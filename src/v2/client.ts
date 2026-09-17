import axios, { AxiosInstance, AxiosError } from 'axios';
import { Config, ClientConfig } from '../config';
import { fetchCredentials, Credentials } from '../auth';
import {
  APIError,
  AuthenticationError,
  BadInputError,
  NotEnoughCreditsError,
  ValidationError,
  CredentialsMissedError,
  BrowserNotSupportedError,
  TimeoutError,
} from '../errors';
import { retryWithBackoff } from '../utils/retry';
import { V2Response } from './types';
import { AgentsResource } from '../agents/resources';

export interface V2ClientConfig extends Omit<ClientConfig, 'apiKey' | 'apiSecret'> {
  credentials?: string; // Single field containing "KEY_ID:KEY_SECRET" format
  apiKey?: string; // Backward compatibility
  apiSecret?: string; // Backward compatibility
}

interface SubscribeOptions<TInput = any> {
  input: TInput;
  webhook?: {
    url: string;
    secret: string;
  };
  withPolling?: boolean;
}

export interface HiggsfieldClient {
  readonly agents: AgentsResource;

  subscribe<TEndpoint extends string>(
    endpoint: TEndpoint,
    options: SubscribeOptions<any>
  ): Promise<V2Response>;

  configure(config: V2ClientConfig): void;
}

interface ClientState {
  config?: Config;
  client?: AxiosInstance;
  credentials?: Credentials;
  agents?: AgentsResource;
}

// Only the unconfigured default client follows module-level config().
// Explicit client instances keep their credentials and cached resources isolated.
const globalState: ClientState = {};

function checkBrowserEnvironment(): void {
  // Check if we're in a browser environment
  const isBrowser = typeof (globalThis as any).window !== 'undefined';
  if (isBrowser) {
    throw new BrowserNotSupportedError();
  }
}

function initializeClient(config?: V2ClientConfig): {
  config: Config;
  client: AxiosInstance;
  credentials: Credentials;
} {
  // Check if running in browser - not allowed
  checkBrowserEnvironment();

  // Parse credentials from single field or separate fields
  let apiKey: string | undefined;
  let apiSecret: string | undefined;

  if (config?.credentials) {
    // Single credentials field in format "KEY_ID:KEY_SECRET"
    const parts = config.credentials.split(':');
    if (parts.length === 2) {
      apiKey = parts[0];
      apiSecret = parts[1];
    } else {
      throw new BadInputError('Credentials must be in format "KEY_ID:KEY_SECRET"');
    }
  } else if (config?.apiKey && config?.apiSecret) {
    // Backward compatibility: separate fields
    apiKey = config.apiKey;
    apiSecret = config.apiSecret;
  }

  // Create config without credentials fields for Config class
  const configForConfig = { ...config };
  delete (configForConfig as any).credentials;

  const cfg = new Config(configForConfig);

  let creds: Credentials;
  if (apiKey && apiSecret) {
    creds = {
      apiKey,
      apiSecret,
    };
  } else {
    // Try to fetch from environment, but don't throw if not found yet
    // (will be initialized when config() is called or on first use)
    try {
      creds = fetchCredentials();
    } catch (error) {
      // If credentials not found, create empty credentials
      // They will be set when config() is called
      creds = {
        apiKey: '',
        apiSecret: '',
      };
    }
  }

  // Build headers object
  const headers: Record<string, string> = {
    Authorization: `Key ${creds.apiKey}:${creds.apiSecret}`,
    'Content-Type': 'application/json',
    ...cfg.headers,
  };

  // Only set User-Agent in Node.js environment (browsers don't allow it)
  // Check if we're in a browser by checking for window object
  // Obfuscate the User-Agent string to avoid exposing it in source
  const isBrowser = typeof (globalThis as any).window !== 'undefined';
  if (!isBrowser && typeof process !== 'undefined' && process.versions?.node) {
    // Obfuscated User-Agent string - constructed at runtime to avoid string literals
    // higgsfield-server-js/2.0
    const uaHeader = String.fromCharCode(85, 115, 101, 114, 45, 65, 103, 101, 110, 116);
    const uaValue = [
      String.fromCharCode(104, 105, 103, 103, 115, 102, 105, 101, 108, 100),
      String.fromCharCode(45),
      String.fromCharCode(115, 101, 114, 118, 101, 114),
      String.fromCharCode(45),
      String.fromCharCode(106, 115),
      String.fromCharCode(47),
      String.fromCharCode(50, 46, 48),
    ].join('');
    headers[uaHeader] = uaValue;
  }

  const axiosClient = axios.create({
    baseURL: cfg.baseURL,
    timeout: cfg.timeout,
    headers,
  });

  axiosClient.interceptors.response.use(
    (response) => {
      return response;
    },
    (
      error: AxiosError<{
        detail?:
          | string
          | Array<{
              type: string;
              loc: string[];
              msg: string;
              input?: any;
              ctx?: Record<string, any>;
            }>;
      }>
    ) => {
      if (error.response?.status === 401) {
        throw new AuthenticationError('Invalid API credentials');
      } else if (error.response?.status === 403) {
        throw new NotEnoughCreditsError();
      } else if (error.response?.status === 422) {
        throw new ValidationError(error.response?.data?.detail);
      } else if (error.response?.status === 400) {
        throw new BadInputError(error.response?.data?.detail);
      }
      if (error.response) {
        throw new APIError(error.message, error.response.status, error.response.data);
      }
      throw error;
    }
  );

  return { config: cfg, client: axiosClient, credentials: creds };
}

async function pollV2Request(
  client: AxiosInstance,
  config: Config,
  requestId: string
): Promise<V2Response> {
  const startTime = Date.now();
  const pollingUrl = `/requests/${requestId}/status`;

  while (true) {
    if (Date.now() - startTime > config.maxPollTime) {
      throw new TimeoutError(
        `Polling exceeded maximum time of ${config.maxPollTime}ms`
      );
    }

    try {
      const response = await client.get<V2Response>(pollingUrl);
      const v2Response = response.data;

      // Check if polling should stop
      if (
        v2Response.status === 'completed' ||
        v2Response.status === 'nsfw' ||
        v2Response.status === 'failed' ||
        v2Response.status === 'canceled'
      ) {
        return v2Response;
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
        // Server error, continue polling
      } else {
        throw error;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollInterval));
  }
}

export function createHiggsfieldClient(
  config?: V2ClientConfig,
  _options?: {
    autoLoadSchemas?: boolean; // Deprecated - kept for backward compatibility
    loadSchemasOnInit?: boolean; // Deprecated - kept for backward compatibility
  }
): HiggsfieldClient {
  const state: ClientState = config ? initializeClient(config) : globalState;

  function ensureInitialized(): void {
    checkBrowserEnvironment();
    if (!state.client || !state.credentials?.apiKey || !state.credentials?.apiSecret) {
      const initialized = initializeClient(state.config);
      if (!initialized.credentials.apiKey || !initialized.credentials.apiSecret) {
        throw new CredentialsMissedError();
      }
      Object.assign(state, initialized, { agents: undefined });
    }
  }

  return {
    get agents(): AgentsResource {
      ensureInitialized();
      state.agents ??= new AgentsResource(state.credentials!, state.config!);
      return state.agents;
    },

    async subscribe<TEndpoint extends string>(
      endpoint: TEndpoint,
      options: SubscribeOptions<any>
    ): Promise<V2Response> {
      ensureInitialized();
      const client = state.client!;
      const clientConfig = state.config!;

      const { input, webhook, withPolling = true } = options;

      // Format endpoint - ensure it starts with / if it's a full path
      let formattedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

      // Build request body - send input directly (not wrapped in params)
      const requestBody: any = { ...input };

      // Add webhook as query parameter if provided
      if (webhook) {
        const webhookParam = encodeURIComponent(webhook.url);
        const separator = formattedEndpoint.includes('?') ? '&' : '?';
        formattedEndpoint = `${formattedEndpoint}${separator}hf_webhook=${webhookParam}`;
      }

      const response = await retryWithBackoff(
        () => {
          return client.post<V2Response>(formattedEndpoint, requestBody);
        },
        {
          maxRetries: clientConfig.maxRetries,
          backoff: clientConfig.retryBackoff,
          maxBackoff: clientConfig.retryMaxBackoff,
        }
      );

      let v2Response: V2Response = response.data;

      // Poll for completion if requested
      if (withPolling && v2Response.request_id) {
        v2Response = await pollV2Request(client, clientConfig, v2Response.request_id);
      }

      return v2Response;
    },

    configure(config: V2ClientConfig): void {
      // Check if running in browser - not allowed
      checkBrowserEnvironment();

      Object.assign(state, initializeClient(config), { agents: undefined });
    },
  };
}

export function configure(config: V2ClientConfig): void {
  Object.assign(globalState, initializeClient(config), { agents: undefined });
}

export function reset(): void {
  globalState.config = undefined;
  globalState.client = undefined;
  globalState.credentials = undefined;
  globalState.agents = undefined;
}

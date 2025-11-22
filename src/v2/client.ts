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
} from '../errors';
import { JobSet } from '../models/JobSet';
import { retryWithBackoff } from '../utils/retry';

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
  subscribe<TEndpoint extends string>(
    endpoint: TEndpoint,
    options: SubscribeOptions<any>
  ): Promise<JobSet>;

  configure(config: V2ClientConfig): void;
}

let globalConfig: Config | undefined;
let globalClient: AxiosInstance | undefined;
let globalCredentials: Credentials | undefined;

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

export function createHiggsfieldClient(
  config?: V2ClientConfig,
  _options?: {
    autoLoadSchemas?: boolean; // Deprecated - kept for backward compatibility
    loadSchemasOnInit?: boolean; // Deprecated - kept for backward compatibility
  }
): HiggsfieldClient {
  // Store config for lazy initialization
  // Only initialize if config is provided, otherwise wait for config() call or first use
  if (config && (!globalConfig || !globalClient)) {
    const { config: cfg, client, credentials } = initializeClient(config);
    globalConfig = cfg;
    globalClient = client;
    globalCredentials = credentials;
  }

  return {
    async subscribe<TEndpoint extends string>(
      endpoint: TEndpoint,
      options: SubscribeOptions<any>
    ): Promise<JobSet> {
      // Ensure client is initialized with credentials
      if (
        !globalClient ||
        !globalCredentials ||
        !globalCredentials.apiKey ||
        !globalCredentials.apiSecret
      ) {
        try {
          const envCreds = fetchCredentials();
          if (envCreds.apiKey && envCreds.apiSecret) {
            const {
              config: cfg,
              client,
              credentials,
            } = initializeClient({ credentials: `${envCreds.apiKey}:${envCreds.apiSecret}` });
            globalConfig = cfg;
            globalClient = client;
            globalCredentials = credentials;
          } else {
            throw new CredentialsMissedError();
          }
        } catch (error) {
          throw new CredentialsMissedError();
        }
      }

      if (!globalClient || !globalConfig) {
        throw new CredentialsMissedError();
      }

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
          return globalClient!.post(formattedEndpoint, requestBody);
        },
        {
          maxRetries: globalConfig.maxRetries,
          backoff: globalConfig.retryBackoff,
          maxBackoff: globalConfig.retryMaxBackoff,
        }
      );

      // Transform v2 API response format to JobSet format
      const v2Response = response.data;
      const jobSetData = {
        id: v2Response.request_id || v2Response.id,
        jobs: v2Response.jobs || [
          {
            id: v2Response.request_id || v2Response.id || '',
            status: v2Response.status || 'queued',
            results: v2Response.results || null,
          },
        ],
      };

      const jobSet = new JobSet(jobSetData);

      if (withPolling) {
        await jobSet.pollV2(globalClient, globalConfig);
      }

      return jobSet;
    },

    configure(config: V2ClientConfig): void {
      // Check if running in browser - not allowed
      checkBrowserEnvironment();

      const { config: cfg, client, credentials } = initializeClient(config);
      globalConfig = cfg;
      globalClient = client;
      globalCredentials = credentials;
    },
  };
}

export function configure(config: V2ClientConfig): void {
  // Check if running in browser - not allowed
  checkBrowserEnvironment();

  if (!globalConfig || !globalClient) {
    const { config: cfg, client, credentials } = initializeClient(config);
    globalConfig = cfg;
    globalClient = client;
    globalCredentials = credentials;
  } else {
    const { config: cfg, client, credentials } = initializeClient(config);
    globalConfig = cfg;
    globalClient = client;
    globalCredentials = credentials;
  }
}

export function reset(): void {
  globalConfig = undefined as any;
  globalClient = undefined as any;
  globalCredentials = undefined as any;
}

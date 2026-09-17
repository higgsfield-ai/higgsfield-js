/**
 * Agent API namespace: `client.agents.sessions` / `client.agents.media`.
 *
 * Uses V2 credentials and a separate error mapper: HTTP 403 means agent
 * access is disabled. Mutating agent requests are never automatically retried.
 */
import axios, { AxiosError, AxiosInstance } from 'axios';

import { Credentials } from '../auth';
import { Config } from '../config';
import { APIError, HiggsfieldError, NotEnoughCreditsError } from '../errors';
import {
  AgentAccessDeniedError,
  AgentBackendError,
  AgentTimeoutError,
  SessionBusyError,
} from './errors';
import {
  AgentSession,
  MediaType,
  MediaUploadSlot,
  RunOptions,
  SessionState,
  TurnResult,
  toTurnResult,
} from './types';

export const AGENT_API_URL = 'https://api.higgsfield.ai';

const POLL_INITIAL_MS = 2000;
const POLL_MAX_MS = 10000;
const POLL_BACKOFF = 1.5;
const DEFAULT_TURN_TIMEOUT_MS = 30 * 60 * 1000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function mapAgentError(error: AxiosError<{ detail?: string }>): never {
  const status = error.response?.status;
  const detail = error.response?.data?.detail;
  if (status === 403) throw new AgentAccessDeniedError();
  if (status === 409) throw new SessionBusyError();
  if (status === 402) throw new NotEnoughCreditsError();
  if (status !== undefined && status >= 500) throw new AgentBackendError(status, detail);
  if (status !== undefined) {
    throw new APIError(error.message, status, error.response?.data);
  }
  throw error;
}

/** Decide whether the turn that started with `userMessageId` is done. The
 *  poll uses `after=<user message id>`, so every assistant row in the slice
 *  belongs to this turn (or its resume). */
function turnOutcome(state: SessionState): TurnResult | null {
  const assistants = state.messages.filter((m) => m.role === 'assistant');
  for (let i = assistants.length - 1; i >= 0; i--) {
    const m = assistants[i];
    if (m.status === 'completed' || m.status === 'failed') {
      return toTurnResult(m.status, m);
    }
  }
  if (state.status === 'awaiting_input') {
    return toTurnResult('awaiting_input', assistants[assistants.length - 1] ?? null);
  }
  return null;
}

export class Sessions {
  constructor(private readonly client: AxiosInstance) {}

  async create(config?: Record<string, unknown>): Promise<AgentSession> {
    const { data } = await this.client.post<AgentSession>('/v1/agent/sessions', {
      config: config ?? {},
    });
    return data;
  }

  /** Submit one message; returns its message_id (the turn runs async). */
  async send(sessionId: string, content: string): Promise<string> {
    const { data } = await this.client.post<{ message_id: string }>(
      `/v1/agent/sessions/${sessionId}/messages`,
      { content }
    );
    return data.message_id;
  }

  async messages(sessionId: string, after?: string): Promise<SessionState> {
    const { data } = await this.client.get<SessionState>(
      `/v1/agent/sessions/${sessionId}/messages`,
      { params: after ? { after } : undefined }
    );
    return data;
  }

  async interrupt(sessionId: string): Promise<void> {
    await this.client.post(`/v1/agent/sessions/${sessionId}/interrupt`);
  }

  /**
   * Send a message and poll until the turn ends (backoff 2s -> 10s).
   *
   * If the agent asks a clarifying question and `onQuestion` is given, the
   * answer is sent and polling continues; without a handler the question
   * resolves as `{status: "awaiting_input", text: <question>}`.
   */
  async run(sessionId: string, content: string, options: RunOptions = {}): Promise<TurnResult> {
    const timeout = options.timeout ?? DEFAULT_TURN_TIMEOUT_MS;
    const deadline = Date.now() + timeout;
    let messageId = await this.send(sessionId, content);
    let delay = POLL_INITIAL_MS;

    for (;;) {
      if (Date.now() > deadline) {
        throw new AgentTimeoutError(
          `turn did not finish within ${Math.round(timeout / 1000)}s ` +
            `(session ${sessionId}); it keeps running server-side`
        );
      }
      await sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
      delay = Math.min(delay * POLL_BACKOFF, POLL_MAX_MS);

      const state = await this.messages(sessionId, messageId);
      const outcome = turnOutcome(state);
      if (outcome === null) {
        continue;
      }
      if (outcome.status === 'awaiting_input' && options.onQuestion) {
        const answer = await options.onQuestion(outcome.text);
        messageId = await this.send(sessionId, answer);
        delay = POLL_INITIAL_MS;
        continue;
      }
      return outcome;
    }
  }
}

export class Media {
  constructor(
    private readonly client: AxiosInstance,
    private readonly timeout: number
  ) {}

  /** Upload input bytes for the agent; returns the CDN URL to reference in
   *  message content. */
  async upload(
    data: Buffer | Uint8Array,
    extension: string,
    type: MediaType = 'image'
  ): Promise<string> {
    const { data: slot } = await this.client.post<MediaUploadSlot>('/v1/agent/media', {
      extension,
      type,
    });
    // Presigned PUT: a bare request — auth headers would break the signature.
    await axios.put(slot.upload_url, data, {
      headers: { 'Content-Type': slot.content_type },
      maxBodyLength: Infinity,
      timeout: this.timeout,
    });
    const { data: confirmation } = await this.client.post<{ status: string }>(
      `/v1/agent/media/${slot.id}/confirm`,
      { type }
    );
    if (confirmation.status !== 'uploaded') {
      throw new HiggsfieldError('Agent media upload has not been confirmed by the server');
    }
    return slot.url;
  }
}

export class AgentsResource {
  readonly sessions: Sessions;
  readonly media: Media;

  constructor(credentials: Credentials, config: Config) {
    const client = axios.create({
      baseURL: config.agentBaseURL ?? AGENT_API_URL,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${credentials.apiKey}:${credentials.apiSecret}`,
        'User-Agent': 'higgsfield-server-js/2.0',
        ...config.headers,
      },
      timeout: config.timeout,
    });
    client.interceptors.response.use((response) => response, mapAgentError);
    this.sessions = new Sessions(client);
    this.media = new Media(client, config.timeout);
  }
}

export type SessionStatus = 'idle' | 'processing' | 'awaiting_input' | 'terminated';
export type MessageStatus = 'processing' | 'completed' | 'failed';
export type MediaType = 'image' | 'video' | 'audio' | 'file';

/** One row of the session transcript, as returned by the API. */
export interface AgentMessageRow {
  message_id: string;
  role: 'user' | 'assistant';
  status: MessageStatus;
  /** User rows: `{type: "text", text}`; assistant rows: structured message with `parts`. */
  message: unknown;
  created_at: string;
  /** Actual LLM cost of the turn in USD (user rows; null/absent = flat charge). */
  llm_cost_usd?: string | null;
}

export interface SessionState {
  status: SessionStatus;
  messages: AgentMessageRow[];
}

export interface AgentSession {
  session_id: string;
  status: SessionStatus;
}

export interface MediaUploadSlot {
  id: string;
  type: MediaType;
  content_type: string;
  upload_url: string;
  url: string;
}

export interface TurnResult {
  status: 'completed' | 'failed' | 'awaiting_input';
  message: AgentMessageRow | null;
  /** Plain text of the agent's answer (text parts joined). */
  text: string;
  /** URLs the agent included in its answer (generated assets, uploads). */
  assetUrls: string[];
}

export interface RunOptions {
  /** Answer the agent's clarifying question; without it, `run()` resolves
   *  with `status: "awaiting_input"` and the question in `text`. */
  onQuestion?: (question: string) => string | Promise<string>;
  /** Overall turn deadline in ms (default 30 min). The turn keeps running
   *  server-side after a timeout. */
  timeout?: number;
}

const URL_RE = /https?:\/\/[^\s)\]>"']+/g;

/** Plain text of a transcript row: user rows carry `{text}`, assistant rows
 *  carry structured `parts` where only `type === "text"` blocks are the
 *  answer (reasoning/tool parts are agent internals). */
export function messageText(row: AgentMessageRow): string {
  const body = row.message as Record<string, unknown> | null;
  if (body === null || typeof body !== 'object') {
    return '';
  }
  if (typeof body.text === 'string') {
    return body.text;
  }
  const parts = body.parts;
  if (!Array.isArray(parts)) {
    return '';
  }
  return parts
    .filter(
      (p): p is { type: string; text: string } =>
        typeof p === 'object' &&
        p !== null &&
        (p as { type?: unknown }).type === 'text' &&
        typeof (p as { text?: unknown }).text === 'string'
    )
    .map((p) => p.text)
    .join('\n');
}

export function assetUrlsOf(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.match(URL_RE) ?? []) {
    seen.add(raw.replace(/[.,;]+$/, ''));
  }
  return [...seen];
}

export function toTurnResult(
  status: TurnResult['status'],
  message: AgentMessageRow | null
): TurnResult {
  const text = message ? messageText(message) : '';
  return { assetUrls: assetUrlsOf(text), message, status, text };
}

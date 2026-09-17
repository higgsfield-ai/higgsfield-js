import { APIError, HiggsfieldError } from '../errors';

export class AgentAccessDeniedError extends APIError {
  constructor() {
    super(
      'Agent API is not enabled for your account. Contact support@higgsfield.ai to request access.',
      403
    );
    this.name = 'AgentAccessDeniedError';
  }
}

export class SessionBusyError extends APIError {
  constructor() {
    super('A turn is already running on this session. Wait for it to finish or interrupt it.', 409);
    this.name = 'SessionBusyError';
  }
}

export class AgentBackendError extends APIError {
  constructor(statusCode: number, detail?: string) {
    super(`Agent backend unavailable (${statusCode})${detail ? `: ${detail}` : ''}`, statusCode);
    this.name = 'AgentBackendError';
  }
}

export class AgentTimeoutError extends HiggsfieldError {
  constructor(message: string) {
    super(message);
    this.name = 'AgentTimeoutError';
  }
}

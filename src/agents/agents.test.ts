import { AgentAccessDeniedError, SessionBusyError } from './errors';
import { Sessions } from './resources';
import { AgentMessageRow, messageText, assetUrlsOf } from './types';

jest.mock('axios');

const SID = '50eeb94c-c396-439d-b504-aee2147b7ec0';

function assistantRow(
  text: string,
  status: 'completed' | 'processing' = 'completed'
): AgentMessageRow {
  return {
    created_at: '2026-09-01T00:00:01Z',
    message: {
      id: 'a1',
      parts: [
        { type: 'step-start' },
        { state: 'done', text: 'hidden', type: 'reasoning' },
        { text, type: 'text' },
      ],
      role: 'assistant',
    },
    message_id: 'a1',
    role: 'assistant',
    status,
  };
}

function makeSessions(handlers: { post?: jest.Mock; get?: jest.Mock }): Sessions {
  const client = {
    get: handlers.get ?? jest.fn(),
    post: handlers.post ?? jest.fn(),
  };
  return new Sessions(client as never);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

async function runWithTimers<T>(promise: Promise<T>): Promise<T> {
  // Drain the poll loop's sleeps deterministically.
  const result = promise.catch((e) => {
    throw e;
  });
  for (let i = 0; i < 50; i++) {
    await jest.advanceTimersByTimeAsync(10000);
  }
  return result;
}

describe('agents sessions', () => {
  it('run() resolves the completed turn with text and asset URLs', async () => {
    let polls = 0;
    const post = jest.fn().mockResolvedValue({ data: { message_id: 'u1', status: 'processing' } });
    const get = jest.fn().mockImplementation(() => {
      polls += 1;
      if (polls === 1) {
        return Promise.resolve({ data: { messages: [], status: 'processing' } });
      }
      return Promise.resolve({
        data: { messages: [assistantRow('Done: https://cdn.test/a.png.')], status: 'idle' },
      });
    });

    const result = await runWithTimers(makeSessions({ get, post }).run(SID, 'make an image'));
    expect(result.status).toBe('completed');
    expect(result.text).toBe('Done: https://cdn.test/a.png.');
    expect(result.assetUrls).toEqual(['https://cdn.test/a.png']);
    expect(get).toHaveBeenCalledWith(`/v1/agent/sessions/${SID}/messages`, {
      params: { after: 'u1' },
    });
  });

  it('run() answers a question through onQuestion and continues', async () => {
    const sent: string[] = [];
    const post = jest.fn().mockImplementation((_url: string, body: { content: string }) => {
      sent.push(body.content);
      return Promise.resolve({ data: { message_id: `u${sent.length}`, status: 'processing' } });
    });
    const get = jest
      .fn()
      .mockImplementation((_url: string, opts: { params: { after: string } }) => {
        if (opts.params.after === 'u1') {
          return Promise.resolve({
            data: {
              messages: [assistantRow('Which style?', 'processing')],
              status: 'awaiting_input',
            },
          });
        }
        return Promise.resolve({
          data: { messages: [assistantRow('photoreal it is')], status: 'idle' },
        });
      });

    const result = await runWithTimers(
      makeSessions({ get, post }).run(SID, 'make an image', {
        onQuestion: (q) => `answer to: ${q}`,
      })
    );
    expect(sent).toEqual(['make an image', 'answer to: Which style?']);
    expect(result.status).toBe('completed');
  });

  it('run() without a handler resolves as awaiting_input with the question', async () => {
    const post = jest.fn().mockResolvedValue({ data: { message_id: 'u1', status: 'processing' } });
    const get = jest.fn().mockResolvedValue({
      data: { messages: [assistantRow('Which style?', 'processing')], status: 'awaiting_input' },
    });

    const result = await runWithTimers(makeSessions({ get, post }).run(SID, 'make an image'));
    expect(result.status).toBe('awaiting_input');
    expect(result.text).toBe('Which style?');
  });

  it('typed agent errors carry actionable messages', () => {
    expect(new SessionBusyError().message).toMatch(/already running/);
    expect(new AgentAccessDeniedError().message).toMatch(/not enabled for your account/);
  });
});

describe('message parsing', () => {
  it('extracts user text and joins assistant text parts only', () => {
    const user: AgentMessageRow = {
      created_at: '',
      message: { text: 'hello', type: 'text' },
      message_id: 'u1',
      role: 'user',
      status: 'completed',
    };
    expect(messageText(user)).toBe('hello');
    expect(messageText(assistantRow('the answer'))).toBe('the answer');
  });

  it('strips trailing punctuation from asset URLs and dedupes', () => {
    expect(assetUrlsOf('see https://cdn.test/a.png. and https://cdn.test/a.png')).toEqual([
      'https://cdn.test/a.png',
    ]);
  });
});

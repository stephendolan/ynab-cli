import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('readline', () => ({
  createInterface: vi.fn(),
}));

vi.mock('../lib/auth.js', () => ({
  auth: { setAccessToken: vi.fn(), deleteAccessToken: vi.fn() },
}));

vi.mock('../lib/api-client.js', () => ({
  client: { checkAuthentication: vi.fn(), clearApi: vi.fn(), getUser: vi.fn() },
}));

vi.mock('../lib/output.js', () => ({
  outputJson: vi.fn(),
}));

import { createInterface } from 'readline';
import { auth } from '../lib/auth.js';
import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { createAuthCommand } from './auth.js';

const mockCheckAuthentication = client.checkAuthentication as ReturnType<typeof vi.fn>;
const mockOutputJson = outputJson as ReturnType<typeof vi.fn>;

describe('ynab auth login', () => {
  const originalIsTTY = Object.getOwnPropertyDescriptor(process.stdin, 'isTTY');

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(process.stdin, 'isTTY', { configurable: true, value: true });
    vi.mocked(client.getUser).mockResolvedValue({ id: 'user-id' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalIsTTY) {
      Object.defineProperty(process.stdin, 'isTTY', originalIsTTY);
    } else {
      Reflect.deleteProperty(process.stdin, 'isTTY');
    }
  });

  it('passes the visible token prompt to readline and trims the answer', async () => {
    const close = vi.fn();
    const question = vi.fn((_query: string, callback: (answer: string) => void) => {
      callback('  test-token  ');
    });
    vi.mocked(createInterface).mockReturnValue({ question, close } as unknown as ReturnType<typeof createInterface>);

    await createAuthCommand().parseAsync(['node', 'auth', 'login']);

    expect(createInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stderr,
    });
    expect(question).toHaveBeenCalledWith('Enter YNAB Personal Access Token: ', expect.any(Function));
    expect(close).toHaveBeenCalledOnce();
    expect(auth.setAccessToken).toHaveBeenCalledWith('test-token');
    expect(mockOutputJson).toHaveBeenCalledWith({
      message: 'Successfully authenticated',
      user: { id: 'user-id' },
    });
  });
});

describe('ynab auth status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function runStatus() {
    await createAuthCommand().parseAsync(['node', 'auth', 'status']);
  }

  it('renders only the authenticated user ID for a valid credential', async () => {
    mockCheckAuthentication.mockResolvedValue({
      authenticated: true,
      credentialPresent: true,
      user: { id: 'user-id', name: 'Jane Doe' },
      token: 'valid-test-token',
    });

    await runStatus();

    expect(mockOutputJson).toHaveBeenCalledWith({
      authenticated: true,
      user: { id: 'user-id' },
    });
    expect(JSON.stringify(mockOutputJson.mock.calls)).not.toContain('valid-test-token');
  });

  it('renders the invalid-token message without exposing the token', async () => {
    mockCheckAuthentication.mockResolvedValue({
      authenticated: false,
      credentialPresent: true,
      token: 'invalid-test-token',
    });

    await runStatus();

    expect(mockOutputJson).toHaveBeenCalledWith({
      authenticated: false,
      message: 'Token exists but is invalid',
    });
    expect(JSON.stringify(mockOutputJson.mock.calls)).not.toContain('invalid-test-token');
  });

  it('renders the missing-credential message', async () => {
    mockCheckAuthentication.mockResolvedValue({
      authenticated: false,
      credentialPresent: false,
    });

    await runStatus();

    expect(mockOutputJson).toHaveBeenCalledWith({
      authenticated: false,
      message: 'Not authenticated',
    });
  });
});

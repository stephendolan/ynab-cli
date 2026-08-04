import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api-client.js', () => ({
  client: { checkAuthentication: vi.fn() },
}));

vi.mock('../lib/output.js', () => ({
  outputJson: vi.fn(),
}));

import { client } from '../lib/api-client.js';
import { outputJson } from '../lib/output.js';
import { createAuthCommand } from './auth.js';

const mockCheckAuthentication = client.checkAuthentication as ReturnType<typeof vi.fn>;
const mockOutputJson = outputJson as ReturnType<typeof vi.fn>;

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

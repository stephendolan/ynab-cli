import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/api-client.js', () => ({
  client: { checkAuthentication: vi.fn() },
}));

import { client } from '../lib/api-client.js';
import { checkAuth } from './server.js';

const mockCheckAuthentication = client.checkAuthentication as ReturnType<typeof vi.fn>;

describe('MCP check_auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('serializes a validated authenticated status without exposing a token', async () => {
    mockCheckAuthentication.mockResolvedValue({
      authenticated: true,
      credentialPresent: true,
      user: { id: 'user-id' },
      token: 'valid-test-token',
    });

    const result = await checkAuth();

    expect(mockCheckAuthentication).toHaveBeenCalledOnce();
    expect(JSON.parse(result.content[0].text)).toEqual({ authenticated: true });
    expect(result.content[0].text).not.toContain('valid-test-token');
  });

  it('serializes an unauthenticated status without exposing a token', async () => {
    mockCheckAuthentication.mockResolvedValue({
      authenticated: false,
      credentialPresent: true,
      token: 'invalid-test-token',
    });

    const result = await checkAuth();

    expect(mockCheckAuthentication).toHaveBeenCalledOnce();
    expect(JSON.parse(result.content[0].text)).toEqual({ authenticated: false });
    expect(result.content[0].text).not.toContain('invalid-test-token');
  });
});

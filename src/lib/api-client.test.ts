import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('ynab', () => ({ API: vi.fn() }));

vi.mock('./auth.js', () => ({
  auth: { resolveCredential: vi.fn() },
}));

import * as ynab from 'ynab';
import { auth } from './auth.js';
import { YnabClient } from './api-client.js';

const mockApiConstructor = ynab.API as unknown as ReturnType<typeof vi.fn>;
const mockGetUser = vi.fn();
const mockResolveCredential = auth.resolveCredential as ReturnType<typeof vi.fn>;

describe('YnabClient authentication status', () => {
  const validToken = 'valid-test-token';

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-id' } } });
    mockApiConstructor.mockImplementation(function () {
      return { user: { getUser: mockGetUser } };
    });
  });

  it('returns authenticated for a valid keychain token', async () => {
    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'keychain' });

    const status = await new YnabClient().checkAuthentication();

    expect(status).toEqual({
      authenticated: true,
      credentialPresent: true,
      user: { id: 'user-id' },
    });
    expect(mockApiConstructor).toHaveBeenCalledWith(validToken);
  });

  it('returns authenticated for a valid YNAB_API_KEY', async () => {
    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'environment' });

    const status = await new YnabClient().checkAuthentication();

    expect(status.authenticated).toBe(true);
    expect(mockApiConstructor).toHaveBeenCalledWith(validToken);
  });

  it('returns unauthenticated for an invalid YNAB_API_KEY', async () => {
    mockResolveCredential.mockResolvedValue({ token: 'invalid-test-token', source: 'environment' });
    mockGetUser.mockRejectedValue({
      error: { id: '401', name: 'unauthorized', detail: 'Unauthorized' },
    });

    const status = await new YnabClient().checkAuthentication();

    expect(status).toEqual({ authenticated: false, credentialPresent: true });
  });

  it('propagates network failures', async () => {
    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'keychain' });
    mockGetUser.mockRejectedValue(new TypeError('fetch failed'));

    await expect(new YnabClient().checkAuthentication()).rejects.toThrow('fetch failed');
  });

  it('propagates rate limit failures', async () => {
    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'keychain' });
    const rateLimitError = {
      error: { id: '429', name: 'too_many_requests', detail: 'Too many requests' },
    };
    mockGetUser.mockRejectedValue(rateLimitError);

    await expect(new YnabClient().checkAuthentication()).rejects.toEqual(rateLimitError);
  });

  it('uses the validated API instance after credential rotation', async () => {
    const client = new YnabClient();
    mockResolveCredential.mockResolvedValue({ token: 'first-token', source: 'keychain' });

    await client.checkAuthentication();

    mockResolveCredential.mockResolvedValue({ token: 'second-token', source: 'keychain' });
    await client.checkAuthentication();
    await client.getUser();

    expect(mockApiConstructor).toHaveBeenCalledTimes(2);
    expect(mockApiConstructor).toHaveBeenLastCalledWith('second-token');
  });

  it('returns unauthenticated without making a request when no credential exists', async () => {
    mockResolveCredential.mockResolvedValue(null);

    const status = await new YnabClient().checkAuthentication();

    expect(status).toEqual({ authenticated: false, credentialPresent: false });
    expect(mockApiConstructor).not.toHaveBeenCalled();
    expect(mockGetUser).not.toHaveBeenCalled();
  });

  it('clears the cached API when no credential exists', async () => {
    const client = new YnabClient();
    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'keychain' });

    await client.checkAuthentication();

    mockResolveCredential.mockResolvedValue(null);
    await expect(client.getApi()).rejects.toMatchObject({ statusCode: 401 });

    mockResolveCredential.mockResolvedValue({ token: validToken, source: 'keychain' });
    await client.getUser();

    expect(mockApiConstructor).toHaveBeenCalledTimes(2);
  });
});

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const mockEntry = {
  getPassword: vi.fn(),
  setPassword: vi.fn(),
  deletePassword: vi.fn(),
};

vi.mock('@napi-rs/keyring', () => ({
  Entry: function () {
    return mockEntry;
  },
}));

import { AuthManager, resetKeyringForTesting } from './auth.js';
import { config } from './config.js';

describe('AuthManager', () => {
  let auth: AuthManager;
  const originalApiKey = process.env.YNAB_API_KEY;
  const testToken = 'test-token-abc123';
  const updatedToken = 'test-token-xyz789';

  beforeEach(() => {
    vi.clearAllMocks();
    resetKeyringForTesting();
    mockEntry.getPassword.mockReturnValue(null);
    mockEntry.deletePassword.mockReturnValue(false);
    delete process.env.YNAB_API_KEY;
    auth = new AuthManager();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.YNAB_API_KEY;
    } else {
      process.env.YNAB_API_KEY = originalApiKey;
    }
    config.clearDefaultBudget();
  });

  describe('token management', () => {
    it('should store and retrieve access token', async () => {
      mockEntry.getPassword.mockReturnValue(testToken);

      await auth.setAccessToken(testToken);
      const retrieved = await auth.getAccessToken();

      expect(retrieved).toBe(testToken);
    });

    it('should return null when no token stored', async () => {
      const token = await auth.getAccessToken();
      expect(token).toBe(null);
    });

    it('should update existing token', async () => {
      mockEntry.getPassword.mockReturnValue(updatedToken);

      await auth.setAccessToken(testToken);
      await auth.setAccessToken(updatedToken);

      const retrieved = await auth.getAccessToken();
      expect(retrieved).toBe(updatedToken);
    });

    it('should delete token and return true', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      const result = await auth.deleteAccessToken();

      expect(result).toBe(true);
    });

    it('should return false when deleting non-existent token', async () => {
      const result = await auth.deleteAccessToken();
      expect(result).toBe(false);
    });

    it('should throw error when keyring setPassword fails', async () => {
      mockEntry.setPassword.mockImplementation(() => {
        throw new Error('Secret Service: no result found');
      });

      await expect(auth.setAccessToken(testToken)).rejects.toThrow(
        /Failed to store token in keychain/
      );
    });
  });

  describe('credential resolution', () => {
    it('should resolve a keychain token', async () => {
      mockEntry.getPassword.mockReturnValue(testToken);

      const credential = await auth.resolveCredential();

      expect(credential).toEqual({ token: testToken, source: 'keychain' });
    });

    it('should resolve YNAB_API_KEY', async () => {
      process.env.YNAB_API_KEY = testToken;

      const credential = await auth.resolveCredential();

      expect(credential).toEqual({ token: testToken, source: 'environment' });
    });

    it('should prefer a keychain token over YNAB_API_KEY', async () => {
      mockEntry.getPassword.mockReturnValue(testToken);
      process.env.YNAB_API_KEY = updatedToken;

      const credential = await auth.resolveCredential();

      expect(credential).toEqual({ token: testToken, source: 'keychain' });
    });

    it('should return null when no credential is configured', async () => {
      const credential = await auth.resolveCredential();

      expect(credential).toBe(null);
    });

    it('should return null after token deletion', async () => {
      mockEntry.deletePassword.mockReturnValue(true);

      await auth.deleteAccessToken();
      const credential = await auth.resolveCredential();

      expect(credential).toBe(null);
    });
  });

  describe('logout', () => {
    it('should remove token and clear default budget', async () => {
      config.setDefaultBudget('test-budget-id');

      await auth.logout();

      expect(config.getDefaultBudget()).toBeUndefined();
    });
  });
});

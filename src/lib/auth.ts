import { Entry } from '@napi-rs/keyring';
import { config } from './config.js';

const SERVICE_NAME = 'ynab-cli';
const ACCOUNT_NAME = 'access-token';

const KEYRING_UNAVAILABLE_ERROR =
  'Keychain storage unavailable. Cannot store credentials securely.\n' +
  'On Linux, install libsecret: sudo apt-get install libsecret-1-dev\n' +
  'Then reinstall: bun install -g @stephendolan/ynab-cli\n' +
  'Alternatively, use the YNAB_API_KEY environment variable.';

let keyring: Entry | null | undefined = undefined;

function getKeyring(): Entry | null {
  if (keyring !== undefined) {
    return keyring;
  }
  try {
    keyring = new Entry(SERVICE_NAME, ACCOUNT_NAME);
  } catch {
    keyring = null;
  }
  return keyring;
}

export function resetKeyringForTesting(): void {
  keyring = undefined;
}

export class AuthManager {
  async getAccessToken(): Promise<string | null> {
    const entry = getKeyring();
    if (entry) {
      try {
        return entry.getPassword();
      } catch {
        return null;
      }
    }
    return null;
  }

  async setAccessToken(token: string): Promise<void> {
    const entry = getKeyring();
    if (!entry) {
      throw new Error(KEYRING_UNAVAILABLE_ERROR);
    }
    try {
      entry.setPassword(token);
    } catch (error) {
      throw new Error(
        `Failed to store token in keychain: ${error instanceof Error ? error.message : error}\n\n` +
          'On Linux, ensure the Secret Service is running and unlocked.\n' +
          'Try: gnome-keyring-daemon --unlock\n' +
          'Or use the YNAB_API_KEY environment variable instead.'
      );
    }
  }

  async deleteAccessToken(): Promise<boolean> {
    const entry = getKeyring();
    if (entry) {
      return entry.deletePassword();
    }
    return false;
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.getAccessToken()) !== null;
  }

  async logout(): Promise<void> {
    await this.deleteAccessToken();
    config.clearDefaultBudget();
  }
}

export const auth = new AuthManager();

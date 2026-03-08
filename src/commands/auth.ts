import { Command } from 'commander';
import { createInterface } from 'readline';
import { auth } from '../lib/auth.js';
import { outputJson } from '../lib/output.js';
import { client } from '../lib/api-client.js';
import { withErrorHandling } from '../lib/command-utils.js';
import { YnabCliError } from '../lib/errors.js';

function readTokenFromStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data.trim()));
    process.stdin.on('error', reject);
  });
}

function promptForToken(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    process.stderr.write('Enter YNAB Personal Access Token: ');
    rl.question('', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export function createAuthCommand(): Command {
  const cmd = new Command('auth').description('Authentication management');

  cmd
    .command('login')
    .description('Configure access token')
    .option('-t, --token <token>', 'YNAB Personal Access Token')
    .action(
      withErrorHandling(async (options: { token?: string }) => {
        let token: string;

        if (options.token) {
          token = options.token.trim();
        } else if (!process.stdin.isTTY) {
          token = await readTokenFromStdin();
        } else {
          token = await promptForToken();
        }

        if (!token) {
          throw new YnabCliError('Access token cannot be empty', 400);
        }
        await auth.setAccessToken(token);
        client.clearApi();

        try {
          const user = await client.getUser();
          outputJson({
            message: 'Successfully authenticated',
            user: { id: user?.id },
          });
        } catch (error) {
          await auth.deleteAccessToken();
          client.clearApi();
          throw error;
        }
      })
    );

  cmd
    .command('status')
    .description('Check authentication status')
    .action(
      withErrorHandling(async () => {
        const isAuthenticated = await auth.isAuthenticated();

        if (!isAuthenticated) {
          outputJson({ authenticated: false, message: 'Not authenticated' });
          return;
        }

        try {
          const user = await client.getUser();
          outputJson({ authenticated: true, user: { id: user?.id } });
        } catch {
          outputJson({ authenticated: false, message: 'Token exists but is invalid' });
        }
      })
    );

  cmd
    .command('logout')
    .description('Remove stored credentials')
    .action(
      withErrorHandling(async () => {
        await auth.logout();
        client.clearApi();
        outputJson({ message: 'Successfully logged out' });
      })
    );

  return cmd;
}

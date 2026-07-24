import { describe, it, expect } from 'vitest';
import { PassThrough } from 'stream';
import { promptForToken, readTokenFromStdin } from './auth.js';

describe('promptForToken', () => {
  it('emits the prompt as part of readline (not a bare pre-write)', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let captured = '';
    output.on('data', (chunk) => {
      captured += chunk.toString();
    });

    const promise = promptForToken(input, output);
    input.write('my-secret-token\n');
    const token = await promise;

    expect(token).toBe('my-secret-token');
    // Regression: prompt must reach output via readline so it isn't cleared off (Warp).
    expect(captured).toContain('Enter YNAB Personal Access Token:');
  });

  it('trims surrounding whitespace from the entered token', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const promise = promptForToken(input, output);
    input.write('  padded-token  \n');
    await expect(promise).resolves.toBe('padded-token');
  });
});

describe('readTokenFromStdin', () => {
  it('resolves with the trimmed token when piped in', async () => {
    const stdin = new PassThrough();
    const promise = readTokenFromStdin(stdin);
    stdin.write('  piped-token\n');
    stdin.end();
    await expect(promise).resolves.toBe('piped-token');
  });

  it('resolves empty when stdin closes without data', async () => {
    const stdin = new PassThrough();
    const promise = readTokenFromStdin(stdin);
    stdin.end();
    await expect(promise).resolves.toBe('');
  });

  it('rejects when the stream errors', async () => {
    const stdin = new PassThrough();
    const promise = readTokenFromStdin(stdin);
    const boom = new Error('stream boom');
    stdin.emit('error', boom);
    await expect(promise).rejects.toBe(boom);
  });
});

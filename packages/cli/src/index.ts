#!/usr/bin/env node
import { Buffer } from 'node:buffer';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createNoteUrlHashFragment, decryptNote, encryptNote, parseNoteUrl } from '@secreto/lib';
import chalk from 'chalk';
import { Command } from 'commander';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Read version from package.json — walk up from dist/ or src/
function getVersion(): string {
  try {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { version: string };
    return pkg.version;
  } catch {
    return '0.1.0';
  }
}

const DEFAULT_INSTANCE_URL = 'https://secreto.info';

// Instance can be overridden for self-hosted deployments, by flag or environment.
function resolveInstanceUrl(instance?: string): string {
  const raw = instance ?? process.env.SECRETO_INSTANCE_URL ?? DEFAULT_INSTANCE_URL;
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    console.error(chalk.red(`Invalid instance URL: ${raw}`));
    process.exit(1);
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    console.error(chalk.red(`Invalid instance URL: ${raw} (expected http:// or https://)`));
    process.exit(1);
  }

  return url.origin;
}

// `fetch` reports every transport problem as an opaque "fetch failed", so the
// underlying cause is turned into something actionable here.
function describeNetworkError(err: unknown, instanceUrl: string): string {
  const cause = (err as { cause?: { code?: string; message?: string } } | undefined)?.cause;
  const code = cause?.code;
  const hints: string[] = [];

  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
    hints.push(`could not resolve ${new URL(instanceUrl).host} — check DNS and the instance URL`);
  } else if (code === 'ECONNREFUSED') {
    hints.push(`connection refused by ${instanceUrl} — is the instance running?`);
  } else if (code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
    hints.push(`connection to ${instanceUrl} timed out — check network access and firewall rules`);
  } else if (code?.startsWith('CERT_') || code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
    hints.push(`TLS certificate of ${instanceUrl} was rejected (${code})`);
  } else {
    hints.push(`could not reach ${instanceUrl}`);
  }

  if (process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy) {
    hints.push('a proxy is configured in the environment, but Node.js ignores it unless NODE_USE_ENV_PROXY=1 is set (Node 24+)');
  }

  const detail = cause?.message ?? (err instanceof Error ? err.message : String(err));

  return `${hints.join('; ')} (${detail})`;
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || Boolean((err as { cause?: unknown } | undefined)?.cause);
}

const TTL_MAP: Record<string, number> = {
  '1h': 3600,
  '1d': 86400,
  '1w': 604800,
  '1m': 2592000,
};

async function promptPassword(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr });
    process.stderr.write(prompt);
    rl.question('', (answer) => {
      rl.close();
      process.stderr.write('\n');
      resolve(answer);
    });
  });
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
}

async function sendNote(text: string, opts: {
  file?: string;
  stdin?: boolean;
  ttl: string;
  burn: boolean;
  password?: string;
  instance?: string;
}): Promise<void> {
  const instanceUrl = resolveInstanceUrl(opts.instance);
  let content = text;

  // Piped input keeps the secret out of the shell history and the process list.
  if (opts.stdin || (!content && !opts.file && !process.stdin.isTTY)) {
    content = (await readStdin()).replace(/\n$/, '');
  }

  if (opts.file) {
    try {
      content = readFileSync(opts.file, 'utf-8');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`Error reading file: ${message}`));
      process.exit(1);
    }
  }

  if (!content) {
    console.error(chalk.red('No content provided. Pass text as an argument, use --file, or pipe it to --stdin.'));
    process.exit(1);
  }

  const ttlInSeconds = TTL_MAP[opts.ttl];
  if (ttlInSeconds === undefined) {
    console.error(chalk.red(`Invalid TTL "${opts.ttl}". Valid values: 1h, 1d, 1w, 1m`));
    process.exit(1);
  }

  let encryptionPassword: string | undefined;
  if (opts.password !== undefined) {
    encryptionPassword = opts.password || await promptPassword('Password: ');
  }

  let encryptedPayload: string;
  let encryptionKey: string;

  try {
    ({ encryptedPayload, encryptionKey } = await encryptNote({
      content,
      password: encryptionPassword,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Encryption failed: ${message}`));
    process.exit(1);
  }

  const body = {
    payload: encryptedPayload,
    isPublic: true,
    deleteAfterReading: opts.burn,
    encryptionAlgorithm: 'aes-256-gcm',
    serializationFormat: 'cbor-array',
    ttlInSeconds,
  };

  let noteId: string;
  try {
    const response = await fetch(`${instanceUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json() as { noteId: string };
    noteId = data.noteId;
  } catch (err: unknown) {
    const message = isNetworkError(err)
      ? describeNetworkError(err, instanceUrl)
      : (err instanceof Error ? err.message : String(err));
    console.error(chalk.red(`Failed to create note: ${message}`));
    process.exit(1);
  }

  const hashFragment = createNoteUrlHashFragment({
    encryptionKey,
    isPasswordProtected: encryptionPassword !== undefined,
    isDeletedAfterReading: opts.burn,
  });

  const noteUrl = `${instanceUrl}/${noteId}#${hashFragment}`;

  console.log(chalk.green('Note created successfully!'));
  console.log(chalk.dim(`TTL: ${opts.ttl}${opts.burn ? ' · deletes after reading' : ''}${encryptionPassword !== undefined ? ' · password protected' : ''}`));
  console.log('');
  console.log(noteUrl);
}

function instanceUrlFromNoteUrl(noteUrl: string): string | undefined {
  try {
    return new URL(noteUrl).origin;
  } catch {
    return undefined;
  }
}

async function getNote(noteUrl: string, opts: { password?: string; instance?: string }): Promise<void> {
  // The note URL already points at an instance, so it wins unless one is given explicitly.
  const instanceUrl = resolveInstanceUrl(opts.instance ?? instanceUrlFromNoteUrl(noteUrl));
  let noteId: string;
  let encryptionKey: string;
  let isPasswordProtected: boolean;

  try {
    ({ noteId, encryptionKey, isPasswordProtected } = parseNoteUrl({ noteUrl }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Invalid URL: ${message}`));
    process.exit(1);
  }

  let password: string | undefined = opts.password;
  if (isPasswordProtected && password === undefined) {
    password = await promptPassword('Password: ');
  }

  let notePayload: string;
  let encryptionAlgorithm: string;
  let serializationFormat: string;

  try {
    const response = await fetch(`${instanceUrl}/api/notes/${noteId}`);

    if (!response.ok) {
      if (response.status === 404) {
        console.error(chalk.red('Note not found. It may have expired or already been read.'));
      } else {
        console.error(chalk.red(`HTTP ${response.status}: ${response.statusText}`));
      }
      process.exit(1);
    }

    const data = await response.json() as {
      note: { payload: string; encryptionAlgorithm: string; serializationFormat: string };
    };
    notePayload = data.note.payload;
    encryptionAlgorithm = data.note.encryptionAlgorithm;
    serializationFormat = data.note.serializationFormat;
  } catch (err: unknown) {
    const message = isNetworkError(err)
      ? describeNetworkError(err, instanceUrl)
      : (err instanceof Error ? err.message : String(err));
    console.error(chalk.red(`Failed to fetch note: ${message}`));
    process.exit(1);
  }

  let content: string;
  try {
    const { note } = await decryptNote({
      encryptedPayload: notePayload,
      encryptionKey,
      password,
      encryptionAlgorithm: encryptionAlgorithm as Parameters<typeof decryptNote>[0]['encryptionAlgorithm'],
      serializationFormat: serializationFormat as Parameters<typeof decryptNote>[0]['serializationFormat'],
    });
    content = note.content;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (isPasswordProtected) {
      console.error(chalk.red(`Decryption failed — wrong password? (${message})`));
    } else {
      console.error(chalk.red(`Decryption failed: ${message}`));
    }
    process.exit(1);
  }

  console.log(content);
}

const program = new Command();

program
  .name('secreto')
  .description('CLI for Secreto — send and receive encrypted notes from your terminal')
  .version(getVersion());

program
  .command('send [text]')
  .description('Encrypt and send a note; prints the shareable URL')
  .option('-f, --file <path>', 'read content from a file instead of the argument')
  .option('--stdin', 'read content from standard input', false)
  .option('--ttl <duration>', 'expiration: 1h, 1d, 1w, or 1m', '1d')
  .option('--burn', 'delete note after the first read', false)
  .option('-p, --password [pass]', 'add password protection (omit value to be prompted)')
  .option('--instance <url>', 'Secreto instance to use (default: $SECRETO_INSTANCE_URL or https://secreto.info)')
  .action(async (text: string | undefined, opts: {
    file?: string;
    stdin?: boolean;
    ttl: string;
    burn: boolean;
    password?: string | boolean;
    instance?: string;
  }) => {
    // --password with no value comes in as true (boolean) from commander;
    // an empty string makes sendNote prompt for it later.
    const passwordOpt = opts.password !== undefined
      ? (opts.password === true ? '' : opts.password as string)
      : undefined;

    await sendNote(text ?? '', {
      file: opts.file,
      stdin: opts.stdin,
      ttl: opts.ttl,
      burn: opts.burn,
      password: passwordOpt,
      instance: opts.instance,
    });
  });

program
  .command('get <url>')
  .description('Fetch and decrypt a note from a Secreto URL')
  .option('-p, --password <pass>', 'password (if note is password-protected; omit to be prompted)')
  .option('--instance <url>', 'Secreto instance to use (default: taken from the note URL)')
  .action(async (url: string, opts: { password?: string; instance?: string }) => {
    await getNote(url, opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Unexpected error: ${message}`));
  process.exit(1);
});

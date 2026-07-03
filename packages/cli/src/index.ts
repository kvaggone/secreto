#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import chalk from 'chalk';
import { encryptNote, decryptNote, createNoteUrlHashFragment, parseNoteUrl } from '@secreto/lib';

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

const BASE_URL = 'https://secreto.info';
const API_BASE = `${BASE_URL}/api`;

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

async function sendNote(text: string, opts: {
  file?: string;
  ttl: string;
  burn: boolean;
  password?: string;
}): Promise<void> {
  let content = text;

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
    console.error(chalk.red('No content provided. Pass text as an argument or use --file.'));
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
    const response = await fetch(`${API_BASE}/notes`, {
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
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`Failed to create note: ${message}`));
    process.exit(1);
  }

  const hashFragment = createNoteUrlHashFragment({
    encryptionKey,
    isPasswordProtected: encryptionPassword !== undefined,
    isDeletedAfterReading: opts.burn,
  });

  const noteUrl = `${BASE_URL}/${noteId}#${hashFragment}`;

  console.log(chalk.green('Note created successfully!'));
  console.log(chalk.dim(`TTL: ${opts.ttl}${opts.burn ? ' · deletes after reading' : ''}${encryptionPassword !== undefined ? ' · password protected' : ''}`));
  console.log('');
  console.log(noteUrl);
}

async function getNote(noteUrl: string, opts: { password?: string }): Promise<void> {
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
    const response = await fetch(`${API_BASE}/notes/${noteId}`);

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
    const message = err instanceof Error ? err.message : String(err);
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
  .option('--ttl <duration>', 'expiration: 1h, 1d, 1w, or 1m', '1d')
  .option('--burn', 'delete note after the first read', false)
  .option('-p, --password [pass]', 'add password protection (omit value to be prompted)')
  .action(async (text: string | undefined, opts: {
    file?: string;
    ttl: string;
    burn: boolean;
    password?: string | boolean;
  }) => {
    // --password with no value comes in as true (boolean) from commander
    const password = opts.password === true ? undefined : opts.password as string | undefined;
    // When password flag is provided as true (no value), we prompt later in sendNote
    const passwordOpt = opts.password !== undefined
      ? (opts.password === true ? '' : opts.password as string)
      : undefined;

    await sendNote(text ?? '', {
      file: opts.file,
      ttl: opts.ttl,
      burn: opts.burn,
      password: passwordOpt,
    });
  });

program
  .command('get <url>')
  .description('Fetch and decrypt a note from a secreto.info URL')
  .option('-p, --password <pass>', 'password (if note is password-protected; omit to be prompted)')
  .action(async (url: string, opts: { password?: string }) => {
    await getNote(url, opts);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(chalk.red(`Unexpected error: ${message}`));
  process.exit(1);
});

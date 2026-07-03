import * as crypto from 'node:crypto';
import type { Storage } from '../../storage/storage.types';
import { injectArguments } from '@corentinth/chisels';

export { createOtpRepository, verifyCode };

type OtpRecord = {
  codeHash: string;
  email: string;
  attempts: number;
  expiresAt: string;
};

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function verifyCode(input: string, storedHash: string): boolean {
  const inputHash = hashCode(input);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(inputHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

function getOtpKey(noteId: string, email: string): string {
  return `otp:${noteId}:${normalizeEmail(email)}`;
}

function createOtpRepository({ storage }: { storage: Storage }) {
  return injectArguments(
    { saveOtp, getOtp, deleteOtp, incrementAttempts },
    { storage },
  );
}

async function saveOtp({
  storage,
  noteId,
  email,
  code,
  ttlInSeconds = 600,
  now = new Date(),
}: {
  storage: Storage;
  noteId: string;
  email: string;
  code: string;
  ttlInSeconds?: number;
  now?: Date;
}): Promise<void> {
  const key = getOtpKey(noteId, email);
  const expiresAt = new Date(now.getTime() + ttlInSeconds * 1000).toISOString();

  await (storage as any).setItem(
    key,
    { codeHash: hashCode(code), email: normalizeEmail(email), attempts: 0, expiresAt },
    { ttl: ttlInSeconds, expirationTtl: ttlInSeconds },
  );
}

async function getOtp({
  storage,
  noteId,
  email,
}: {
  storage: Storage;
  noteId: string;
  email: string;
}): Promise<OtpRecord | null> {
  const key = getOtpKey(noteId, email);
  return (storage as any).getItem(key);
}

async function deleteOtp({
  storage,
  noteId,
  email,
}: {
  storage: Storage;
  noteId: string;
  email: string;
}): Promise<void> {
  const key = getOtpKey(noteId, email);
  await (storage as any).removeItem(key);
}

async function incrementAttempts({
  storage,
  noteId,
  email,
  record,
}: {
  storage: Storage;
  noteId: string;
  email: string;
  record: OtpRecord;
}): Promise<void> {
  const key = getOtpKey(noteId, email);
  const remainingMs = new Date(record.expiresAt).getTime() - Date.now();
  const remainingSeconds = Math.max(1, Math.floor(remainingMs / 1000));

  await (storage as any).setItem(
    key,
    { ...record, attempts: record.attempts + 1 },
    { ttl: remainingSeconds, expirationTtl: remainingSeconds },
  );
}

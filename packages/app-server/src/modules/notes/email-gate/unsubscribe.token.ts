import type { EmailGateEnv } from './email-gate.env';
import * as crypto from 'node:crypto';

export { makeUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl };

type UnsubscribeEnv = Pick<EmailGateEnv, 'unsubscribeSecret' | 'publicSiteUrl'>;

function getSigningKey(env: UnsubscribeEnv): Buffer {
  if (!env.unsubscribeSecret) {
    // Never sign with a guessable fallback — that would let anyone forge opt-outs.
    throw new Error('UNSUBSCRIBE_SECRET (or RESEND_API_KEY) is not configured');
  }
  return crypto.createHash('sha256').update(env.unsubscribeSecret).digest();
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function makeUnsubscribeToken(email: string, env: UnsubscribeEnv): string {
  return crypto
    .createHmac('sha256', getSigningKey(env))
    .update(normalize(email))
    .digest('hex')
    .slice(0, 32);
}

function verifyUnsubscribeToken(email: string, token: string, env: UnsubscribeEnv): boolean {
  if (!env.unsubscribeSecret) {
    return false;
  }

  const expected = makeUnsubscribeToken(email, env);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

function buildUnsubscribeUrl(email: string, env: UnsubscribeEnv): string {
  const token = makeUnsubscribeToken(email, env);
  return `${env.publicSiteUrl}/api/unsubscribe?email=${encodeURIComponent(normalize(email))}&token=${token}`;
}

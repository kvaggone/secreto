import * as crypto from 'node:crypto';

export { makeUnsubscribeToken, verifyUnsubscribeToken, buildUnsubscribeUrl };

function getSigningKey(): Buffer {
  // Derive a stable signing key from an existing secret so no extra config is needed.
  const secret = process.env.UNSUBSCRIBE_SECRET || process.env.RESEND_API_KEY || 'secret-manager-fallback-key';
  return crypto.createHash('sha256').update(secret).digest();
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

function makeUnsubscribeToken(email: string): string {
  return crypto
    .createHmac('sha256', getSigningKey())
    .update(normalize(email))
    .digest('hex')
    .slice(0, 32);
}

function verifyUnsubscribeToken(email: string, token: string): boolean {
  const expected = makeUnsubscribeToken(email);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

function buildUnsubscribeUrl(email: string): string {
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://secret.agg.one').replace(/\/$/, '');
  const token = makeUnsubscribeToken(email);
  return `${siteUrl}/api/unsubscribe?email=${encodeURIComponent(normalize(email))}&token=${token}`;
}

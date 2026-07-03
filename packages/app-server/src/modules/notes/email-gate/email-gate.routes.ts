import * as crypto from 'node:crypto';
import { z } from 'zod';
import { createNoteRepository } from '../notes.repository';
import { getRefreshedNote } from '../notes.usecases';
import { createOtpRepository } from './otp.repository';
import { issueOtp, verifyOtp } from './otp.usecases';
import { sendOtpEmail, sendNoAccessEmail } from './email.services';
import { isEmailSuppressed, suppressEmail } from './suppression.repository';
import { verifyUnsubscribeToken } from './unsubscribe.token';

export { registerEmailGateRoutes };

function unsubscribePage({ title, message }: { title: string; message: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e5e5;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0">
  <div style="max-width:420px;padding:32px;text-align:center">
    <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
    <p style="color:#a3a3a3;line-height:1.5;margin:0">${message}</p>
  </div>
</body></html>`;
}

const requestCodeSchema = z.object({ email: z.string().email() });
const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

async function parseBody(c: any, schema: z.ZodTypeAny) {
  const raw = await c.req.json().catch(() => null);
  return schema.safeParse(raw);
}

function registerEmailGateRoutes({ app }: { app: any }) {
  // GET /api/notes/:noteId/gate-status
  // Lightweight check: does this note require email verification?
  // Used by the client BEFORE fetching deleteAfterReading notes so it can show
  // the email gate UI without accidentally burning a one-time note.
  app.get('/api/notes/:noteId/gate-status', async (c: any) => {
    const { noteId } = c.req.param();
    const storage = c.get('storage');
    const rawNote = await (storage as any).getItem(noteId);

    return c.json({
      requiresEmailVerification: !!(rawNote?.allowedEmails?.length),
    });
  });

  // POST /api/notes/:noteId/request-code
  // Sends a 6-digit OTP to the provided email if it is in the note's allow-list.
  // Always returns { sent: true } regardless of whether the email is allowed,
  // to avoid leaking the allow-list.
  app.post('/api/notes/:noteId/request-code', async (c: any) => {
    const parsed = await parseBody(c, requestCodeSchema);
    if (!parsed.success) {
      return c.json({ error: { code: 'validation.invalid', message: 'Invalid email.' } }, 400);
    }

    const { noteId } = c.req.param();
    const { email } = parsed.data;
    const storage = c.get('storage');
    const rawNote = await (storage as any).getItem(noteId);

    if (!rawNote?.allowedEmails?.length) {
      return c.json({ sent: true });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const allowed: string[] = rawNote.allowedEmails.map((e: string) => e.toLowerCase().trim());

    if (!allowed.includes(normalizedEmail)) {
      // 1Password-style: tell the typed address it doesn't have access — but only
      // once per (note, address) per hour, and never to opted-out addresses, to
      // avoid turning this into a spam relay.
      if (!(await isEmailSuppressed({ storage, email: normalizedEmail }))) {
        const dedupeKey = `noaccess:${noteId}:${crypto.createHash('sha256').update(normalizedEmail).digest('hex').slice(0, 24)}`;
        const alreadyNotified = await (storage as any).getItem(dedupeKey);
        if (!alreadyNotified) {
          await (storage as any).setItem(dedupeKey, { at: new Date().toISOString() }, { ttl: 3600, expirationTtl: 3600 });
          sendNoAccessEmail({ to: normalizedEmail }).catch((err: unknown) => {
            console.error('[email-gate] Failed to send no-access email:', err);
          });
        }
      }
      return c.json({ sent: true });
    }

    // Respect the suppression list even if the address was allow-listed before opting out.
    if (await isEmailSuppressed({ storage, email: normalizedEmail })) {
      return c.json({ sent: true });
    }

    const otpRepository = createOtpRepository({ storage });
    const { code } = await issueOtp({ otpRepository, noteId, email: normalizedEmail });

    // Fire-and-forget — do not expose email service errors to the caller
    sendOtpEmail({ to: normalizedEmail, code }).catch((err: unknown) => {
      console.error('[email-gate] Failed to send OTP email:', err);
    });

    return c.json({ sent: true });
  });

  // POST /api/notes/:noteId/verify-code
  // Verifies the OTP. On success, returns the note payload (same shape as GET)
  // and applies deleteAfterReading burn logic.
  app.post('/api/notes/:noteId/verify-code', async (c: any) => {
    const parsed = await parseBody(c, verifyCodeSchema);
    if (!parsed.success) {
      return c.json({ error: { code: 'validation.invalid', message: 'Invalid input.' } }, 400);
    }

    const { noteId } = c.req.param();
    const { email, code } = parsed.data;
    const storage = c.get('storage');
    const rawNote = await (storage as any).getItem(noteId);

    if (!rawNote?.allowedEmails?.length) {
      return c.json({ error: { code: 'note.not_found', message: 'Note not found.' } }, 404);
    }

    const normalizedEmail = email.toLowerCase().trim();
    const otpRepository = createOtpRepository({ storage });

    const { isValid, attemptsExceeded } = await verifyOtp({
      otpRepository,
      noteId,
      email: normalizedEmail,
      code,
    });

    if (!isValid) {
      return c.json(
        {
          error: {
            code: attemptsExceeded ? 'otp.attempts_exceeded' : 'otp.invalid',
            message: attemptsExceeded ? 'Too many attempts.' : 'Invalid code.',
          },
        },
        400,
      );
    }

    // OTP verified — fetch the note (burns it if deleteAfterReading)
    const notesRepository = createNoteRepository({ storage });
    try {
      const { note } = await getRefreshedNote({ noteId, notesRepository });
      return c.json({ note });
    } catch {
      return c.json({ error: { code: 'note.not_found', message: 'Note not found.' } }, 404);
    }
  });

  // GET /api/unsubscribe?email=&token=
  // One-click opt-out target embedded in every OTP email. Adds the address to the
  // suppression list so it can no longer be used as a note recipient.
  app.get('/api/unsubscribe', async (c: any) => {
    const email = c.req.query('email') ?? '';
    const token = c.req.query('token') ?? '';

    if (!email || !token || !verifyUnsubscribeToken(email, token)) {
      return c.html(
        unsubscribePage({
          title: 'Invalid link',
          message: 'This unsubscribe link is invalid or has expired. If you keep receiving unwanted emails, contact support@agg.one.',
        }),
        400,
      );
    }

    const storage = c.get('storage');
    await suppressEmail({ storage, email });

    return c.html(
      unsubscribePage({
        title: "You're unsubscribed",
        message: 'All good — we won\'t send access codes to this address anymore, and it can no longer be used as a note recipient. If you believe this was a mistake, contact support@agg.one.',
      }),
    );
  });
}

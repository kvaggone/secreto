import { getDb } from '../../db/db.client';
import { findSuppressedEmails } from './suppression.repository';

export { registerEmailGateMiddleware };

// Registers middleware that must run BEFORE registerNotesRoutes:
//  1. Intercepts GET /api/notes/:noteId for email-gated notes (withholds the payload).
//  2. Rejects note creation that targets an email which has opted out (suppression list).
// Mirrors the route's own limit on recipients.
const MAX_CHECKED_EMAILS = 20;

function registerEmailGateMiddleware({ app }: { app: any }) {
  // 1. Email-gate read interception
  app.use('/api/notes/:noteId', async (c: any, next: any) => {
    if (c.req.method !== 'GET') {
      return next();
    }

    // Only match the bare note path, not sub-paths like /exists or /gate-status
    const pathname = new URL(c.req.url).pathname;
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length !== 3) {
      return next();
    }

    const noteId = c.req.param('noteId');
    const storage = c.get('storage');

    const rawNote = await (storage as any).getItem(noteId);
    if (!rawNote?.allowedEmails?.length) {
      return next();
    }

    return c.json({ requiresEmailVerification: true });
  });

  // 2. Suppression check on note creation
  app.use('/api/notes', async (c: any, next: any) => {
    if (c.req.method !== 'POST') {
      return next();
    }

    const body = await c.req.json().catch(() => null);
    const emails: unknown = body?.allowedEmails;

    // An oversized list is left to the route's own validation, which rejects it
    // without touching the database.
    const isCheckable = Array.isArray(emails)
      && emails.length > 0
      && emails.length <= MAX_CHECKED_EMAILS
      && emails.every(email => typeof email === 'string');

    if (isCheckable) {
      const suppressed = await findSuppressedEmails({ db: await getDb(c), emails: emails as string[] });
      const firstSuppressed = (emails as string[]).find(email => suppressed.has(email.toLowerCase().trim()));

      if (firstSuppressed) {
        return c.json(
          {
            error: {
              code: 'email.suppressed',
              message: 'This recipient has opted out of receiving notes.',
              email: firstSuppressed,
            },
          },
          400,
        );
      }
    }

    return next();
  });
}

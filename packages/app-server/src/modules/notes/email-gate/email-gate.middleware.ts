import { isEmailSuppressed } from './suppression.repository';

export { registerEmailGateMiddleware };

// Registers middleware that must run BEFORE registerNotesRoutes:
//  1. Intercepts GET /api/notes/:noteId for email-gated notes (withholds the payload).
//  2. Rejects note creation that targets an email which has opted out (suppression list).
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

    if (Array.isArray(emails) && emails.length > 0) {
      const storage = c.get('storage');
      for (const email of emails) {
        if (typeof email === 'string' && (await isEmailSuppressed({ storage, email }))) {
          return c.json(
            {
              error: {
                code: 'email.suppressed',
                message: 'This recipient has opted out of receiving notes.',
                email,
              },
            },
            400,
          );
        }
      }
    }

    return next();
  });
}

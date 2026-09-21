import { z } from 'zod';
import { getDb, getDbStatus } from '../db/db.client';
import { listSuppressedEmails, unsuppressEmail } from '../notes/email-gate/suppression.repository';
import {
  checkLoginRateLimit,
  clearAdminSession,
  findAdminByCredentials,
  getAdminConfig,
  getAdminSession,
  setAdminSession,
} from './admin.auth';
import { getNoteStats } from './note-events.repository';

export { registerAdminRoutes };

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1).max(200),
});

const listSuppressionsSchema = z.object({
  search: z.string().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

function errorResponse(c: any, status: number, code: string, message: string) {
  return c.json({ error: { code, message } }, status);
}

function registerAdminRoutes({ app }: { app: any }) {
  // Admin responses are never cached by browsers or proxies.
  app.use('/api/admin/*', async (c: any, next: any) => {
    await next();
    c.header('Cache-Control', 'no-store');
  });

  app.post('/api/admin/login', async (c: any) => {
    const config = getAdminConfig(c);

    if (!config.isEnabled) {
      return errorResponse(c, 404, 'admin.disabled', 'Admin area is not configured.');
    }

    if (!checkLoginRateLimit(c).isAllowed) {
      return errorResponse(c, 429, 'admin.rate_limited', 'Too many login attempts. Try again later.');
    }

    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));

    if (!parsed.success) {
      return errorResponse(c, 400, 'validation.invalid', 'Invalid email or password.');
    }

    const admin = await findAdminByCredentials({ config, ...parsed.data });

    if (!admin) {
      return errorResponse(c, 401, 'admin.invalid_credentials', 'Invalid email or password.');
    }

    await setAdminSession(c, { email: admin.email, secret: config.sessionSecret! });

    return c.json({ email: admin.email });
  });

  app.post('/api/admin/logout', (c: any) => {
    clearAdminSession(c);
    return c.json({ ok: true });
  });

  // Everything below requires a valid admin session.
  app.use('/api/admin/*', async (c: any, next: any) => {
    const path = new URL(c.req.url).pathname;
    if (path === '/api/admin/login' || path === '/api/admin/logout') {
      return next();
    }

    const config = getAdminConfig(c);

    if (!config.isEnabled) {
      return errorResponse(c, 404, 'admin.disabled', 'Admin area is not configured.');
    }

    const session = await getAdminSession(c, { config });

    if (!session) {
      return errorResponse(c, 401, 'admin.unauthorized', 'Not signed in.');
    }

    c.set('adminEmail', session.email);
    return next();
  });

  app.get('/api/admin/session', (c: any) => c.json({ email: c.get('adminEmail') }));

  app.get('/api/admin/stats', async (c: any) => {
    const db = await getDb(c);

    if (!db) {
      return c.json({ databaseStatus: await getDbStatus(c), notes: null, suppressedEmailsCount: null });
    }

    const [notes, [{ count }]] = await Promise.all([
      getNoteStats({ db }),
      db<{ count: number }[]>`select count(*)::int as count from suppressed_emails`,
    ]);

    return c.json({ databaseStatus: 'ok', notes, suppressedEmailsCount: count });
  });

  app.get('/api/admin/suppressions', async (c: any) => {
    const parsed = listSuppressionsSchema.safeParse(c.req.query());

    if (!parsed.success) {
      return errorResponse(c, 400, 'validation.invalid', 'Invalid query.');
    }

    const db = await getDb(c);

    if (!db) {
      return errorResponse(c, 503, 'db.unavailable', 'Database is not available.');
    }

    const { search, page, pageSize } = parsed.data;
    const { items, total } = await listSuppressedEmails({ db, search: search || undefined, page, pageSize });

    return c.json({ items, total, page, pageSize });
  });

  app.delete('/api/admin/suppressions/:email', async (c: any) => {
    const db = await getDb(c);

    if (!db) {
      return errorResponse(c, 503, 'db.unavailable', 'Database is not available.');
    }

    const email = decodeURIComponent(c.req.param('email'));
    const { removed } = await unsuppressEmail({ db, email });

    if (!removed) {
      return errorResponse(c, 404, 'suppression.not_found', 'Address is not in the list.');
    }

    return c.json({ removed: true });
  });
}

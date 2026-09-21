import bcrypt from 'bcryptjs';
import { describe, expect, test } from 'vitest';
import { overrideConfig } from '../../app/config/config.test-utils';
import { createServer } from '../../app/server';
import { createMemoryStorage } from '../../storage/factories/memory.storage';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

const ADMIN_EMAIL = 'admin@example.com';
const ADMIN_PASSWORD = 'correct horse battery staple';
const SESSION_SECRET = 'x'.repeat(40);

function createTestServer() {
  const { storage } = createMemoryStorage();
  const { app } = createServer({ storageFactory: () => ({ storage }), config: overrideConfig({}) });
  return { app };
}

function buildEnv(extra: Record<string, string> = {}) {
  return {
    ADMIN_USERS: `${ADMIN_EMAIL}:${bcrypt.hashSync(ADMIN_PASSWORD, 4)}`,
    ADMIN_SESSION_SECRET: SESSION_SECRET,
    ...extra,
  };
}

async function login({ app, env, password = ADMIN_PASSWORD }: { app: any; env: Record<string, string>; password?: string }) {
  const response = await app.request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
    headers: { 'Content-Type': 'application/json' },
  }, env);

  const cookie = response.headers.get('set-cookie')?.split(';')[0] ?? '';
  return { response, cookie };
}

describe('e2e', () => {
  describe('admin', () => {
    test('the admin area is disabled when ADMIN_USERS or ADMIN_SESSION_SECRET is missing', async () => {
      const { app } = createTestServer();

      const response = await app.request('/api/admin/stats', {}, {});

      expect(response.status).to.eql(404);
    });

    test('admin endpoints require a session', async () => {
      const { app } = createTestServer();

      const response = await app.request('/api/admin/stats', {}, buildEnv());

      expect(response.status).to.eql(401);
    });

    test('invalid credentials are rejected', async () => {
      const { app } = createTestServer();

      const { response, cookie } = await login({ app, env: buildEnv(), password: 'wrong' });

      expect(response.status).to.eql(401);
      expect(cookie).to.eql('');
    });

    test('a valid login sets an httpOnly session cookie scoped to the admin API', async () => {
      const { app } = createTestServer();

      const { response } = await login({ app, env: buildEnv() });
      const setCookie = response.headers.get('set-cookie') ?? '';

      expect(response.status).to.eql(200);
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('Path=/api/admin');
      expect(setCookie).toContain('SameSite=Strict');
    });

    test('without a database, stats report the database status instead of failing', async () => {
      const { app } = createTestServer();
      const env = buildEnv();
      const { cookie } = await login({ app, env });

      const response = await app.request('/api/admin/stats', { headers: { cookie } }, env);

      expect(response.status).to.eql(200);
      expect(await response.json()).to.eql({ databaseStatus: 'not-configured', notes: null, suppressedEmailsCount: null });
    });

    describe.skipIf(!TEST_DATABASE_URL)('with a database', () => {
      test('note creations are counted and suppressions can be listed and removed', async () => {
        const { app } = createTestServer();
        const env = buildEnv({ DATABASE_URL: TEST_DATABASE_URL!, UNSUBSCRIBE_SECRET: 'unsubscribe-secret' });
        const { cookie } = await login({ app, env });

        const statsBefore = await (await app.request('/api/admin/stats', { headers: { cookie } }, env)).json<any>();

        const createResponse = await app.request('/api/notes', {
          method: 'POST',
          body: JSON.stringify({
            payload: 'aaaaaaaa',
            deleteAfterReading: true,
            ttlInSeconds: 3600,
            encryptionAlgorithm: 'aes-256-gcm',
            serializationFormat: 'cbor-array',
            allowedEmails: ['someone@example.com'],
          }),
          headers: { 'Content-Type': 'application/json' },
        }, env);
        expect(createResponse.status).to.eql(200);

        // The event is written in the background.
        await new Promise(resolve => setTimeout(resolve, 200));

        const statsAfter = await (await app.request('/api/admin/stats', { headers: { cookie } }, env)).json<any>();
        expect(statsAfter.databaseStatus).to.eql('ok');
        expect(statsAfter.notes.totals.today).to.eql(statsBefore.notes.totals.today + 1);
        expect(statsAfter.notes.daily).toHaveLength(30);

        const { makeUnsubscribeToken } = await import('../../notes/email-gate/unsubscribe.token');
        const email = `optout-${Date.now()}@example.com`;
        const token = makeUnsubscribeToken(email, { unsubscribeSecret: 'unsubscribe-secret', publicSiteUrl: '' });
        const unsubscribeResponse = await app.request(`/api/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`, {}, env);
        expect(unsubscribeResponse.status).to.eql(200);

        const list = await (await app.request(`/api/admin/suppressions?search=${encodeURIComponent(email)}`, { headers: { cookie } }, env)).json<any>();
        expect(list.total).to.eql(1);
        expect(list.items[0].email).to.eql(email);

        const deleteResponse = await app.request(`/api/admin/suppressions/${encodeURIComponent(email)}`, { method: 'DELETE', headers: { cookie } }, env);
        expect(deleteResponse.status).to.eql(200);

        const listAfter = await (await app.request(`/api/admin/suppressions?search=${encodeURIComponent(email)}`, { headers: { cookie } }, env)).json<any>();
        expect(listAfter.total).to.eql(0);
      });
    });
  });
});

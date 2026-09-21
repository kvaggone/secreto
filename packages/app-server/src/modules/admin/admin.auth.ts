import bcrypt from 'bcryptjs';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { sign, verify } from 'hono/jwt';
import { readRuntimeEnv } from '../shared/env/runtime-env';

export {
  checkLoginRateLimit,
  clearAdminSession,
  findAdminByCredentials,
  getAdminConfig,
  getAdminSession,
  setAdminSession,
};

const SESSION_COOKIE = 'secreto_admin_session';
const SESSION_DURATION_SECONDS = 60 * 60 * 12;

type AdminConfig = {
  users: { email: string; passwordHash: string }[];
  sessionSecret?: string;
};

// ADMIN_USERS: comma-separated `email:bcryptHash` pairs, same format as AUTHENTICATION_USERS.
// The admin area is disabled unless both ADMIN_USERS and ADMIN_SESSION_SECRET are set.
function getAdminConfig(c: any): AdminConfig & { isEnabled: boolean } {
  const env = readRuntimeEnv(c);

  const users = (env.ADMIN_USERS ?? '')
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const separatorIndex = entry.indexOf(':');
      return {
        email: entry.slice(0, separatorIndex).toLowerCase().trim(),
        passwordHash: entry.slice(separatorIndex + 1),
      };
    })
    .filter(({ email, passwordHash }) => email && passwordHash);

  const sessionSecret = env.ADMIN_SESSION_SECRET || undefined;

  return {
    users,
    sessionSecret,
    isEnabled: users.length > 0 && Boolean(sessionSecret && sessionSecret.length >= 32),
  };
}

// A dummy hash keeps response timing similar for unknown emails.
const DUMMY_HASH = '$2a$10$c1Kfne02G6Psxoweq/sx7e3//PCWN99dUqVsnZyyVthLSf4VEHYgq';

async function findAdminByCredentials({
  config,
  email,
  password,
}: {
  config: AdminConfig;
  email: string;
  password: string;
}): Promise<{ email: string } | null> {
  const user = config.users.find(u => u.email === email.toLowerCase().trim());
  const isMatch = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  return user && isMatch ? { email: user.email } : null;
}

async function setAdminSession(c: any, { email, secret }: { email: string; secret: string }): Promise<void> {
  const token = await sign(
    { sub: email, scope: 'admin', exp: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS },
    secret,
    'HS256',
  );

  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === 'https:',
    sameSite: 'Strict',
    path: '/api/admin',
    maxAge: SESSION_DURATION_SECONDS,
  });
}

function clearAdminSession(c: any): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/api/admin' });
}

async function getAdminSession(c: any, { config }: { config: AdminConfig }): Promise<{ email: string } | null> {
  const token = getCookie(c, SESSION_COOKIE);

  if (!token || !config.sessionSecret) {
    return null;
  }

  try {
    const payload = await verify(token, config.sessionSecret, 'HS256');
    const email = typeof payload.sub === 'string' ? payload.sub : '';

    // The user must still be listed in ADMIN_USERS: removing them revokes their sessions.
    if (payload.scope !== 'admin' || !config.users.some(u => u.email === email)) {
      return null;
    }

    return { email };
  } catch {
    return null;
  }
}

// Simple in-memory limiter for login attempts, keyed by client IP.
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 10;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function checkLoginRateLimit(c: any): { isAllowed: boolean } {
  const ip = c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('cf-connecting-ip')
    || 'unknown';
  const now = Date.now();

  for (const [key, entry] of loginAttempts) {
    if (entry.resetAt <= now) {
      loginAttempts.delete(key);
    }
  }

  const entry = loginAttempts.get(ip) ?? { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  entry.count += 1;
  loginAttempts.set(ip, entry);

  return { isAllowed: entry.count <= LOGIN_MAX_ATTEMPTS };
}

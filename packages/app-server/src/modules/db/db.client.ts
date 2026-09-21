import type { Sql } from 'postgres';
import postgres from 'postgres';
import { readRuntimeEnv } from '../shared/env/runtime-env';
import { runMigrations } from './db.migrations';

export { getDb, getDbStatus };
export type { Db };

type Db = Sql;

type DbState = {
  url: string;
  sql: Sql;
  ready: Promise<boolean>;
};

let state: DbState | null = null;

// The database is optional: when DATABASE_URL is unset or the server is unreachable,
// callers get `null` and must degrade gracefully (notes and emails keep working).
function connect(url: string): DbState {
  const sql = postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 5,
    onnotice: () => {},
  });

  const ready = runMigrations(sql)
    .then(() => true)
    .catch((err: unknown) => {
      console.error('[db] migrations failed:', err);
      return false;
    });

  return { url, sql, ready };
}

async function getDb(c: any): Promise<Db | null> {
  const url = readRuntimeEnv(c).DATABASE_URL;

  if (!url) {
    return null;
  }

  if (!state || state.url !== url) {
    state = connect(url);
  }

  const current = state;
  const isReady = await current.ready;

  if (!isReady) {
    // Retry the connection and migrations on the next request.
    if (state === current) {
      state = null;
      await current.sql.end({ timeout: 1 }).catch(() => {});
    }
    return null;
  }

  return current.sql;
}

async function getDbStatus(c: any): Promise<'ok' | 'not-configured' | 'unavailable'> {
  if (!readRuntimeEnv(c).DATABASE_URL) {
    return 'not-configured';
  }

  return (await getDb(c)) ? 'ok' : 'unavailable';
}

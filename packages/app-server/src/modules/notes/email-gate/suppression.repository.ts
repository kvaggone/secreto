import type { Db } from '../../db/db.client';

export { isEmailSuppressed, listSuppressedEmails, suppressEmail, unsuppressEmail };

// Suppression list (recipients who opted out) lives in the `suppressed_emails` table.
// Lookups FAIL SAFE: without a database, addresses are treated as "not suppressed"
// so note creation and access codes keep working.

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

async function isEmailSuppressed({ email, db }: { email: string; db: Db | null }): Promise<boolean> {
  if (!db) {
    return false;
  }

  try {
    const rows = await db`select 1 from suppressed_emails where email = ${normalize(email)} limit 1`;
    return rows.length > 0;
  } catch (err) {
    console.error('[suppression] lookup error:', err);
    return false;
  }
}

async function suppressEmail({ email, db }: { email: string; db: Db | null }): Promise<boolean> {
  if (!db) {
    console.error('[suppression] database not configured; cannot record opt-out');
    return false;
  }

  try {
    await db`insert into suppressed_emails (email) values (${normalize(email)}) on conflict (email) do nothing`;
    return true;
  } catch (err) {
    console.error('[suppression] insert error:', err);
    return false;
  }
}

async function unsuppressEmail({ email, db }: { email: string; db: Db }): Promise<{ removed: boolean }> {
  const rows = await db`delete from suppressed_emails where email = ${normalize(email)} returning email`;
  return { removed: rows.length > 0 };
}

async function listSuppressedEmails({
  db,
  search,
  page,
  pageSize,
}: {
  db: Db;
  search?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: { email: string; createdAt: string }[]; total: number }> {
  const pattern = search ? `%${search.toLowerCase().trim().replace(/[\\%_]/g, char => `\\${char}`)}%` : null;
  const where = pattern ? db`where email like ${pattern}` : db``;

  const [{ total }] = await db<{ total: number }[]>`select count(*)::int as total from suppressed_emails ${where}`;
  const rows = await db<{ email: string; created_at: Date }[]>`
    select email, created_at from suppressed_emails ${where}
    order by created_at desc, email
    limit ${pageSize} offset ${(page - 1) * pageSize}
  `;

  return {
    items: rows.map(row => ({ email: row.email, createdAt: row.created_at.toISOString() })),
    total,
  };
}

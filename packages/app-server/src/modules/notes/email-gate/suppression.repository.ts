import type { EmailGateEnv } from './email-gate.env';

export { isEmailSuppressed, suppressEmail };

// Suppression list is stored in Supabase (Postgres) so it can be viewed/edited
// from the Supabase dashboard without server access.
//
// Table:
//   create table suppressed_emails (
//     email text primary key,
//     created_at timestamptz not null default now()
//   );
//
// Accessed via the PostgREST endpoint using the service_role key (server-side only).
// All operations FAIL SAFE: if Supabase is unconfigured or unreachable, suppression
// is simply treated as "not suppressed" / a no-op, so note creation never breaks.

const TABLE = 'suppressed_emails';

type SuppressionEnv = Pick<EmailGateEnv, 'supabaseUrl' | 'supabaseServiceKey'>;

function getConfig(env: SuppressionEnv): { url: string; key: string } | null {
  const { supabaseUrl: url, supabaseServiceKey: key } = env;
  if (!url || !key) {
    return null;
  }
  return { url, key };
}

function authHeaders(key: string): Record<string, string> {
  return {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

function normalize(email: string): string {
  return email.toLowerCase().trim();
}

async function isEmailSuppressed({ email, env }: { email: string; env: SuppressionEnv }): Promise<boolean> {
  const config = getConfig(env);
  if (!config) {
    return false;
  }

  try {
    const query = `${config.url}/rest/v1/${TABLE}?email=eq.${encodeURIComponent(normalize(email))}&select=email`;
    const res = await fetch(query, { headers: authHeaders(config.key) });

    if (!res.ok) {
      console.error(`[suppression] lookup failed: ${res.status}`);
      return false;
    }

    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch (err) {
    console.error('[suppression] lookup error:', err);
    return false;
  }
}

async function suppressEmail({ email, env }: { email: string; env: SuppressionEnv }): Promise<boolean> {
  const config = getConfig(env);
  if (!config) {
    console.error('[suppression] Supabase not configured; cannot record opt-out');
    return false;
  }

  try {
    const res = await fetch(`${config.url}/rest/v1/${TABLE}`, {
      method: 'POST',
      headers: {
        ...authHeaders(config.key),
        // Idempotent: ignore if the email is already suppressed.
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({ email: normalize(email) }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[suppression] insert failed: ${res.status} ${body}`);
      return false;
    }

    return true;
  } catch (err) {
    console.error('[suppression] insert error:', err);
    return false;
  }
}

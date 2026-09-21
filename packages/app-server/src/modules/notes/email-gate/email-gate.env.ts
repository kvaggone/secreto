export { getEmailGateEnv, runInBackground };
export type { EmailGateEnv };

type EmailGateEnv = {
  resendApiKey?: string;
  emailFrom: string;
  supabaseUrl?: string;
  supabaseServiceKey?: string;
  unsubscribeSecret?: string;
  publicSiteUrl: string;
};

// Env must be read from the request context: on Cloudflare Workers, project
// variables/secrets live on `c.env` and are NOT exposed through `process.env`.
// Bindings on `c.env` win; `process.env` is the fallback for the Node runtime.
function readEnv(c: any): Record<string, string | undefined> {
  const fromContext: Record<string, unknown> = c.env ?? {};
  // `process` may not exist at all on Workers, so it is read defensively from globalThis.
  // eslint-disable-next-line node/prefer-global/process
  const fromProcess: Record<string, string | undefined> = globalThis.process?.env ?? {};

  return new Proxy({}, {
    get: (_target, key: string) => {
      const value = fromContext[key];
      return typeof value === 'string' ? value : fromProcess[key];
    },
  });
}

function getEmailGateEnv(c: any): EmailGateEnv {
  const env = readEnv(c);

  return {
    resendApiKey: env.RESEND_API_KEY || undefined,
    emailFrom: env.EMAIL_FROM || 'SECRETO.INFO <noreply@secreto.info>',
    supabaseUrl: env.SUPABASE_URL?.replace(/\/$/, '') || undefined,
    supabaseServiceKey: env.SUPABASE_SERVICE_KEY || undefined,
    // Falls back to the Resend key so no extra config is required, but never to a hardcoded value.
    unsubscribeSecret: env.UNSUBSCRIBE_SECRET || env.RESEND_API_KEY || undefined,
    publicSiteUrl: (env.PUBLIC_SITE_URL || 'https://secreto.info').replace(/\/$/, ''),
  };
}

// Runs a task after the response without blocking it. On Workers the promise must be
// registered with waitUntil, otherwise the isolate may be torn down before it settles.
function runInBackground(c: any, task: Promise<unknown>, label: string): void {
  const guarded = task.catch((err: unknown) => {
    console.error(`[email-gate] ${label}:`, err);
  });

  try {
    c.executionCtx.waitUntil(guarded);
  } catch {
    // No execution context (Node runtime): the process stays alive, nothing to do.
  }
}

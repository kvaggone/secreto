export { readRuntimeEnv };

// Env must be read from the request context: on Cloudflare Workers, project
// variables/secrets live on `c.env` and are NOT exposed through `process.env`.
// Bindings on `c.env` win; `process.env` is the fallback for the Node runtime.
function readRuntimeEnv(c: any): Record<string, string | undefined> {
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

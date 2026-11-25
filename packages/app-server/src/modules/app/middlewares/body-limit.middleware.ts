export { createBodyLimitMiddleware };

/**
 * Rejects a request whose body exceeds `maxSizeBytes` before anything downstream
 * reads or validates it.
 *
 * Hono ships `bodyLimit`, but on a request without `Content-Length` it rebuilds
 * `c.req.raw` from the very stream it just locked, which throws
 * `ReadableStream is locked` on Node. This reads the body into a bounded buffer
 * and builds a fresh request from the URL instead of from the locked one.
 */
function createBodyLimitMiddleware({
  getMaxSizeBytes,
  onExceeded,
}: {
  getMaxSizeBytes: (context: any) => number;
  onExceeded: (context: any) => any;
}) {
  return async function bodyLimitMiddleware(context: any, next: any) {
    const request: Request = context.req.raw;
    const maxSizeBytes = getMaxSizeBytes(context);

    if (!request.body) {
      return next();
    }

    const declaredLength = request.headers.get('content-length');
    const isChunked = request.headers.has('transfer-encoding');

    if (declaredLength !== null && !isChunked) {
      return Number.parseInt(declaredLength, 10) > maxSizeBytes ? onExceeded(context) : next();
    }

    // No declared length: read it ourselves, stopping as soon as the cap is passed.
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      size += value.length;

      if (size > maxSizeBytes) {
        await reader.cancel().catch(() => {});
        return onExceeded(context);
      }

      chunks.push(value);
    }

    const body = new Uint8Array(size);
    let offset = 0;

    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.length;
    }

    context.req.raw = new Request(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : body,
    });

    return next();
  };
}

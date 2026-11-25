import type { BindableStorageFactory } from '../storage/storage.types';
import type { Config } from './config/config.types';
import type { ServerInstanceGenerics } from './server.types';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { registerAdminRoutes } from '../admin/admin.routes';
import { registerEmailGateMiddleware } from '../notes/email-gate/email-gate.middleware.js';
import { registerEmailGateRoutes } from '../notes/email-gate/email-gate.routes.js';
import { registerNotesRoutes } from '../notes/notes.routes';
import { authenticationMiddleware } from './auth/auth.middleware';
import { registerAuthRoutes } from './auth/auth.routes';
import { registerConfigRoutes } from './config/config.routes';
import { createBodyLimitMiddleware } from './middlewares/body-limit.middleware';
import { createConfigMiddleware } from './middlewares/config.middleware';
import { corsMiddleware } from './middlewares/cors.middleware';
import { registerErrorMiddleware } from './middlewares/errors.middleware';
import { loggerMiddleware } from './middlewares/logger.middleware';
import { createStorageMiddleware } from './middlewares/storage.middleware';
import { timeoutMiddleware } from './middlewares/timeout.middleware';

export { createServer };

// Note creation carries the encrypted payload, so it gets the larger ceiling;
// every other API route takes small JSON. One middleware handles both, because a
// request body can only be read once.
const NOTE_BODY_LIMIT_BYTES = 64 * 1024 * 1024;
const SMALL_BODY_LIMIT_BYTES = 256 * 1024;

function isNoteCreation(context: any): boolean {
  return context.req.method === 'POST' && new URL(context.req.url).pathname === '/api/notes';
}

const apiBodyLimit = createBodyLimitMiddleware({
  getMaxSizeBytes: context => (isNoteCreation(context) ? NOTE_BODY_LIMIT_BYTES : SMALL_BODY_LIMIT_BYTES),
  onExceeded: (context: any) => context.json(
    {
      error: isNoteCreation(context)
        ? { code: 'note.payload_too_large', message: 'Note payload is too large.' }
        : { code: 'request.body_too_large', message: 'Request body is too large.' },
    },
    413,
  ),
});

function createServer({ config, storageFactory }: { config?: Config; storageFactory: BindableStorageFactory }) {
  const app = new Hono<ServerInstanceGenerics>({ strict: true });

  app.use(loggerMiddleware);
  app.use(createConfigMiddleware({ config }));
  app.use(timeoutMiddleware);
  app.use(corsMiddleware);
  app.use(createStorageMiddleware({ storageFactory }));
  app.use('/api/*', apiBodyLimit);
  app.use(secureHeaders());
  app.use(authenticationMiddleware);

  registerErrorMiddleware({ app });

  registerAuthRoutes({ app });
  registerConfigRoutes({ app });
  registerAdminRoutes({ app });
  registerEmailGateMiddleware({ app });

  registerEmailGateRoutes({ app });

  registerNotesRoutes({ app });

  app.get('/api/ping', context => context.json({ status: 'ok' }));

  return {
    app,
  };
}

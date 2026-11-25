import type { ServerInstance } from '../server.types';
import { getDbStatus } from '../../db/db.client';
import { getEmailDeliveryHealth } from './health.state';

export { registerHealthRoutes };

function registerHealthRoutes({ app }: { app: ServerInstance }) {
  // Deeper than /api/ping, which only proves the process answers: this also reports
  // the two parts that have failed silently in the past — background email sending
  // and the database behind the opt-out list and the statistics.
  //
  // Answers 503 when degraded so an uptime check notices without parsing the body.
  app.get('/api/health', async (context) => {
    const database = await getDbStatus(context);
    const email = getEmailDeliveryHealth();

    // A database that is not configured is a supported setup, not a fault.
    const isDegraded = database === 'unavailable' || email.status === 'degraded';

    return context.json(
      {
        status: isDegraded ? 'degraded' : 'ok',
        database,
        email,
      },
      isDegraded ? 503 : 200,
    );
  });
}

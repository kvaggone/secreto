import { beforeEach, describe, expect, test } from 'vitest';
import { createMemoryStorage } from '../../../storage/factories/memory.storage';
import { overrideConfig } from '../../config/config.test-utils';
import { createServer } from '../../server';
import { recordEmailFailure, recordEmailSuccess, resetEmailDeliveryHealth } from '../health.state';

function createTestServer() {
  const { storage } = createMemoryStorage();
  const { app } = createServer({ storageFactory: () => ({ storage }), config: overrideConfig({}) });
  return { app };
}

describe('e2e', () => {
  describe('health', () => {
    beforeEach(() => {
      resetEmailDeliveryHealth();
    });

    test('an instance without a database reports ok, because running without one is a supported setup', async () => {
      const { app } = createTestServer();

      const response = await app.request('/api/health');

      expect(response.status).to.eql(200);
      expect(await response.json()).to.eql({
        status: 'ok',
        database: 'not-configured',
        email: {
          status: 'unknown',
          lastFailureAt: null,
          lastSuccessAt: null,
          failures: 0,
          deliveries: 0,
        },
      });
    });

    test('a failed send makes the endpoint answer 503, so an uptime check notices an outage the API itself hides', async () => {
      const { app } = createTestServer();
      recordEmailFailure();

      const response = await app.request('/api/health');
      const body = await response.json() as { status: string; email: { status: string; failures: number } };

      expect(response.status).to.eql(503);
      expect(body.status).to.eql('degraded');
      expect(body.email.status).to.eql('degraded');
      expect(body.email.failures).to.eql(1);
    });

    test('a later delivery clears the alert', async () => {
      const { app } = createTestServer();
      recordEmailFailure();
      recordEmailSuccess();

      const response = await app.request('/api/health');

      expect(response.status).to.eql(200);
      expect((await response.json() as { status: string }).status).to.eql('ok');
    });

    test('no address or provider message is exposed', async () => {
      const { app } = createTestServer();
      recordEmailFailure();

      const body = await (await app.request('/api/health')).text();

      expect(body).to.not.match(/@/);
      expect(body).to.not.match(/resend/i);
    });
  });
});

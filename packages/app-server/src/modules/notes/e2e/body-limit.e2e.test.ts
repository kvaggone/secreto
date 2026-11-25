import { describe, expect, test } from 'vitest';
import { overrideConfig } from '../../app/config/config.test-utils';
import { createServer } from '../../app/server';
import { createMemoryStorage } from '../../storage/factories/memory.storage';

function createTestServer() {
  const { storage } = createMemoryStorage();
  const { app } = createServer({ storageFactory: () => ({ storage }), config: overrideConfig({}) });
  return { app };
}

describe('e2e', () => {
  describe('request body limits', () => {
    test('an oversized body on a small API route is rejected before it is parsed', async () => {
      const { app } = createTestServer();
      const oversized = JSON.stringify({ email: `${'a'.repeat(300 * 1024)}@example.com` });

      const response = await app.request('/api/notes/some-note/request-code', {
        method: 'POST',
        body: oversized,
        headers: { 'Content-Type': 'application/json', 'Content-Length': String(oversized.length) },
      });

      expect(response.status).to.eql(413);
    });

    test('a note with more recipients than allowed is rejected without validating each address', async () => {
      const { app } = createTestServer();

      const response = await app.request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          payload: 'aaaaaaaa',
          deleteAfterReading: false,
          ttlInSeconds: 3600,
          encryptionAlgorithm: 'aes-256-gcm',
          serializationFormat: 'cbor-array',
          allowedEmails: Array.from({ length: 5000 }, (_, index) => `not-an-email-${index}`),
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).to.eql(400);

      const body = await response.json<any>();
      // One complaint about the list, not one per address.
      expect(JSON.stringify(body).length).toBeLessThan(2000);
    });

    test('a normal note is still accepted', async () => {
      const { app } = createTestServer();

      const response = await app.request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          payload: 'aaaaaaaa',
          deleteAfterReading: false,
          ttlInSeconds: 3600,
          encryptionAlgorithm: 'aes-256-gcm',
          serializationFormat: 'cbor-array',
          allowedEmails: ['someone@example.com'],
        }),
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.status).to.eql(200);
    });
  });
});

import { describe, expect, test } from 'vitest';
import { getEmailDeliveryHealth, recordEmailFailure, recordEmailSuccess, resetEmailDeliveryHealth } from './health.state';

const MINUTE = 60 * 1000;

describe('health state', () => {
  describe('getEmailDeliveryHealth', () => {
    test('an instance that has not sent anything yet is unknown, not degraded, so a quiet deployment does not read as an outage', () => {
      resetEmailDeliveryHealth();

      expect(getEmailDeliveryHealth({ now: 0 })).to.eql({
        status: 'unknown',
        lastFailureAt: null,
        lastSuccessAt: null,
        failures: 0,
        deliveries: 0,
      });
    });

    test('a recent failure with no later success is degraded', () => {
      resetEmailDeliveryHealth();
      recordEmailFailure({ now: 10 * MINUTE });

      expect(getEmailDeliveryHealth({ now: 11 * MINUTE }).status).to.eql('degraded');
    });

    test('a success after the failure clears it, since the next send proving delivery means the configuration works', () => {
      resetEmailDeliveryHealth();
      recordEmailFailure({ now: 10 * MINUTE });
      recordEmailSuccess({ now: 11 * MINUTE });

      expect(getEmailDeliveryHealth({ now: 12 * MINUTE }).status).to.eql('ok');
    });

    test('a failure older than the window stops being reported, so an incident resolves on its own once sending stops failing', () => {
      resetEmailDeliveryHealth();
      recordEmailFailure({ now: 0 });

      expect(getEmailDeliveryHealth({ now: 14 * MINUTE }).status).to.eql('degraded');
      expect(getEmailDeliveryHealth({ now: 16 * MINUTE }).status).to.eql('ok');
    });

    test('an earlier success does not hide a newer failure', () => {
      resetEmailDeliveryHealth();
      recordEmailSuccess({ now: 1 * MINUTE });
      recordEmailFailure({ now: 2 * MINUTE });

      expect(getEmailDeliveryHealth({ now: 3 * MINUTE }).status).to.eql('degraded');
    });

    test('counters and timestamps are reported, and never carry an address or a provider message', () => {
      resetEmailDeliveryHealth();
      recordEmailSuccess({ now: 1 * MINUTE });
      recordEmailFailure({ now: 2 * MINUTE });
      recordEmailFailure({ now: 3 * MINUTE });

      expect(getEmailDeliveryHealth({ now: 4 * MINUTE })).to.eql({
        status: 'degraded',
        lastFailureAt: new Date(3 * MINUTE).toISOString(),
        lastSuccessAt: new Date(1 * MINUTE).toISOString(),
        failures: 2,
        deliveries: 1,
      });
    });
  });
});

describe('health state ordering', () => {
  test('a success recorded in the same millisecond as the failure still clears it, because order of arrival decides, not the clock', () => {
    resetEmailDeliveryHealth();
    recordEmailFailure({ now: 5 * MINUTE });
    recordEmailSuccess({ now: 5 * MINUTE });

    expect(getEmailDeliveryHealth({ now: 5 * MINUTE }).status).to.eql('ok');
  });

  test('a failure recorded in the same millisecond as the success still counts, so an outage is not hidden by a stale delivery', () => {
    resetEmailDeliveryHealth();
    recordEmailSuccess({ now: 5 * MINUTE });
    recordEmailFailure({ now: 5 * MINUTE });

    expect(getEmailDeliveryHealth({ now: 5 * MINUTE }).status).to.eql('degraded');
  });
});

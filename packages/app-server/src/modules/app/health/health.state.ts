export { getEmailDeliveryHealth, recordEmailFailure, recordEmailSuccess, resetEmailDeliveryHealth };
export type { EmailDeliveryHealth };

// Sending happens in the background and its errors are deliberately hidden from the
// caller, so a broken mail configuration is invisible from outside the server. This
// keeps just enough state in memory for a health check to notice.
//
// Only counters and timestamps are kept: no addresses, no provider messages.
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

type EmailDeliveryHealth = {
  status: 'ok' | 'degraded' | 'unknown';
  lastFailureAt: string | null;
  lastSuccessAt: string | null;
  failures: number;
  deliveries: number;
};

type State = {
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  failures: number;
  deliveries: number;
  // Which of the two came last, by order of arrival rather than by clock: two sends
  // can land in the same millisecond, and then timestamps cannot tell them apart.
  lastFailureSequence: number;
  lastSuccessSequence: number;
  sequence: number;
};

const emptyState: State = {
  lastFailureAt: null,
  lastSuccessAt: null,
  failures: 0,
  deliveries: 0,
  lastFailureSequence: 0,
  lastSuccessSequence: 0,
  sequence: 0,
};

let state: State = emptyState;

function recordEmailSuccess({ now = Date.now() }: { now?: number } = {}) {
  const sequence = state.sequence + 1;
  state = { ...state, sequence, lastSuccessSequence: sequence, lastSuccessAt: now, deliveries: state.deliveries + 1 };
}

function recordEmailFailure({ now = Date.now() }: { now?: number } = {}) {
  const sequence = state.sequence + 1;
  state = { ...state, sequence, lastFailureSequence: sequence, lastFailureAt: now, failures: state.failures + 1 };
}

function resetEmailDeliveryHealth() {
  state = emptyState;
}

/**
 * Degraded while a failure is both recent and unanswered by a later success:
 * a transient provider error resolves itself on the next send, an expired or
 * unauthorised key keeps failing.
 *
 * `unknown` means nothing has been sent yet — a quiet instance is not a broken one,
 * so it must not read as an outage.
 */
function getEmailDeliveryHealth({ now = Date.now() }: { now?: number } = {}): EmailDeliveryHealth {
  const { lastFailureAt, lastSuccessAt, failures, deliveries, lastFailureSequence, lastSuccessSequence } = state;

  const hasRecentFailure = lastFailureAt !== null && now - lastFailureAt < FAILURE_WINDOW_MS;
  const isAnsweredBySuccess = lastSuccessSequence > lastFailureSequence;

  const status = hasRecentFailure && !isAnsweredBySuccess
    ? 'degraded'
    : lastFailureAt === null && lastSuccessAt === null ? 'unknown' : 'ok';

  return {
    status,
    lastFailureAt: lastFailureAt === null ? null : new Date(lastFailureAt).toISOString(),
    lastSuccessAt: lastSuccessAt === null ? null : new Date(lastSuccessAt).toISOString(),
    failures,
    deliveries,
  };
}

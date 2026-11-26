import { expect } from 'vitest';

export { expectExpiresInAbout };

/**
 * The view page counts down to `expirationDate`, so the API has to return it.
 * Asserting the exact value would mean freezing the clock; asserting the window
 * instead catches both a missing field and a TTL applied to the wrong unit.
 */
function expectExpiresInAbout({
  expirationDate,
  ttlInSeconds,
  toleranceInSeconds = 60,
}: {
  expirationDate: unknown;
  ttlInSeconds: number;
  toleranceInSeconds?: number;
}) {
  expect(expirationDate).to.be.a('string');

  const expiresInSeconds = (new Date(expirationDate as string).getTime() - Date.now()) / 1000;

  expect(Number.isNaN(expiresInSeconds)).to.eql(false);
  expect(Math.abs(expiresInSeconds - ttlInSeconds)).toBeLessThan(toleranceInSeconds);
}

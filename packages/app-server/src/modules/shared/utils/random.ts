import { ulidFactory } from 'ulid-workers';

export { generateId };

// Note ids are capability identifiers, not sort keys: monotonic mode would derive
// ids minted in the same millisecond from the previous one instead of fresh randomness.
const createUlid = ulidFactory({ monotonic: false });

function generateId() {
  return createUlid().toLowerCase();
}

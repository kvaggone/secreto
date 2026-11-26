import type { Note } from '../../notes/notes.types';

export { defineSerializationMethods };

// `serializeNote`'s buffer is handed straight to WebCrypto, which takes a view
// onto an `ArrayBuffer` rather than onto any `ArrayBufferLike`. A bare
// `Uint8Array` also covers `SharedArrayBuffer`, so the backing store is named.
// `parseNote` only reads, and stays permissive.
function defineSerializationMethods<Name extends string>(args: {
  name: Name;
  serializeNote: (args: { note: Note }) => Promise<{ noteBuffer: Uint8Array<ArrayBuffer> }>;
  parseNote: (args: { noteBuffer: Uint8Array }) => Promise<{ note: Note }>;
}) {
  return args;
}

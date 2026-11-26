import type { Note } from '../../../notes/notes.types';
import { decode, encode } from 'cbor-x';
import { defineSerializationMethods } from '../serialization.models';

export const cborArraySerializationDefinition = defineSerializationMethods({
  name: 'cbor-array',

  serializeNote: async ({ note }) => {
    // `encode` returns a small view onto one large ArrayBuffer that cbor-x
    // shares across calls, so that buffer still holds the plaintext of notes
    // serialized before this one. Copying the bytes out leaves a buffer this
    // note alone owns, and gives WebCrypto the ArrayBuffer-backed view its
    // types require.
    const encoded = encode([note.content, note.assets.map(({ content, metadata }) => ([metadata, content]))]);
    const noteBuffer = new Uint8Array(encoded);

    return { noteBuffer };
  },

  parseNote: async ({ noteBuffer }) => {
    const [content, assets] = decode(noteBuffer) as [string, [Record<string, unknown>, Uint8Array][]];

    const note = { content, assets: assets.map(([metadata, content]) => ({ metadata, content })) } as Note;

    return { note };
  },
});

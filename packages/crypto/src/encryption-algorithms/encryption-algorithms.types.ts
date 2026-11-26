import type { ENCRYPTION_ALGORITHMS } from './encryption-algorithms.constants';

// WebCrypto and Blob accept a view onto an `ArrayBuffer`, not onto any
// `ArrayBufferLike`. Since TypeScript 5.7 a bare `Uint8Array` means
// `Uint8Array<ArrayBufferLike>`, which also covers `SharedArrayBuffer` and is
// therefore rejected. Every buffer here is allocated locally and never shared,
// so the backing store is named explicitly.
export type EncryptionMethodsDefinition = {
  encryptBuffer: (args: { buffer: Uint8Array<ArrayBuffer>; encryptionKey: Uint8Array<ArrayBuffer> }) => Promise<{ encryptedString: string }>;
  decryptString: (args: { encryptedString: string; encryptionKey: Uint8Array<ArrayBuffer> }) => Promise<{ decryptedBuffer: Uint8Array<ArrayBuffer> }>;
};

export type EncryptionAlgorithm = typeof ENCRYPTION_ALGORITHMS[number];

export type EncryptionAlgorithmDefinitions = Record<EncryptionAlgorithm, EncryptionMethodsDefinition>;

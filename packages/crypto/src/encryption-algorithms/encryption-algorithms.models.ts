export { defineEncryptionMethods };

function defineEncryptionMethods(args: {
  encryptBuffer: (args: { buffer: Uint8Array<ArrayBuffer>; encryptionKey: Uint8Array<ArrayBuffer> }) => Promise<{ encryptedString: string }>;
  decryptString: (args: { encryptedString: string; encryptionKey: Uint8Array<ArrayBuffer> }) => Promise<{ decryptedBuffer: Uint8Array<ArrayBuffer> }>;
}) {
  return args;
}

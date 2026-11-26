import type { EncryptionAlgorithmDefinitions } from './encryption-algorithms/encryption-algorithms.types';
import { createEncryptionAlgorithmsRegistry } from './encryption-algorithms/encryption-algorithms.registry';

export { createSecretoCryptoApi };

function createSecretoCryptoApi({
  encryptionMethodDefinitions,
  ...api
}: {
  generateBaseKey: () => { baseKey: Uint8Array<ArrayBuffer> };
  deriveMasterKey: ({ baseKey, password }: { baseKey: Uint8Array<ArrayBuffer>; password?: string }) => Promise<{ masterKey: Uint8Array<ArrayBuffer> }>;
  base64UrlToBuffer: ({ base64Url }: { base64Url: string }) => Uint8Array<ArrayBuffer>;
  bufferToBase64Url: ({ buffer }: { buffer: Uint8Array }) => string;
  encryptionMethodDefinitions: EncryptionAlgorithmDefinitions;
}) {
  const { encryptionAlgorithms, getDecryptionMethod, getEncryptionMethod } = createEncryptionAlgorithmsRegistry({ encryptionMethodDefinitions });

  return {
    ...api,
    encryptionAlgorithms,
    encryptionMethodDefinitions,
    getDecryptionMethod,
    getEncryptionMethod,
  };
}

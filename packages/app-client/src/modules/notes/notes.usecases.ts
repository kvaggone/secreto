import { createNote, filesToNoteAssets } from '@secreto/lib';
import { storeNote } from './notes.services';

export { encryptAndCreateNote };

async function encryptAndCreateNote(args: {
  content: string;
  password?: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  fileAssets: File[];
  isPublic?: boolean;
  pathPrefix?: string;
  allowedEmails?: string[];
}) {
  const { allowedEmails, ...rest } = args;

  return createNote({
    ...rest,
    storeNote: (storeArgs: Parameters<typeof storeNote>[0]) =>
      storeNote({ ...storeArgs, allowedEmails }),
    clientBaseUrl: window.location.origin,
    assets: [
      ...await filesToNoteAssets({ files: args.fileAssets }),
    ],
  });
}

import { apiClient } from '../shared/http/http-client';

export { fetchNoteById, fetchNoteExists, fetchNoteGateStatus, requestNoteCode, storeNote, verifyNoteCode };

async function storeNote({
  payload,
  ttlInSeconds,
  deleteAfterReading,
  encryptionAlgorithm,
  serializationFormat,
  isPublic,
  allowedEmails,
}: {
  payload: string;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  encryptionAlgorithm: string;
  serializationFormat: string;
  isPublic?: boolean;
  allowedEmails?: string[];
}) {
  const { noteId } = await apiClient<{ noteId: string }>({
    path: '/api/notes',
    method: 'POST',
    body: {
      payload,
      ttlInSeconds,
      deleteAfterReading,
      serializationFormat,
      encryptionAlgorithm,
      isPublic,
      ...(allowedEmails?.length ? { allowedEmails } : {}),
    },
  });

  return { noteId };
}

type NotePayload = {
  payload: string;
  isPasswordProtected: boolean;
  assets: string[];
  serializationFormat: string;
  encryptionAlgorithm: string;
};

async function fetchNoteById({ noteId }: { noteId: string }) {
  return apiClient<{ note: NotePayload } | { requiresEmailVerification: true }>({
    path: `/api/notes/${noteId}`,
    method: 'GET',
  });
}

async function fetchNoteExists({ noteId }: { noteId: string }) {
  const { noteExists } = await apiClient<{ noteExists: boolean }>({
    method: 'GET',
    path: `/api/notes/${noteId}/exists`,
  });

  return { noteExists };
}

async function fetchNoteGateStatus({ noteId }: { noteId: string }) {
  return apiClient<{ requiresEmailVerification: boolean }>({
    method: 'GET',
    path: `/api/notes/${noteId}/gate-status`,
  });
}

async function requestNoteCode({ noteId, email }: { noteId: string; email: string }) {
  await apiClient<{ sent: boolean }>({
    path: `/api/notes/${noteId}/request-code`,
    method: 'POST',
    body: { email },
  });

  return { sent: true };
}

async function verifyNoteCode({
  noteId,
  email,
  code,
}: {
  noteId: string;
  email: string;
  code: string;
}) {
  return apiClient<{ note: NotePayload }>({
    path: `/api/notes/${noteId}/verify-code`,
    method: 'POST',
    body: { email, code },
  });
}

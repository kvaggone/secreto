export type Config = {
  baseApiUrl: string;
  documentationBaseUrl: string;
  isAuthenticationRequired: boolean;
  secretoVersion: string;
  defaultDeleteNoteAfterReading: boolean;
  defaultNoteTtlSeconds: number;
  isSettingNoExpirationAllowed: boolean;
  defaultNoteNoExpiration: boolean;
  viewNotePathPrefix: string;
};

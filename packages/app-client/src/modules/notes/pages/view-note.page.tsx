import { authStore } from '@/modules/auth/auth.store';
import { getFileIcon } from '@/modules/files/files.models';
import { useI18n } from '@/modules/i18n/i18n.provider';
import { isHttpErrorWithCode, isRateLimitError } from '@/modules/shared/http/http-errors';
import { cn } from '@/modules/shared/style/cn';
import { CopyButton } from '@/modules/shared/utils/copy';
import { Alert, AlertDescription } from '@/modules/ui/components/alert';
import { Button } from '@/modules/ui/components/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/modules/ui/components/card';
import { TextField, TextFieldLabel, TextFieldRoot } from '@/modules/ui/components/textfield';
import { formatBytes, safely, safelySync } from '@corentinth/chisels';
import { decryptNote, noteAssetsToFiles, parseNoteUrlHashFragment } from '@secreto/lib';
import { useLocation, useNavigate, useParams } from '@solidjs/router';
import JSZip from 'jszip';
import { type Component, createSignal, type JSX, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import {
  fetchNoteById,
  fetchNoteExists,
  fetchNoteGateStatus,
  requestNoteCode,
  verifyNoteCode,
} from '../notes.services';

// ── Password gate (unchanged from upstream) ───────────────────────────────────

const RequestPasswordForm: Component<{
  onPasswordEntered: (args: { password: string }) => void;
  getIsPasswordInvalid: () => boolean;
  setIsPasswordInvalid: (value: boolean) => void;
}> = (props) => {
  const [getPassword, setPassword] = createSignal('');
  const { t } = useI18n();

  function updatePassword(text: string) {
    setPassword(text);
    props.setIsPasswordInvalid(false);
  }

  return (
    <div class="sm:mt-6 p-6">
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardDescription>
            {t('view.request-password.description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => {
            e.preventDefault();
            props.onPasswordEntered({ password: getPassword() });
          }}
          >
            <div>
              <TextFieldRoot>
                <TextFieldLabel>{t('view.request-password.form.label')}</TextFieldLabel>
                <TextField type="password" autocomplete="new-password" placeholder={t('view.request-password.form.placeholder')} value={getPassword()} onInput={e => updatePassword(e.currentTarget.value)} autofocus data-test-id="note-password-prompt" />
              </TextFieldRoot>
            </div>
            <Button class="w-full mt-4" type="submit" data-test-id="note-password-submit">
              <div class="i-tabler-lock-open mr-2 text-lg"></div>
              {t('view.request-password.form.unlock-button')}
            </Button>
          </form>
          <Show when={props.getIsPasswordInvalid()}>
            <Alert class="mt-4" variant="destructive">
              <AlertDescription>
                {t('view.request-password.form.invalid')}
              </AlertDescription>
            </Alert>
          </Show>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Email gate UI ─────────────────────────────────────────────────────────────

const EmailGateForm: Component<{
  onComplete: (note: any) => void;
  onError: (err: { title: string; description: string }) => void;
  noteId: string;
}> = (props) => {
  const { t } = useI18n();
  const [getStep, setStep] = createSignal<'email' | 'code'>('email');
  const [getEmail, setEmail] = createSignal('');
  const [getCode, setCode] = createSignal('');
  const [getIsSubmitting, setIsSubmitting] = createSignal(false);
  const [getIsCodeInvalid, setIsCodeInvalid] = createSignal(false);

  const handleEmailSubmit = async (e: Event) => {
    e.preventDefault();
    setIsSubmitting(true);
    await safely(requestNoteCode({ noteId: props.noteId, email: getEmail() }));
    setIsSubmitting(false);
    setStep('code');
  };

  const handleCodeSubmit = async (e: Event) => {
    e.preventDefault();
    setIsCodeInvalid(false);
    setIsSubmitting(true);

    const [result, err] = await safely(verifyNoteCode({
      noteId: props.noteId,
      email: getEmail(),
      code: getCode(),
    }));

    setIsSubmitting(false);

    if (err) {
      if (isHttpErrorWithCode({ error: err, code: 'otp.attempts_exceeded' })) {
        props.onError({
          title: t('view.error.fetch-error.title'),
          description: 'Too many failed attempts. Please request a new code.',
        });
      } else {
        setIsCodeInvalid(true);
      }
      return;
    }

    props.onComplete(result.note);
  };

  return (
    <div class="sm:mt-6 p-6">
      <Card class="w-full max-w-sm mx-auto">
        <CardHeader>
          <CardTitle class="text-base font-semibold">
            <div class="i-tabler-lock mr-2 text-lg inline-block align-middle" />
            Restricted note
          </CardTitle>
          <CardDescription>
            <Show
              when={getStep() === 'email'}
              fallback={`Enter the 6-digit code sent to ${getEmail()}.`}
            >
              {t('view.request-email.description')}
            </Show>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Switch>
            <Match when={getStep() === 'email'}>
              <form onSubmit={handleEmailSubmit}>
                <TextFieldRoot>
                  <TextFieldLabel>{t('view.request-email.label')}</TextFieldLabel>
                  <TextField
                    type="email"
                    placeholder={t('view.request-email.placeholder')}
                    value={getEmail()}
                    onInput={e => setEmail(e.currentTarget.value)}
                    autofocus
                    required
                    data-test-id="email-gate-email"
                  />
                </TextFieldRoot>
                <Button class="w-full mt-4" type="submit" disabled={getIsSubmitting()}>
                  {getIsSubmitting()
                    ? <div class="i-tabler-loader-2 mr-2 text-lg animate-spin" />
                    : <div class="i-tabler-send mr-2 text-lg" />}
                  {t('view.request-email.submit')}
                </Button>
              </form>
            </Match>

            <Match when={getStep() === 'code'}>
              <form onSubmit={handleCodeSubmit}>
                <TextFieldRoot>
                  <TextFieldLabel>{t('view.verify-code.label')}</TextFieldLabel>
                  <TextField
                    type="text"
                    inputmode="numeric"
                    autocomplete="one-time-code"
                    placeholder={t('view.verify-code.placeholder')}
                    value={getCode()}
                    onInput={e => setCode(e.currentTarget.value.replace(/\D/g, '').slice(0, 6))}
                    autofocus
                    required
                    maxlength="6"
                    class="placeholder:text-muted-foreground/40"
                    data-test-id="email-gate-code"
                  />
                </TextFieldRoot>
                <Button class="w-full mt-4" type="submit" disabled={getIsSubmitting() || getCode().length !== 6}>
                  {getIsSubmitting()
                    ? <div class="i-tabler-loader-2 mr-2 text-lg animate-spin" />
                    : <div class="i-tabler-lock-open mr-2 text-lg" />}
                  {t('view.verify-code.submit')}
                </Button>
                <Button
                  variant="ghost"
                  class="w-full mt-2 text-muted-foreground text-sm"
                  onClick={() => { setStep('email'); setCode(''); setIsCodeInvalid(false); }}
                >
                  {t('view.verify-code.resend')}
                </Button>
              </form>
              <Show when={getIsCodeInvalid()}>
                <Alert class="mt-4" variant="destructive">
                  <AlertDescription>
                    {t('view.verify-code.invalid')}
                  </AlertDescription>
                </Alert>
              </Show>
            </Match>
          </Switch>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────

export const ViewNotePage: Component = () => {
  const params = useParams();
  const location = useLocation();
  const [isPasswordEntered, setIsPasswordEntered] = createSignal(false);
  const [getError, setError] = createSignal<{ title: string; description: string; action?: JSX.Element } | null>(null);
  const [getNote, setNote] = createSignal<{ payload: string; isPasswordProtected: boolean; encryptionAlgorithm: string; serializationFormat: string } | null>(null);
  const [getDecryptedNote, setDecryptedNote] = createSignal<string | null>(null);
  const [getIsPasswordInvalid, setIsPasswordInvalid] = createSignal(false);
  const [fileAssets, setFileAssets] = createSignal<File[]>([]);
  const [isDownloadingAllLoading, setIsDownloadingAllLoading] = createSignal(false);
  const [getShowWarnForNoteDeletion, setShowWarnForNoteDeletion] = createSignal(false);
  const [getResolveWarnForNoteDeletion, setResolveWarnForNoteDeletion] = createSignal<(() => void) | null>(null);
  const [getRequiresEmailVerification, setRequiresEmailVerification] = createSignal(false);

  const [getEncryptionKey, setEncryptionKey] = createSignal('');
  const [getIsPasswordProtected, setIsPasswordProtected] = createSignal(false);
  const [getIsDeletedAfterReading, setIsDeletedAfterReading] = createSignal(false);
  const [getExpirationDate, setExpirationDate] = createSignal<string | null>(null);
  const [getNow, setNow] = createSignal(Date.now());

  const { t } = useI18n();
  const navigate = useNavigate();

  // Tick every second so the countdown updates live.
  const countdownInterval = setInterval(() => setNow(Date.now()), 1000);
  onCleanup(() => clearInterval(countdownInterval));

  const pad = (n: number) => n.toString().padStart(2, '0');

  // Returns just the "1d 02h 03m 04s" time string (no label).
  const formatTimeString = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (days > 0 || hours > 0) parts.push(`${pad(hours)}h`);
    parts.push(`${pad(minutes)}m`, `${pad(seconds)}s`);
    return parts.join(' ');
  };

  // Full single-line label, used on desktop.
  const formatRemaining = (ms: number): string => {
    if (ms <= 0) return t('view.lifetime.expired');
    return t('view.lifetime.expires-in', { time: formatTimeString(ms) });
  };

  // Human-readable note lifetime, shown next to the content.
  const getLifetimeText = () => {
    if (getIsDeletedAfterReading()) return t('view.lifetime.delete-after-reading');
    const expiration = getExpirationDate();
    if (expiration) return formatRemaining(new Date(expiration).getTime() - getNow());
    return t('view.lifetime.never');
  };

  // For mobile two-line display: { label, time? }
  const getLifetimeParts = (): { label: string; time?: string } => {
    if (getIsDeletedAfterReading()) return { label: t('view.lifetime.delete-after-reading') };
    const expiration = getExpirationDate();
    if (expiration) {
      const ms = new Date(expiration).getTime() - getNow();
      if (ms <= 0) return { label: t('view.lifetime.expired') };
      return { label: 'Will be purged', time: formatTimeString(ms) };
    }
    return { label: t('view.lifetime.never') };
  };

  const warnForNoteDeletion = async () => {
    setShowWarnForNoteDeletion(true);
    return new Promise<void>((resolve) => {
      setResolveWarnForNoteDeletion(() => resolve);
    });
  };

  const acceptWarnForNoteDeletion = () => {
    setShowWarnForNoteDeletion(false);
    const resolve = getResolveWarnForNoteDeletion();
    resolve?.();
  };

  const decrypt = async ({ password }: { password?: string } = {}) => {
    const { payload, encryptionAlgorithm, serializationFormat } = getNote()!;

    const [decryptionResult, decryptionError] = await safely(decryptNote({
      encryptedPayload: payload,
      encryptionKey: getEncryptionKey(),
      password,
      encryptionAlgorithm: encryptionAlgorithm as 'aes-256-gcm',
      serializationFormat: serializationFormat as 'cbor-array',
    }));

    if (decryptionError && password) {
      setIsPasswordInvalid(true);
      return;
    }

    if (decryptionError) {
      setError({
        title: t('view.error.decryption.title'),
        description: t('view.error.decryption.description'),
      });
      return;
    }

    const { note } = decryptionResult;

    const files = await noteAssetsToFiles({ noteAssets: note.assets });
    setFileAssets(files);
    setDecryptedNote(note.content);
    setIsPasswordEntered(true);
  };

  // Called after email gate verification succeeds
  const handleEmailGateSuccess = async (note: any) => {
    setRequiresEmailVerification(false);
    setNote(note);
    if (note?.expirationDate) {
      setExpirationDate(note.expirationDate);
    }

    // A note can be protected by BOTH an email gate and a password.
    // If it's also password-protected, show the password prompt instead of
    // decrypting straight away.
    if (getIsPasswordProtected()) {
      return;
    }

    await decrypt();
  };

  onMount(async () => {
    const [parsedHashFragment, parsingError] = safelySync(() => parseNoteUrlHashFragment({ hashFragment: location.hash }));

    if (parsingError) {
      setError({
        title: t('view.error.invalid-url.title'),
        description: t('view.error.invalid-url.description'),
      });
      return;
    }

    const { encryptionKey, isPasswordProtected, isDeletedAfterReading } = parsedHashFragment;

    setIsPasswordProtected(isPasswordProtected);
    setIsDeletedAfterReading(isDeletedAfterReading);
    setEncryptionKey(encryptionKey);

    if (!encryptionKey) {
      setError({
        title: t('view.error.invalid-url.title'),
        description: t('view.error.invalid-url.description'),
      });
      return;
    }

    if (isDeletedAfterReading) {
      // For burn-after-reading notes, first check for email gate WITHOUT burning.
      const [gateStatus] = await safely(fetchNoteGateStatus({ noteId: params.noteId }));

      if (gateStatus?.requiresEmailVerification) {
        setRequiresEmailVerification(true);
        return;
      }

      // No email gate — proceed with the existing burn-after-reading confirmation flow.
      const [noteExistsResult, noteExistsError] = await safely(fetchNoteExists({ noteId: params.noteId }));

      if (noteExistsError) {
        setError({
          title: t('view.error.fetch-error.title'),
          description: t('view.error.fetch-error.description'),
        });
        return;
      }

      const { noteExists } = noteExistsResult;

      if (!noteExists) {
        setError({
          title: t('view.error.note-not-found.title'),
          description: t('view.error.note-not-found.description'),
        });
        return;
      }

      await warnForNoteDeletion();
    }

    const [fetchedNote, fetchError] = await safely(fetchNoteById({ noteId: params.noteId }));

    if (isRateLimitError({ error: fetchError })) {
      setError({
        title: t('view.error.rate-limit.title'),
        description: t('view.error.rate-limit.description'),
      });
      return;
    }

    if (isHttpErrorWithCode({ error: fetchError, code: 'auth.unauthorized' })) {
      setError({
        title: t('view.error.unauthorized.title'),
        description: t('view.error.unauthorized.description'),
        action: (
          <Button
            onClick={() => {
              authStore.setRedirectUrl(location.pathname + location.hash);
              navigate('/login');
            }}
            variant="secondary"
          >
            <div class="i-tabler-login-2 mr-2 text-lg"></div>
            {t('view.error.unauthorized.button')}
          </Button>
        ),
      });
      return;
    }

    if (isHttpErrorWithCode({ error: fetchError, code: 'note.not_found' })) {
      setError({
        title: t('view.error.note-not-found.title'),
        description: t('view.error.note-not-found.description'),
      });
      return;
    }

    if (fetchError) {
      setError({
        title: t('view.error.fetch-error.title'),
        description: t('view.error.fetch-error.description'),
      });
      return;
    }

    // Email-gated note — server returned { requiresEmailVerification: true }
    if ((fetchedNote as any).requiresEmailVerification) {
      setRequiresEmailVerification(true);
      return;
    }

    const { note } = fetchedNote as { note: any };
    setNote(note);
    if (note?.expirationDate) {
      setExpirationDate(note.expirationDate);
    }

    if (getIsPasswordProtected()) {
      return;
    }

    await decrypt();
  });

  const downloadFile = async ({ file }: { file: File }) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAllFiles = async () => {
    setIsDownloadingAllLoading(true);
    const zipFile = new JSZip();
    fileAssets().forEach((file) => {
      zipFile.file(file.name, file);
    });

    const blob = await zipFile.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'note-files.zip';
    a.click();
    URL.revokeObjectURL(url);
    setIsDownloadingAllLoading(false);
  };

  return (
    <div>

      <Switch
        fallback={(
          <div class="mx-auto max-w-400px text-center mt-6 flex flex-col justify-center items-center p-6 gap-2">
            <div class="i-tabler-loader-2 text-3xl animate-spin text-muted-foreground op-60"></div>
            <div class="text-muted-foreground">{t('view.loading')}</div>
          </div>
        )}
      >

        <Match when={getError()}>
          {error => (
            <div class="mx-auto max-w-300px text-center mt-6 flex flex-col justify-center items-center">
              <div class="i-tabler-alert-triangle text-4xl text-muted-foreground op-60"></div>
              <div class="text-lg font-bold mt-2">
                {error().title}
              </div>
              <div class="mt-2 mb-4 text-muted-foreground text-pretty">
                {error().description}
              </div>

              {error().action}
            </div>
          )}
        </Match>

        <Match when={getShowWarnForNoteDeletion()}>
          <div class="sm:mt-6 p-6">
            <Card class="w-full max-w-sm mx-auto">
              <CardHeader>
                <CardTitle class="text-base font-semibold">
                  {t('view.warn-for-note-deletion.title')}
                </CardTitle>
                <CardDescription>
                  {t('view.warn-for-note-deletion.description')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div class="flex gap-4">
                  <Button onClick={acceptWarnForNoteDeletion} class="w-full" data-test-id="note-deletion-accept">
                    {t('view.warn-for-note-deletion.confirm')}
                    <div class="i-tabler-arrow-right ml-2 text-lg"></div>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </Match>

        <Match when={getRequiresEmailVerification()}>
          <EmailGateForm
            noteId={params.noteId}
            onComplete={handleEmailGateSuccess}
            onError={err => setError({ ...err })}
          />
        </Match>

        <Match when={getIsPasswordProtected() && !isPasswordEntered()}>
          <RequestPasswordForm onPasswordEntered={decrypt} getIsPasswordInvalid={getIsPasswordInvalid} setIsPasswordInvalid={setIsPasswordInvalid} />
        </Match>

        <Match when={getDecryptedNote() || fileAssets().length > 0}>

          <div class="mx-auto max-w-1200px px-6 mt-6 flex gap-4 md:flex-row-reverse flex-col justify-center min-w-0">
            {getDecryptedNote() && (
              <div class="flex-1 mb-4 min-w-0">
                <div class="flex items-center gap-2 mb-4">
                  {/* Mobile: two-line lifetime on the left */}
                  <div class="flex-1 sm:hidden text-sm text-muted-foreground leading-tight">
                    <div>{getLifetimeParts().label}</div>
                    <Show when={getLifetimeParts().time}>
                      {time => <div class="tabular-nums">{time()}</div>}
                    </Show>
                  </div>
                  {/* Desktop: "Note content" label + centred countdown */}
                  <div class="text-muted-foreground flex-shrink-0 hidden sm:block">
                    {t('view.note-content')}
                  </div>
                  <div class="flex-1 text-center text-muted-foreground px-2 truncate tabular-nums hidden sm:block" title={getLifetimeText()}>
                    {getLifetimeText()}
                  </div>
                  <CopyButton text={getDecryptedNote()!} variant="secondary" />
                </div>

                <Card class="w-full rounded-md shadow-sm mb-2">
                  <CardContent class="p-6">
                    <pre class="whitespace-pre-wrap break-all" data-test-id="note-content-display">
                      {getDecryptedNote()}
                    </pre>
                  </CardContent>
                </Card>

              </div>
            )}

            {fileAssets().length > 0 && (
              <div class="flex flex-col gap-4">
                <div class="flex md:min-w-500px items-center h-9">
                  <div class="text-muted-foreground">
                    {
                      fileAssets().length > 1
                        ? t('view.assets.heading-multiple', { count: fileAssets().length })
                        : t('view.assets.heading-single')
                    }
                  </div>

                  {fileAssets().length > 1 && (
                    <Button
                      class="ml-auto"
                      variant="secondary"
                      onClick={downloadAllFiles}
                      disabled={isDownloadingAllLoading()}
                    >
                      {isDownloadingAllLoading()
                        ? <div class="i-tabler-loader-2 mr-2 text-lg animate-spin"></div>
                        : <div class="i-tabler-file-zip mr-2 text-lg"></div>}

                      {t('view.assets.download-all')}
                    </Button>
                  )}
                </div>

                <div class="flex flex-col gap-2 md:min-w-500px">
                  {
                    fileAssets().map(file => (
                      <Card class="w-full rounded-md shadow-sm ">
                        <CardContent class="p-4 flex items-center gap-3">
                          <div class={cn('text-4xl text-muted-foreground op-50 flex-shrink-0', getFileIcon({ file }))} />
                          <div class="flex flex-col min-w-0">
                            <button class="p-0 h-auto cursor-pointer hover:underline truncate block" onClick={() => downloadFile({ file })} title={file.name}>
                              {file.name}
                            </button>
                            <div class="text-muted-foreground text-xs">
                              {formatBytes({ bytes: file.size })}
                            </div>
                          </div>
                          <div class="ml-auto">
                            <Button variant="secondary" onClick={() => downloadFile({ file })}>
                              <div class="i-tabler-download mr-2 text-lg"></div>
                              {t('view.assets.download')}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </Match>
      </Switch>
    </div>
  );
};

import { authStore } from '@/modules/auth/auth.store';
import { getConfig } from '@/modules/config/config.provider';
import { getFileIcon } from '@/modules/files/files.models';
import { useI18n } from '@/modules/i18n/i18n.provider';
import { svgToBase64Png } from '@/modules/shared/files/convert';
import { downloadBase64File, downloadSvgFile } from '@/modules/shared/files/download';
import { isHttpErrorWithCode, isHttpErrorWithStatusCode, isRateLimitError } from '@/modules/shared/http/http-errors';
import { cn } from '@/modules/shared/style/cn';
import { CopyButton, useCopy } from '@/modules/shared/utils/copy';
import { Alert, AlertDescription } from '@/modules/ui/components/alert';
import { Button } from '@/modules/ui/components/button';
import { Card, CardHeader } from '@/modules/ui/components/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/modules/ui/components/dropdown-menu';
import { toast } from '@/modules/ui/components/sonner';
import { SwitchControl, SwitchLabel, SwitchThumb, Switch as SwitchUiComponent } from '@/modules/ui/components/switch';
import { Tabs, TabsIndicator, TabsList, TabsTrigger } from '@/modules/ui/components/tabs';
import { TextArea } from '@/modules/ui/components/textarea';
import { TextField, TextFieldLabel, TextFieldRoot } from '@/modules/ui/components/textfield';
import { safely } from '@corentinth/chisels';
import { useNavigate } from '@solidjs/router';
import { type Component, createSignal, Match, onCleanup, onMount, Show, Switch } from 'solid-js';
import { renderSVG as renderQrCodeSvg } from 'uqr';
import { EmailAllowlistField } from '../components/email-allowlist-field';
import { FileUploaderButton } from '../components/file-uploader';
import { NotePasswordField } from '../components/note-password-field';
import { useNoteContext } from '../notes.context';
import { encryptAndCreateNote } from '../notes.usecases';

const QrCodeCard: Component<{ noteUrl: string }> = (props) => {
  const getNoteUrl = () => props.noteUrl;
  const { t } = useI18n();
  const { copy } = useCopy();

  const downloadSvgQrCode = () => {
    downloadSvgFile({ svg: renderQrCodeSvg(getNoteUrl()), fileName: 'note-qr-code.svg' });
    toast.success(t('create.qr-code.download-success'));
  };

  const downloadPngQrCode = async () => {
    const base64 = await svgToBase64Png({ svg: renderQrCodeSvg(getNoteUrl()), width: 512, height: 512 });
    downloadBase64File({ base64, fileName: 'note-qr-code.png' });
    toast.success(t('create.qr-code.download-success'));
  };

  const copyQrCodeSvg = () => {
    copy({ text: renderQrCodeSvg(getNoteUrl()) });
    toast.success(t('create.qr-code.copy-success'));
  };

  return (
    <Card class="max-w-500px mx-auto mt-6">
      <CardHeader>
        <div class="flex items-center gap-4 flex-col-reverse sm:flex-row sm:items-stretch">
          <div class="w-full max-w-200px">
            <div innerHTML={renderQrCodeSvg(getNoteUrl(), { blackColor: 'white', whiteColor: 'transparent' })} class="dark:block light:hidden" />
            <div innerHTML={renderQrCodeSvg(getNoteUrl(), { blackColor: 'black', whiteColor: 'transparent' })} class="light:block dark:hidden" />
          </div>

          <div class="flex flex-col gap-2 justify-between">
            <div>
              <div class="text-sm font-semibold">
                {t('create.qr-code.title')}
              </div>

              <div class="text-muted-foreground">
                {t('create.qr-code.description')}
              </div>
            </div>

            <div>
              <DropdownMenu>
                <DropdownMenuTrigger>
                  <Button variant="secondary">
                    {t('create.qr-code.export')}
                    <div class="i-tabler-chevron-down ml-2 text-lg"></div>
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={downloadPngQrCode}
                    class="cursor-pointer"
                  >
                    <div class="i-tabler-photo mr-2 text-lg"></div>
                    {t('create.qr-code.download-png')}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={downloadSvgQrCode}
                    class="cursor-pointer"
                  >
                    <div class="i-tabler-file-type-svg mr-2 text-lg"></div>
                    {t('create.qr-code.download-svg')}
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={copyQrCodeSvg} class="cursor-pointer">
                    <div class="i-tabler-copy mr-2 text-lg"></div>
                    {t('create.qr-code.copy-svg')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};

export const CreateNotePage: Component = () => {
  const config = getConfig();
  const { t } = useI18n();
  const navigate = useNavigate();
  const { onResetNoteForm, removeResetNoteFormHandler } = useNoteContext();

  const [getContent, setContent] = createSignal('');
  const [getPassword, setPassword] = createSignal('');
  const [getAllowedEmails, setAllowedEmails] = createSignal<string[]>([]);
  const [getNoteUrl, setNoteUrl] = createSignal('');
  const [getError, setError] = createSignal<{ message: string; details?: string } | null>(null);
  const [getIsNoteCreated, setIsNoteCreated] = createSignal(false);
  const [getIsPublic, setIsPublic] = createSignal(true);
  const [getTtlInSeconds, setTtlInSeconds] = createSignal(config.defaultNoteTtlSeconds);
  const [getDeleteAfterReading, setDeleteAfterReading] = createSignal(config.defaultDeleteNoteAfterReading);
  const [getUploadedFiles, setUploadedFiles] = createSignal<File[]>([]);
  const [getIsNoteCreating, setIsNoteCreating] = createSignal(false);
  const [getHasNoExpiration, setHasNoExpiration] = createSignal(config.defaultNoteNoExpiration);
  // Mutually-exclusive access control: only one of password / email can be active.
  const [getAccessMode, setAccessMode] = createSignal<'none' | 'password' | 'email'>('none');

  // Auto-activate a mode when the user starts filling its field, deactivating the other.
  function updatePassword(value: string) {
    setPassword(value);
    if (value && getAccessMode() !== 'password') {
      setAccessMode('password');
    }
  }

  function updateAllowedEmails(emails: string[]) {
    setAllowedEmails(emails);
    if (emails.length > 0 && getAccessMode() !== 'email') {
      setAccessMode('email');
    }
  }

  function resetNoteForm() {
    setContent('');
    setAccessMode('none');
    setPassword('');
    setAllowedEmails([]);
    setNoteUrl('');
    setError(null);
    setIsPublic(true);
    setIsNoteCreated(false);
    setTtlInSeconds(config.defaultNoteTtlSeconds);
    setDeleteAfterReading(config.defaultDeleteNoteAfterReading);
    setUploadedFiles([]);
    setIsNoteCreating(false);
    setHasNoExpiration(config.defaultNoteNoExpiration);
  }

  onMount(() => {
    if (config.isAuthenticationRequired && !authStore.getIsAuthenticated()) {
      navigate('/login');
      return;
    }

    onResetNoteForm(resetNoteForm);
  });

  onCleanup(() => {
    removeResetNoteFormHandler(resetNoteForm);
  });

  const createNote = async () => {
    if (!getContent() && getUploadedFiles().length === 0) {
      setError({ message: t('create.errors.empty-note') });
      return;
    }

    setIsNoteCreating(true);

    const activePassword = getAccessMode() === 'password' ? getPassword() : '';
    const activeEmails = getAccessMode() === 'email' ? getAllowedEmails() : [];

    const [createdNote, error] = await safely(encryptAndCreateNote({
      content: getContent(),
      password: activePassword,
      ttlInSeconds: getHasNoExpiration() ? undefined : getTtlInSeconds(),
      deleteAfterReading: getDeleteAfterReading(),
      fileAssets: getUploadedFiles(),
      isPublic: getIsPublic(),
      pathPrefix: config.viewNotePathPrefix,
      allowedEmails: activeEmails.length > 0 ? activeEmails : undefined,
    }));

    setIsNoteCreating(false);

    if (!error) {
      const { noteUrl } = createdNote;
      setNoteUrl(noteUrl);
      setIsNoteCreated(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (isRateLimitError({ error })) {
      setError({ message: t('create.errors.rate-limit') });
      return;
    }

    if (isHttpErrorWithCode({ error, code: 'note.payload_too_large' })) {
      setError({ message: t('create.errors.too-large') });
      return;
    }

    if (isHttpErrorWithCode({ error, code: 'email.suppressed' })) {
      const suppressedEmail = (error as any)?.body?.error?.email ?? '';
      setError({ message: t('create.errors.email-suppressed', { email: suppressedEmail }) });
      return;
    }

    if (isHttpErrorWithCode({ error, code: 'auth.unauthorized' })) {
      setError({ message: t('create.errors.unauthorized') });
      return;
    }

    if (isHttpErrorWithStatusCode({ error, statusCode: 404 })) {
      setError({ message: t('create.errors.api-not-found') });
      return;
    }

    setError({ message: t('create.errors.unknown'), details: error.message });
    console.error(error);
  };

  function updateContent(text: string) {
    setContent(text);
    setError(null);
  }

  function updateUploadedFiles(files: File[]) {
    setUploadedFiles(prevFiles => [...prevFiles, ...files]);
    setError(null);
  }

  const getIsShareApiSupported = () => navigator.share !== undefined;

  const shareNote = async () => {
    if (!getIsShareApiSupported()) {
      return;
    }

    try {
      await navigator.share({
        title: t('create.share.title'),
        text: t('create.share.description'),
        url: getNoteUrl(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div class="mx-auto max-w-1200px px-6 mt-6 flex gap-4 flex-col sm:flex-row">
      <Switch>
        <Match when={!getIsNoteCreated()}>
          <TextFieldRoot class="w-full ">
            <TextArea
              placeholder={t('create.settings.placeholder')}
              class="flex-1 p-4 min-h-300px sm:min-h-700px"
              value={getContent()}
              onInput={e => updateContent(e.currentTarget.value)}
              data-test-id="note-content"
            />
          </TextFieldRoot>

          <div class="w-full sm:w-320px flex flex-col gap-4 flex-shrink-0">

            {/* Password protection — mutually exclusive with the email gate */}
            <TextFieldRoot class="w-full">
              <TextFieldLabel>
                {t('create.settings.password.label')}
              </TextFieldLabel>
              <SwitchUiComponent
                class="flex items-center space-x-2 mb-2"
                checked={getAccessMode() === 'password'}
                onChange={(checked: boolean) => setAccessMode(checked ? 'password' : 'none')}
              >
                <SwitchControl data-test-id="enable-password">
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm text-muted-foreground">
                  {t('create.settings.enable-feature')}
                </SwitchLabel>
              </SwitchUiComponent>
              <div classList={{ 'opacity-40 pointer-events-none': getAccessMode() === 'email' }}>
                <NotePasswordField getPassword={getPassword} setPassword={updatePassword} dataTestId="note-password" />
              </div>
            </TextFieldRoot>

            {/* Email access gate — mutually exclusive with the password */}
            <TextFieldRoot class="w-full">
              <TextFieldLabel>
                {t('create.settings.email-gate.label')}
              </TextFieldLabel>
              <SwitchUiComponent
                class="flex items-center space-x-2 mb-2"
                checked={getAccessMode() === 'email'}
                onChange={(checked: boolean) => setAccessMode(checked ? 'email' : 'none')}
              >
                <SwitchControl data-test-id="enable-email-gate">
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm text-muted-foreground">
                  {t('create.settings.enable-feature')}
                </SwitchLabel>
              </SwitchUiComponent>
              <div classList={{ 'opacity-40 pointer-events-none': getAccessMode() === 'password' }}>
                <EmailAllowlistField
                  getEmails={getAllowedEmails}
                  setEmails={updateAllowedEmails}
                  placeholder={t('create.settings.email-gate.placeholder')}
                  dataTestId="note-allowed-emails"
                />
                <p class="text-xs text-muted-foreground mt-1">
                  {t('create.settings.email-gate.description')}
                </p>
              </div>
            </TextFieldRoot>

            <TextFieldRoot class="w-full">
              <TextFieldLabel>
                {t('create.settings.expiration')}
              </TextFieldLabel>

              {config.isSettingNoExpirationAllowed && (
                <SwitchUiComponent class="flex items-center space-x-2 pb-1" checked={getHasNoExpiration()} onChange={setHasNoExpiration}>
                  <SwitchControl data-test-id="no-expiration">
                    <SwitchThumb />
                  </SwitchControl>
                  <SwitchLabel class="text-sm text-muted-foreground">
                    {t('create.settings.no-expiration')}
                  </SwitchLabel>
                </SwitchUiComponent>
              )}

              <Tabs
                value={getTtlInSeconds().toString()}
                onChange={(value: string) => setTtlInSeconds(Number(value))}
                disabled={getHasNoExpiration()}
              >
                <TabsList>
                  <TabsIndicator />
                  <TabsTrigger value="3600">{t('create.settings.delays.1h')}</TabsTrigger>
                  <TabsTrigger value="86400">{t('create.settings.delays.1d')}</TabsTrigger>
                  <TabsTrigger value="604800">{t('create.settings.delays.1w')}</TabsTrigger>
                  <TabsTrigger value="2592000">{t('create.settings.delays.1m')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </TextFieldRoot>

            <TextFieldRoot class="w-full">
              <TextFieldLabel>
                {t('create.settings.delete-after-reading.label')}
              </TextFieldLabel>
              <SwitchUiComponent class="flex items-center space-x-2" checked={getDeleteAfterReading()} onChange={setDeleteAfterReading}>
                <SwitchControl data-test-id="delete-after-reading">
                  <SwitchThumb />
                </SwitchControl>
                <SwitchLabel class="text-sm text-muted-foreground">
                  {t('create.settings.delete-after-reading.description')}
                </SwitchLabel>
              </SwitchUiComponent>
            </TextFieldRoot>

            <div>
              <FileUploaderButton variant="secondary" class="mt-2 w-full" multiple onFilesUpload={({ files }) => updateUploadedFiles(files)}>
                <div class="i-tabler-upload mr-2 text-lg text-muted-foreground"></div>
                {t('create.settings.attach-files')}
              </FileUploaderButton>

              <Button class="mt-2 w-full" onClick={createNote} disabled={getIsNoteCreating()} data-test-id="create-note">
                <div class={cn('mr-2 text-lg text-muted-foreground', getIsNoteCreating() ? 'i-tabler-loader-2 animate-spin' : 'i-tabler-plus')}></div>
                {getIsNoteCreating() ? t('create.settings.creating') : t('create.settings.create')}
              </Button>
            </div>

            <div class="flex flex-col gap-1">
              {getUploadedFiles().map(file => (
                <div class="flex items-center gap-2">
                  <div class={cn('text-lg text-muted-foreground flex-shrink-0', getFileIcon({ file }))} />
                  <div class="truncate" title={file.name}>
                    {file.name}
                  </div>

                  <Button class="size-9 ml-auto" variant="ghost" onClick={() => setUploadedFiles(prevFiles => prevFiles.filter(f => f !== file))}>
                    <div class="i-tabler-x text-lg text-muted-foreground cursor-pointer flex-shrink-0"></div>
                  </Button>
                </div>
              ))}
            </div>

            <Show when={getError()}>
              {error => (
                <Alert variant="destructive">
                  <AlertDescription>
                    {error().message}
                  </AlertDescription>
                </Alert>
              )}
            </Show>

          </div>

        </Match>

        <Match when={getIsNoteCreated()}>
          <div class="flex flex-col justify-center items-center gap-2 w-full mt-12  mx-auto">
            <div class="i-tabler-circle-check text-primary text-5xl"></div>
            <div class="text-xl font-semibold">
              {t('create.success.title')}
            </div>

            <div class="text-muted-foreground text-center max-w-400px">
              {
                [
                  t('create.success.description'),
                  getDeleteAfterReading() && t('create.success.with-deletion'),
                ].filter(Boolean).join(' ')
              }

            </div>

            <TextFieldRoot class="w-full max-w-800px mt-4">
              <TextField value={getNoteUrl()} readonly class="w-full text-center" data-test-id="note-url" />
            </TextFieldRoot>

            <div class="flex items-center gap-2 w-full mx-auto mt-2 justify-center flex-col sm:flex-row">

              <CopyButton
                variant="secondary"
                class="flex-shrink-0 w-full sm:w-auto"
                autofocus
                text={getNoteUrl()}
                label={t('create.success.copy-link')}
                copiedLabel={t('create.success.copy-success')}
              />

              {/* Hide for burn-after-reading notes — opening would consume the single view. */}
              <Show when={!getDeleteAfterReading()}>
                <Button variant="secondary" as="a" href={getNoteUrl()} class="flex-shrink-0 w-full sm:w-auto">
                  <div class="i-tabler-eye mr-2 text-lg"></div>
                  {t('create.success.open-note')}
                </Button>
              </Show>

              <Show when={getIsShareApiSupported()}>
                <Button variant="secondary" class="flex-shrink-0 w-full sm:w-auto" onClick={shareNote}>
                  <div class="i-tabler-share mr-2 text-lg"></div>
                  {t('create.share.button')}
                </Button>
              </Show>
            </div>

            <QrCodeCard noteUrl={getNoteUrl()} />
          </div>
        </Match>
      </Switch>
    </div>
  );
};

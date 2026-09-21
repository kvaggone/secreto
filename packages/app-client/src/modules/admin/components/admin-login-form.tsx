import { useI18n } from '@/modules/i18n/i18n.provider';
import { isHttpErrorWithStatusCode, isRateLimitError } from '@/modules/shared/http/http-errors';
import { Alert, AlertDescription } from '@/modules/ui/components/alert';
import { Button } from '@/modules/ui/components/button';
import { TextField, TextFieldLabel, TextFieldRoot } from '@/modules/ui/components/textfield';
import { safely } from '@corentinth/chisels';
import { type Component, createSignal, Show } from 'solid-js';
import { loginAdmin } from '../admin.services';

export const AdminLoginForm: Component<{ onSuccess: () => void }> = (props) => {
  const { t } = useI18n();
  const [getEmail, setEmail] = createSignal('');
  const [getPassword, setPassword] = createSignal('');
  const [getError, setError] = createSignal<string | null>(null);
  const [getIsSubmitting, setIsSubmitting] = createSignal(false);

  const onSubmit = async () => {
    setIsSubmitting(true);
    const [, error] = await safely(loginAdmin({ email: getEmail(), password: getPassword() }));
    setIsSubmitting(false);

    if (!error) {
      props.onSuccess();
      return;
    }

    if (isHttpErrorWithStatusCode({ error, statusCode: 401 }) || isHttpErrorWithStatusCode({ error, statusCode: 400 })) {
      setError(t('admin.login.errors.invalid-credentials'));
    } else if (isRateLimitError({ error })) {
      setError(t('admin.login.errors.rate-limited'));
    } else if (isHttpErrorWithStatusCode({ error, statusCode: 404 })) {
      setError(t('admin.login.errors.disabled'));
    } else {
      setError(t('admin.login.errors.unknown'));
    }
  };

  return (
    <div class="px-4 mt-12 md:mt-32">
      <div class="max-w-sm mx-auto">
        <h1 class="text-lg font-semibold">{t('admin.login.title')}</h1>
        <p class="text-sm text-muted-foreground">{t('admin.login.description')}</p>

        <form
          class="mt-4 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <TextFieldRoot>
            <TextFieldLabel class="sr-only">{t('admin.login.email')}</TextFieldLabel>
            <TextField
              type="email"
              autocomplete="username"
              placeholder={t('admin.login.email')}
              value={getEmail()}
              onInput={(e) => {
                setEmail(e.currentTarget.value);
                setError(null);
              }}
            />
          </TextFieldRoot>

          <TextFieldRoot>
            <TextFieldLabel class="sr-only">{t('admin.login.password')}</TextFieldLabel>
            <TextField
              type="password"
              autocomplete="current-password"
              placeholder={t('admin.login.password')}
              value={getPassword()}
              onInput={(e) => {
                setPassword(e.currentTarget.value);
                setError(null);
              }}
            />
          </TextFieldRoot>

          <Button type="submit" class="w-full" disabled={getIsSubmitting() || !getEmail() || !getPassword()}>
            {t('admin.login.submit')}
          </Button>

          <Show when={getError()}>
            {error => (
              <Alert variant="destructive">
                <AlertDescription>{error()}</AlertDescription>
              </Alert>
            )}
          </Show>
        </form>
      </div>
    </div>
  );
};

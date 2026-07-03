import { Button } from '@/modules/ui/components/button';
import { TextField } from '@/modules/ui/components/textfield';
import { type Component, createSignal, For } from 'solid-js';

const MAX_EMAILS = 20;

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export const EmailAllowlistField: Component<{
  getEmails: () => string[];
  setEmails: (emails: string[]) => void;
  placeholder?: string;
  dataTestId?: string;
}> = (props) => {
  const [getInput, setInput] = createSignal('');
  const [getError, setError] = createSignal('');

  const addEmail = (raw: string) => {
    const email = raw.trim().toLowerCase().replace(/,\s*$/, '');
    if (!email) {
      return;
    }
    if (!isValidEmail(email)) {
      setError('Invalid email address');
      return;
    }
    if (props.getEmails().includes(email)) {
      setInput('');
      return;
    }
    if (props.getEmails().length >= MAX_EMAILS) {
      setError(`Maximum ${MAX_EMAILS} emails allowed`);
      return;
    }
    props.setEmails([...props.getEmails(), email]);
    setInput('');
    setError('');
  };

  const removeEmail = (email: string) => {
    props.setEmails(props.getEmails().filter(e => e !== email));
    setError('');
  };

  const handleKeyDown = (e: KeyboardEvent & { currentTarget: HTMLInputElement }) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
      e.preventDefault();
      addEmail(getInput());
    }
    if (e.key === 'Backspace' && !getInput() && props.getEmails().length > 0) {
      removeEmail(props.getEmails()[props.getEmails().length - 1]);
    }
  };

  return (
    <div class="flex flex-col gap-1.5">
      <div class="border border-input rounded-md flex items-center flex-wrap gap-1.5 px-2 py-1.5 min-h-10 focus-within:ring-2 focus-within:ring-ring">
        <For each={props.getEmails()}>
          {email => (
            <span class="inline-flex items-center gap-1 bg-primary/15 text-foreground border border-primary/30 text-xs rounded-md px-2 py-1 max-w-full">
              <span class="truncate max-w-200px" title={email}>{email}</span>
              <button
                type="button"
                onClick={() => removeEmail(email)}
                class="text-muted-foreground hover:text-primary transition flex-shrink-0"
                aria-label={`Remove ${email}`}
              >
                <div class="i-tabler-x text-xs" />
              </button>
            </span>
          )}
        </For>
        <TextField
          type="email"
          placeholder={props.placeholder ?? 'Add email, press Enter...'}
          value={getInput()}
          onInput={e => setInput(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (getInput()) addEmail(getInput()); }}
          class="border-none shadow-none focus-visible:ring-0 flex-1 min-w-32 h-7 text-sm p-0"
          disabled={props.getEmails().length >= MAX_EMAILS}
          data-test-id={props.dataTestId}
        />
      </div>
      {getError() && (
        <span class="text-xs text-destructive">{getError()}</span>
      )}
    </div>
  );
};

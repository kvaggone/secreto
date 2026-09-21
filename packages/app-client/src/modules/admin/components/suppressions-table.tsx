import { useI18n } from '@/modules/i18n/i18n.provider';
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/modules/ui/components/alert-dialog';
import { Button } from '@/modules/ui/components/button';
import { Card } from '@/modules/ui/components/card';
import { toast } from '@/modules/ui/components/sonner';
import { TextField, TextFieldLabel, TextFieldRoot } from '@/modules/ui/components/textfield';
import { safely } from '@corentinth/chisels';
import { type Component, createEffect, createResource, createSignal, For, on, onCleanup, Show } from 'solid-js';
import { fetchSuppressions, removeSuppression } from '../admin.services';

const PAGE_SIZE = 20;

export const SuppressionsTable: Component<{ refreshKey: number; onChanged: () => void }> = (props) => {
  const { t, getLocale } = useI18n();
  const [getSearchInput, setSearchInput] = createSignal('');
  const [getSearch, setSearch] = createSignal('');
  const [getPage, setPage] = createSignal(1);
  const [getPendingRemoval, setPendingRemoval] = createSignal<string | null>(null);
  const [getIsRemoving, setIsRemoving] = createSignal(false);

  // Debounce the search input before it hits the server.
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  const onSearchInput = (value: string) => {
    setSearchInput(value);
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      setSearch(value.trim());
      setPage(1);
    }, 300);
  };
  onCleanup(() => clearTimeout(searchTimer));

  const [data, { refetch }] = createResource(
    () => ({ search: getSearch(), page: getPage() }),
    ({ search, page }) => fetchSuppressions({ search, page, pageSize: PAGE_SIZE }),
  );

  createEffect(on(() => props.refreshKey, () => refetch(), { defer: true }));

  const formatDate = (iso: string) => new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  const total = () => data.latest?.total ?? 0;
  const from = () => (total() === 0 ? 0 : (getPage() - 1) * PAGE_SIZE + 1);
  const to = () => Math.min(getPage() * PAGE_SIZE, total());
  const pageCount = () => Math.max(1, Math.ceil(total() / PAGE_SIZE));

  const confirmRemoval = async () => {
    const email = getPendingRemoval();
    if (!email) {
      return;
    }

    setIsRemoving(true);
    const [, error] = await safely(removeSuppression({ email }));
    setIsRemoving(false);
    setPendingRemoval(null);

    if (error) {
      toast.error(t('admin.suppressions.remove-error'));
      return;
    }

    toast.success(t('admin.suppressions.removed'));
    if (data.latest?.items.length === 1 && getPage() > 1) {
      setPage(getPage() - 1);
    } else {
      refetch();
    }
    props.onChanged();
  };

  return (
    <Card class="shadow-none">
      <div class="p-4 flex flex-col sm:(flex-row items-end justify-between) gap-3 border-b">
        <div>
          <div class="text-sm font-medium">{t('admin.suppressions.title')}</div>
          <div class="text-xs text-muted-foreground max-w-prose">{t('admin.suppressions.description')}</div>
        </div>
        <TextFieldRoot class="w-full sm:w-64">
          <TextFieldLabel class="sr-only">{t('admin.suppressions.search')}</TextFieldLabel>
          <TextField
            type="search"
            class="h-8"
            placeholder={t('admin.suppressions.search')}
            value={getSearchInput()}
            onInput={e => onSearchInput(e.currentTarget.value)}
          />
        </TextFieldRoot>
      </div>

      <div class="relative overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs text-muted-foreground border-b">
              <th class="font-medium px-4 py-2">{t('admin.suppressions.email')}</th>
              <th class="font-medium px-4 py-2 whitespace-nowrap">{t('admin.suppressions.created-at')}</th>
              <th class="font-medium px-4 py-2 text-right w-1"><span class="sr-only">{t('admin.suppressions.actions')}</span></th>
            </tr>
          </thead>
          <tbody class={data.loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <For each={data.latest?.items ?? []}>
              {item => (
                <tr class="border-b last:border-b-0 hover:bg-muted/40">
                  <td class="px-4 py-2 font-mono text-xs break-all">{item.email}</td>
                  <td class="px-4 py-2 text-muted-foreground whitespace-nowrap">{formatDate(item.createdAt)}</td>
                  <td class="px-4 py-1 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      class="text-muted-foreground hover:text-destructive"
                      aria-label={`${t('admin.suppressions.remove')}: ${item.email}`}
                      onClick={() => setPendingRemoval(item.email)}
                    >
                      <div class="i-tabler-trash text-base" />
                    </Button>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>

        <Show when={data.error && !data.latest}>
          <div class="px-4 py-8 text-center text-sm text-destructive">{t('admin.suppressions.load-error')}</div>
        </Show>
        <Show when={data.latest && data.latest.items.length === 0}>
          <div class="px-4 py-8 text-center text-sm text-muted-foreground">
            {getSearch() ? t('admin.suppressions.empty-search') : t('admin.suppressions.empty')}
          </div>
        </Show>
      </div>

      <Show when={total() > 0}>
        <div class="px-4 py-2 border-t flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span class="tabular-nums">{t('admin.suppressions.pagination', { from: from(), to: to(), total: total() })}</span>
          <div class="flex gap-1">
            <Button variant="outline" size="sm" disabled={getPage() <= 1 || data.loading} onClick={() => setPage(getPage() - 1)}>
              {t('admin.suppressions.previous')}
            </Button>
            <Button variant="outline" size="sm" disabled={getPage() >= pageCount() || data.loading} onClick={() => setPage(getPage() + 1)}>
              {t('admin.suppressions.next')}
            </Button>
          </div>
        </div>
      </Show>

      <AlertDialog open={getPendingRemoval() !== null} onOpenChange={isOpen => !isOpen && !getIsRemoving() && setPendingRemoval(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('admin.suppressions.remove-dialog.title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('admin.suppressions.remove-dialog.description', { email: getPendingRemoval() ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="outline" disabled={getIsRemoving()} onClick={() => setPendingRemoval(null)}>
              {t('admin.suppressions.remove-dialog.cancel')}
            </Button>
            <Button variant="destructive" disabled={getIsRemoving()} onClick={confirmRemoval}>
              {t('admin.suppressions.remove-dialog.confirm')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

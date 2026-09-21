import { useI18n } from '@/modules/i18n/i18n.provider';
import { Alert, AlertDescription } from '@/modules/ui/components/alert';
import { Button } from '@/modules/ui/components/button';
import { safely } from '@corentinth/chisels';
import { A } from '@solidjs/router';
import { type Component, createResource, createSignal, Match, Show, Switch } from 'solid-js';
import { fetchAdminSession, fetchAdminStats, logoutAdmin } from '../admin.services';
import { AdminLoginForm } from '../components/admin-login-form';
import { AdminKpiCards, NotesDailyChart } from '../components/admin-stats';
import { SuppressionsTable } from '../components/suppressions-table';

const AdminDashboard: Component<{ email: string; onSignedOut: () => void }> = (props) => {
  const { t } = useI18n();
  const [getRefreshKey, setRefreshKey] = createSignal(0);
  const [stats, { refetch: refetchStats }] = createResource(getRefreshKey, () => fetchAdminStats());

  const refresh = () => setRefreshKey(key => key + 1);
  const signOut = async () => {
    await safely(logoutAdmin());
    props.onSignedOut();
  };

  return (
    <div class="max-w-6xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div class="flex flex-col sm:(flex-row items-center justify-between) gap-3">
        <div>
          <h1 class="text-lg font-semibold">{t('admin.title')}</h1>
          <p class="text-sm text-muted-foreground">{t('admin.description')}</p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs text-muted-foreground hidden md:inline">{props.email}</span>
          <Button variant="outline" size="sm" onClick={refresh} disabled={stats.loading}>
            <div class={`i-tabler-refresh mr-1.5 ${stats.loading ? 'animate-spin' : ''}`} />
            {t('admin.refresh')}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <div class="i-tabler-logout mr-1.5" />
            {t('admin.sign-out')}
          </Button>
        </div>
      </div>

      <Show when={stats.latest && stats.latest.databaseStatus !== 'ok'}>
        <Alert variant="destructive">
          <AlertDescription>
            {stats.latest?.databaseStatus === 'not-configured' ? t('admin.database.not-configured') : t('admin.database.unavailable')}
          </AlertDescription>
        </Alert>
      </Show>

      <AdminKpiCards stats={stats.latest} />

      <Show when={stats.latest?.notes}>
        {notes => <NotesDailyChart daily={notes().daily} />}
      </Show>

      <Show when={stats.latest?.databaseStatus === 'ok'}>
        <SuppressionsTable refreshKey={getRefreshKey()} onChanged={() => refetchStats()} />
      </Show>
    </div>
  );
};

export const AdminPage: Component = () => {
  const { t } = useI18n();
  const [session, { refetch }] = createResource(async () => {
    const [result] = await safely(fetchAdminSession());
    return result ?? null;
  });

  return (
    <div class="min-h-screen bg-background">
      <div class="border-b">
        <div class="max-w-6xl mx-auto px-4 h-12 flex items-center">
          <Button as={A} href="/" variant="link" class="px-0 text-base font-semibold text-foreground">
            {t('app.title')}
          </Button>
        </div>
      </div>

      <Switch>
        <Match when={session.loading && !session.latest}>
          <div class="max-w-6xl mx-auto px-4 py-6 text-sm text-muted-foreground">…</div>
        </Match>
        <Match when={session.latest}>
          {current => <AdminDashboard email={current().email} onSignedOut={() => refetch()} />}
        </Match>
        <Match when={!session.latest}>
          <AdminLoginForm onSuccess={() => refetch()} />
        </Match>
      </Switch>
    </div>
  );
};

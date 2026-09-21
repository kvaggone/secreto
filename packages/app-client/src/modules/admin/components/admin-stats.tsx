import type { AdminStats } from '../admin.services';
import { useI18n } from '@/modules/i18n/i18n.provider';
import { Card } from '@/modules/ui/components/card';
import { type Component, For, Show } from 'solid-js';

const KpiCard: Component<{ label: string; value: number | null | undefined; hint?: string }> = props => (
  <Card class="p-4 shadow-none">
    <div class="text-xs text-muted-foreground">{props.label}</div>
    <div class="mt-1 text-2xl font-semibold tabular-nums">{props.value ?? '—'}</div>
    <Show when={props.hint}>
      <div class="mt-1 text-xs text-muted-foreground">{props.hint}</div>
    </Show>
  </Card>
);

export const AdminKpiCards: Component<{ stats: AdminStats | undefined }> = (props) => {
  const { t } = useI18n();
  const notes = () => props.stats?.notes;

  return (
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <KpiCard label={t('admin.stats.today')} value={notes()?.totals.today} />
      <KpiCard label={t('admin.stats.last-7-days')} value={notes()?.totals.last7Days} />
      <KpiCard
        label={t('admin.stats.last-30-days')}
        value={notes()?.totals.last30Days}
        hint={notes() ? `${t('admin.stats.delete-after-reading', { count: notes()!.last30Days.deleteAfterReading })} · ${t('admin.stats.email-gated', { count: notes()!.last30Days.emailGated })}` : undefined}
      />
      <KpiCard label={t('admin.stats.all-time')} value={notes()?.totals.allTime} />
      <KpiCard label={t('admin.stats.opt-outs')} value={props.stats?.suppressedEmailsCount} />
    </div>
  );
};

export const NotesDailyChart: Component<{ daily: { date: string; count: number }[] }> = (props) => {
  const { t, getLocale } = useI18n();
  const max = () => Math.max(1, ...props.daily.map(d => d.count));
  const formatDay = (date: string) => new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));

  return (
    <Card class="p-4 shadow-none">
      <div>
        <div class="text-sm font-medium">{t('admin.stats.chart-title')}</div>
        <div class="text-xs text-muted-foreground">{t('admin.stats.chart-description')}</div>
      </div>

      <div class="mt-4 flex items-end gap-[2px] h-32" role="img" aria-label={t('admin.stats.chart-title')}>
        <For each={props.daily}>
          {day => (
            <div
              class="flex-1 h-full flex items-end group"
              title={t('admin.stats.chart-tooltip', { date: formatDay(day.date), count: day.count })}
            >
              <div
                class="w-full rounded-t-sm bg-primary/70 group-hover:bg-primary transition-colors"
                style={{ 'height': day.count > 0 ? `${Math.max(4, (day.count / max()) * 100)}%` : '1px', 'min-height': '1px' }}
              />
            </div>
          )}
        </For>
      </div>

      <Show when={props.daily.length > 0}>
        <div class="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{formatDay(props.daily[0].date)}</span>
          <span>{formatDay(props.daily[props.daily.length - 1].date)}</span>
        </div>
      </Show>
    </Card>
  );
};

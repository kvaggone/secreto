import type { Db } from '../db/db.client';

export { getNoteStats, recordNoteCreated };

// Only non-identifying metadata is stored: no note id, payload or recipient addresses.
async function recordNoteCreated({
  db,
  ttlInSeconds,
  deleteAfterReading,
  allowedEmailsCount,
}: {
  db: Db;
  ttlInSeconds?: number;
  deleteAfterReading: boolean;
  allowedEmailsCount: number;
}): Promise<void> {
  await db`
    insert into note_events (ttl_seconds, delete_after_reading, allowed_emails_count)
    values (${ttlInSeconds ?? null}, ${deleteAfterReading}, ${allowedEmailsCount})
  `;
}

type NoteStats = {
  totals: { today: number; last7Days: number; last30Days: number; allTime: number };
  last30Days: { deleteAfterReading: number; emailGated: number };
  daily: { date: string; count: number }[];
};

async function getNoteStats({ db, days = 30 }: { db: Db; days?: number }): Promise<NoteStats> {
  const [totals] = await db<{
    today: number;
    last_7_days: number;
    last_30_days: number;
    all_time: number;
    delete_after_reading: number;
    email_gated: number;
  }[]>`
    select
      count(*) filter (where created_at >= date_trunc('day', now()))::int as today,
      count(*) filter (where created_at >= now() - interval '7 days')::int as last_7_days,
      count(*) filter (where created_at >= now() - interval '30 days')::int as last_30_days,
      count(*)::int as all_time,
      count(*) filter (where created_at >= now() - interval '30 days' and delete_after_reading)::int as delete_after_reading,
      count(*) filter (where created_at >= now() - interval '30 days' and allowed_emails_count > 0)::int as email_gated
    from note_events
  `;

  // One row per day (UTC), including days without notes.
  const daily = await db<{ date: string; count: number }[]>`
    select to_char(day, 'YYYY-MM-DD') as date, coalesce(count(e.id), 0)::int as count
    from generate_series(
      date_trunc('day', now() at time zone 'utc') - make_interval(days => ${days - 1}),
      date_trunc('day', now() at time zone 'utc'),
      interval '1 day'
    ) as day
    left join note_events e
      on (e.created_at at time zone 'utc') >= day
     and (e.created_at at time zone 'utc') < day + interval '1 day'
    group by day
    order by day
  `;

  return {
    totals: {
      today: totals.today,
      last7Days: totals.last_7_days,
      last30Days: totals.last_30_days,
      allTime: totals.all_time,
    },
    last30Days: {
      deleteAfterReading: totals.delete_after_reading,
      emailGated: totals.email_gated,
    },
    daily: daily.map(({ date, count }) => ({ date, count })),
  };
}

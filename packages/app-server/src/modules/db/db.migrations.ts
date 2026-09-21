import type { Sql } from 'postgres';

export { runMigrations };

// Append-only list: never edit an applied migration, add a new one instead.
const migrations: { id: number; name: string; up: (sql: Sql) => Promise<unknown> }[] = [
  {
    id: 1,
    name: 'create suppressed_emails and note_events',
    up: async sql => sql`
      create table if not exists suppressed_emails (
        email text primary key,
        created_at timestamptz not null default now()
      );

      create table if not exists note_events (
        id bigserial primary key,
        created_at timestamptz not null default now(),
        ttl_seconds integer,
        delete_after_reading boolean not null,
        allowed_emails_count integer not null default 0
      );

      create index if not exists note_events_created_at_idx on note_events (created_at);
    `.simple(),
  },
];

async function runMigrations(sql: Sql): Promise<void> {
  await sql`
    create table if not exists schema_migrations (
      id integer primary key,
      name text not null,
      applied_at timestamptz not null default now()
    )
  `;

  // Serialize concurrent starts (several instances or requests) with an advisory lock.
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(727272)`;

    const applied = await tx<{ id: number }[]>`select id from schema_migrations`;
    const appliedIds = new Set(applied.map(({ id }) => id));

    for (const migration of migrations) {
      if (appliedIds.has(migration.id)) {
        continue;
      }

      await migration.up(tx as unknown as Sql);
      await tx`insert into schema_migrations (id, name) values (${migration.id}, ${migration.name})`;
    }
  });
}

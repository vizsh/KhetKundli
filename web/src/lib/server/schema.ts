/**
 * The Postgres schema, as an ordered list of migrations. Each runs once, in its own transaction, and is
 * recorded in `schema_migrations` (see `migrate` in sql.ts). Never edit a migration that has shipped:
 * add a new one at the end.
 */
export const MIGRATIONS: readonly string[] = [
  // 1 · The season record: append-only, hash-chained (Phase 1, slice 1).
  `create table season_events (
     seq bigserial primary key,
     id text not null unique,
     hlc text not null,
     kind text not null,
     actor text not null,
     doc text not null,
     recorded_at text not null,
     prev_hash text not null,
     hash text not null unique
   );
   create index season_events_hlc on season_events (hlc);
   create function season_events_append_only() returns trigger language plpgsql as $$
   begin
     raise exception 'season_events is append-only: % refused', tg_op;
   end
   $$;
   create trigger season_events_no_change before update or delete on season_events
     for each row execute function season_events_append_only();
   create trigger season_events_no_truncate before truncate on season_events
     for each statement execute function season_events_append_only();`,

  // 2 · People, plots, devices, sessions, one-time codes, and who wrote each season event (slice 2).
  `create table people (
     id text primary key,
     phone text not null unique,
     name text not null,
     name_mr text not null default '',
     role text not null check (role in ('farmer', 'officer', 'fpo_admin', 'buyer')),
     created_at timestamptz not null default now()
   );
   create table person_plots (
     person_id text not null references people(id),
     plot int not null,
     relation text not null default 'owner',
     primary key (person_id, plot)
   );
   create table devices (
     id text primary key,
     label text not null,
     user_agent text not null default '',
     created_at timestamptz not null default now(),
     last_seen timestamptz not null default now()
   );
   create table sessions (
     token_hash text primary key,
     person_id text not null references people(id),
     device_id text not null references devices(id),
     created_at timestamptz not null default now(),
     expires_at timestamptz not null,
     revoked_at timestamptz
   );
   create index sessions_person on sessions (person_id);
   create table otp_codes (
     id bigserial primary key,
     phone text not null,
     code_hash text not null,
     created_at timestamptz not null,
     expires_at timestamptz not null,
     attempts int not null default 0,
     consumed_at timestamptz
   );
   create index otp_codes_phone on otp_codes (phone, created_at);
   create table auth_log (
     id bigserial primary key,
     at timestamptz not null default now(),
     event text not null,
     phone_tail text not null default '',
     person_id text,
     ok boolean not null,
     detail text not null default ''
   );
   create table secrets (name text primary key, value text not null);
   alter table season_events add column person_id text;`,

  // 3 · The inbox, advisory batches and messages move from the laptop's SQLite file to Postgres (slice 2).
  `create table escalations (
     id text primary key,
     plot int not null,
     person_id text,
     item jsonb not null,
     asked_at timestamptz not null,
     reply jsonb,
     replied_by text,
     replied_at timestamptz
   );
   create index escalations_plot on escalations (plot);
   create table advisory_batches (
     id text primary key,
     day int not null,
     created_by text not null,
     created_at timestamptz not null default now(),
     items jsonb not null,
     sent_at timestamptz,
     sent_by text
   );
   create table messages (
     id text primary key,
     batch text not null references advisory_batches(id),
     plot int not null,
     item jsonb not null,
     sent_at timestamptz not null,
     delivered_at timestamptz,
     read_at timestamptz,
     simulated boolean not null default false
   );
   create index messages_plot on messages (plot);
   create table sync_messages (
     hlc text primary key,
     kind text not null,
     person_id text,
     received_at timestamptz not null default now()
   );`,
];

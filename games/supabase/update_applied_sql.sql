-- PEP Games: a list of the SQL files that have run on this database (games.applied_sql).
-- Run ONCE in Supabase > SQL Editor (New query > paste all > Run). Safe to run again.
-- If Supabase shows "Potential issues detected", pick "Run and enable RLS".
--
-- Why: until now nothing on the database said which of the files in games/supabase were run, or when.
-- From now on every new update_*.sql file ends with
--     select games.mark_applied('update_name.sql');
-- so after a Run the file shows up here. To see the list:
--     select file, applied_at, note from games.applied_sql order by applied_at desc;
-- Files from before 27 XI 2026 are not on the list (deploy/00_check.sql still checks the launch ones).
-- Only the database owner (you in the SQL Editor) can write or read it: no website key can.

create table if not exists games.applied_sql (
  id bigint generated always as identity primary key,
  file text not null check (file ~ '^[A-Za-z0-9_./-]{1,200}$'),
  applied_at timestamptz not null default now(),
  applied_by text not null default current_user,
  note text
);
create index if not exists applied_sql_file on games.applied_sql (file, applied_at desc);
alter table games.applied_sql enable row level security;   -- no policies: not readable through the API
revoke all on table games.applied_sql from public, anon, authenticated;

create or replace function games.mark_applied(p_file text, p_note text default null) returns text
language sql security definer set search_path = '' as $$
  insert into games.applied_sql(file, note) values (p_file, nullif(left(p_note, 300), ''))
  returning file || ' marked as applied at ' || to_char(applied_at at time zone 'Europe/Warsaw', 'YYYY-MM-DD HH24:MI') || ' (Warsaw)'
$$;
revoke all on function games.mark_applied(text, text) from public, anon, authenticated;

select games.mark_applied('update_applied_sql.sql');

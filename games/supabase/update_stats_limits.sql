-- Pepecoin Hub: page counter (gry_pv) and PondOS window counter (gry_open) without any ID in the browser,
-- and with limits so one network cannot pump the statistics.
-- Run ONCE in Supabase > SQL Editor (New query > paste all > Run). Safe to run again.
-- Needs update_page_stats.sql, update_app_opens.sql and update_applied_sql.sql to be run first.
--
-- What changes:
--  • The site no longer keeps a random "phw-day-id" number in the browser. Instead the server makes a
--    daily visitor code: a hash of the salted IP hash (games.client_ip_hash) with a random salt that is
--    replaced every day. Yesterday's codes cannot be linked to today's, and the codes are deleted after 2 days.
--    "People" per day now means "different networks that day" (a household on one Wi-Fi counts once).
--  • Limits per visitor code and day: 300 page views and 600 window opens. Above that the call does nothing.
--  • At most 400 different page paths per day (others still count in the '*' total), like the 120 app names.
--  • On the first day both old (browser number) and new codes are in games.page_seen, so "people" can be
--    a little too high that one day.

alter table games.config add column if not exists stat_salt text;
alter table games.config add column if not exists stat_salt_day date;

create table if not exists games.stat_hits (            -- per day and daily visitor code: how many calls (for the limits)
  day date not null,
  who text not null,
  pv int not null default 0,
  opens int not null default 0,
  primary key (day, who)
);
alter table games.stat_hits enable row level security;  -- no policies: only the functions below touch it
revoke all on table games.stat_hits from public, anon, authenticated;

-- Today's visitor code for the caller, or null when the request has no IP header (e.g. the SQL Editor).
create or replace function games.stat_visitor() returns text
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; ip text := games.client_ip_hash(); s text;
begin
  if ip is null then return null; end if;
  select stat_salt into s from games.config where id = 1 and stat_salt_day = d;
  if s is null then      -- first call of the day: a new random salt replaces yesterday's
    update games.config set stat_salt = replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
                            stat_salt_day = d
     where id = 1 and stat_salt_day is distinct from d returning stat_salt into s;
    if s is null then select stat_salt into s from games.config where id = 1; end if;
  end if;
  return left(encode(sha256(convert_to(s || '|day|' || ip, 'UTF8')), 'hex'), 32);
end $$;

-- +1 for this visitor code today; false when the daily limit is used up.
create or replace function games.stat_allow(p_who text, p_kind text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; n int;
begin
  if p_who is null then return true; end if;
  if p_kind = 'pv' then
    insert into games.stat_hits(day, who, pv) values (d, p_who, 1)
    on conflict (day, who) do update set pv = games.stat_hits.pv + 1 returning pv into n;
    return n <= 300;
  else
    insert into games.stat_hits(day, who, opens) values (d, p_who, 1)
    on conflict (day, who) do update set opens = games.stat_hits.opens + 1 returning opens into n;
    return n <= 600;
  end if;
end $$;

-- One page view. p_visitor is ignored: it is kept only so pages still cached with the old chrome.js keep working.
create or replace function public.gry_pv(p_path text, p_visitor text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; p text := lower(left(trim(coalesce(p_path, '')), 100));
        v text;
begin
  p := regexp_replace(p, '(index\.html)?$', '');
  if p !~ '^/[a-z0-9/._-]*$' then return; end if;
  v := games.stat_visitor();
  if not games.stat_allow(v, 'pv') then return; end if;
  if not exists (select 1 from games.page_daily where day = d and path = p)
     and (select count(*) from games.page_daily where day = d) >= 401 then
    p := '*';            -- too many different paths today: count only in the total
  end if;
  insert into games.page_daily(day, path, views) values (d, '*', 1)
  on conflict (day, path) do update set views = games.page_daily.views + 1;
  if p <> '*' then
    insert into games.page_daily(day, path, views) values (d, p, 1)
    on conflict (day, path) do update set views = games.page_daily.views + 1;
  end if;
  if v is not null then
    if p <> '*' then
      insert into games.page_seen(day, visitor, path) values (d, v, p) on conflict do nothing;
      if found then update games.page_daily set people = people + 1 where day = d and path = p; end if;
    end if;
    insert into games.page_seen(day, visitor, path) values (d, v, '*') on conflict do nothing;
    if found then update games.page_daily set people = people + 1 where day = d and path = '*'; end if;
  end if;
  update games.config set pv_cleanup_at = now() where id = 1 and (pv_cleanup_at is null or pv_cleanup_at < now() - interval '1 hour');
  if found then
    delete from games.page_seen where day < d - 1;
    delete from games.stat_hits where day < d - 1;
  end if;
end $$;

-- One PondOS window opened (see update_app_opens.sql), now with the daily limit per visitor code.
create or replace function public.gry_open(p_app text) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; a text := lower(trim(coalesce(p_app, '')));
begin
  if a !~ '^[a-z0-9][a-z0-9-]{0,31}$' then return; end if;
  if not games.stat_allow(games.stat_visitor(), 'open') then return; end if;
  update games.app_daily set opens = opens + 1 where day = d and app = a;
  if found then return; end if;
  if (select count(*) from games.app_daily where day = d) >= 120 then return; end if;
  insert into games.app_daily(day, app, opens) values (d, a, 1)
  on conflict (day, app) do update set opens = games.app_daily.opens + 1;
end $$;

revoke all on function games.stat_visitor(), games.stat_allow(text, text) from public, anon, authenticated;
revoke all on function public.gry_pv(text, text), public.gry_open(text) from public, anon;
grant execute on function public.gry_pv(text, text), public.gry_open(text) to anon, authenticated;

select games.mark_applied('update_stats_limits.sql');

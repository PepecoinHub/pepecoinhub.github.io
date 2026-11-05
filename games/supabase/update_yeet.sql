-- YEET THE PEP v1. Apply after games/supabase/schema.sql in the same project.
-- One durable record per Discord-authenticated user, not a capped history of runs.
-- No direct table reads/writes. No realtime, assets, rewards or per-frame requests.
-- This casual browser leaderboard uses plausibility checks, NOT authoritative replay.
begin;
create table if not exists games.yeet_records (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nick text not null,
  best integer not null default 0 check (best between 0 and 60000),
  duration_ms integer not null default 0,
  achieved_at timestamptz not null default now(),
  last_attempt_at timestamptz
);
create index if not exists yeet_records_best on games.yeet_records (best desc, achieved_at, user_id);
alter table games.yeet_records enable row level security;
revoke all on games.yeet_records from public, anon, authenticated;

create or replace function games.yeet_top() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('nick', t.nick, 'score', t.best)
                            order by t.best desc, t.achieved_at, t.user_id), '[]'::jsonb)
  from (select user_id, nick, best, achieved_at from games.yeet_records where best > 0
        order by best desc, achieved_at, user_id limit 10) t
$$;
revoke all on function games.yeet_top() from public, anon, authenticated;

create or replace function public.gry_yeet_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('top', games.yeet_top(), 'best',
    case when auth.uid() is not null and games.discord_identity(auth.uid()) is not null
    then coalesce((select r.best from games.yeet_records r where r.user_id = auth.uid()), 0)
    else 0 end)
$$;

create or replace function public.gry_yeet_submit(p_score integer, p_ms integer, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); d jsonb; r games.yeet_records;
  v_nick text; saved boolean := false;
begin
  if u is null then raise exception 'Log in with Discord to save a flight'; end if;
  d := games.discord_identity(u);
  if d is null then raise exception 'Log in with Discord to save a flight'; end if;
  if p_version is distinct from 1 then raise exception 'Refresh the game before submitting'; end if;
  if p_score is null or p_score < 1 or p_score > 60000 then raise exception 'Invalid flight distance'; end if;
  if p_ms is null or p_ms < 1000 or p_ms > 360500 then raise exception 'Invalid flight duration'; end if;
  -- At most 100 m/s in v1; tolerate rounding and initial launch/collision steps.
  if p_score::bigint > p_ms::bigint + 100 then raise exception 'That distance does not match the flight time'; end if;
  v_nick := left(btrim(regexp_replace(coalesce(d->>'name', 'Discord pilot'), '[[:cntrl:]]', '', 'g')), 40);
  if v_nick = '' then v_nick := 'Discord pilot'; end if;
  insert into games.yeet_records(user_id, nick) values (u, v_nick) on conflict (user_id) do nothing;
  select * into strict r from games.yeet_records where user_id = u for update;
  -- A per-account lock makes simultaneous submissions monotonic and enforces cooldown atomically.
  if r.last_attempt_at > clock_timestamp() - interval '10 seconds' then
    return jsonb_build_object('best', r.best, 'saved', false, 'rate_limited', true);
  end if;
  saved := p_score > r.best;
  update games.yeet_records set nick = v_nick,
    best = greatest(best, p_score),
    duration_ms = case when p_score > best then p_ms else duration_ms end,
    achieved_at = case when p_score > best then clock_timestamp() else achieved_at end,
    last_attempt_at = clock_timestamp()
  where user_id = u;
  return jsonb_build_object('best', greatest(r.best, p_score), 'saved', saved,
                           'rate_limited', false, 'top', games.yeet_top());
end $$;
revoke all on function public.gry_yeet_state() from public, anon, authenticated;
revoke all on function public.gry_yeet_submit(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.gry_yeet_state() to anon, authenticated;
grant execute on function public.gry_yeet_submit(integer, integer, integer) to authenticated;
commit;

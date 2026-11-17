-- Fren Passport, expansion 7 (owner, 2026-11-15): the server side of four arcade stamps. DRAFT: not run anywhere.
--
-- Run after: schema.sql, the Fren Passport files (update_passport_awards.sql) and update_lilies.sql.
-- Gold Hook may come before or after: update_gold_hook_campaign.sql creates its no-op hook only when this file's
-- real one is not there yet, so either order ends with the real hook. Safe to run again (nothing is deleted).
--
--   lord_of_the_lilies  Lord of the Lilies  10 Three Lilies duels won against a valid opponent
--   master_tactician    Master Tactician    5 such wins in a row; a loss or a DRAW breaks the streak
--   gold_digger         Gold Digger         level 10 COMPLETED in one validated Gold Hook run
--   gold_rush           Gold Rush           all 20 levels completed in one validated Gold Hook run
--
-- Super Parent is PepeGochi's (update_pepegochi_v2.sql + update_pepegochi_passport.sql). Pond Sweeper and General
-- Fren have NO award path: Pepe Sweeper keeps its records in the browser only, and online FROGAGEDDON does not
-- exist yet. No award may depend on browser-editable saves or client-reported scores.
--
-- Progress is recorded from the moment this file runs. A stamp that is not yet in games.passport_award()'s
-- allowlist answers "Unknown passport stamp" and waits. Owner, 2026-11-17: Lord of the Lilies and Master Tactician
-- are live (allowlist + catalog); Gold Digger and Gold Rush wait for the Gold Hook launch. To activate a stamp:
-- add its id to the allowlist in update_passport_awards.sql, set it 'live' in docs/meme/passport-catalog.json, run
--   select games.passport_x7_sync(user_id) from games.passport_x7_progress;
-- which delivers every stamp the recorded progress already reached.
--
-- Three Lilies: what counts
--   * only a duel that was really settled (status open -> completed, once, under gry_lily_accept's row lock);
--     cancelled and expired challenges never reach the trigger;
--   * a WIN counts only against a valid opponent: a different account, signed in with Discord, with a different
--     Discord id, and the accepting player not on the same network (IP hash) as the challenge's author;
--   * a loss or a draw against ANY opponent resets the win streak; a win against a non-valid opponent
--     (a guest, the same network) neither counts nor breaks it;
--   * each (duel, player) is counted once (games.passport_lily_duels), so a replayed trigger never counts twice.
-- Gold Hook: public.gry_goldhook_submit_run() replays the whole run on the server and passes the number of levels
-- it completed (the lost last level does not count) for Discord players only.

begin;

do $$ begin
  if to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is null then
    raise exception 'Run update_passport_awards.sql before update_passport_arcade_x7.sql';
  end if;
  if to_regclass('games.lily_challenges') is null then
    raise exception 'Run update_lilies.sql before update_passport_arcade_x7.sql';
  end if;
end $$;

-- one row per Discord player: the Passport's own counters (kept apart from games.lily_stats, which counts guests)
create table if not exists games.passport_x7_progress (
  user_id            uuid primary key,
  lily_wins          integer not null default 0 check (lily_wins >= 0),
  lily_streak        integer not null default 0 check (lily_streak >= 0),
  lily_best_streak   integer not null default 0 check (lily_best_streak >= 0),
  goldhook_completed integer not null default 0 check (goldhook_completed between 0 and 20),
  updated_at         timestamptz not null default now()
);
-- every settled duel is counted once per player
create table if not exists games.passport_lily_duels (
  challenge_id uuid not null,
  user_id      uuid not null,
  outcome      text not null check (outcome in ('win', 'win_ignored', 'lose', 'draw')),
  counted_at   timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table games.passport_x7_progress enable row level security;
alter table games.passport_lily_duels enable row level security;
revoke all on games.passport_x7_progress, games.passport_lily_duels from public, anon, authenticated;

-- one stamp; "not in the allowlist yet" is the only error swallowed (the stamp waits for its activation)
create or replace function games.passport_x7_award(u uuid, b text, at timestamptz default null)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform games.passport_award(u, b, at);
exception when raise_exception then
  if sqlerrm not like 'Unknown passport stamp %' then raise; end if;
end $$;

-- every stamp the recorded progress already reached (repeat-safe: passport_award gives a stamp once)
create or replace function games.passport_x7_sync(u uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare p games.passport_x7_progress;
begin
  select * into p from games.passport_x7_progress where user_id = u;
  if p.user_id is null then return; end if;
  if p.lily_wins >= 10 then perform games.passport_x7_award(u, 'lord_of_the_lilies'); end if;
  if p.lily_best_streak >= 5 then perform games.passport_x7_award(u, 'master_tactician'); end if;
  if p.goldhook_completed >= 10 then perform games.passport_x7_award(u, 'gold_digger'); end if;
  if p.goldhook_completed >= 20 then perform games.passport_x7_award(u, 'gold_rush'); end if;
end $$;

-- ---------- BATTLE OF THREE LILIES ----------
-- p's side of one settled duel against o. ip: the accepting player's network (the request that settled it).
create or replace function games.passport_lily_count(ch games.lily_challenges, p uuid, o uuid, ip text)
returns void language plpgsql volatile security definer set search_path = '' as $$
declare
  dp jsonb := games.discord_identity(p);
  dq jsonb := case when o is null then null else games.discord_identity(o) end;
  res text; valid boolean;
begin
  if p is null or dp is null then return; end if;   -- the Passport is Discord only
  valid := o is not null and o <> p and dq is not null and (dq->>'id') is distinct from (dp->>'id')
           and (ip is null or ch.creator_ip is null or ip <> ch.creator_ip);
  res := case when ch.result = 'draw' then 'draw'
              when ch.winner = p then case when valid then 'win' else 'win_ignored' end
              else 'lose' end;
  insert into games.passport_lily_duels (challenge_id, user_id, outcome) values (ch.id, p, res)
  on conflict (challenge_id, user_id) do nothing;
  if not found then return; end if;   -- counted before
  if res = 'win_ignored' then return; end if;
  insert into games.passport_x7_progress as x (user_id, lily_wins, lily_streak, lily_best_streak)
  values (p, (res = 'win')::int, (res = 'win')::int, (res = 'win')::int)
  on conflict (user_id) do update set
    lily_wins        = x.lily_wins + excluded.lily_wins,
    lily_streak      = case when res = 'win' then x.lily_streak + 1 else 0 end,
    lily_best_streak = greatest(x.lily_best_streak, case when res = 'win' then x.lily_streak + 1 else 0 end),
    updated_at       = now();
  if res = 'win' then perform games.passport_x7_sync(p); end if;
end $$;

create or replace function games.passport_lily_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare ip text := games.client_ip_hash();
begin
  begin
    perform games.passport_lily_count(new, new.creator, new.opponent, ip);
    perform games.passport_lily_count(new, new.opponent, new.creator, ip);
  exception when others then
    raise warning 'three lilies passport: %', sqlerrm;   -- never undo a settled duel over a stamp
  end;
  return null;
end $$;

drop trigger if exists passport_lily_after on games.lily_challenges;
create trigger passport_lily_after after update of status on games.lily_challenges
  for each row when (old.status = 'open' and new.status = 'completed')
  execute function games.passport_lily_after();

-- ---------- PEPE GOLD HOOK ----------
-- called by public.gry_goldhook_submit_run() for Discord players after the server replayed the run
create or replace function games.passport_goldhook_run(u uuid, p_completed integer)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if u is null or p_completed is null or p_completed < 1 or games.discord_identity(u) is null then return; end if;
  insert into games.passport_x7_progress as x (user_id, goldhook_completed)
  values (u, least(p_completed, 20))
  on conflict (user_id) do update set
    goldhook_completed = greatest(x.goldhook_completed, excluded.goldhook_completed),
    updated_at = now();
  perform games.passport_x7_sync(u);
end $$;

revoke all on function games.passport_x7_award(uuid, text, timestamptz), games.passport_x7_sync(uuid),
  games.passport_lily_count(games.lily_challenges, uuid, uuid, text), games.passport_lily_after(),
  games.passport_goldhook_run(uuid, integer)
  from public, anon, authenticated;

commit;

-- Undo (if ever needed):
--   drop trigger passport_lily_after on games.lily_challenges;
--   drop function games.passport_lily_after(), games.passport_lily_count(games.lily_challenges, uuid, uuid, text),
--     games.passport_x7_sync(uuid), games.passport_x7_award(uuid, text, timestamptz);
--   create or replace function games.passport_goldhook_run(u uuid, p_completed integer) returns void
--     language plpgsql set search_path = '' as $$ begin return; end $$;
--   drop table games.passport_lily_duels, games.passport_x7_progress;

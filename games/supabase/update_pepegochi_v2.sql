-- PepeGochi v2: one personal frog at a time per Discord account. A frog can move out after
-- neglect (it is never shown dying), leaves GOODBYE.TXT, and the owner can adopt a new one.
-- Past lives stay as history.
--
-- DRAFT (PR A1). Not applied anywhere. Test on a local database or a separate staging project only.
-- Do NOT run in the production SQL editor without the owner's explicit approval.
--
-- Design: docs/design/pepegochi-v2/ (README.md, TECH_PLAN.md). Browser contract: games/PEPEGOCHI_API.md.
-- Supersedes the v1 draft in PR #186, which was never applied (owner check of PH-games, 2026-11-07).
--
-- Trust rules:
--  * The database owns time, needs, growth, care days, departure and history. The browser sends only a
--    pet name or one of four action names: no user id, stat, count, time or stamp id.
--  * Discord accounts only (games.discord_identity). Private tables in schema games, RLS on, no grants.
--  * Every write locks the owner's row first, then the newest life; server time is read after the locks.
--  * No cron, Realtime, heartbeat or click log. A frog that moved out is written once, by the next write
--    call. The moment it left is computed from saved timestamps, so it never depends on when that is.
--  * Moving out deletes nothing: stamps, items, avatars and secrets are not touched by this file.
--  * Stamps are not written here. Milestones go to games.pepegochi_milestones in the same transaction as
--    the care action. A separate, isolated hook hands them to the Fren Passport later (PR C). If the hook
--    fails, the care is kept and the milestone stays pending, so it can still be awarded later.
--
-- Values in games.pepegochi_rules() are PLAYTEST values, not final rules.
--
-- Dependency: PH-games schema.sql (games.discord_identity). Independent of the Fren Passport files.
-- Safe to run twice.
begin;

-- v2 starts from a clean schema. Never run it on top of v1 data by accident.
do $$
begin
  if to_regclass('games.pepegochi_pets') is not null then
    raise exception 'games.pepegochi_pets (PepeGochi v1) exists. Move its pets to v2 by hand before running this file.';
  end if;
end $$;

-- ---------- storage ----------
-- One row per account: the lock for adopting and moving out.
create table if not exists games.pepegochi_owners (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null
);

-- One row per frog life. After the frog moves out, the same row is its history entry.
create table if not exists games.pepegochi_lives (
  life_id     uuid primary key default gen_random_uuid(),
  user_id     uuid not null references games.pepegochi_owners(user_id) on delete cascade,
  generation  integer not null check (generation between 1 and 100000),
  pet_name    text not null check (char_length(pet_name) between 2 and 18 and pet_name ~ '^[[:alnum:] _.-]+$'),
  adopted_at  timestamptz not null,
  -- needs as saved by the last accepted action (needs_at); reads derive the current values
  hunger      numeric(7,4) not null default 75 check (hunger between 0 and 100),
  hygiene     numeric(7,4) not null default 80 check (hygiene between 0 and 100),
  mood        numeric(7,4) not null default 80 check (mood between 0 and 100),
  energy      numeric(7,4) not null default 75 check (energy between 0 and 100),
  needs_at    timestamptz not null,
  -- growth: distinct UTC days with at least one accepted action
  care_days         integer not null default 0 check (care_days between 0 and 100000),
  last_care_day_utc date,
  -- each need's own clock: the moment it started waiting for care (null = adopted_at). A need that is
  -- cared for, or still at/above meaningful_below, is not waiting; a future value means "fine until then".
  hunger_due_at  timestamptz,
  hygiene_due_at timestamptz,
  mood_due_at    timestamptz,
  energy_due_at  timestamptz,
  -- last accepted action of each kind (cooldowns)
  last_feed_at   timestamptz,
  last_clean_at  timestamptz,
  last_play_at   timestamptz,
  last_rest_at   timestamptz,
  last_action_at timestamptz,
  -- rescue: the frog reached "packing"; caring for every overdue need then starts recovery
  rescue_pending     boolean not null default false,
  recovery_days_left smallint not null default 0 check (recovery_days_left between 0 and 30),
  recovery_day_utc   date,
  recovery_since     timestamptz,   -- when the last recovery step counted (check-up or follow-up)
  -- accepted actions per UTC day, kept in this row (no request log)
  action_day_utc date,
  actions_today  integer not null default 0 check (actions_today between 0 and 1000),
  -- good care days (PR A2): which kinds of care were given on action_day_utc (1 feed, 2 clean, 4 play, 8 rest)
  day_kinds         smallint not null default 0 check (day_kinds between 0 and 15),
  good_days         integer not null default 0 check (good_days >= 0),
  last_good_day_utc date,
  good_streak       integer not null default 0 check (good_streak >= 0),   -- good days in a row, up to the last one
  best_good_streak  integer not null default 0 check (best_good_streak >= 0),
  -- totals for future goodbye-letter variants (they cannot be rebuilt later)
  feeds  integer not null default 0 check (feeds >= 0),
  cleans integer not null default 0 check (cleans >= 0),
  plays  integer not null default 0 check (plays >= 0),
  rests  integer not null default 0 check (rests >= 0),
  -- end of life, written once
  status           text not null default 'active' check (status in ('active', 'departed')),
  departed_at      timestamptz,
  departure_reason text check (departure_reason in ('feed', 'clean', 'play', 'rest', 'recovery')),
  letter_variant   text check (letter_variant ~ '^[a-z_]{3,24}$'),
  letter_seen_at   timestamptz,
  unique (user_id, generation),
  check ((status = 'departed') = (departed_at is not null)),
  check (letter_seen_at is null or status = 'departed')
);
-- a local or staging database that already ran the A1 version of this file gets the good-day columns
alter table games.pepegochi_lives
  add column if not exists day_kinds smallint not null default 0 check (day_kinds between 0 and 15),
  add column if not exists good_days integer not null default 0 check (good_days >= 0),
  add column if not exists last_good_day_utc date,
  add column if not exists good_streak integer not null default 0 check (good_streak >= 0),
  add column if not exists best_good_streak integer not null default 0 check (best_good_streak >= 0);
-- exactly one active frog per account, enforced by the database
create unique index if not exists pepegochi_one_active_life
  on games.pepegochi_lives (user_id) where status = 'active';

-- Account milestones the server has seen (first adoption, froglet, adult, good parent). Written in the same
-- transaction as the action. synced_at stays null until the Passport hook has delivered the stamp.
create table if not exists games.pepegochi_milestones (
  user_id    uuid not null references games.pepegochi_owners(user_id) on delete cascade,
  milestone  text not null check (milestone ~ '^[a-z0-9_]{3,40}$'),
  life_id    uuid not null references games.pepegochi_lives(life_id) on delete cascade,
  reached_at timestamptz not null,
  synced_at  timestamptz,
  primary key (user_id, milestone)
);
create index if not exists pepegochi_milestones_pending
  on games.pepegochi_milestones (user_id) where synced_at is null;

alter table games.pepegochi_owners enable row level security;
alter table games.pepegochi_lives enable row level security;
alter table games.pepegochi_milestones enable row level security;
revoke all on games.pepegochi_owners, games.pepegochi_lives, games.pepegochi_milestones
  from public, anon, authenticated;

-- ---------- time and rules ----------
-- Server time for every PepeGochi rule. Tests and scripts/pepegochi_sim.mjs replace this function in
-- their own throwaway database to fast-forward time. Here the body must stay exactly clock_timestamp()
-- (tests/pepegochi.test.mjs checks it).
create or replace function games.pepegochi_clock()
returns timestamptz language sql volatile set search_path = '' as $$
  select clock_timestamp()
$$;

-- PLAYTEST values (owner, 2026-11-07): working numbers to tune, not final rules.
-- The state RPC returns them, so the game always explains the rules the server really uses.
create or replace function games.pepegochi_rules()
returns jsonb language sql stable set search_path = '' as $$
  select jsonb_build_object(
    'version', 2,
    'playtest', true,
    'meaningful_below', 90,       -- an action is accepted only while its need is below this
    'neglected_h', 48,            -- the most neglected need has waited this long: neglected
    'packing_h', 120,             -- ... packing: "Your Fren is thinking of leaving"
    'departs_h', 168,             -- ... the frog moves out
    'rescue_from_h', 120,         -- caring again for a frog that reached this starts recovery
    'recovery_days', 1,           -- later UTC days with care needed to finish recovery (owner: 1, so
                                  -- Saturday + Sunday players can keep their frog)
    'recovery_departs_h', 72,     -- while recovering, the frog moves out after this long without care
    'recovery_min_gap_h', 8,      -- owner, 2026-11-07: the next-day visit counts only 8 h after the check-up,
                                  -- so one session across UTC midnight cannot count as two days
    'max_actions_per_utc_day', 12,
    'min_gap_s', 2,
    'cooldown_min', jsonb_build_object('feed', 30, 'clean', 20, 'play', 45, 'rest', 60),
    'decay_per_day', jsonb_build_object('hunger', 20, 'hygiene', 15, 'mood', 18, 'energy', 10),
    'froglet_care_days', 2,
    'adult_care_days', 7,
    -- good care days (PR A2), PLAYTEST: at most one per UTC day
    'good_day_min_kinds', 2,      -- different kinds of care on that UTC day
    'good_day_min_need', 50,      -- every need at least this after the action that completes the day
    'good_day_cared_counts', false, -- proposal, off: a need cared for that day counts as fine below min_need
    'good_parent_days', 30,       -- owner, working value: good days in one life, not necessarily in a row
    'history_limit', 10
  )
$$;

-- ---------- derived state (no writes) ----------
-- Time arithmetic is exact on purpose (docs/games/js/pepegochi-model.mjs must give the same answers):
-- decay multiplies before its single division, and computed moments are rounded to whole microseconds.
-- Never add day-sized intervals: in a session time zone with daylight saving time they move by an hour.
--
-- When a need starts waiting for care, after an accepted action at time t left it at value v:
-- at/above the threshold it is fine until linear decay takes it below; cared for just now it waits
-- from t; otherwise it keeps waiting since it was last fine.
create or replace function games.pepegochi_due(
  v numeric, prev timestamptz, t timestamptz, acted boolean, per_day numeric, threshold numeric)
returns timestamptz language sql immutable set search_path = '' as $$
  select case
    when v >= threshold then
      case when per_day > 0
           then t + round((v - threshold) * 86400000000 / per_day)::bigint * interval '1 microsecond'
           else 'infinity'::timestamptz end
    when acted then t
    else least(prev, t)
  end
$$;

-- Current needs, the most neglected need, the departure moment and the status of one life at time t.
-- A life that already moved out is frozen at the moment it left.
create or replace function games.pepegochi_eval(
  l games.pepegochi_lives, t timestamptz, r jsonb,
  out hunger numeric, out hygiene numeric, out mood numeric, out energy numeric,
  out oldest_kind text, out oldest_at timestamptz, out care_at timestamptz,
  out departs_at timestamptz, out departure_reason text, out status text)
language plpgsql stable set search_path = '' as $$
declare
  feed_at  timestamptz := coalesce(l.hunger_due_at, l.adopted_at);
  clean_at timestamptz := coalesce(l.hygiene_due_at, l.adopted_at);
  play_at  timestamptz := coalesce(l.mood_due_at, l.adopted_at);
  rest_at  timestamptz := coalesce(l.energy_due_at, l.adopted_at);
  by_recovery timestamptz;
  secs numeric;
  age_h numeric;
  idle_h numeric;
begin
  oldest_kind := 'feed'; oldest_at := feed_at;
  if clean_at < oldest_at then oldest_kind := 'clean'; oldest_at := clean_at; end if;
  if play_at < oldest_at then oldest_kind := 'play'; oldest_at := play_at; end if;
  if rest_at < oldest_at then oldest_kind := 'rest'; oldest_at := rest_at; end if;
  -- every accepted action is a meaningful one, so the last action is the last care
  care_at := coalesce(l.last_action_at, l.adopted_at);

  if l.status = 'departed' then
    hunger := l.hunger; hygiene := l.hygiene; mood := l.mood; energy := l.energy;
    departs_at := l.departed_at; departure_reason := l.departure_reason; status := 'departed';
    return;
  end if;

  -- any need left alone for departs_h; while recovering, also no care at all for recovery_departs_h
  departs_at := oldest_at + (r->>'departs_h')::numeric * interval '1 hour';
  departure_reason := oldest_kind;
  if l.recovery_days_left > 0 then
    by_recovery := care_at + (r->>'recovery_departs_h')::numeric * interval '1 hour';
    if by_recovery < departs_at then departs_at := by_recovery; departure_reason := 'recovery'; end if;
  end if;

  -- needs fall linearly until the frog leaves, never below 0
  secs := greatest(0::numeric, extract(epoch from (least(t, departs_at) - l.needs_at)));
  hunger  := greatest(0::numeric, l.hunger  - secs * (r#>>'{decay_per_day,hunger}')::numeric / 86400);
  hygiene := greatest(0::numeric, l.hygiene - secs * (r#>>'{decay_per_day,hygiene}')::numeric / 86400);
  mood    := greatest(0::numeric, l.mood    - secs * (r#>>'{decay_per_day,mood}')::numeric / 86400);
  energy  := greatest(0::numeric, l.energy  - secs * (r#>>'{decay_per_day,energy}')::numeric / 86400);

  age_h := extract(epoch from (t - oldest_at)) / 3600;
  idle_h := extract(epoch from (t - care_at)) / 3600;
  if t >= departs_at then
    status := 'departed';
  elsif l.recovery_days_left > 0 then
    status := case when idle_h >= (r->>'neglected_h')::numeric then 'packing' else 'recovering' end;
  elsif age_h >= (r->>'packing_h')::numeric then
    status := 'packing';
  elsif age_h >= (r->>'neglected_h')::numeric then
    status := 'neglected';
  else
    status := 'healthy';
  end if;
end
$$;

-- The full state the browser gets back from every RPC, for one account at time t. Read-only.
create or replace function games.pepegochi_view(u uuid, t timestamptz)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  r jsonb := games.pepegochi_rules();
  l games.pepegochi_lives%rowtype;
  e record;
  pet jsonb;
  hist jsonb;
  former integer;
  longest integer;
  first_left timestamptz;
  departed boolean;
  stage text;
  age_h numeric;
  overdue jsonb;
  today integer;
  kinds_today integer;
  low jsonb;
  mn numeric := (r->>'good_day_min_need')::numeric;
  cared boolean := (r->>'good_day_cared_counts')::boolean;
  day_utc date := (t at time zone 'UTC')::date;
begin
  select * into l from games.pepegochi_lives x where x.user_id = u order by x.generation desc limit 1;
  if not found then
    return jsonb_build_object('version', 2, 'server_now', t, 'rules', r,
      'has_pet', false, 'can_adopt', true, 'pet', null, 'history', '[]'::jsonb,
      'summary', jsonb_build_object('frens_adopted', 0, 'former_frens', 0,
                                    'longest_friendship_days', 0, 'first_departed_at', null));
  end if;

  e := games.pepegochi_eval(l, t, r);
  departed := e.status = 'departed';
  stage := case when l.care_days >= (r->>'adult_care_days')::integer then 'adult'
                when l.care_days >= (r->>'froglet_care_days')::integer then 'froglet'
                else 'tadpole' end;

  if departed then
    pet := jsonb_build_object(
      'life_id', l.life_id, 'generation', l.generation, 'name', l.pet_name, 'adopted_at', l.adopted_at,
      'stage', stage, 'care_days', l.care_days,
      'status', 'departed',
      'departed_at', e.departs_at,
      'departure_saved', l.status = 'departed',
      'departure_reason', e.departure_reason,
      'days_together', floor(extract(epoch from (e.departs_at - l.adopted_at)) / 86400)::integer,
      'good_days', l.good_days, 'best_good_streak', l.best_good_streak,
      'letter', jsonb_build_object('variant', coalesce(l.letter_variant, 'classic'),
                                   'seen', l.letter_seen_at is not null));
  else
    age_h := extract(epoch from (t - e.oldest_at)) / 3600;
    -- the needs a check-up still has to cover (empty while recovering)
    select coalesce(jsonb_agg(v.k order by v.n), '[]'::jsonb) into overdue
      from (values (1, 'feed', coalesce(l.hunger_due_at, l.adopted_at)),
                   (2, 'clean', coalesce(l.hygiene_due_at, l.adopted_at)),
                   (3, 'play', coalesce(l.mood_due_at, l.adopted_at)),
                   (4, 'rest', coalesce(l.energy_due_at, l.adopted_at))) v(n, k, since)
     where l.recovery_days_left = 0
       and extract(epoch from (t - v.since)) / 3600 >= (r->>'neglected_h')::numeric;
    today := case when l.action_day_utc = day_utc then l.actions_today else 0 end;
    kinds_today := case when l.action_day_utc = day_utc then l.day_kinds else 0 end;
    -- the needs that would stop a good day right now
    select coalesce(jsonb_agg(v.k order by v.n), '[]'::jsonb) into low
      from (values (1, 'feed', e.hunger, 1), (2, 'clean', e.hygiene, 2),
                   (3, 'play', e.mood, 4), (4, 'rest', e.energy, 8)) v(n, k, val, b)
     where v.val < mn and not (cared and (kinds_today & v.b) <> 0);
    pet := jsonb_build_object(
      'life_id', l.life_id, 'generation', l.generation, 'name', l.pet_name, 'adopted_at', l.adopted_at,
      'life_day', floor(extract(epoch from (t - l.adopted_at)) / 86400)::integer + 1,
      'stage', stage,
      'next_growth_care_days', case stage when 'tadpole' then (r->>'froglet_care_days')::integer
                                          when 'froglet' then (r->>'adult_care_days')::integer end,
      'care_days', l.care_days,
      'last_care_day_utc', l.last_care_day_utc,
      'status', e.status,
      'needs', jsonb_build_object('hunger', floor(e.hunger)::integer, 'hygiene', floor(e.hygiene)::integer,
                                  'mood', floor(e.mood)::integer, 'energy', floor(e.energy)::integer),
      -- when each need started (or will start) waiting for care
      'waiting_since', jsonb_build_object('feed', coalesce(l.hunger_due_at, l.adopted_at),
                                          'clean', coalesce(l.hygiene_due_at, l.adopted_at),
                                          'play', coalesce(l.mood_due_at, l.adopted_at),
                                          'rest', coalesce(l.energy_due_at, l.adopted_at)),
      'most_neglected', e.oldest_kind,
      'most_neglected_since', e.oldest_at,
      'overdue', overdue,
      'rescue_starts_recovery', l.recovery_days_left = 0
                                and (l.rescue_pending or age_h >= (r->>'rescue_from_h')::numeric),
      'recovery', case when l.recovery_days_left > 0 then
                    jsonb_build_object('days_left', l.recovery_days_left, 'last_day_utc', l.recovery_day_utc,
                      -- the earliest moment the next visit counts: a later UTC day (and the gap, if set)
                      'counts_from', greatest(((l.recovery_day_utc + 1)::timestamp at time zone 'UTC'),
                                              l.recovery_since + (r->>'recovery_min_gap_h')::numeric * interval '1 hour')) end,
      'departs_at', e.departs_at,
      'departure_reason', e.departure_reason,
      'cooldowns', jsonb_build_object(
        'feed',  l.last_feed_at  + (r#>>'{cooldown_min,feed}')::numeric  * interval '1 minute',
        'clean', l.last_clean_at + (r#>>'{cooldown_min,clean}')::numeric * interval '1 minute',
        'play',  l.last_play_at  + (r#>>'{cooldown_min,play}')::numeric  * interval '1 minute',
        'rest',  l.last_rest_at  + (r#>>'{cooldown_min,rest}')::numeric  * interval '1 minute',
        'any_action', l.last_action_at + (r->>'min_gap_s')::numeric * interval '1 second'),
      'action_budget', jsonb_build_object('accepted_today', today,
                                          'max_per_utc_day', (r->>'max_actions_per_utc_day')::integer),
      -- good care days (PR A2) and the Good Parent goal (good days in this life, not necessarily in a row)
      'good_days', l.good_days,
      'good_days_goal', (r->>'good_parent_days')::integer,
      'good_streak', case when l.last_good_day_utc >= day_utc - 1 then l.good_streak else 0 end,
      'best_good_streak', l.best_good_streak,
      'good_day', jsonb_build_object(
        'today', coalesce(l.last_good_day_utc = day_utc, false),
        'kinds_today', (kinds_today & 1) + ((kinds_today >> 1) & 1) + ((kinds_today >> 2) & 1) + ((kinds_today >> 3) & 1),
        'needs_low', low));
  end if;

  -- earlier lives: all of them have moved out (a new life is only adopted after that)
  select coalesce(jsonb_agg(jsonb_build_object(
           'generation', h.generation, 'name', h.pet_name,
           'adopted_at', h.adopted_at, 'departed_at', h.departed_at,
           'days_together', floor(extract(epoch from (h.departed_at - h.adopted_at)) / 86400)::integer,
           'care_days', h.care_days, 'departure_reason', h.departure_reason,
           'good_days', h.good_days, 'best_good_streak', h.best_good_streak)
           order by h.generation desc), '[]'::jsonb)
    into hist
    from (select * from games.pepegochi_lives x
           where x.user_id = u and x.generation < l.generation
           order by x.generation desc limit (r->>'history_limit')::integer) h;
  select count(*), coalesce(max(floor(extract(epoch from (x.departed_at - x.adopted_at)) / 86400)), 0),
         min(x.departed_at)
    into former, longest, first_left
    from games.pepegochi_lives x where x.user_id = u and x.generation < l.generation;
  if departed then
    former := former + 1;
    first_left := least(first_left, e.departs_at);
  end if;
  longest := greatest(longest,
    floor(extract(epoch from ((case when departed then e.departs_at else t end) - l.adopted_at)) / 86400)::integer);

  return jsonb_build_object('version', 2, 'server_now', t, 'rules', r,
    'has_pet', not departed,
    'can_adopt', departed and l.letter_seen_at is not null,
    'pet', pet, 'history', hist,
    'summary', jsonb_build_object('frens_adopted', l.generation, 'former_frens', former,
                                  'longest_friendship_days', longest, 'first_departed_at', first_left));
end
$$;

-- ---------- internal writes ----------
-- Writes "moved out" once, if the frog is due to leave at time t. Returns true when it wrote.
-- departed_at is the computed moment, not t, so the result never depends on when this runs.
create or replace function games.pepegochi_settle(l games.pepegochi_lives, t timestamptz, r jsonb)
returns boolean language plpgsql volatile set search_path = '' as $$
declare
  e record;
begin
  if l.status <> 'active' then return false; end if;
  e := games.pepegochi_eval(l, t, r);
  if e.status <> 'departed' then return false; end if;
  update games.pepegochi_lives set
    status = 'departed', departed_at = e.departs_at, departure_reason = e.departure_reason,
    letter_variant = 'classic',
    hunger = e.hunger, hygiene = e.hygiene, mood = e.mood, energy = e.energy, needs_at = e.departs_at
  where life_id = l.life_id and status = 'active';
  return found;
end
$$;

-- Records an account milestone once (first_adoption, froglet, adult). Never a stamp by itself.
create or replace function games.pepegochi_milestone(u uuid, m text, life uuid, p_at timestamptz)
returns void language plpgsql volatile set search_path = '' as $$
begin
  if m not in ('first_adoption', 'froglet', 'adult', 'good_parent') then
    raise exception 'Unknown PepeGochi milestone %', m;
  end if;
  insert into games.pepegochi_milestones (user_id, milestone, life_id, reached_at)
  values (u, m, life, p_at)
  on conflict (user_id, milestone) do nothing;
end
$$;

-- The Passport hook. Created here only when it does not exist yet, so re-running this file never
-- switches off a real hook installed later by the Passport bridge (PR C).
do $$
begin
  if to_regprocedure('games.pepegochi_passport_sync(uuid)') is null then
    create function games.pepegochi_passport_sync(u uuid)
    returns void language plpgsql volatile set search_path = '' as $f$
    begin
      -- No-op until the Fren Passport bridge (PR C) replaces it. Milestones wait in
      -- games.pepegochi_milestones with synced_at = null, so the bridge can still award them.
      return;
    end
    $f$;
  end if;
end $$;

-- Hands pending milestones to the Passport hook. A failing hook is logged as a warning and never
-- undoes the care action; the milestone stays pending and is retried on the next accepted write.
create or replace function games.pepegochi_sync(u uuid)
returns void language plpgsql volatile set search_path = '' as $$
begin
  if exists (select 1 from games.pepegochi_milestones m where m.user_id = u and m.synced_at is null) then
    begin
      perform games.pepegochi_passport_sync(u);
    exception when others then
      raise warning 'pepegochi passport sync: %', sqlerrm;
    end;
  end if;
end
$$;

revoke all on function games.pepegochi_clock(), games.pepegochi_rules(),
  games.pepegochi_due(numeric, timestamptz, timestamptz, boolean, numeric, numeric),
  games.pepegochi_eval(games.pepegochi_lives, timestamptz, jsonb), games.pepegochi_view(uuid, timestamptz),
  games.pepegochi_settle(games.pepegochi_lives, timestamptz, jsonb),
  games.pepegochi_milestone(uuid, text, uuid, timestamptz), games.pepegochi_passport_sync(uuid),
  games.pepegochi_sync(uuid)
  from public, anon, authenticated;

-- ---------- browser RPCs (Discord only, no user id) ----------
-- Read-only, even when the frog is due to move out: that is written by the next write call.
create or replace function public.gry_pepegochi_state()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  return games.pepegochi_view(u, games.pepegochi_clock());
end
$$;
revoke all on function public.gry_pepegochi_state() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_state() to authenticated;

-- Adopts a frog when there is none, or after the previous one moved out and its letter was read.
-- With an active frog it returns that frog: a frog cannot be replaced.
create or replace function public.gry_pepegochi_adopt(p_name text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r jsonb := games.pepegochi_rules();
  cleaned text;
  t timestamptz;
  l games.pepegochi_lives%rowtype;
  had_life boolean;
  new_life uuid;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  cleaned := btrim(left(coalesce(p_name, ''), 64));
  if char_length(coalesce(p_name, '')) > 64 or char_length(cleaned) not between 2 and 18
     or cleaned !~ '^[[:alnum:] _.-]+$' then
    raise exception 'Name must be 2-18 letters, numbers, spaces, dots, dashes or underscores'
      using errcode = '22023';
  end if;

  insert into games.pepegochi_owners (user_id, created_at) values (u, games.pepegochi_clock())
  on conflict (user_id) do nothing;
  perform 1 from games.pepegochi_owners o where o.user_id = u for update;
  select * into l from games.pepegochi_lives x where x.user_id = u
    order by x.generation desc limit 1 for update;
  had_life := found;
  t := games.pepegochi_clock();

  if had_life then
    if l.status = 'active' then
      if not games.pepegochi_settle(l, t, r) then
        return games.pepegochi_view(u, t) || jsonb_build_object('adopt_result', 'already_have_fren');
      end if;
      -- it has just moved out; the owner sees the letter before a new egg
      return games.pepegochi_view(u, t) || jsonb_build_object('adopt_result', 'read_the_letter_first');
    end if;
    if l.letter_seen_at is null then
      return games.pepegochi_view(u, t) || jsonb_build_object('adopt_result', 'read_the_letter_first');
    end if;
  end if;

  insert into games.pepegochi_lives (user_id, generation, pet_name, adopted_at, needs_at)
  values (u, coalesce(l.generation, 0) + 1, cleaned, t, t)
  returning life_id into new_life;
  perform games.pepegochi_milestone(u, 'first_adoption', new_life, t);
  perform games.pepegochi_sync(u);
  return games.pepegochi_view(u, t) || jsonb_build_object('adopt_result', 'adopted');
end
$$;
revoke all on function public.gry_pepegochi_adopt(text) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_adopt(text) to authenticated;

-- One of four care actions. Rejections raise an error and write nothing. A frog that is due to move
-- out is written as moved out instead (action_result = 'moved_out'); the action is not applied.
create or replace function public.gry_pepegochi_action(p_action text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r jsonb := games.pepegochi_rules();
  t timestamptz;
  day_utc date;
  l games.pepegochi_lives%rowtype;
  e record;
  has_owner boolean;
  today_count integer;
  last_kind timestamptz;
  need_now numeric;
  h numeric; c numeric; m numeric; en numeric;
  thr numeric;
  due_h timestamptz; due_c timestamptz; due_m timestamptz; due_e timestamptz;
  new_oldest timestamptz;
  was_age_h numeric;
  new_care_day boolean;
  rescue boolean;
  rec_left smallint;
  rec_day date;
  rec_since timestamptz;
  kinds integer;
  mn numeric;
  cared boolean;
  good_now boolean := false;
  g_days integer; g_last date; g_streak integer; g_best integer;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('feed', 'clean', 'play', 'rest') then
    raise exception 'Unknown care action' using errcode = '22023';
  end if;

  select true into has_owner from games.pepegochi_owners o where o.user_id = u for update;
  if has_owner is null then
    raise exception 'Adopt a Fren first' using errcode = 'P0001';
  end if;
  select * into l from games.pepegochi_lives x where x.user_id = u
    order by x.generation desc limit 1 for update;
  t := games.pepegochi_clock();   -- after the locks
  if l.status is distinct from 'active' then
    return games.pepegochi_view(u, t) || jsonb_build_object('action_result', 'moved_out');
  end if;

  e := games.pepegochi_eval(l, t, r);
  if e.status = 'departed' then
    perform games.pepegochi_settle(l, t, r);
    return games.pepegochi_view(u, t) || jsonb_build_object('action_result', 'moved_out');
  end if;

  day_utc := (t at time zone 'UTC')::date;
  today_count := case when l.action_day_utc = day_utc then l.actions_today else 0 end;
  if l.last_action_at is not null
     and t < l.last_action_at + (r->>'min_gap_s')::numeric * interval '1 second' then
    raise exception 'Wait a moment before the next care action' using errcode = 'P0001';
  end if;
  if today_count >= (r->>'max_actions_per_utc_day')::integer then
    raise exception 'Daily care action limit reached' using errcode = 'P0001';
  end if;
  last_kind := case p_action when 'feed' then l.last_feed_at when 'clean' then l.last_clean_at
                             when 'play' then l.last_play_at else l.last_rest_at end;
  if last_kind is not null
     and t < last_kind + (r#>>array['cooldown_min', p_action])::numeric * interval '1 minute' then
    raise exception 'That action is cooling down' using errcode = 'P0001';
  end if;
  need_now := case p_action when 'feed' then e.hunger when 'clean' then e.hygiene
                            when 'play' then e.mood else e.energy end;
  if need_now >= (r->>'meaningful_below')::numeric then
    raise exception 'Your Fren does not need that right now' using errcode = 'P0001';
  end if;

  -- effects, as in v1; fractions are kept, only the response is rounded
  h := e.hunger; c := e.hygiene; m := e.mood; en := e.energy;
  if p_action = 'feed' then
    h := least(100::numeric, h + 35);
  elsif p_action = 'clean' then
    c := least(100::numeric, c + 40);
  elsif p_action = 'play' then
    m := least(100::numeric, m + 35);
    en := greatest(0::numeric, en - 10);
    h := greatest(0::numeric, h - 3);
  else
    en := least(100::numeric, en + 40);
    m := least(100::numeric, m + 5);
  end if;

  -- each need's clock after this action
  thr := (r->>'meaningful_below')::numeric;
  due_h := games.pepegochi_due(h, coalesce(l.hunger_due_at, l.adopted_at), t, p_action = 'feed',
                               (r#>>'{decay_per_day,hunger}')::numeric, thr);
  due_c := games.pepegochi_due(c, coalesce(l.hygiene_due_at, l.adopted_at), t, p_action = 'clean',
                               (r#>>'{decay_per_day,hygiene}')::numeric, thr);
  due_m := games.pepegochi_due(m, coalesce(l.mood_due_at, l.adopted_at), t, p_action = 'play',
                               (r#>>'{decay_per_day,mood}')::numeric, thr);
  due_e := games.pepegochi_due(en, coalesce(l.energy_due_at, l.adopted_at), t, p_action = 'rest',
                               (r#>>'{decay_per_day,energy}')::numeric, thr);

  -- rescue and recovery
  new_oldest := least(due_h, due_c, due_m, due_e);
  was_age_h := extract(epoch from (t - e.oldest_at)) / 3600;
  new_care_day := l.last_care_day_utc is distinct from day_utc;
  rescue := l.rescue_pending;
  rec_left := l.recovery_days_left;
  rec_day := l.recovery_day_utc;
  rec_since := l.recovery_since;
  if rec_left > 0 then
    -- recovering: each later UTC day with care counts once (and, if set, only after the minimum gap)
    if (rec_day is null or day_utc > rec_day)
       and (rec_since is null
            or t >= rec_since + (r->>'recovery_min_gap_h')::numeric * interval '1 hour') then
      rec_left := rec_left - 1;
      rec_day := day_utc;
      rec_since := t;
    end if;
  else
    if was_age_h >= (r->>'rescue_from_h')::numeric then rescue := true; end if;
    -- check-up complete: no need is overdue any more
    if rescue and extract(epoch from (t - new_oldest)) / 3600 < (r->>'neglected_h')::numeric then
      rescue := false;
      rec_left := (r->>'recovery_days')::smallint;
      rec_day := day_utc;
      rec_since := t;
    end if;
  end if;

  -- good care day (PR A2): at most one per UTC day, never taken back. It needs enough different kinds of
  -- care that day and, right after this action, every need at good_day_min_need or more (or, only with the
  -- proposal knob good_day_cared_counts, cared for that day).
  kinds := (case when l.action_day_utc = day_utc then l.day_kinds else 0 end)
           | (case p_action when 'feed' then 1 when 'clean' then 2 when 'play' then 4 else 8 end);
  mn := (r->>'good_day_min_need')::numeric;
  cared := (r->>'good_day_cared_counts')::boolean;
  g_days := l.good_days; g_last := l.last_good_day_utc; g_streak := l.good_streak; g_best := l.best_good_streak;
  if l.last_good_day_utc is distinct from day_utc
     and (kinds & 1) + ((kinds >> 1) & 1) + ((kinds >> 2) & 1) + ((kinds >> 3) & 1)
         >= (r->>'good_day_min_kinds')::integer
     and (h >= mn or (cared and (kinds & 1) <> 0))
     and (c >= mn or (cared and (kinds & 2) <> 0))
     and (m >= mn or (cared and (kinds & 4) <> 0))
     and (en >= mn or (cared and (kinds & 8) <> 0)) then
    good_now := true;
    g_days := g_days + 1;
    g_streak := case when l.last_good_day_utc = day_utc - 1 then l.good_streak + 1 else 1 end;
    g_best := greatest(g_best, g_streak);
    g_last := day_utc;
  end if;

  update games.pepegochi_lives set
    hunger = h, hygiene = c, mood = m, energy = en, needs_at = t,
    hunger_due_at = due_h, hygiene_due_at = due_c, mood_due_at = due_m, energy_due_at = due_e,
    last_action_at = t,
    last_feed_at  = case when p_action = 'feed'  then t else last_feed_at end,
    last_clean_at = case when p_action = 'clean' then t else last_clean_at end,
    last_play_at  = case when p_action = 'play'  then t else last_play_at end,
    last_rest_at  = case when p_action = 'rest'  then t else last_rest_at end,
    feeds  = feeds  + case when p_action = 'feed'  then 1 else 0 end,
    cleans = cleans + case when p_action = 'clean' then 1 else 0 end,
    plays  = plays  + case when p_action = 'play'  then 1 else 0 end,
    rests  = rests  + case when p_action = 'rest'  then 1 else 0 end,
    action_day_utc = day_utc,
    actions_today = today_count + 1,
    care_days = care_days + case when new_care_day then 1 else 0 end,
    last_care_day_utc = day_utc,
    rescue_pending = rescue,
    recovery_days_left = rec_left,
    recovery_day_utc = rec_day,
    recovery_since = rec_since,
    day_kinds = kinds,
    good_days = g_days,
    last_good_day_utc = g_last,
    good_streak = g_streak,
    best_good_streak = g_best
  where life_id = l.life_id
  returning * into strict l;

  if new_care_day then
    if l.care_days >= (r->>'froglet_care_days')::integer then
      perform games.pepegochi_milestone(u, 'froglet', l.life_id, t);
    end if;
    if l.care_days >= (r->>'adult_care_days')::integer then
      perform games.pepegochi_milestone(u, 'adult', l.life_id, t);
    end if;
  end if;
  -- Good Parent foundation: good_parent_days good days in this one life. A milestone only; the stamp
  -- itself comes with the Passport bridge.
  if good_now and l.good_days >= (r->>'good_parent_days')::integer then
    perform games.pepegochi_milestone(u, 'good_parent', l.life_id, t);
  end if;
  perform games.pepegochi_sync(u);
  return games.pepegochi_view(u, t) || jsonb_build_object('action_result', 'accepted');
end
$$;
revoke all on function public.gry_pepegochi_action(text) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_action(text) to authenticated;

-- Opens GOODBYE.TXT: writes the move-out if it is due, then marks the letter as read (once).
-- After this the owner can adopt a new egg. Safe to repeat.
create or replace function public.gry_pepegochi_letter_read()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r jsonb := games.pepegochi_rules();
  t timestamptz;
  l games.pepegochi_lives%rowtype;
  has_owner boolean;
  had_life boolean;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  select true into has_owner from games.pepegochi_owners o where o.user_id = u for update;
  if has_owner is null then
    return games.pepegochi_view(u, games.pepegochi_clock());
  end if;
  select * into l from games.pepegochi_lives x where x.user_id = u
    order by x.generation desc limit 1 for update;
  had_life := found;
  t := games.pepegochi_clock();   -- after the locks
  if had_life then
    if l.status = 'active' and games.pepegochi_settle(l, t, r) then
      select * into strict l from games.pepegochi_lives x where x.life_id = l.life_id;
    end if;
    if l.status = 'departed' and l.letter_seen_at is null then
      update games.pepegochi_lives set letter_seen_at = t where life_id = l.life_id;
    end if;
  end if;
  return games.pepegochi_view(u, t);
end
$$;
revoke all on function public.gry_pepegochi_letter_read() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_letter_read() to authenticated;

commit;

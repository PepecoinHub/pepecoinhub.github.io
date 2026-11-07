-- PepeGochi v1: one personal pet per verified Discord account.
-- REVIEW + STAGING TEST FIRST. Do not paste into the production SQL editor yet.
--
-- The database, not the browser, owns time, stats, evolution and care days.
-- Browser inputs are limited to a pet name and an allowed action string.
-- No cron, Realtime, heartbeat, per-frame writes, or automatic death.
-- Independent of PR #184 (Fren Passport); optional bridge is a separate file.
--
-- Dependency: existing PH-games schema with games.discord_identity(uuid).
begin;

create schema if not exists games;

create table if not exists games.pepegochi_pets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pet_name text not null check (
    char_length(trim(pet_name)) between 2 and 18
    and pet_name ~ '^[[:alnum:] _.-]+$'
  ),
  adopted_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),

  -- Persisted snapshot from the last *accepted* action; read-only calls
  -- derive the current needs without writing.
  hunger numeric(7,4) not null default 75 check (hunger between 0 and 100),
  hygiene numeric(7,4) not null default 80 check (hygiene between 0 and 100),
  mood numeric(7,4) not null default 80 check (mood between 0 and 100),
  energy numeric(7,4) not null default 75 check (energy between 0 and 100),

  care_days integer not null default 0 check (care_days between 0 and 20000),
  last_care_day_utc date,

  -- Rate limits maintained in this ONE row (no request log table).
  action_day_utc date not null default (timezone('utc', now())::date),
  actions_today integer not null default 0 check (actions_today between 0 and 12),
  last_action_at timestamptz,
  last_feed_at timestamptz,
  last_clean_at timestamptz,
  last_play_at timestamptz,
  last_rest_at timestamptz
);

-- Repeatable column upgrade (also supports an older integer-only staging schema).
alter table games.pepegochi_pets
  alter column hunger type numeric(7,4) using hunger::numeric(7,4),
  alter column hygiene type numeric(7,4) using hygiene::numeric(7,4),
  alter column mood type numeric(7,4) using mood::numeric(7,4),
  alter column energy type numeric(7,4) using energy::numeric(7,4);

-- The 'games' schema is not exposed by the site's Supabase Data API.
-- Even if this changes, no client gets direct table permissions.
alter table games.pepegochi_pets enable row level security;
revoke all on games.pepegochi_pets from public, anon, authenticated;

-- Internal, read-only presentation helper. No state mutation on reads.
create or replace function games.pepegochi_snapshot(
  p games.pepegochi_pets, p_asof timestamptz
)
returns jsonb
language plpgsql stable security invoker set search_path = ''
as $$
declare
  elapsed_hours numeric;
  h integer;
  c integer;
  m integer;
  e integer;
  stage text;
  growth integer;
begin
  -- Stop calculating after 30 days; needs can never fall below zero.
  elapsed_hours := greatest(0::numeric,
     least(720::numeric, extract(epoch from (p_asof - p.updated_at)) / 3600));
  h := floor(greatest(0::numeric, p.hunger - elapsed_hours * 20 / 24))::integer;
  c := floor(greatest(0::numeric, p.hygiene - elapsed_hours * 15 / 24))::integer;
  m := floor(greatest(0::numeric, p.mood - elapsed_hours * 18 / 24))::integer;
  e := floor(greatest(0::numeric, p.energy - elapsed_hours * 10 / 24))::integer;

  stage := case when p.care_days >= 7 then 'adult'
                when p.care_days >= 2 then 'froglet'
                else 'tadpole' end;
  growth := case when p.care_days < 2 then 2
                 when p.care_days < 7 then 7
                 else null end;

  return jsonb_build_object(
    'version', 1,
    'has_pet', true,
    'name', p.pet_name,
    'adopted_at', p.adopted_at,
    'server_now', p_asof,
    'care_days', p.care_days,
    'last_care_day_utc', p.last_care_day_utc,
    'stage', stage,
    'next_growth_care_days', growth,
    'needs', jsonb_build_object(
      'hunger', h, 'hygiene', c, 'mood', m, 'energy', e
    ),
    'cooldowns', jsonb_build_object(
      'feed', case when p.last_feed_at is null then null
          else p.last_feed_at + interval '30 minutes' end,
      'clean', case when p.last_clean_at is null then null
          else p.last_clean_at + interval '20 minutes' end,
      'play', case when p.last_play_at is null then null
          else p.last_play_at + interval '45 minutes' end,
      'rest', case when p.last_rest_at is null then null
          else p.last_rest_at + interval '60 minutes' end,
      'any_action', case when p.last_action_at is null then null
          else p.last_action_at + interval '2 seconds' end
    ),
    'action_budget', jsonb_build_object(
      'accepted_today', case when p.action_day_utc =
        (p_asof at time zone 'UTC')::date then p.actions_today else 0 end,
      'max_per_utc_day', 12
    )
  );
end
$$;
revoke all on function games.pepegochi_snapshot(games.pepegochi_pets, timestamptz)
  from public, anon, authenticated;

-- Internal milestone hook. Initially a no-op, so this migration can run
-- independently. The optional Passport bridge replaces it after PR #184.
create or replace function games.pepegochi_milestone_hook(
  p_user_id uuid, p_care_days integer
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  -- Intentionally empty. No rewards until server-side validation is wired.
  return;
end
$$;
revoke all on function games.pepegochi_milestone_hook(uuid, integer)
  from public, anon, authenticated;

-- Read-only: no writes, even when the pet has been away for months.
create or replace function public.gry_pepegochi_state()
returns jsonb
language plpgsql volatile security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  p games.pepegochi_pets%rowtype;
  t timestamptz := clock_timestamp();
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  select * into p from games.pepegochi_pets where user_id = u;
  if not found then
    return jsonb_build_object('version', 1, 'has_pet', false, 'server_now', t);
  end if;
  return games.pepegochi_snapshot(p, t);
end
$$;
revoke all on function public.gry_pepegochi_state()
  from public, anon, authenticated;
grant execute on function public.gry_pepegochi_state() to authenticated;

-- One permanent adoption per Discord user. No user_id parameter.
create or replace function public.gry_pepegochi_adopt(p_name text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  p games.pepegochi_pets%rowtype;
  t timestamptz;
  cleaned_name text := trim(p_name);
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  if cleaned_name is null or char_length(cleaned_name) not between 2 and 18
     or cleaned_name !~ '^[[:alnum:] _.-]+$' then
    raise exception 'Name must be 2-18 letters, numbers, spaces, dots, dashes or underscores'
      using errcode = '22023';
  end if;

  -- Concurrent adoptions of the same account cannot create two pets.
  insert into games.pepegochi_pets (user_id, pet_name)
  values (u, cleaned_name)
  on conflict (user_id) do nothing;

  select * into strict p from games.pepegochi_pets where user_id = u;
  t := clock_timestamp();
  return games.pepegochi_snapshot(p, t);
end
$$;
revoke all on function public.gry_pepegochi_adopt(text)
  from public, anon, authenticated;
grant execute on function public.gry_pepegochi_adopt(text) to authenticated;

-- Only FOUR action names are accepted; no client-controlled scores/stats/time.
-- Locks the owner's row so concurrent requests cannot double-count care days.
create or replace function public.gry_pepegochi_action(p_action text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  u uuid := auth.uid();
  p games.pepegochi_pets%rowtype;
  t timestamptz;
  day_utc date;
  elapsed_hours numeric;
  h numeric;
  c numeric;
  m numeric;
  e numeric;
  today_count integer;
  new_care_day boolean;
  next_care_days integer;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('feed', 'clean', 'play', 'rest') then
    raise exception 'Unknown care action' using errcode = '22023';
  end if;

  select * into p from games.pepegochi_pets
    where user_id = u for update;
  if not found then
    raise exception 'Adopt a Pepe first' using errcode = '22023';
  end if;

  -- Read server time AFTER obtaining the lock. No race on a queued request.
  t := clock_timestamp();
  day_utc := (t at time zone 'UTC')::date;
  today_count := case when p.action_day_utc = day_utc
                 then p.actions_today else 0 end;

  if p.last_action_at is not null
     and t < p.last_action_at + interval '2 seconds' then
    raise exception 'Wait a moment before the next care action' using errcode = 'P0001';
  end if;
  if today_count >= 12 then
    raise exception 'Daily care action limit reached' using errcode = 'P0001';
  end if;

  if (p_action = 'feed' and p.last_feed_at is not null
      and t < p.last_feed_at + interval '30 minutes')
   or (p_action = 'clean' and p.last_clean_at is not null
      and t < p.last_clean_at + interval '20 minutes')
   or (p_action = 'play' and p.last_play_at is not null
      and t < p.last_play_at + interval '45 minutes')
   or (p_action = 'rest' and p.last_rest_at is not null
      and t < p.last_rest_at + interval '60 minutes') then
    raise exception 'That action is cooling down' using errcode = 'P0001';
  end if;

  -- Persist fractional needs. Only the UI response is rounded to integers.
  elapsed_hours := greatest(0::numeric,
    least(720::numeric, extract(epoch from (t - p.updated_at)) / 3600));
  h := greatest(0::numeric, p.hunger - elapsed_hours * 20 / 24);
  c := greatest(0::numeric, p.hygiene - elapsed_hours * 15 / 24);
  m := greatest(0::numeric, p.mood - elapsed_hours * 18 / 24);
  e := greatest(0::numeric, p.energy - elapsed_hours * 10 / 24);

  if p_action = 'feed' then
    h := least(100, h + 35);
  elsif p_action = 'clean' then
    c := least(100, c + 40);
  elsif p_action = 'play' then
    m := least(100, m + 35);
    e := greatest(0, e - 10);
    h := greatest(0, h - 3);
  elsif p_action = 'rest' then
    e := least(100, e + 40);
    m := least(100, m + 5);
  end if;

  new_care_day := p.last_care_day_utc is distinct from day_utc;
  next_care_days := p.care_days + case when new_care_day then 1 else 0 end;

  update games.pepegochi_pets set
    hunger = h, hygiene = c, mood = m, energy = e,
    updated_at = t,
    last_action_at = t,
    last_feed_at = case when p_action = 'feed' then t else p.last_feed_at end,
    last_clean_at = case when p_action = 'clean' then t else p.last_clean_at end,
    last_play_at = case when p_action = 'play' then t else p.last_play_at end,
    last_rest_at = case when p_action = 'rest' then t else p.last_rest_at end,
    action_day_utc = day_utc,
    actions_today = today_count + 1,
    care_days = next_care_days,
    last_care_day_utc = case when new_care_day then day_utc
                             else p.last_care_day_utc end
  where user_id = u returning * into strict p;

  if new_care_day and next_care_days = 100 then
    perform games.pepegochi_milestone_hook(u, next_care_days);
  end if;
  return games.pepegochi_snapshot(p, t);
end
$$;
revoke all on function public.gry_pepegochi_action(text)
  from public, anon, authenticated;
grant execute on function public.gry_pepegochi_action(text) to authenticated;

commit;

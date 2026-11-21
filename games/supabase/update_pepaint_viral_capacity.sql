-- PEPaint surge protection, stage 1. Apply to a test database first.
-- Apply before the new client, then use enforce_pepaint_draw_rpc.sql only after
-- old clients have refreshed. Never run the enforcement file alone.
begin;

-- Active players include lobbies, so game creation cannot consume every
-- Realtime connection. These are conservative PEPaint limits, not measurements
-- of the total project's connections or capacity.
alter table games.config add column if not exists pepaint_max_live_rooms int not null default 8
  check (pepaint_max_live_rooms between 1 and 8);
alter table games.config add column if not exists pepaint_max_active_players int not null default 100
  check (pepaint_max_active_players between 12 and 100);
alter table games.config add column if not exists pepaint_draw_budget int not null default 48
  check (pepaint_draw_budget between 26 and 60);

create or replace function games.pepaint_guard_room() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim int;
begin
  if new.mode <> 'kalambury' or new.status <> 'open' or new.phase not in ('turn','reveal') then return new; end if;
  if tg_op = 'UPDATE' then
    if old.mode = 'kalambury' and old.status = 'open' and old.phase in ('turn','reveal') then return new; end if;
  end if;
  -- Serialize admission, including simultaneous starts in different rooms.
  perform pg_advisory_xact_lock(980021, 1);
  select pepaint_max_live_rooms into lim from games.config where id = 1;
  if (select count(*) from games.rooms r where r.mode = 'kalambury' and r.status = 'open'
        and r.phase in ('turn','reveal') and r.code <> new.code) >= lim then
    raise exception 'PEPaint is busy: all live game slots are occupied. Please wait for a game to finish.';
  end if;
  return new;
end $$;

drop trigger if exists pepaint_guard_room on games.rooms;
create trigger pepaint_guard_room before insert or update of phase, status on games.rooms
  for each row execute function games.pepaint_guard_room();

create or replace function games.pepaint_guard_player() returns trigger
language plpgsql security definer set search_path = '' as $$
declare lim int; room_lim int;
begin
  if not games.active(new::games.players) then return new; end if;
  if tg_op = 'UPDATE' then
    if games.active(old::games.players) then return new; end if;
  end if;
  if not exists (select 1 from games.rooms where code = new.room_code and mode = 'kalambury' and status = 'open') then return new; end if;
  -- Also handles returning inactive players via gry_state, not only new joins.
  perform pg_advisory_xact_lock(980021, 2);
  select pepaint_max_active_players, casual_max_players into lim, room_lim from games.config where id = 1;
  if (select count(*) from games.players p where p.room_code = new.room_code
      and p.user_id <> new.user_id and games.active(p)) >= room_lim then
    raise exception 'This room is full';
  end if;
  if (select count(*) from games.players p join games.rooms r on r.code = p.room_code
      where r.mode = 'kalambury' and r.status = 'open' and games.active(p)
        and (p.room_code, p.user_id) <> (new.room_code, new.user_id)) >= lim then
    raise exception 'PEPaint is busy: player capacity reached. Please try again in a moment.';
  end if;
  return new;
end $$;

drop trigger if exists pepaint_guard_player on games.players;
create trigger pepaint_guard_player before insert or update of last_seen, left_at, kicked on games.players
  for each row execute function games.pepaint_guard_player();

-- Small private rolling window: bounded by recent accepted packets, cleaned on
-- each successful/attempted send. No per-stroke history or public table.
create table if not exists games.pepaint_draw_window (
  sent_at timestamptz not null,
  room_code text not null,
  delivery_cost int not null check (delivery_cost > 0)
);
alter table games.pepaint_draw_window enable row level security;
revoke all on games.pepaint_draw_window from public, anon, authenticated;

create or replace function public.gry_pepaint_draw(
  p_code text, p_turn uuid, p_event text, p_payload jsonb
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; t timestamptz;
        cost int; budget int; live_rooms int; used int; last_room timestamptz; first_recent timestamptz;
        interval_ms int; wait_ms int; st jsonb;
begin
  if u is null then raise exception 'Sign in first'; end if;
  if p_event is null or p_event not in ('d','snap') or p_payload is null
     or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 220000 then
    raise exception 'Invalid drawing packet';
  end if;
  if p_event = 'd' and (jsonb_typeof(p_payload->'s') is distinct from 'array') then
    raise exception 'Invalid drawing packet';
  end if;
  if p_event = 'snap' and (jsonb_typeof(p_payload->'data') is distinct from 'string'
      or not (p_payload->>'data' like 'data:image/jpeg;base64,%')) then
    raise exception 'Invalid drawing snapshot';
  end if;
  -- Keep the authorization and turn check atomic with the dispatch.
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found or r.mode <> 'kalambury' or r.status <> 'open' or r.phase <> 'turn'
     or r.turn_id is distinct from p_turn or p_turn is null or r.drawer_id is distinct from u
     or not exists (select 1 from games.players p where p.room_code = r.code and p.user_id = u and games.active(p)) then
    return jsonb_build_object('ok', false, 'closed', true);
  end if;
  if p_event = 'd' then
    if jsonb_array_length(p_payload->'s') > 256 then raise exception 'Invalid drawing packet'; end if;
    for st in select value from jsonb_array_elements(p_payload->'s') loop
      if jsonb_typeof(st) <> 'object' or coalesce(st->>'id','') !~ '^[0-9]{1,10}$'
        or coalesce(st->>'c','') !~ '^#[0-9a-fA-F]{6}$' or coalesce(st->>'w','') not in ('3','4','9','18','36')
        or jsonb_typeof(st->'p') is distinct from 'array' then raise exception 'Invalid stroke'; end if;
      if jsonb_array_length(st->'p') < 2 or jsonb_array_length(st->'p') > 4096
        or mod(jsonb_array_length(st->'p'), 2) <> 0
        or exists (select 1 from jsonb_array_elements(st->'p') a where jsonb_typeof(a.value) <> 'number'
             or a.value::text !~ '^-?[0-9]{1,6}$') then raise exception 'Invalid stroke'; end if;
    end loop;
  end if;
  -- Cost includes the sender/server event and each active member. This is a
  -- conservative estimate for one connection per player, not a provider meter.
  select count(*)::int + 1 into cost from games.players p where p.room_code = r.code and games.active(p);
  select pepaint_draw_budget into budget from games.config where id = 1;
  select greatest(1,count(*))::int into live_rooms from games.rooms
    where mode = 'kalambury' and status = 'open' and phase in ('turn','reveal');
  -- Packets are indivisible: e.g. a 13-event packet fits only 3 times into a
  -- 48-event window. Budgeting fractional packets would starve the last
  -- rooms in a burst of eight full games.
  interval_ms := greatest(250, ceil(1000.0 * live_rooms / greatest(1, budget / cost))::int + 50);

  -- A single shared rolling-second budget, independent of the number or timing
  -- of drawing clients. Use wall clock after acquiring the lock.
  perform pg_advisory_xact_lock(980021, 3);
  t := clock_timestamp();
  delete from games.pepaint_draw_window where sent_at <= t - interval '10 seconds';
  select coalesce(sum(delivery_cost) filter (where sent_at > t - interval '1 second'),0)::int,
         max(sent_at) filter (where room_code = r.code),
         min(sent_at) filter (where sent_at > t - interval '1 second')
    into used, last_room, first_recent from games.pepaint_draw_window;
  wait_ms := greatest(0, ceil(extract(epoch from (last_room + make_interval(secs => interval_ms / 1000.0) - t)) * 1000)::int);
  -- A room that was simply unlucky can try when shared credit expires,
  -- sooner than rooms that already sent. Avoid synchronized starvation.
  if used + cost > budget then
    wait_ms := greatest(wait_ms, coalesce(ceil(extract(epoch from (first_recent + interval '1 second' - t)) * 1000)::int, 1000));
  end if;
  if used + cost > budget or wait_ms > 0 then
    return jsonb_build_object('ok', false, 'retry_ms', greatest(250, wait_ms + 25));
  end if;
  insert into games.pepaint_draw_window values (t, r.code, cost);
  perform realtime.send(p_payload, p_event, 'draw:' || r.code || ':' || p_turn, true);
  return jsonb_build_object('ok', true, 'interval_ms', interval_ms);
end $$;

revoke all on function games.pepaint_guard_room(), games.pepaint_guard_player() from public, anon, authenticated;
revoke all on function public.gry_pepaint_draw(text, uuid, text, jsonb) from public, anon;
grant execute on function public.gry_pepaint_draw(text, uuid, text, jsonb) to authenticated;
commit;

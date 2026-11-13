-- BATTLE OF THREE LILIES (Colonel Blotto for two frogs) on PondOS 98. Run once in the Supabase SQL editor
-- after schema.sql and update_pond_bulletin.sql. Safe to run again (nothing is deleted).
--
-- Rules
--   * Each player has exactly 10 flies and puts them on three lily pads (A, B, C): whole numbers 0..10, sum 10.
--   * Each pad is won by the bigger number; equal numbers leave that pad undecided.
--   * The duel goes to the player who wins MORE pads (2:1, 2:0, 1:0, 3:0). Otherwise (1:1, 0:0) it is a draw.
--   * Player A creates a challenge: the allocation is stored as a secret. Player B accepts later with their
--     own allocation; the server stores it, settles the duel and only then shows both allocations.
--   * A challenge is open for 48 hours. Expired: no win, no loss. Only its author can cancel an open one.
--   * Limits: 3 open challenges per player, 5 new challenges per player per UTC day, 15 per network per UTC day.
--   * No stakes, no PEP, no points for posting.
--
-- Security: players come from the signed-in Supabase session (Discord or guest), never from an argument.
-- The secret allocations live in games.lily_moves, which no browser role can read or write; the functions
-- below are the only way in, and they return an opponent's allocation only after the duel is settled and
-- only to its two players. Nothing here is sent over Realtime.

create table if not exists games.lily_challenges (
  id                 uuid primary key default gen_random_uuid(),
  creator            uuid not null,
  creator_nick       text not null,
  creator_ip         text,
  invitee            uuid,                 -- set for a rematch: only this fren may accept
  invitee_nick       text,
  opponent           uuid,
  opponent_nick      text,
  status             text not null default 'open' check (status in ('open', 'completed', 'cancelled', 'expired')),
  result             text check (result in ('creator_win', 'opponent_win', 'draw')),
  winner             uuid,
  pads               int[],                -- pads won per side after the duel: {creator, opponent}
  rematch_of         uuid,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null default now() + interval '48 hours',
  completed_at       timestamptz,
  check ((status = 'completed') = (result is not null))
);
create index if not exists lily_open on games.lily_challenges (expires_at) where status = 'open';
create index if not exists lily_creator on games.lily_challenges (creator, created_at desc);
create index if not exists lily_opponent on games.lily_challenges (opponent, created_at desc);
create index if not exists lily_ip on games.lily_challenges (creator_ip, created_at);
alter table games.lily_challenges enable row level security;
revoke all on games.lily_challenges from public, anon, authenticated;

create table if not exists games.lily_moves (
  challenge_id  uuid not null references games.lily_challenges(id) on delete cascade,
  player        uuid not null,
  a             int not null check (a between 0 and 10),
  b             int not null check (b between 0 and 10),
  c             int not null check (c between 0 and 10),
  submitted_at  timestamptz not null default now(),
  primary key (challenge_id, player),
  check (a + b + c = 10)
);
alter table games.lily_moves enable row level security;
revoke all on games.lily_moves from public, anon, authenticated;

-- a submitted allocation can never change (on top of the missing grants): defence in depth
create or replace function games.lily_moves_frozen() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'A submitted allocation cannot be changed'; end $$;
drop trigger if exists lily_moves_frozen on games.lily_moves;
create trigger lily_moves_frozen before update on games.lily_moves for each row execute function games.lily_moves_frozen();

-- 'ok' or the reason an allocation is not allowed
create or replace function games.lily_check(a int, b int, c int) returns text language sql immutable set search_path = '' as $$
  select case when a is null or b is null or c is null then 'flies'
              when a < 0 or b < 0 or c < 0 or a > 10 or b > 10 or c > 10 then 'flies'
              when a + b + c <> 10 then 'sum' else 'ok' end
$$;

-- pads won by x and by y: {x, y}
create or replace function games.lily_pads(xa int, xb int, xc int, ya int, yb int, yc int) returns int[]
language sql immutable set search_path = '' as $$
  select array[(xa > ya)::int + (xb > yb)::int + (xc > yc)::int, (ya > xa)::int + (yb > xb)::int + (yc > xc)::int]
$$;

-- public metadata of one challenge, as anyone may see it (no moves)
create or replace function games.lily_public(ch games.lily_challenges, u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'id', ch.id, 'status', case when ch.status = 'open' and ch.expires_at <= now() then 'expired' else ch.status end,
    'creator', ch.creator_nick, 'creator_passport', games.passport_id(ch.creator),
    'opponent', ch.opponent_nick, 'opponent_passport', games.passport_id(ch.opponent),
    'invitee', ch.invitee_nick, 'result', ch.result, 'pads', to_jsonb(ch.pads),
    'created_at', ch.created_at, 'expires_at', ch.expires_at, 'completed_at', ch.completed_at,
    'mine', u is not null and ch.creator = u, 'played', u is not null and ch.opponent = u,
    'for_me', u is not null and ch.invitee = u, 'rematch_of', ch.rematch_of)
$$;

-- full view of a duel for one of its players: own allocation always, the other one only when settled
create or replace function games.lily_view(ch games.lily_challenges, u uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me games.lily_moves; them games.lily_moves; you_won text;
begin
  select * into me from games.lily_moves where challenge_id = ch.id and player = u;
  if ch.status = 'completed' then
    select * into them from games.lily_moves where challenge_id = ch.id and player <> u;
    you_won := case when ch.result = 'draw' then 'draw' when ch.winner = u then 'win' else 'lose' end;
  end if;
  return games.lily_public(ch, u) || jsonb_build_object(
    'you', case when me.player is null then null else jsonb_build_array(me.a, me.b, me.c) end,
    'them', case when them.player is null then null else jsonb_build_array(them.a, them.b, them.c) end,
    'outcome', you_won);
end $$;

-- expired challenges are closed when somebody touches the game (no background job needed)
create or replace function games.lily_expire() returns void language sql security definer set search_path = '' as $$
  update games.lily_challenges set status = 'expired' where status = 'open' and expires_at <= now();
$$;

-- A creates a challenge with a secret allocation. A rematch (p_rematch_of = a finished duel of yours)
-- is offered only to the other player of that duel. Returns safe metadata only.
create or replace function public.gry_lily_create(p_a int, p_b int, p_c int, p_nick text default null, p_rematch_of uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); ip text := games.client_ip_hash(); nm jsonb; chk text; n int;
  day timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  prev games.lily_challenges; inv uuid; inv_nick text; ch games.lily_challenges;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'signin'); end if;
  chk := games.lily_check(p_a, p_b, p_c);
  if chk <> 'ok' then return jsonb_build_object('ok', false, 'error', chk); end if;
  nm := games.pond_name(u, p_nick);
  if nm ? 'error' then return jsonb_build_object('ok', false, 'error', 'nick', 'message', nm->>'message'); end if;
  if p_rematch_of is not null then
    select * into prev from games.lily_challenges where id = p_rematch_of;
    if prev.id is null or prev.status <> 'completed' or u not in (prev.creator, prev.opponent) then
      return jsonb_build_object('ok', false, 'error', 'rematch'); end if;
    inv := case when prev.creator = u then prev.opponent else prev.creator end;
    inv_nick := case when prev.creator = u then prev.opponent_nick else prev.creator_nick end;
  end if;

  perform pg_advisory_xact_lock(hashtext('lily:' || u::text));   -- one create at a time per player
  perform games.lily_expire();
  select count(*) into n from games.lily_challenges where creator = u and status = 'open';
  if n >= 3 then return jsonb_build_object('ok', false, 'error', 'open_limit'); end if;
  select count(*) into n from games.lily_challenges where creator = u and created_at >= day;
  if n >= 5 then return jsonb_build_object('ok', false, 'error', 'day_limit'); end if;
  if ip is not null then
    select count(*) into n from games.lily_challenges where creator_ip = ip and created_at >= day;
    if n >= 15 then return jsonb_build_object('ok', false, 'error', 'day_limit'); end if;
  end if;
  if (select count(*) from games.lily_challenges where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'busy'); end if;

  insert into games.lily_challenges (creator, creator_nick, creator_ip, invitee, invitee_nick, rematch_of)
  values (u, nm->>'nick', ip, inv, inv_nick, p_rematch_of) returning * into ch;
  insert into games.lily_moves (challenge_id, player, a, b, c) values (ch.id, u, p_a, p_b, p_c);
  return jsonb_build_object('ok', true, 'challenge', games.lily_public(ch, u));
end $$;

-- B accepts an open challenge: lock, check, store the second allocation, settle, post to the Bulletin.
create or replace function public.gry_lily_accept(p_id uuid, p_a int, p_b int, p_c int, p_nick text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid(); nm jsonb; chk text; ch games.lily_challenges; cm games.lily_moves; v_pads int[]; res text; win uuid;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'signin'); end if;
  chk := games.lily_check(p_a, p_b, p_c);
  if chk <> 'ok' then return jsonb_build_object('ok', false, 'error', chk); end if;
  nm := games.pond_name(u, p_nick);
  if nm ? 'error' then return jsonb_build_object('ok', false, 'error', 'nick', 'message', nm->>'message'); end if;

  select * into ch from games.lily_challenges where id = p_id for update;   -- a second accept waits here
  if ch.id is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if ch.status = 'open' and ch.expires_at <= now() then
    update games.lily_challenges set status = 'expired' where id = ch.id;
    return jsonb_build_object('ok', false, 'error', 'expired');
  end if;
  if ch.status <> 'open' then return jsonb_build_object('ok', false, 'error', 'taken', 'status', ch.status); end if;
  if ch.creator = u then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  if ch.invitee is not null and ch.invitee <> u then return jsonb_build_object('ok', false, 'error', 'invite'); end if;

  insert into games.lily_moves (challenge_id, player, a, b, c) values (ch.id, u, p_a, p_b, p_c);
  select * into cm from games.lily_moves where challenge_id = ch.id and player = ch.creator;
  v_pads := games.lily_pads(cm.a, cm.b, cm.c, p_a, p_b, p_c);
  res := case when v_pads[1] > v_pads[2] then 'creator_win' when v_pads[2] > v_pads[1] then 'opponent_win' else 'draw' end;
  win := case res when 'creator_win' then ch.creator when 'opponent_win' then u end;
  update games.lily_challenges set status = 'completed', opponent = u, opponent_nick = nm->>'nick', result = res,
         winner = win, pads = v_pads, completed_at = now() where id = ch.id returning * into ch;

  if res = 'draw' then
    perform games.bulletin_post('lily:' || ch.id, 'lilies', 'lily_draw', ch.creator_nick, ch.creator, ch.opponent_nick, u, ch.id::text,
                                jsonb_build_object('pads', to_jsonb(v_pads)));
  else
    perform games.bulletin_post('lily:' || ch.id, 'lilies', 'lily_win',
                                case when win = u then ch.opponent_nick else ch.creator_nick end, win,
                                case when win = u then ch.creator_nick else ch.opponent_nick end,
                                case when win = u then ch.creator else u end, ch.id::text,
                                jsonb_build_object('pads', to_jsonb(array[greatest(v_pads[1], v_pads[2]), least(v_pads[1], v_pads[2])])));
  end if;
  return jsonb_build_object('ok', true, 'match', games.lily_view(ch, u));
end $$;

-- your duels: open, settled, cancelled, expired (newest first, max 30)
create or replace function public.gry_lily_my()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('signed_in', false, 'matches', '[]'::jsonb); end if;
  perform games.lily_expire();
  return jsonb_build_object('signed_in', true, 'matches', coalesce((
    select jsonb_agg(games.lily_view(ch, u) order by coalesce(ch.completed_at, ch.created_at) desc)
      from (select * from games.lily_challenges where creator = u or opponent = u
             order by coalesce(completed_at, created_at) desc limit 30) ch), '[]'::jsonb));
end $$;

-- one duel. Its players see both allocations once it is settled; everybody else sees the public metadata.
create or replace function public.gry_lily_result(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); ch games.lily_challenges;
begin
  select * into ch from games.lily_challenges where id = p_id;
  if ch.id is null then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if u is not null and u in (ch.creator, ch.opponent) then return jsonb_build_object('ok', true, 'match', games.lily_view(ch, u)); end if;
  return jsonb_build_object('ok', true, 'match', games.lily_public(ch, u));
end $$;

-- the author cancels a challenge that is still open
create or replace function public.gry_lily_cancel(p_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ch games.lily_challenges;
begin
  if u is null then return jsonb_build_object('ok', false, 'error', 'signin'); end if;
  select * into ch from games.lily_challenges where id = p_id for update;
  if ch.id is null or ch.creator <> u then return jsonb_build_object('ok', false, 'error', 'missing'); end if;
  if ch.status <> 'open' or ch.expires_at <= now() then return jsonb_build_object('ok', false, 'error', 'taken', 'status', ch.status); end if;
  update games.lily_challenges set status = 'cancelled' where id = ch.id;
  return jsonb_build_object('ok', true);
end $$;

revoke all on function games.lily_moves_frozen(), games.lily_check(int, int, int), games.lily_pads(int, int, int, int, int, int),
  games.lily_public(games.lily_challenges, uuid), games.lily_view(games.lily_challenges, uuid),
  games.lily_expire() from public, anon, authenticated;
revoke all on function public.gry_lily_create(int, int, int, text, uuid), public.gry_lily_accept(uuid, int, int, int, text),
  public.gry_lily_my(), public.gry_lily_result(uuid), public.gry_lily_cancel(uuid) from public, anon;
grant execute on function public.gry_lily_create(int, int, int, text, uuid), public.gry_lily_accept(uuid, int, int, int, text),
  public.gry_lily_my(), public.gry_lily_result(uuid), public.gry_lily_cancel(uuid) to authenticated;

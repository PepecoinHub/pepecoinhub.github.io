-- POND KING: an asynchronous rock-paper-scissors "king of the hill" for the meme edition (PondOS 98).
-- Run once in the Supabase SQL editor after schema.sql. Safe to run again (nothing is deleted).
--
-- Rules
--   * One frog sits on the throne with three secret moves (r = rock, p = paper, s = scissors).
--   * A challenger picks three moves. For every duel the server shuffles the king's three moves into a
--     random order, then plays three rounds. The challenger needs MORE round wins than the king;
--     a tie (1:1, 0:0) keeps the king on the throne.
--   * A winning challenger becomes the new king; their three moves become their defence and they can
--     change them at any time while they reign. A lost duel adds one defence to the king's reign.
--   * One duel per king per player (random browser token) and per network (hashed IP). When the king
--     changes, everybody may try again. Nobody can challenge themselves.
--   * The king's moves never leave the database, except to the king (who holds the token) and as the
--     shuffled rounds of a finished duel, which show the challenger only the king's set of moves.
--
-- No sign-in: a player is a random token the browser keeps in localStorage. The database keeps only its
-- SHA-256 (with the project salt), the nickname, the moves and a salted IP hash (for the limits).
-- The tables are reachable only through the functions below.

create table if not exists games.pk_kings (
  id          bigint generated always as identity primary key,
  token_hash  text,                                   -- null = the house frog that opens the pond
  ip_hash     text,
  nick        text not null,
  moves       text not null check (moves ~ '^[rps]{3}$'),
  crowned_at  timestamptz not null default now(),
  ended_at    timestamptz,
  defenses    int not null default 0,
  ended_by    text                                    -- nickname of the frog that took the throne
);
create unique index if not exists pk_kings_one_reigning on games.pk_kings ((true)) where ended_at is null;
create index if not exists pk_kings_best on games.pk_kings (defenses desc, crowned_at);
alter table games.pk_kings enable row level security;
revoke all on games.pk_kings from public, anon, authenticated;

create table if not exists games.pk_duels (
  id          bigint generated always as identity primary key,
  king_id     bigint not null references games.pk_kings(id) on delete cascade,
  token_hash  text not null,
  ip_hash     text,
  nick        text not null,
  moves       text not null check (moves ~ '^[rps]{3}$'),
  king_order  text not null check (king_order ~ '^[rps]{3}$'),
  won         boolean not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists pk_duels_once on games.pk_duels (king_id, token_hash);
create index if not exists pk_duels_ip on games.pk_duels (ip_hash, created_at);
create index if not exists pk_duels_king on games.pk_duels (king_id, created_at desc);
create index if not exists pk_duels_time on games.pk_duels (created_at);
alter table games.pk_duels enable row level security;
revoke all on games.pk_duels from public, anon, authenticated;

create table if not exists games.pk_meta (id int primary key check (id = 1), cleanup_at timestamptz);
insert into games.pk_meta (id) values (1) on conflict do nothing;
alter table games.pk_meta enable row level security;
revoke all on games.pk_meta from public, anon, authenticated;

-- the pond opens with the house frog on the throne
insert into games.pk_kings (nick, moves)
select 'Pepe', (select string_agg(substr('rps', 1 + floor(random() * 3)::int, 1), '') from generate_series(1, 3))
where not exists (select 1 from games.pk_kings);

-- the player's random browser token, hashed with the project salt (null if the token looks wrong)
create or replace function games.pk_token_hash(p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select case when coalesce(p_token, '') ~ '^[A-Za-z0-9-]{20,64}$'
    then encode(sha256(convert_to((select host_code_salt from games.config where id = 1) || '|pk|' || p_token, 'UTF8')), 'hex') end
$$;

-- 1 = a beats b, -1 = b beats a, 0 = the same move
create or replace function games.pk_beats(a text, b text) returns int
language sql immutable set search_path = '' as $$
  select case when a = b then 0 when (a, b) in (('r', 's'), ('s', 'p'), ('p', 'r')) then 1 else -1 end
$$;

-- What a visitor sees: the reigning king (and their moves, if it is you), whether you may challenge,
-- the longest reigns and the latest duels (names and results only, never moves).
create or replace function public.gry_pk_state(p_token text default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  th text := games.pk_token_hash(p_token);
  ip text := games.client_ip_hash();
  k games.pk_kings;
  mine games.pk_duels;
  ip_used boolean := false;
  you boolean;
begin
  select * into k from games.pk_kings where ended_at is null;
  if k.id is null then return jsonb_build_object('king', null); end if;
  you := coalesce(th is not null and k.token_hash = th, false);
  if th is not null then select * into mine from games.pk_duels where king_id = k.id and token_hash = th; end if;
  if ip is not null and mine.id is null then
    ip_used := exists (select 1 from games.pk_duels where king_id = k.id and ip_hash = ip);
  end if;
  return jsonb_build_object(
    'king', jsonb_build_object('id', k.id, 'nick', k.nick, 'defenses', k.defenses, 'since', k.crowned_at,
                               'house', k.token_hash is null, 'you', you,
                               'moves', case when you then k.moves end),
    'can_challenge', not you and mine.id is null and not ip_used,
    'tried', case when mine.id is not null then jsonb_build_object('won', mine.won, 'at', mine.created_at)
                  when ip_used then jsonb_build_object('network', true) end,
    'duels_today', (select count(*) from games.pk_duels where created_at > now() - interval '24 hours'),
    'top', coalesce((select jsonb_agg(jsonb_build_object('nick', t.nick, 'defenses', t.defenses, 'reigning', t.ended_at is null,
                                                         'since', t.crowned_at, 'until', t.ended_at, 'you', coalesce(th is not null and t.token_hash = th, false))
                                      order by t.defenses desc, t.crowned_at)
                     from (select * from games.pk_kings where defenses > 0 or ended_at is null
                            order by defenses desc, crowned_at limit 10) t), '[]'::jsonb),
    'recent', coalesce((select jsonb_agg(jsonb_build_object('nick', d.nick, 'won', d.won, 'at', d.created_at, 'king', kk.nick)
                                         order by d.created_at desc)
                        from (select * from games.pk_duels order by created_at desc limit 8) d
                        join games.pk_kings kk on kk.id = d.king_id), '[]'::jsonb),
    -- the king sees who came for the throne during this reign
    'challengers', case when you then coalesce((select jsonb_agg(jsonb_build_object('nick', d.nick, 'moves', d.moves, 'order', d.king_order, 'at', d.created_at)
                                                                 order by d.created_at desc)
                                                from (select * from games.pk_duels where king_id = k.id order by created_at desc limit 10) d), '[]'::jsonb) end);
end $$;

-- One duel against the king the player saw (p_king_id). If the throne changed hands in the meantime,
-- nothing is played and the answer says so ("changed"), so the player can look at the new king first.
create or replace function public.gry_pk_challenge(p_token text, p_king_id bigint, p_nick text, p_moves text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  th text := games.pk_token_hash(p_token);
  ip text := games.client_ip_hash();
  v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
  v_moves text := lower(coalesce(p_moves, ''));
  k games.pk_kings;
  ord text; me int := 0; them int := 0; r int; won boolean; n int; new_id bigint;
  rounds jsonb := '[]'::jsonb;
begin
  if th is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if v_moves !~ '^[rps]{3}$' then return jsonb_build_object('ok', false, 'error', 'moves'); end if;
  if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick !~ '^[A-Za-z0-9 _.\-]+$' then
    return jsonb_build_object('ok', false, 'error', 'nick'); end if;
  if games.is_profane(v_nick) then return jsonb_build_object('ok', false, 'error', 'nick_bad'); end if;

  -- the throne row lock makes duels happen one after another
  select * into k from games.pk_kings where ended_at is null for update;
  if k.id is null or k.id is distinct from p_king_id then return jsonb_build_object('ok', false, 'error', 'changed'); end if;
  if k.token_hash = th then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  if exists (select 1 from games.pk_duels where king_id = k.id and token_hash = th) then
    return jsonb_build_object('ok', false, 'error', 'tried'); end if;
  if ip is not null and exists (select 1 from games.pk_duels where king_id = k.id and ip_hash = ip) then
    return jsonb_build_object('ok', false, 'error', 'network'); end if;

  -- limits: 300 duels an hour overall; 12 per network (or 60 from clients without an IP header) in 10 minutes
  if (select count(*) from games.pk_duels where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'busy'); end if;
  select count(*) into n from games.pk_duels where created_at > now() - interval '10 minutes'
     and (ip_hash = ip or (ip is null and ip_hash is null));
  if n >= (case when ip is null then 60 else 12 end) then return jsonb_build_object('ok', false, 'error', 'slow'); end if;

  -- the king's three moves in a fresh random order
  select string_agg(m, '' order by random()) into ord from regexp_split_to_table(k.moves, '') m;
  for i in 1..3 loop
    r := games.pk_beats(substr(v_moves, i, 1), substr(ord, i, 1));
    if r > 0 then me := me + 1; elsif r < 0 then them := them + 1; end if;
    rounds := rounds || jsonb_build_object('you', substr(v_moves, i, 1), 'king', substr(ord, i, 1), 'result', r);
  end loop;
  won := me > them;

  insert into games.pk_duels (king_id, token_hash, ip_hash, nick, moves, king_order, won)
  values (k.id, th, ip, v_nick, v_moves, ord, won);

  if won then
    update games.pk_kings set ended_at = now(), ended_by = v_nick where id = k.id;
    insert into games.pk_kings (token_hash, ip_hash, nick, moves) values (th, ip, v_nick, v_moves) returning id into new_id;
  else
    update games.pk_kings set defenses = defenses + 1 where id = k.id;
  end if;

  -- tidy up at most once an hour: duels older than 60 days, and old reigns outside the all-time top 50
  update games.pk_meta set cleanup_at = now() where id = 1 and (cleanup_at is null or cleanup_at < now() - interval '1 hour');
  if found then
    delete from games.pk_duels where created_at < now() - interval '60 days';
    delete from games.pk_kings x where x.ended_at < now() - interval '60 days'
      and x.id not in (select id from games.pk_kings order by defenses desc, crowned_at limit 50);
  end if;

  return jsonb_build_object('ok', true, 'won', won, 'score', jsonb_build_array(me, them), 'rounds', rounds,
                            'king', jsonb_build_object('nick', k.nick, 'defenses', k.defenses + case when won then 0 else 1 end),
                            'new_king_id', new_id);
end $$;

-- The reigning king changes their three moves (only with the token that won the throne).
create or replace function public.gry_pk_set_moves(p_token text, p_moves text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare th text := games.pk_token_hash(p_token); v_moves text := lower(coalesce(p_moves, '')); k games.pk_kings;
begin
  if th is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if v_moves !~ '^[rps]{3}$' then return jsonb_build_object('ok', false, 'error', 'moves'); end if;
  select * into k from games.pk_kings where ended_at is null for update;
  if k.id is null or k.token_hash is distinct from th then return jsonb_build_object('ok', false, 'error', 'not_king'); end if;
  update games.pk_kings set moves = v_moves where id = k.id;
  return jsonb_build_object('ok', true, 'moves', v_moves);
end $$;

revoke all on function games.pk_token_hash(text), games.pk_beats(text, text) from public, anon, authenticated;
revoke all on function public.gry_pk_state(text), public.gry_pk_challenge(text, bigint, text, text), public.gry_pk_set_moves(text, text) from public;
grant execute on function public.gry_pk_state(text), public.gry_pk_challenge(text, bigint, text, text), public.gry_pk_set_moves(text, text) to anon, authenticated;

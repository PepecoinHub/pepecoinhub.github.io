-- POND BULLETIN: the notice board of PondOS 98 (the meme edition at /meme/). Run once in the Supabase SQL
-- editor after schema.sql and BEFORE update_pond_king.sql and update_lilies.sql. Safe to run again.
--
-- What it shows (public metadata only, never a hidden move):
--   * open challenges of BATTLE OF THREE LILIES (read live from games.lily_challenges, so an accepted,
--     cancelled or expired challenge disappears by itself);
--   * the latest events: finished duels, new Pond Kings, long reigns.
-- Events are written ONLY by other server functions (games.bulletin_post is not callable from the browser),
-- inside the same transaction as the game result, and each one carries a unique event_key, so a result
-- can never be posted twice. Built so YEET, Pepe Guesser and achievements can post later with a new kind.

create table if not exists games.bulletin_events (
  id          bigint generated always as identity primary key,
  event_key   text not null unique,                 -- e.g. 'lily:<challenge id>', 'pk:crown:<king id>'
  game        text not null check (game in ('lilies', 'pond_king')),
  kind        text not null check (kind in ('lily_win', 'lily_draw', 'king_crowned', 'king_defended')),
  actor_nick  text not null,                        -- the winner / the new king / the defending king
  actor_user  uuid,                                 -- only for Discord players: opens their Fren Passport
  other_nick  text,                                 -- the loser / the old king / the other side of a draw
  other_user  uuid,
  ref         text,                                 -- what "View" opens (a challenge id); never a move
  data        jsonb not null default '{}'::jsonb,   -- small public numbers (a score, a reign length)
  created_at  timestamptz not null default now()
);
create index if not exists bulletin_events_time on games.bulletin_events (created_at desc);
alter table games.bulletin_events enable row level security;
revoke all on games.bulletin_events from public, anon, authenticated;

-- only for Discord players: the id that opens a Fren Passport (guests have none)
create or replace function games.passport_id(u uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select case when u is not null and games.discord_identity(u) is not null then u end
$$;

-- the one way in: other server functions post here. A repeated event_key is ignored (returns false).
create or replace function games.bulletin_post(p_key text, p_game text, p_kind text, p_actor_nick text, p_actor_user uuid,
                                               p_other_nick text, p_other_user uuid, p_ref text, p_data jsonb)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into games.bulletin_events (event_key, game, kind, actor_nick, actor_user, other_nick, other_user, ref, data)
  values (p_key, p_game, p_kind, p_actor_nick, games.passport_id(p_actor_user), p_other_nick, games.passport_id(p_other_user),
          p_ref, coalesce(p_data, '{}'::jsonb))
  on conflict (event_key) do nothing;
  if not found then return false; end if;
  -- keep the board small: events older than 30 days go
  delete from games.bulletin_events where created_at < now() - interval '30 days';
  return true;
end $$;

-- The display name of a player in the pond games. Signed in (Discord or guest): games.valid_nick (Discord
-- name for Discord players, reserved names protected, profanity filter). Not signed in (POND KING without an
-- account): the same rules, and a name a Discord player has reserved is refused. Returns {nick, verified} or {error}.
create or replace function games.pond_name(u uuid, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v jsonb; v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
begin
  if u is not null then
    begin v := games.valid_nick(u, v_nick);
    exception when others then return jsonb_build_object('error', 'nick', 'message', sqlerrm); end;
    return v;
  end if;
  if v_nick !~ '^[A-Za-z0-9 _.\-]{2,20}$' then return jsonb_build_object('error', 'nick', 'message', 'Name: 2 to 20 letters, digits, spaces, _ . -'); end if;
  if games.is_profane(v_nick) then return jsonb_build_object('error', 'nick', 'message', 'Pick a different name'); end if;
  if exists (select 1 from games.profiles where nick_key = games.nick_key(v_nick)) then
    return jsonb_build_object('error', 'nick', 'message', 'That name belongs to a verified player. Log on, or pick another'); end if;
  return jsonb_build_object('nick', v_nick, 'verified', false);
end $$;

revoke all on function games.passport_id(uuid) from public, anon, authenticated;
revoke all on function games.pond_name(uuid, text) from public, anon, authenticated;
revoke all on function games.bulletin_post(text, text, text, text, uuid, text, uuid, text, jsonb) from public, anon, authenticated;

-- What the board shows. Anyone may read it (guests too). The parts of games that are not installed yet
-- (update_lilies.sql, update_pond_king.sql) are simply left out.
create or replace function public.gry_bulletin(p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); n int := least(greatest(coalesce(p_limit, 20), 1), 50); opn jsonb := '[]'::jsonb; king jsonb;
begin
  if to_regclass('games.lily_challenges') is not null then
    execute $q$
      select coalesce(jsonb_agg(games.lily_public(ch, $1) order by ch.created_at desc), '[]'::jsonb)
        from (select * from games.lily_challenges where status = 'open' and expires_at > now()
               order by created_at desc limit $2) ch $q$ into opn using u, n;
  end if;
  if to_regclass('games.pk_kings') is not null then
    execute $q$ select jsonb_build_object('nick', nick, 'defenses', defenses, 'since', crowned_at, 'house', token_hash is null)
                  from games.pk_kings where ended_at is null $q$ into king;
  end if;
  return jsonb_build_object(
    'open', opn,
    'king', king,
    'events', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'game', e.game, 'kind', e.kind, 'actor', e.actor_nick,
                                                            'actor_passport', e.actor_user, 'other', e.other_nick, 'other_passport', e.other_user,
                                                            'ref', e.ref, 'data', e.data, 'at', e.created_at) order by e.created_at desc)
                          from (select * from games.bulletin_events order by created_at desc limit n) e), '[]'::jsonb));
end $$;

revoke all on function public.gry_bulletin(int) from public;
grant execute on function public.gry_bulletin(int) to anon, authenticated;

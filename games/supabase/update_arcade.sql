-- PondOS arcade high scores (FUD Invaders, PEP Snake) for the meme edition.
-- Run once in the Supabase SQL editor after schema.sql. Safe to run again.
--
-- Anyone may submit; a player signed in with Discord on PEP Games is stored as verified.
-- The table is reachable only through the two functions below (no direct table access).
-- Protection, because the games run in the browser and a score can be faked:
--   * plausibility: a score must fit the length of the game (and hard caps per game);
--   * rate limits: 6 submissions / 10 min per network (hashed IP) and per account,
--     40 / 10 min from clients without an IP header, 300 / hour overall;
--   * nicknames: 2-20 letters, digits, space, _ . - ; profanity filter; a guest nick
--     that equals a verified player's Discord name is rejected;
--   * only the 300 best rows per game are kept.

create table if not exists games.arcade_scores (
  id           bigint generated always as identity primary key,
  game         text not null check (game in ('fud', 'snake')),
  nick         text not null,
  score        int  not null check (score > 0),
  verified     boolean not null default false,
  user_id      uuid,
  duration_ms  int not null,
  ip_hash      text,
  created_at   timestamptz not null default now()
);
create index if not exists arcade_scores_top on games.arcade_scores (game, score desc, created_at);
create index if not exists arcade_scores_ip  on games.arcade_scores (ip_hash, created_at);
create index if not exists arcade_scores_uid on games.arcade_scores (user_id, created_at);
alter table games.arcade_scores enable row level security;
revoke all on games.arcade_scores from public, anon, authenticated;

create or replace function public.gry_arcade_submit(p_game text, p_nick text, p_score int, p_ms int)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb := case when u is null then null else games.discord_identity(u) end;
  ip text := games.client_ip_hash();
  v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
  cap int; n int; place int;
begin
  if p_game not in ('fud', 'snake') then raise exception 'Unknown game'; end if;
  if p_score is null or p_score < 1 then raise exception 'Nothing to submit'; end if;
  if p_ms is null or p_ms < 5000 or p_ms > 6 * 3600 * 1000 then raise exception 'That game was too short or too long'; end if;

  -- plausibility: snake eats at most one block per ~0.3 s (the board holds 297); FUD scores 10 per word,
  -- 240 per wave, and a wave takes at least a few seconds
  if p_game = 'snake' then cap := least(297, 3 + p_ms / 300);
  else cap := least(200000, (p_ms / 3000 + 1) * 240);
       if p_score % 10 <> 0 then raise exception 'That score does not add up'; end if;
  end if;
  if p_score > cap then raise exception 'That score does not add up'; end if;

  -- rate limits (row lock on config serialises concurrent submissions)
  perform 1 from games.config where id = 1 for update;
  if (select count(*) from games.arcade_scores where created_at > now() - interval '1 hour') >= 300 then
    raise exception 'The high score table is busy. Try again later'; end if;
  if ip is not null then
    select count(*) into n from games.arcade_scores where ip_hash = ip and created_at > now() - interval '10 minutes';
    if n >= 6 then raise exception 'Slow down a little, fren'; end if;
  else
    select count(*) into n from games.arcade_scores where ip_hash is null and created_at > now() - interval '10 minutes';
    if n >= 40 then raise exception 'Slow down a little, fren'; end if;
  end if;
  if u is not null then
    select count(*) into n from games.arcade_scores where user_id = u and created_at > now() - interval '10 minutes';
    if n >= 6 then raise exception 'Slow down a little, fren'; end if;
  end if;

  if d is not null then
    v_nick := left(d->>'name', 32);
  else
    if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick !~ '^[A-Za-z0-9 _.\-]+$' then
      raise exception 'Nickname: 2 to 20 letters, digits, spaces, _ . -'; end if;
    if games.is_profane(v_nick) then raise exception 'Pick a different nickname'; end if;
    if exists (select 1 from games.arcade_scores s where s.verified and lower(s.nick) = lower(v_nick)) then
      raise exception 'That name belongs to a verified player. Sign in with Discord on PEP Games, or pick another'; end if;
  end if;

  insert into games.arcade_scores (game, nick, score, verified, user_id, duration_ms, ip_hash)
  values (p_game, v_nick, p_score, d is not null, case when d is not null then u end, p_ms, ip);

  -- keep only the best 300 per game
  delete from games.arcade_scores a where a.game = p_game and a.id not in (
    select id from games.arcade_scores where game = p_game order by score desc, created_at limit 300);

  select 1 + count(*) into place from (
    select max(a.score) s from games.arcade_scores a where a.game = p_game
     group by case when a.verified then a.user_id::text else 'n:' || lower(a.nick) end) t where t.s > p_score;
  return jsonb_build_object('nick', v_nick, 'verified', d is not null, 'place', place);
end $$;

create or replace function public.gry_arcade_top(p_game text)
returns jsonb language sql stable security definer set search_path = '' as $$
  with best as (
    select distinct on (case when verified then user_id::text else 'n:' || lower(nick) end)
           nick, score, verified, created_at
      from games.arcade_scores
     where game = p_game
     order by case when verified then user_id::text else 'n:' || lower(nick) end, score desc, created_at
  ), top as (
    select * from best order by score desc, created_at limit 10
  )
  select coalesce(jsonb_agg(jsonb_build_object('nick', nick, 'score', score, 'verified', verified, 'at', created_at)
                            order by score desc, created_at), '[]'::jsonb) from top
$$;

revoke all on function public.gry_arcade_submit(text, text, int, int) from public;
revoke all on function public.gry_arcade_top(text) from public;
grant execute on function public.gry_arcade_submit(text, text, int, int) to anon, authenticated;
grant execute on function public.gry_arcade_top(text) to anon, authenticated;

-- PondOS: "Letters to the Editor" (zgoda na druk) + liczby powrotów dla właściciela.
-- Uruchom PO update_frog_letters.sql. Bezpieczne do powtórzenia.
-- Dwie części: każdą możesz wkleić i uruchomić osobno (CZĘŚĆ 1, potem CZĘŚĆ 2).

-- ===== CZĘŚĆ 1: listy z ptaszkiem "OK to print" =====

alter table games.letters
  add column if not exists print_ok boolean not null default false;

drop function if exists public.gry_letter_send(text, text, text);

create or replace function public.gry_letter_send(
  p_body text, p_name text default '', p_page text default '',
  p_print boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  u uuid := auth.uid();
  b text := trim(coalesce(p_body, ''));
  idd jsonb;
  nm text;
  is_d boolean := false;
begin
  if u is null then
    raise exception 'Log on first (as a guest or with Discord) to send a letter';
  end if;
  if char_length(b) < 2 then
    raise exception 'The letter is empty. Write at least a few words.';
  end if;
  if char_length(b) > 1500 then
    raise exception 'Too long: keep it under 1500 characters.';
  end if;
  if (select count(*) from games.letters
      where user_id = u and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'That''s 3 letters today. The editor needs time to read them. Try again tomorrow.';
  end if;
  if (select count(*) from games.letters
      where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'The mailbox is full for this hour. Try again a bit later.';
  end if;
  select i.identity_data into idd from auth.identities i
   where i.user_id = u and i.provider = 'discord' limit 1;
  if found then
    is_d := true;
    nm := coalesce(idd #>> '{custom_claims,global_name}',
                   idd ->> 'full_name', idd ->> 'name');
  end if;
  nm := coalesce(nullif(nm, ''), nullif(trim(coalesce(p_name, '')), ''), 'guest');
  nm := left(trim(regexp_replace(nm, '[\r\n\t]+', ' ', 'g')), 40);
  insert into games.letters(user_id, name, discord, body, page, print_ok)
  values (u, nm, is_d, b, left(coalesce(p_page, ''), 100), coalesce(p_print, false));
  delete from games.letters where id in (
    select id from games.letters where read_at is not null
    order by created_at desc offset 2000);
  return jsonb_build_object('ok', true);
end
$fn$;

create or replace function public.gry_letters(p_limit int default 100)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  lim int := least(greatest(coalesce(p_limit, 100), 1), 500);
begin
  if not games.is_owner(auth.uid()) then
    return null;
  end if;
  return jsonb_build_object(
    'unread', (select count(*) from games.letters where read_at is null),
    'letters', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'at', q.created_at, 'name', q.name,
               'discord', q.discord, 'print', q.print_ok, 'body', q.body,
               'page', q.page, 'read', q.read_at is not null)
             order by q.created_at desc)
      from (select * from games.letters
            order by created_at desc limit lim) q), '[]'::jsonb));
end
$fn$;

revoke all on function public.gry_letter_send(text, text, text, boolean) from public, anon;
revoke all on function public.gry_letters(int) from public, anon;
grant execute on function public.gry_letter_send(text, text, text, boolean) to authenticated;
grant execute on function public.gry_letters(int) to authenticated;

-- ===== CZĘŚĆ 2: liczby powrotów (strona statystyk) =====

create or replace function public.gry_community(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = ''
as $fn$
declare
  t date := (now() at time zone 'utc')::date;
  n int := least(greatest(coalesce(p_days, 30), 1), 400);
  res jsonb;
begin
  if not games.is_owner(auth.uid()) then
    raise exception 'Only the site owner can see the statistics';
  end if;

  create temp table if not exists pond_plays (user_id uuid, day date, verified boolean) on commit drop;
  truncate pond_plays;
  insert into pond_plays
  select distinct pl.user_id, z.day, pl.verified
    from games.wp_plays pl
    join games.wp_puzzles z on z.id = pl.puzzle_id
   where z.day is not null and z.day <= t;

  create temp table if not exists pond_first (user_id uuid, d0 date) on commit drop;
  truncate pond_first;
  insert into pond_first
  select user_id, min(day) from pond_plays group by user_id;

  select jsonb_build_object(
    'today', t,
    'days', coalesce((
      select jsonb_agg(jsonb_build_object(
               'day', x.day, 'players', x.players, 'discord', x.discord,
               'new', x.new_players, 'back_next_day', x.back_next_day)
             order by x.day)
      from (
        select p.day,
               count(*) as players,
               count(*) filter (where p.verified) as discord,
               count(*) filter (where f.d0 = p.day) as new_players,
               case when p.day < t then
                 count(*) filter (where exists (
                   select 1 from pond_plays y
                    where y.user_id = p.user_id and y.day = p.day + 1))
               end as back_next_day
          from pond_plays p
          join pond_first f on f.user_id = p.user_id
         where p.day > t - n
         group by p.day) x), '[]'::jsonb),
    'players_total', (select count(*) from pond_first),
    'd1_base', (select count(*) from pond_first where d0 < t),
    'd1_back', (select count(*) from pond_first f where f.d0 < t
                and exists (select 1 from pond_plays y
                             where y.user_id = f.user_id and y.day = f.d0 + 1)),
    'd7_base', (select count(*) from pond_first where d0 <= t - 7),
    'd7_back', (select count(*) from pond_first f where f.d0 <= t - 7
                and exists (select 1 from pond_plays y
                             where y.user_id = f.user_id
                               and y.day between f.d0 + 1 and f.d0 + 7)),
    'letters_7d', (select count(*) from games.letters
                    where created_at > now() - interval '7 days'),
    'letters_total', (select count(*) from games.letters),
    'chat_24h', (select count(*) from games.lobby_chat
                  where created_at > now() - interval '24 hours'
                    and hidden_at is null),
    'chatters_24h', (select count(distinct user_id) from games.lobby_chat
                      where created_at > now() - interval '24 hours'
                        and hidden_at is null))
  into res;
  return res;
end
$fn$;

revoke all on function public.gry_community(int) from public, anon;
grant execute on function public.gry_community(int) to authenticated;

-- PondOS: "Letters to the Editor" (zgoda na druk w gazecie) + liczby powrotów dla właściciela.
-- Uruchom w Supabase → SQL Editor PO update_frog_letters.sql (New query → wklej całość → Run). Bezpieczne do powtórzenia.
--
--  • list ma ptaszek „można wydrukować w gazecie” (print_ok); bez ptaszka list zostaje tylko do Twojej wiadomości
--  • gry_community: tylko właściciel. Gracze Where's Pepe dzień po dniu, nowi vs wracający, ile osób wraca
--    następnego dnia i w ciągu 7 dni, listy i czat z ostatnich 24 h. Do strony statystyk (games/stats.html).

alter table games.letters add column if not exists print_ok boolean not null default false;

drop function if exists public.gry_letter_send(text, text, text);
create or replace function public.gry_letter_send(p_body text, p_name text default '', p_page text default '', p_print boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); b text := trim(coalesce(p_body, '')); d record; nm text; is_d boolean := false;
begin
  if u is null then raise exception 'Log on first (as a guest or with Discord) to send a letter'; end if;
  if char_length(b) < 2 then raise exception 'The letter is empty. Write at least a few words.'; end if;
  if char_length(b) > 1500 then raise exception 'Too long: keep it under 1500 characters.'; end if;
  if (select count(*) from games.letters where user_id = u and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'That''s 3 letters today. The editor needs time to read them. Try again tomorrow.';
  end if;
  if (select count(*) from games.letters where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'The mailbox is full for this hour. Try again a bit later.';
  end if;
  select i.identity_data into d from auth.identities i where i.user_id = u and i.provider = 'discord' limit 1;
  if found then
    is_d := true;
    nm := coalesce(d.identity_data #>> '{custom_claims,global_name}', d.identity_data ->> 'full_name', d.identity_data ->> 'name');
  end if;
  nm := left(trim(regexp_replace(coalesce(nullif(nm, ''), nullif(trim(coalesce(p_name, '')), ''), 'guest'), '[\r\n\t]+', ' ', 'g')), 40);
  insert into games.letters(user_id, name, discord, body, page, print_ok) values (u, nm, is_d, b, left(coalesce(p_page, ''), 100), coalesce(p_print, false));
  delete from games.letters where id in (select id from games.letters where read_at is not null order by created_at desc offset 2000);
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gry_letters(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then return null; end if;
  return jsonb_build_object(
    'unread', (select count(*) from games.letters where read_at is null),
    'letters', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'name', name, 'discord', discord, 'print', print_ok,
                                                          'body', body, 'page', page, 'read', read_at is not null) order by created_at desc)
                         from (select * from games.letters order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) q), '[]'::jsonb));
end $$;

-- Liczby powrotów (tylko właściciel). Dzień = dzień zagadki Where's Pepe (UTC).
create or replace function public.gry_community(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t date := (now() at time zone 'utc')::date; n int := least(greatest(coalesce(p_days, 30), 1), 400);
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can see the statistics'; end if;
  return (
    with plays as (select distinct pl.user_id, z.day, pl.verified from games.wp_plays pl join games.wp_puzzles z on z.id = pl.puzzle_id where z.day is not null and z.day <= t),
    first as (select user_id, min(day) d0 from plays group by user_id),
    per_day as (
      select p.day, count(*) players, count(*) filter (where p.verified) discord,
             count(*) filter (where f.d0 = p.day) new_players,
             case when p.day < t then count(*) filter (where exists (select 1 from plays x where x.user_id = p.user_id and x.day = p.day + 1)) end back_next_day
      from plays p join first f using (user_id) where p.day > t - n group by p.day)
    select jsonb_build_object(
      'today', t,
      'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'players', players, 'discord', discord, 'new', new_players, 'back_next_day', back_next_day) order by day) from per_day), '[]'::jsonb),
      'players_total', (select count(*) from first),
      'd1_base', (select count(*) from first where d0 < t),
      'd1_back', (select count(*) from first f where d0 < t and exists (select 1 from plays x where x.user_id = f.user_id and x.day = f.d0 + 1)),
      'd7_base', (select count(*) from first where d0 <= t - 7),
      'd7_back', (select count(*) from first f where d0 <= t - 7 and exists (select 1 from plays x where x.user_id = f.user_id and x.day between f.d0 + 1 and f.d0 + 7)),
      'letters_7d', (select count(*) from games.letters where created_at > now() - interval '7 days'),
      'letters_total', (select count(*) from games.letters),
      'chat_24h', (select count(*) from games.lobby_chat where created_at > now() - interval '24 hours' and hidden_at is null),
      'chatters_24h', (select count(distinct user_id) from games.lobby_chat where created_at > now() - interval '24 hours' and hidden_at is null)
    ));
end $$;

revoke all on function public.gry_letter_send(text, text, text, boolean), public.gry_letters(int), public.gry_community(int) from public, anon;
grant execute on function public.gry_letter_send(text, text, text, boolean), public.gry_letters(int), public.gry_community(int) to authenticated;

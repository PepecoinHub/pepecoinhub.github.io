-- PondOS: listy do autora (Frog Mail → "Write a letter") + publiczny licznik odwiedzin.
-- Uruchom RAZ w Supabase → SQL Editor (New query → wklej całość → Run). Bezpieczne do powtórzenia.
-- Wymaga wcześniej update_page_stats.sql (tabele games.owners i games.page_daily, funkcja games.is_owner).
-- Jeśli Supabase pokaże „Potential issues detected”, wybierz „Run and enable RLS”.
--
--  • list może wysłać każdy zalogowany: przez Discorda albo jako gość (jedno kliknięcie + test „nie jestem botem”)
--  • limity: max 3 listy dziennie na osobę, max 40 listów na godzinę na całą stronę, długość 2–1500 znaków
--  • listy czyta WYŁĄCZNIE właściciel (games.owners); nikt inny nie ma do nich dostępu, nawet hosty
--  • licznik: suma osób z wszystkich dni (te same dane co statystyki, bez IP i bez ciasteczek)

create table if not exists games.letters (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,
  name text not null,
  discord boolean not null default false,
  body text not null,
  page text,
  read_at timestamptz
);
alter table games.letters enable row level security;   -- bez żadnych polityk: tabela dostępna tylko przez funkcje niżej
create index if not exists letters_user_day on games.letters (user_id, created_at);

-- Wyślij list. Discord: imię z Discorda. Gość: nick podany w okienku (albo "guest").
create or replace function public.gry_letter_send(p_body text, p_name text default '', p_page text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); b text := trim(coalesce(p_body, '')); d record; nm text; is_d boolean := false;
begin
  if u is null then raise exception 'Log on first (as a guest or with Discord) to send a letter'; end if;
  if char_length(b) < 2 then raise exception 'The letter is empty. Write at least a few words.'; end if;
  if char_length(b) > 1500 then raise exception 'Too long: keep it under 1500 characters.'; end if;
  if (select count(*) from games.letters where user_id = u and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'That''s 3 letters today. The frog needs time to read them. Try again tomorrow.';
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
  insert into games.letters(user_id, name, discord, body, page) values (u, nm, is_d, b, left(coalesce(p_page, ''), 100));
  delete from games.letters where id in (select id from games.letters where read_at is not null order by created_at desc offset 2000);
  return jsonb_build_object('ok', true);
end $$;

-- Skrzynka właściciela: null dla wszystkich innych (strona po prostu nie pokazuje skrzynki).
create or replace function public.gry_letters(p_limit int default 100) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then return null; end if;
  return jsonb_build_object(
    'unread', (select count(*) from games.letters where read_at is null),
    'letters', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'at', created_at, 'name', name, 'discord', discord,
                                                          'body', body, 'page', page, 'read', read_at is not null) order by created_at desc)
                         from (select * from games.letters order by created_at desc limit least(greatest(coalesce(p_limit, 100), 1), 500)) q), '[]'::jsonb));
end $$;

-- Właściciel: oznacz jako przeczytany albo usuń.
create or replace function public.gry_letter_mark(p_id bigint, p_delete boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  if p_delete then delete from games.letters where id = p_id;
  else update games.letters set read_at = coalesce(read_at, now()) where id = p_id; end if;
end $$;

-- Licznik odwiedzin dla wszystkich: tylko jedna liczba, żadnych szczegółów.
create or replace function public.gry_counter() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('frogs', coalesce(sum(people), 0), 'since', min(day))
  from games.page_daily where path = '*'
$$;

revoke all on function public.gry_letter_send(text, text, text), public.gry_letters(int), public.gry_letter_mark(bigint, boolean), public.gry_counter() from public, anon;
grant execute on function public.gry_letter_send(text, text, text) to authenticated;
grant execute on function public.gry_letters(int), public.gry_letter_mark(bigint, boolean) to authenticated;
grant execute on function public.gry_counter() to anon, authenticated;

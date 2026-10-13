-- Pepecoin Hub: własny licznik odsłon (bez IP, bez ciasteczek). Uruchom RAZ w Supabase → SQL Editor
-- (New query → wklej całość → Run). Bezpieczne do powtórzenia. Jeśli Supabase pokaże „Potential issues detected”,
-- wybierz „Run and enable RLS”.
--  • każda strona wysyła „ktoś otworzył /ścieżka” + losowy numer przeglądarki, który zmienia się co dzień
--  • zapisujemy tylko liczby na dzień i stronę: odsłony i osoby (różne numery danego dnia); numery kasujemy po 2 dniach
--  • statystyki widzi WYŁĄCZNIE właściciel (games.owners), nie hosty

create table if not exists games.owners (discord_id text primary key, note text);
alter table games.owners enable row level security;
-- Na start właścicielem zostaje każdy, kto jest dziś wpisany jako host z Discorda (czyli Ty).
-- Hosta dodanego później NIE dopisujemy tu automatycznie.
insert into games.owners(discord_id, note) select discord_id, 'owner (copied from host_discord)' from games.host_discord
on conflict (discord_id) do nothing;

create table if not exists games.page_daily (           -- liczby na dzień (czas polski) i ścieżkę; '*' = cała strona
  day date not null,
  path text not null,
  views int not null default 0,
  people int not null default 0,
  primary key (day, path)
);
alter table games.page_daily enable row level security;

create table if not exists games.page_seen (            -- kto był już liczony danego dnia (losowy numer dnia), kasowane po 2 dniach
  day date not null,
  visitor text not null,
  path text not null,
  primary key (day, visitor, path)
);
alter table games.page_seen enable row level security;
alter table games.config add column if not exists pv_cleanup_at timestamptz;

create or replace function games.is_owner(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and exists (select 1 from auth.identities i join games.owners o on o.discord_id = i.provider_id
                                   where i.user_id = u and i.provider = 'discord')
$$;

-- Jedna odsłona. Woła ją każda strona (także bez logowania).
create or replace function public.gry_pv(p_path text, p_visitor text) returns void
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; p text := lower(left(trim(coalesce(p_path, '')), 100));
        v text := left(trim(coalesce(p_visitor, '')), 40);
begin
  p := regexp_replace(p, '(index\.html)?$', '');
  if p !~ '^/[a-z0-9/._-]*$' or v !~ '^[A-Za-z0-9-]{8,40}$' then return; end if;
  insert into games.page_daily(day, path, views) values (d, p, 1), (d, '*', 1)
  on conflict (day, path) do update set views = games.page_daily.views + 1;
  insert into games.page_seen(day, visitor, path) values (d, v, p) on conflict do nothing;
  if found then update games.page_daily set people = people + 1 where day = d and path = p; end if;
  insert into games.page_seen(day, visitor, path) values (d, v, '*') on conflict do nothing;
  if found then update games.page_daily set people = people + 1 where day = d and path = '*'; end if;
  update games.config set pv_cleanup_at = now() where id = 1 and (pv_cleanup_at is null or pv_cleanup_at < now() - interval '1 hour');
  if found then delete from games.page_seen where day < d - 1; end if;
end $$;

-- Statystyki: tylko właściciel. Dni (odsłony, osoby) + strony z ostatnich p_days dni.
create or replace function public.gry_stats(p_days int default 30) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d date := (now() at time zone 'Europe/Warsaw')::date; n int := least(greatest(coalesce(p_days, 30), 1), 400);
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can see the statistics'; end if;
  return jsonb_build_object(
    'today', d,
    'days', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'views', views, 'people', people) order by day)
                      from games.page_daily where path = '*' and day > d - n), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(jsonb_build_object('path', path, 'views', v, 'people', pp) order by v desc)
                       from (select path, sum(views) v, sum(people) pp from games.page_daily
                              where path <> '*' and day > d - n group by path) q), '[]'::jsonb));
end $$;

revoke all on function games.is_owner(uuid) from public;
revoke all on function public.gry_pv(text, text), public.gry_stats(int) from public, anon;
grant execute on function public.gry_pv(text, text) to anon, authenticated;
grant execute on function public.gry_stats(int) to authenticated;

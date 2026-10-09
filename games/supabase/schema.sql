-- =====================================================================
--  PEP Games (pepecoinhub.com/games) — schemat bazy dla Supabase (Postgres 15+)
--  Interfejs gier i wszystkie komunikaty dla graczy są po angielsku.
--  Cała logika gry jest tutaj: punkty, kolejka rysujących, sekretne hasła,
--  limity czatu i filtr wulgaryzmów liczą się PO STRONIE SERWERA.
--  Klient (przeglądarka) nie ma prawa zapisu do żadnej tabeli — tylko
--  wywołuje funkcje public.gry_* (RPC), które same sprawdzają uprawnienia.
--  Tabele leżą w schemacie "games", którego Supabase nie wystawia w API.
--  Plik można uruchamiać wielokrotnie (idempotentny dla funkcji).
-- =====================================================================

create schema if not exists games;
revoke all on schema games from public;

-- ---------- konfiguracja i hosty ----------
create table if not exists games.config (
  id int primary key default 1 check (id = 1),
  host_code_hash text,
  host_code_salt text not null default md5(random()::text || clock_timestamp()::text),
  max_players int not null default 24
);
insert into games.config (id) values (1) on conflict do nothing;
-- limity pokoi „casual” (Draw & Guess zakłada każdy; Guess the Picture tylko host z kodem)
alter table games.config add column if not exists casual_max_players int not null default 12;
alter table games.config add column if not exists casual_rooms_per_user int not null default 1;
alter table games.config add column if not exists casual_rooms_per_ip int not null default 3;
alter table games.config add column if not exists casual_rooms_total int not null default 40;
alter table games.config add column if not exists casual_creates_per_hour int not null default 6;
alter table games.config add column if not exists empty_room_minutes int not null default 2;
-- Guess the Picture: limit czasu obrazka (s) i liczba punktujących (pierwsze N poprawnych odpowiedzi: 3 / 2 / 1 pkt)
alter table games.config add column if not exists picture_max_seconds int not null default 120;
alter table games.config add column if not exists picture_scorers int not null default 3;
-- Draw & Guess: anti-spam, min. odstęp (s) między kolejnymi wiadomościami/odpowiedziami jednego gracza (0 = wyłączone)
alter table games.config add column if not exists dg_message_cooldown_seconds int not null default 5;

-- ---------- sezony: N tygodni gry (domyślnie 10 piątkowych wieczorów Guess the Picture), potem przerwa ----------
-- Każdy wiersz = jeden sezon. Gdy po sezonie nie ma kolejnego wiersza, następny jest dopisywany „w locie”
-- (ten sam układ: weeks + break_weeks, nazwa „Season N”, nagrody puste). Nagrody: jsonb [{"place":"1st","prize":"…"}].
create table if not exists games.seasons (
  no int primary key check (no >= 1),
  name text not null,
  starts_at timestamptz not null unique,
  weeks int not null default 10 check (weeks between 1 and 52),
  break_weeks int not null default 4 check (break_weeks between 0 and 26),
  prizes jsonb not null default '[]'::jsonb,
  prize_note text,
  break_name text not null default 'Summer break'
);
alter table games.seasons add column if not exists break_name text not null default 'Summer break';
insert into games.seasons (no, name, starts_at)
select 1, 'Season 1', date_trunc('week', now() at time zone 'Europe/Warsaw') at time zone 'Europe/Warsaw'
where not exists (select 1 from games.seasons);

create table if not exists games.host_discord (       -- lista Discord ID, które są hostami
  discord_id text primary key,
  note text
);
create table if not exists games.host_sessions (      -- kto podał poprawny kod hosta (ważne 12 h)
  user_id uuid primary key,
  until timestamptz not null
);
create table if not exists games.host_attempts (
  id bigint generated always as identity primary key,
  user_id uuid, ok boolean, at timestamptz not null default now()
);

-- ---------- profile zweryfikowanych graczy (Discord) = zarezerwowane nicki ----------
create table if not exists games.profiles (
  user_id uuid primary key,
  nick text not null,
  nick_key text not null unique,
  discord_id text,
  discord_name text,
  created_at timestamptz not null default now()
);

-- ---------- słowa do kalamburów ----------
create table if not exists games.words (
  id int generated always as identity primary key,
  word text not null unique,
  category text not null default 'general'
);

-- ---------- filtr wulgaryzmów (rdzenie, po normalizacji) ----------
create table if not exists games.badwords (root text primary key);

-- ---------- pokoje, gracze, czat ----------
create table if not exists games.rooms (
  code text primary key,
  mode text not null check (mode in ('kalambury','obrazek')),
  title text not null,
  host_id uuid not null,
  status text not null default 'open' check (status in ('open','closed')),
  phase text not null default 'lobby' check (phase in ('lobby','turn','reveal','waiting','finished')),
  rounds int not null default 3 check (rounds between 1 and 10),
  turn_seconds int not null default 80 check (turn_seconds between 15 and 180),
  round_no int not null default 0,
  turn_no int not null default 0,
  turn_id uuid,
  drawer_id uuid,
  turn_started_at timestamptz,
  turn_ends_at timestamptz,
  next_at timestamptz,
  hint_seed int,
  last_answer text,
  match_id uuid,
  creator_id uuid,
  creator_ip text,                                     -- skrót (sha256 z solą) adresu IP, tylko do limitów
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists games.secrets (             -- hasło bieżącej tury: NIGDY nie trafia do zgadujących
  room_code text primary key references games.rooms(code) on delete cascade,
  answer text not null,
  keys text[] not null
);

create table if not exists games.players (
  room_code text not null references games.rooms(code) on delete cascade,
  user_id uuid not null,
  nick text not null,
  nick_key text not null,
  verified boolean not null default false,
  is_host boolean not null default false,
  seq bigint generated always as identity,
  score int not null default 0,
  guessed_turn uuid,
  kicked boolean not null default false,
  left_at timestamptz,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  last_msg_at timestamptz,
  msg_window_start timestamptz,
  msg_window_count int not null default 0,
  primary key (room_code, user_id)
);

create table if not exists games.messages (
  id bigint generated always as identity primary key,
  room_code text not null references games.rooms(code) on delete cascade,
  turn_id uuid,
  user_id uuid,
  nick text,
  kind text not null default 'chat' check (kind in ('chat','system','correct')),
  scope text not null default 'all' check (scope in ('all','guessed')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_room_idx on games.messages(room_code, id desc);

-- ---------- rozgrywki i wyniki (ranking) ----------
create table if not exists games.matches (
  id uuid primary key default gen_random_uuid(),
  room_code text not null,
  mode text not null,
  title text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table games.rooms add column if not exists creator_id uuid;
alter table games.rooms add column if not exists creator_ip text;
alter table games.matches add column if not exists ranked boolean not null default false;
alter table games.matches add column if not exists season_no int;
alter table games.matches add column if not exists season_name text;
create index if not exists matches_season_idx on games.matches(season_no) where ranked;
create table if not exists games.used_words (match_id uuid, word_id int, primary key (match_id, word_id));
create table if not exists games.results (
  match_id uuid not null references games.matches(id) on delete cascade,
  user_id uuid not null,
  nick text not null,
  nick_key text not null,
  verified boolean not null,
  points int not null,
  place int not null,
  finished_at timestamptz not null,
  primary key (match_id, user_id)
);
-- Guess the Picture: kto i jako który (1–3) zgadł obrazek; podstawa rankingu sezonu i tie-breaków.
-- unique(turn_id, place) + check: nawet przy wyścigu baza nie przyzna więcej niż 3 miejsc na obrazek.
create table if not exists games.guesses (
  match_id uuid not null references games.matches(id) on delete cascade,
  turn_id uuid not null,
  user_id uuid not null,
  nick text not null,
  nick_key text not null,
  verified boolean not null,
  place smallint not null check (place between 1 and 3),
  at timestamptz not null default clock_timestamp(),
  primary key (turn_id, user_id),
  unique (turn_id, place)
);
create index if not exists guesses_match_idx on games.guesses(match_id);
alter table games.guesses enable row level security;
create index if not exists results_time_idx on games.results(finished_at);

create table if not exists games.events (               -- harmonogram ("Piątek 20:00 — Kalambury PEP")
  id int generated always as identity primary key,
  title text not null,
  mode text not null default 'obrazek',
  starts_at timestamptz not null,
  room_code text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table games.events alter column mode set default 'obrazek';

-- RLS włączone wszędzie, brak polityk = brak bezpośredniego dostępu z API.
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'games' loop
    execute format('alter table games.%I enable row level security', t);
  end loop;
end $$;

-- =====================================================================
--  Funkcje pomocnicze (schemat games — niedostępne z API)
-- =====================================================================
create or replace function games.norm(t text) returns text language sql immutable as $$
  select regexp_replace(
           translate(lower(coalesce(t, '')), 'ąćęłńóśźżäöüéèáàíìúù', 'acelnoszzaoueeaaiiuu'),
           '[^a-z0-9]', '', 'g')
$$;

-- klucz nicku: wyłapuje podszywanie się (Byl = byI = by1 = B.y.l)
create or replace function games.nick_key(t text) returns text language sql immutable as $$
  select translate(games.norm(t), '013457l', 'oieasti')
$$;

create or replace function games.profanity_key(t text) returns text language sql immutable as $$
  select regexp_replace(
           games.norm(translate(replace(lower(coalesce(t,'')), 'shitcoin', 'coin'), '013457@$!|', 'oieastasii')),
           '(.)\1+', '\1', 'g')
$$;

create or replace function games.is_profane(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from games.badwords b where position(games.profanity_key(b.root) in games.profanity_key(t)) > 0)
$$;

-- maskuje wulgarne słowa gwiazdkami
create or replace function games.clean_text(t text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare w text; out text := '';
begin
  foreach w in array regexp_split_to_array(t, '\s+') loop
    if games.is_profane(w) then w := repeat('*', greatest(3, char_length(w))); end if;
    out := out || case when out = '' then '' else ' ' end || w;
  end loop;
  return out;
end $$;

create or replace function games.lev(a text, b text) returns int language plpgsql immutable as $$
declare la int := char_length(a); lb int := char_length(b); prev int[]; cur int[]; i int; j int; cost int;
begin
  if la = 0 then return lb; end if;
  if lb = 0 then return la; end if;
  if la > 40 or lb > 40 then return 99; end if;
  prev := array(select generate_series(0, lb));
  for i in 1..la loop
    cur := array[i];
    for j in 1..lb loop
      cost := case when substr(a, i, 1) = substr(b, j, 1) then 0 else 1 end;
      cur := cur || least(cur[j] + 1, prev[j + 1] + 1, prev[j] + cost);
    end loop;
    prev := cur;
  end loop;
  return prev[lb + 1];
end $$;

create or replace function games.discord_identity(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', i.provider_id,
           'name', coalesce(i.identity_data->'custom_claims'->>'global_name', i.identity_data->>'full_name',
                            i.identity_data->>'name', i.identity_data->>'user_name', 'player'))
  from auth.identities i where i.user_id = u and i.provider = 'discord' limit 1
$$;

create or replace function games.is_host_user(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and (
    exists (select 1 from games.host_sessions s where s.user_id = u and s.until > now())
    or exists (select 1 from auth.identities i join games.host_discord h on h.discord_id = i.provider_id
               where i.user_id = u and i.provider = 'discord'))
$$;

create or replace function games.set_host_code(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if char_length(p_code) < 10 then raise exception 'Host code must be at least 10 characters'; end if;
  update games.config set host_code_salt = md5(random()::text || clock_timestamp()::text) where id = 1;
  update games.config set host_code_hash = encode(sha256(convert_to(host_code_salt || p_code, 'UTF8')), 'hex') where id = 1;
  delete from games.host_sessions;
end $$;

-- ---------- sezony ----------
drop function if exists games.season_label(timestamptz);
drop function if exists games.season_start(timestamptz);
-- Sezon w chwili ts. phase: 'pre' (przed 1. sezonem) | 'season' (tygodnie gry) | 'break' (przerwa, gry nierankingowe)
-- Daty liczone w czasie polskim (zmiana czasu nie przesuwa granic tygodni).
create or replace function games.season_at(ts timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s games.seasons; nx games.seasons; n int; nm text; st timestamptz; wk int; brk int; pr jsonb; pn text; bn text;
        e timestamptz; ns timestamptz; guard int := 0;
  -- dodanie tygodni w czasie lokalnym
begin
  select * into s from games.seasons where starts_at <= ts order by starts_at desc limit 1;
  if s.no is null then
    select * into nx from games.seasons order by starts_at limit 1;
    if nx.no is null then return null; end if;
    return jsonb_build_object('phase', 'pre', 'no', null, 'next_no', nx.no, 'next_name', nx.name, 'next_starts_at', nx.starts_at,
                              'prizes', '[]'::jsonb);
  end if;
  n := s.no; nm := s.name; st := s.starts_at; wk := s.weeks; brk := s.break_weeks; pr := s.prizes; pn := s.prize_note; bn := s.break_name;
  loop
    e := ((st at time zone 'Europe/Warsaw') + make_interval(weeks => wk)) at time zone 'Europe/Warsaw';
    select * into nx from games.seasons where no > n order by no limit 1;
    ns := coalesce(nx.starts_at, ((e at time zone 'Europe/Warsaw') + make_interval(weeks => brk)) at time zone 'Europe/Warsaw');
    exit when ts < ns or nx.no is not null or guard > 500;
    -- brak kolejnego wiersza: następny sezon w tym samym układzie
    n := n + 1; nm := 'Season ' || n; st := ns; pr := '[]'::jsonb; pn := null; guard := guard + 1;
  end loop;
  return jsonb_build_object(
    'phase', case when ts < e then 'season' else 'break' end,
    'no', n, 'name', nm, 'starts_at', st, 'ends_at', e, 'weeks', wk, 'break_weeks', brk,
    'week', least(wk, greatest(1, floor(extract(epoch from ts - st) / 604800)::int + 1)),
    'next_no', coalesce(nx.no, n + 1), 'next_name', coalesce(nx.name, 'Season ' || (n + 1)), 'next_starts_at', ns,
    'prizes', coalesce(pr, '[]'::jsonb), 'prize_note', pn, 'break_name', coalesce(bn, 'Summer break'));
end $$;

-- hash IP klienta (z nagłówków PostgREST/Cloudflare) — tylko do limitów zakładania pokoi, nigdy nie zapisujemy jawnego IP
create or replace function games.client_ip_hash() returns text
language plpgsql stable security definer set search_path = '' as $$
declare hd json; ip text;
begin
  begin hd := nullif(current_setting('request.headers', true), '')::json; exception when others then hd := null; end;
  if hd is null then return null; end if;
  ip := coalesce(nullif(hd->>'cf-connecting-ip', ''), nullif(hd->>'x-real-ip', ''), nullif(trim(split_part(hd->>'x-forwarded-for', ',', 1)), ''));
  if ip is null then return null; end if;
  return encode(sha256(convert_to((select host_code_salt from games.config where id = 1) || '|ip|' || ip, 'UTF8')), 'hex');
end $$;

-- powiadomienie klientów (Supabase Realtime: broadcast z bazy, kanał prywatny)
create or replace function games.notify(p_code text, p_event text, p_payload jsonb default '{}'::jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  update games.rooms set version = version + 1, updated_at = now() where code = p_code returning version into v;
  perform realtime.send(p_payload || jsonb_build_object('code', p_code, 'v', v), p_event, 'room:' || p_code, true);
end $$;

create or replace function games.sys(p_code text, p_body text, p_kind text default 'system') returns void
language plpgsql security definer set search_path = '' as $$
declare t uuid; m jsonb;
begin
  select turn_id into t from games.rooms where code = p_code;
  insert into games.messages(room_code, turn_id, kind, body) values (p_code, t, p_kind, p_body)
  returning jsonb_build_object('id', id, 'kind', kind, 'body', body, 'nick', null, 'at', created_at) into m;
  perform realtime.send(jsonb_build_object('code', p_code, 'msg', m), 'msg', 'room:' || p_code, true);
end $$;

-- aktywni gracze (widziani w ostatnich 45 s)
create or replace function games.active(p games.players) returns boolean language sql stable as $$
  select not p.kicked and p.left_at is null and p.last_seen > now() - interval '45 seconds'
$$;

-- maska hasła z podpowiedziami: litery odsłaniane z czasem (40% / 60% / 80% czasu)
create or replace function games.mask(p_code text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare r games.rooms; a text; f float; letters int; n int; out text := ''; i int; ch text; reveal int[];
begin
  select * into r from games.rooms where code = p_code;
  if r.phase <> 'turn' then return null; end if;
  select answer into a from games.secrets where room_code = p_code;
  if a is null then return null; end if;
  f := extract(epoch from now() - r.turn_started_at) / greatest(1, r.turn_seconds);
  letters := char_length(regexp_replace(a, '[^[:alpha:]0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]', '', 'g'));
  n := case when f < 0.4 then 0 when f < 0.6 then 1 when f < 0.8 then 2 else greatest(2, letters / 3) end;
  n := least(n, greatest(0, letters - 2));
  if letters <= 3 then n := least(n, 1); end if;
  select coalesce(array_agg(idx), '{}') into reveal from (
    select idx from generate_series(1, char_length(a)) idx
    where substr(a, idx, 1) ~ '[[:alpha:]0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]'
    order by md5(r.hint_seed::text || ':' || idx) limit n) s;
  for i in 1..char_length(a) loop
    ch := substr(a, i, 1);
    if ch ~ '[[:alpha:]0-9ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]' then
      out := out || case when i = any(reveal) then upper(ch) else '_' end;
    else
      out := out || ch;
    end if;
  end loop;
  return out;
end $$;

-- ---------- przebieg gry ----------
create or replace function games.finish(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms;
begin
  select * into r from games.rooms where code = p_code for update;
  delete from games.secrets where room_code = p_code;
  update games.rooms set phase = 'finished', drawer_id = null, turn_ends_at = null, next_at = null where code = p_code;
  if r.mode = 'kalambury' then
    -- Draw & Guess: bez rankingu; wynik żyje tylko w pokoju (games.players.score) do następnej gry
    delete from games.used_words where match_id = r.match_id;
  elsif r.match_id is not null then
    update games.matches set finished_at = now() where id = r.match_id;
    insert into games.results(match_id, user_id, nick, nick_key, verified, points, place, finished_at)
    select r.match_id, p.user_id, p.nick, p.nick_key, p.verified, p.score,
           rank() over (order by p.score desc, coalesce(gq.firsts, 0) desc, coalesce(gq.seconds, 0) desc, gq.last_at asc nulls last), now()
    from games.players p
    left join lateral (select count(*) filter (where g.place = 1) firsts, count(*) filter (where g.place = 2) seconds, max(g.at) last_at
                         from games.guesses g where g.match_id = r.match_id and g.user_id = p.user_id) gq on true
    where p.room_code = p_code and not p.kicked
      and not (r.mode = 'obrazek' and p.is_host)
      and (p.score > 0 or p.left_at is null)
    on conflict do nothing;
  end if;
  perform games.sys(p_code, case when r.mode = 'kalambury' then 'Game over! Final scores are on screen (this game only).'
                                 else 'Game over! Scores were added to the leaderboard.' end);
  perform games.notify(p_code, 'state');
end $$;

create or replace function games.start_turn(p_code text, p_drawer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; w record; dn text;
begin
  select * into r from games.rooms where code = p_code for update;
  select id, word into w from games.words
   where id not in (select word_id from games.used_words where match_id = r.match_id)
   order by random() limit 1;
  if w is null then select id, word into w from games.words order by random() limit 1; end if;
  insert into games.used_words values (r.match_id, w.id) on conflict do nothing;
  insert into games.secrets(room_code, answer, keys) values (p_code, w.word, array[games.norm(w.word)])
    on conflict (room_code) do update set answer = excluded.answer, keys = excluded.keys;
  update games.rooms set phase = 'turn', drawer_id = p_drawer, turn_id = gen_random_uuid(), turn_no = turn_no + 1,
         turn_started_at = now(), turn_ends_at = now() + make_interval(secs => turn_seconds),
         next_at = null, last_answer = null, hint_seed = floor(random() * 1000000)::int
   where code = p_code;
  select nick into dn from games.players where room_code = p_code and user_id = p_drawer;
  perform games.sys(p_code, dn || ' is drawing now');
  perform games.notify(p_code, 'state');
end $$;

create or replace function games.next_turn(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; cur_seq bigint; nxt uuid;
begin
  select * into r from games.rooms where code = p_code for update;
  if r.mode = 'obrazek' then
    update games.rooms set phase = 'waiting', next_at = null where code = p_code;
    perform games.notify(p_code, 'state');
    return;
  end if;
  select seq into cur_seq from games.players where room_code = p_code and user_id = r.drawer_id;
  select p.user_id into nxt from games.players p
   where p.room_code = p_code and games.active(p) and p.seq > coalesce(cur_seq, 0) order by p.seq limit 1;
  if nxt is null then
    if r.round_no >= r.rounds then perform games.finish(p_code); return; end if;
    update games.rooms set round_no = round_no + 1 where code = p_code;
    select p.user_id into nxt from games.players p where p.room_code = p_code and games.active(p) order by p.seq limit 1;
  end if;
  if nxt is null or (select count(*) from games.players p where p.room_code = p_code and games.active(p)) < 2 then
    perform games.finish(p_code); return;
  end if;
  perform games.start_turn(p_code, nxt);
end $$;

-- kto rysuje w następnej turze (do karty „Next round”); final = po tej turze koniec gry
create or replace function games.next_info(p_code text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r games.rooms; cur_seq bigint; nxt games.players; rnd int;
begin
  select * into r from games.rooms where code = p_code;
  select seq into cur_seq from games.players where room_code = p_code and user_id = r.drawer_id;
  rnd := r.round_no;
  select * into nxt from games.players p where p.room_code = p_code and games.active(p) and p.seq > coalesce(cur_seq, 0)
   order by p.seq limit 1;
  if nxt.user_id is null then
    if r.round_no >= r.rounds then return jsonb_build_object('final', true); end if;
    rnd := r.round_no + 1;
    select * into nxt from games.players p where p.room_code = p_code and games.active(p) order by p.seq limit 1;
  end if;
  if nxt.user_id is null then return jsonb_build_object('final', true); end if;
  return jsonb_build_object('final', false, 'nick', nxt.nick, 'user_id', nxt.user_id, 'round_no', rnd, 'rounds', r.rounds);
end $$;

create or replace function games.end_turn(p_code text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a text;
begin
  select answer into a from games.secrets where room_code = p_code;
  -- kalambury: 2,5 s odsłonięcia hasła + 4 s przerywnika „Next round”; obrazek: 5 s pełnego obrazka
  update games.rooms set phase = 'reveal', last_answer = a,
         next_at = now() + case when mode = 'kalambury' then interval '6.5 seconds' else interval '5 seconds' end
   where code = p_code;
  delete from games.secrets where room_code = p_code;
  perform games.sys(p_code, coalesce(p_reason || ' ', '') || 'The word was: ' || coalesce(a, '?'));
  perform games.notify(p_code, 'state');
end $$;

-- sprzątanie (zamiast crona; wołane z lobby i przy zakładaniu pokoju)
create or replace function games.cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare em int := (select empty_room_minutes from games.config where id = 1);
begin
  -- pokoje Draw & Guess zamykają się same, gdy nikt w nich nie jest aktywny
  update games.rooms r set status = 'closed', updated_at = now()
   where r.status = 'open' and r.mode = 'kalambury' and r.created_at < now() - make_interval(mins => em)
     and not exists (select 1 from games.players p where p.room_code = r.code and games.active(p))
     and r.updated_at < now() - make_interval(mins => em);
  update games.rooms set status = 'closed' where status = 'open' and updated_at < now() - interval '24 hours';
  delete from games.messages where created_at < now() - interval '7 days';
  delete from games.host_attempts where at < now() - interval '1 day';
  delete from games.used_words w where not exists (select 1 from games.matches m where m.id = w.match_id)
     and not exists (select 1 from games.rooms x where x.match_id = w.match_id and x.status = 'open');
end $$;

-- moderator pokoju Draw & Guess wychodzi / znika → moderacja przechodzi na następnego aktywnego gracza (kolejność wejścia)
create or replace function games.pass_host(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; nx games.players;
begin
  select * into r from games.rooms where code = p_code;
  if r.mode <> 'kalambury' or r.status <> 'open' then return false; end if;
  select * into nx from games.players p where p.room_code = p_code and games.active(p) and p.user_id is distinct from r.host_id
   order by p.seq limit 1;
  if nx.user_id is null then return false; end if;
  update games.players set is_host = (user_id = nx.user_id) where room_code = p_code;
  update games.rooms set host_id = nx.user_id where code = p_code;
  perform games.sys(p_code, nx.nick || ' is now the room moderator');
  perform games.notify(p_code, 'state');
  return true;
end $$;

-- =====================================================================
--  API (RPC) — public.gry_*  (jedyne, co widzi przeglądarka)
-- =====================================================================
create or replace function public.gry_me() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); d jsonb; p games.profiles;
begin
  if u is null then return jsonb_build_object('user_id', null); end if;
  d := games.discord_identity(u);
  select * into p from games.profiles where user_id = u;
  return jsonb_build_object('user_id', u, 'verified', d is not null, 'discord_name', d->>'name',
                            'nick', p.nick, 'can_host', games.is_host_user(u));
end $$;

create or replace function public.gry_host_login(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); c games.config; v_ok boolean;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  if (select count(*) from games.host_attempts a where a.user_id = u and not a.ok and a.at > now() - interval '10 minutes') >= 5
     or (select count(*) from games.host_attempts a where not a.ok and a.at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many attempts. Try again in a few minutes.';
  end if;
  select * into c from games.config where id = 1;
  v_ok := c.host_code_hash is not null
        and c.host_code_hash = encode(sha256(convert_to(c.host_code_salt || coalesce(p_code, ''), 'UTF8')), 'hex');
  insert into games.host_attempts(user_id, ok) values (u, v_ok);
  if v_ok then
    insert into games.host_sessions values (u, now() + interval '12 hours')
      on conflict (user_id) do update set until = excluded.until;
  end if;
  return v_ok;
end $$;

create or replace function public.gry_create_room(p_mode text, p_title text, p_rounds int default 3, p_seconds int default 80) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); c text; alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; i int; cfg games.config;
        is_host boolean; ip text; t text; existing text;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  if p_mode not in ('kalambury','obrazek') then raise exception 'Unknown game mode'; end if;
  is_host := games.is_host_user(u);
  -- Guess the Picture = rankingowy event sezonu → tylko host z kodem. Draw & Guess = casual, może każdy.
  if p_mode = 'obrazek' and not is_host then raise exception 'Guess the Picture rooms are opened by the event host'; end if;
  perform games.cleanup();
  select * into cfg from games.config where id = 1;
  t := left(trim(coalesce(p_title, '')), 40);
  if t <> '' and games.is_profane(t) then raise exception 'That room name did not pass the filter. Pick another one.'; end if;
  if is_host then
    if (select count(*) from games.rooms where host_id = u and status = 'open') >= 5 then
      raise exception 'You already have 5 open rooms. Close one first.'; end if;
  else
    ip := games.client_ip_hash();
    select code into existing from games.rooms where creator_id = u and status = 'open' and mode = 'kalambury' order by created_at desc limit 1;
    if existing is not null and (select count(*) from games.rooms where creator_id = u and status = 'open' and mode = 'kalambury') >= cfg.casual_rooms_per_user then
      raise exception 'You already have an open room (%). Join it or wait until it closes.', existing; end if;
    if (select count(*) from games.rooms where creator_id = u and created_at > now() - interval '1 hour') >= cfg.casual_creates_per_hour then
      raise exception 'You created too many rooms. Try again later.'; end if;
    if ip is not null and (select count(*) from games.rooms where creator_ip = ip and status = 'open' and mode = 'kalambury') >= cfg.casual_rooms_per_ip then
      raise exception 'Too many open rooms from your network. Join one of them instead.'; end if;
    if (select count(*) from games.rooms where status = 'open' and mode = 'kalambury') >= cfg.casual_rooms_total then
      raise exception 'All game tables are busy right now. Join an open room!'; end if;
  end if;
  loop
    c := '';
    for i in 1..5 loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from games.rooms where code = c);
  end loop;
  insert into games.rooms(code, mode, title, host_id, creator_id, creator_ip, rounds, turn_seconds)
  values (c, p_mode, coalesce(nullif(t, ''), case p_mode when 'kalambury' then 'Draw & Guess' else 'Guess the Picture' end),
          u, u, ip,
          case when p_mode = 'kalambury' and not is_host then least(greatest(coalesce(p_rounds, 2), 1), 5) else least(greatest(coalesce(p_rounds, 3), 1), 10) end,
          least(greatest(coalesce(p_seconds, case p_mode when 'kalambury' then 80 else 45 end), case when is_host then 15 else 30 end), case when is_host then 180 else 120 end));
  return c;
end $$;

create or replace function public.gry_close_room(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u and not games.is_host_user(u) then raise exception 'Only the room moderator can do that'; end if;
  update games.rooms set status = 'closed' where code = r.code;
  perform games.notify(r.code, 'closed');
end $$;

create or replace function public.gry_state(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; sec text; can_see_private boolean; res jsonb;
begin
  select * into r from games.rooms where code = upper(p_code);
  if not found then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.user_id is not null and not me.kicked and me.left_at is null then
    update games.players set last_seen = now() where room_code = r.code and user_id = u;
  end if;
  if r.phase = 'turn' and me.user_id is not null and not me.kicked
     and ((r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host)) then
    select answer into sec from games.secrets where room_code = r.code;
  end if;
  can_see_private := r.phase <> 'turn' or sec is not null or me.guessed_turn = r.turn_id;
  res := jsonb_build_object(
    'now', now(),
    'room', jsonb_build_object('code', r.code, 'mode', r.mode, 'title', r.title, 'status', r.status, 'phase', r.phase,
        'rounds', r.rounds, 'turn_seconds', r.turn_seconds, 'round_no', r.round_no, 'turn_no', r.turn_no,
        'turn_id', r.turn_id, 'drawer_id', r.drawer_id, 'turn_started_at', r.turn_started_at,
        'turn_ends_at', r.turn_ends_at, 'next_at', r.next_at, 'host_id', r.host_id, 'version', r.version,
        'match_id', r.match_id, 'creator_id', r.creator_id,
        'ranked', coalesce((select m.ranked from games.matches m where m.id = r.match_id), false),
        'last_answer', case when r.phase in ('reveal','waiting','finished') then r.last_answer end),
    'next', case when r.phase = 'reveal' and r.mode = 'kalambury' then games.next_info(r.code) end,
    'mask', games.mask(r.code),
    'secret', sec,
    'podium', case when r.mode = 'obrazek' and r.phase in ('turn','reveal') then
        coalesce((select jsonb_agg(jsonb_build_object('place', g.place, 'nick', g.nick, 'user_id', g.user_id) order by g.place)
                  from games.guesses g where g.turn_id = r.turn_id), '[]'::jsonb) end,
    'spots', case when r.mode = 'obrazek' then least((select picture_scorers from games.config where id = 1), 3) end,
    'cooldown', case when r.mode = 'kalambury' then greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0) else 0 end,
    'me', jsonb_build_object('user_id', u, 'joined', me.user_id is not null and not me.kicked and me.left_at is null,
        'kicked', coalesce(me.kicked, false), 'is_host', coalesce(me.is_host, false) or (u = r.host_id),
        'nick', me.nick, 'guessed', me.guessed_turn is not null and me.guessed_turn = r.turn_id,
        'cooldown_left', case when r.mode = 'kalambury' and me.last_msg_at is not null then
            greatest(0, extract(epoch from me.last_msg_at + make_interval(secs => greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0)) - now()))::float8 else 0 end),
    'players', coalesce((select jsonb_agg(jsonb_build_object('user_id', p.user_id, 'nick', p.nick, 'verified', p.verified,
          'is_host', p.is_host, 'score', p.score, 'active', games.active(p),
          'guessed', r.phase = 'turn' and p.guessed_turn = r.turn_id,
          'place', case when r.mode = 'obrazek' and r.phase in ('turn','reveal') then
                     (select g.place from games.guesses g where g.turn_id = r.turn_id and g.user_id = p.user_id) end) order by p.score desc, p.seq)
        from games.players p where p.room_code = r.code and not p.kicked and p.left_at is null), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(m order by (m->>'id')::bigint) from (
        select jsonb_build_object('id', x.id, 'kind', x.kind, 'scope', x.scope, 'nick', x.nick, 'user_id', x.user_id,
                                  'body', x.body, 'at', x.created_at) m
        from games.messages x
        where x.room_code = r.code
          and (x.scope = 'all' or x.turn_id is distinct from r.turn_id or can_see_private)
        order by x.id desc limit 40) s), '[]'::jsonb),
    'results', case when r.phase = 'finished' and r.mode = 'kalambury' then
        (select jsonb_agg(jsonb_build_object('place', q.place, 'nick', q.nick, 'verified', q.verified, 'points', q.score) order by q.place, q.nick)
         from (select p.nick, p.verified, p.score, rank() over (order by p.score desc) place from games.players p
               where p.room_code = r.code and not p.kicked and (p.score > 0 or p.left_at is null)) q)
      when r.phase = 'finished' and r.match_id is not null then
        (select jsonb_agg(jsonb_build_object('place', place, 'nick', nick, 'verified', verified, 'points', points) order by place, nick)
         from games.results where match_id = r.match_id) end
  );
  return res;
end $$;

create or replace function public.gry_join(p_code text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; d jsonb; prof games.profiles;
        nick text := trim(coalesce(p_nick, '')); k text; is_ver boolean;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found or r.status <> 'open' then raise exception 'This room does not exist or is closed'; end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.kicked then raise exception 'The host removed you from this room'; end if;

  d := games.discord_identity(u);
  is_ver := d is not null;
  if is_ver then
    select * into prof from games.profiles where user_id = u;
    if prof.user_id is not null and (nick = '' or games.nick_key(nick) = prof.nick_key) then
      nick := prof.nick;
    end if;
  end if;
  if nick = '' then raise exception 'Enter a nickname'; end if;
  if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]{2,20}$' then
    raise exception 'Nickname: 2–20 characters, letters, digits, space, _ . -'; end if;
  if games.is_profane(nick) then raise exception 'That nickname did not pass the filter. Pick another one.'; end if;
  k := games.nick_key(nick);
  if char_length(k) < 2 then raise exception 'Nickname is too short'; end if;
  if exists (select 1 from games.profiles where nick_key = k and user_id <> u) then
    raise exception 'That nickname is reserved by a verified (Discord) player'; end if;
  if exists (select 1 from games.players p where p.room_code = r.code and p.nick_key = k and p.user_id <> u
             and not p.kicked and p.left_at is null) then
    raise exception 'Someone in this room already uses that nickname'; end if;
  if is_ver then
    insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
    values (u, nick, k, d->>'id', d->>'name')
    on conflict (user_id) do update set nick = excluded.nick, nick_key = excluded.nick_key, discord_name = excluded.discord_name;
  end if;
  if me.user_id is null and (select count(*) from games.players p where p.room_code = r.code and games.active(p))
       >= (select case when r.mode = 'kalambury' then casual_max_players else max_players end from games.config where id = 1) then
    raise exception 'This room is full'; end if;

  insert into games.players(room_code, user_id, nick, nick_key, verified, is_host)
  values (r.code, u, nick, k, is_ver, u = r.host_id)
  on conflict (room_code, user_id) do update
    set nick = excluded.nick, nick_key = excluded.nick_key, verified = excluded.verified,
        left_at = null, last_seen = now();
  if me.user_id is null or me.left_at is not null then
    perform games.sys(r.code, nick || ' joined');
  end if;
  perform games.notify(r.code, 'joined', jsonb_build_object('user_id', u));
  return public.gry_state(r.code);
end $$;

create or replace function public.gry_leave(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; n text;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  update games.players set left_at = now() where room_code = r.code and user_id = u and left_at is null returning nick into n;
  if n is null then return; end if;
  perform games.sys(r.code, n || ' left');
  if r.mode = 'kalambury' and not exists (select 1 from games.players p where p.room_code = r.code and games.active(p)) then
    update games.rooms set status = 'closed' where code = r.code;   -- ostatni wyszedł → pokój się zamyka
    perform games.notify(r.code, 'closed');
    return;
  end if;
  if r.mode = 'kalambury' and r.host_id = u then perform games.pass_host(r.code); end if;
  if r.phase = 'turn' and r.mode = 'kalambury' and r.drawer_id = u then
    perform games.end_turn(r.code, 'The drawer left.');
  else
    perform games.notify(r.code, 'state');
  end if;
end $$;

create or replace function public.gry_start(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; n int; first uuid; mid uuid; se jsonb;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the room moderator can start the game'; end if;
  if r.phase not in ('lobby','finished') then raise exception 'The game is already running'; end if;
  delete from games.players where room_code = r.code and left_at is not null;
  select count(*) into n from games.players p where p.room_code = r.code and games.active(p)
     and not (r.mode = 'obrazek' and p.is_host);
  if r.mode = 'kalambury' and n < 2 then raise exception 'You need at least 2 players'; end if;
  if r.mode = 'obrazek' and n < 1 then raise exception 'You need at least 1 player to guess'; end if;
  -- ranking sezonu: tylko Guess the Picture (event hosta) w tygodniach sezonu; Draw & Guess = casual
  -- Draw & Guess: nic nie trafia do games.matches/results; match_id = tylko id bieżącej gry (słowa bez powtórek)
  if r.mode = 'kalambury' then
    delete from games.used_words where match_id = r.match_id;
    mid := gen_random_uuid();
  else
    se := games.season_at(now());
    insert into games.matches(room_code, mode, title, ranked, season_no, season_name)
    values (r.code, r.mode, r.title, se->>'phase' = 'season',
            case when se->>'phase' = 'season' then (se->>'no')::int end,
            case when se->>'phase' = 'season' then se->>'name' end)
    returning id into mid;
  end if;
  update games.players set score = 0, guessed_turn = null where room_code = r.code;
  delete from games.messages where room_code = r.code;
  update games.rooms set match_id = mid, round_no = 1, turn_no = 0, last_answer = null, drawer_id = null,
         phase = case when mode = 'obrazek' then 'waiting' else phase end where code = r.code;
  perform games.sys(r.code, 'Game on: ' || r.title || '!');
  if r.mode = 'kalambury' then
    select p.user_id into first from games.players p where p.room_code = r.code and games.active(p) order by p.seq limit 1;
    perform games.start_turn(r.code, first);
  else
    update games.rooms set round_no = 0 where code = r.code;
    perform games.notify(r.code, 'state');
  end if;
end $$;

-- Zgadnij obrazek: host odpala kolejny obrazek (hasło zna tylko serwer i host)
create or replace function public.gry_image_start(p_code text, p_answer text, p_seconds int default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; a text := trim(coalesce(p_answer, '')); ks text[]; t uuid := gen_random_uuid();
        mx int := (select picture_max_seconds from games.config where id = 1); secs int;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the host can show pictures'; end if;
  secs := least(greatest(coalesce(p_seconds, mx), 15), mx);   -- domyślnie i maksymalnie picture_max_seconds (120 s)
  if r.mode <> 'obrazek' or r.phase not in ('waiting','reveal') then raise exception 'You can''t show a picture right now'; end if;
  if char_length(a) < 2 or char_length(a) > 60 then raise exception 'Enter the answer (2–60 characters)'; end if;
  select array_agg(distinct games.norm(x)) into ks from unnest(regexp_split_to_array(a, '\s*[,/|]\s*')) x where games.norm(x) <> '';
  insert into games.secrets(room_code, answer, keys) values (r.code, split_part(regexp_replace(a, '\s*[/|]\s*', ',', 'g'), ',', 1), ks)
    on conflict (room_code) do update set answer = excluded.answer, keys = excluded.keys;
  update games.rooms set phase = 'turn', turn_id = t, turn_no = turn_no + 1, round_no = round_no + 1,
         turn_seconds = secs,
         -- odliczanie 3-2-1: obrazek pojawia się u wszystkich w chwili turn_started_at (czas serwera), od niej liczą się punkty
         turn_started_at = now() + interval '3 seconds',
         turn_ends_at = now() + interval '3 seconds' + make_interval(secs => secs),
         hint_seed = floor(random() * 1000000)::int, last_answer = null, next_at = null
   where code = r.code;
  perform games.sys(r.code, 'Picture #' || (r.round_no + 1) || ' in 3… 2… 1…');
  perform games.notify(r.code, 'state', jsonb_build_object('turn_id', t));
  return t;
end $$;

create or replace function public.gry_guess(p_code text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; s games.secrets; txt text := trim(coalesce(p_text, ''));
        k text; is_guesser boolean; is_master boolean; pts int; rnk int; remaining float; v_scope text := 'all';
        eligible int; done int; m jsonb; nsc int := (select picture_scorers from games.config where id = 1);
        cd int := greatest(coalesce((select dg_message_cooldown_seconds from games.config where id = 1), 0), 0); wait_s int;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if txt = '' then return jsonb_build_object('ok', false); end if;
  if char_length(txt) > 120 then txt := left(txt, 120); end if;
  -- Draw & Guess: 1 wiadomość / cd s na gracza (config dg_message_cooldown_seconds); odrzucone próby nie przedłużają blokady odrzuconych prób
  if r.mode = 'kalambury' and cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    wait_s := greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int);
    raise exception 'Slow down — wait %s', wait_s;
  end if;
  -- limit ogólny (Guess the Picture bez zmian): 1 wiadomość / 0,6 s i max 10 na 10 s
  if me.last_msg_at is not null and me.last_msg_at > now() - interval '600 milliseconds' then
    raise exception 'Slow down a little 🙂'; end if;
  if me.msg_window_start is null or me.msg_window_start < now() - interval '10 seconds' then
    update games.players set msg_window_start = now(), msg_window_count = 1, last_msg_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  else
    if me.msg_window_count >= 10 then raise exception 'Too many messages. Take a short break.'; end if;
    update games.players set msg_window_count = msg_window_count + 1, last_msg_at = now(), last_seen = now()
     where room_code = r.code and user_id = u;
  end if;

  if r.phase = 'turn' then
    select * into s from games.secrets where room_code = r.code;
    k := games.norm(txt);
    is_master := (r.mode = 'kalambury' and r.drawer_id = u) or (r.mode = 'obrazek' and me.is_host);
    is_guesser := not is_master and me.guessed_turn is distinct from r.turn_id;
    if is_master and s.keys is not null and exists (select 1 from unnest(s.keys) x where position(x in k) > 0) then
      raise exception 'Don''t give away the answer! 🤐';
    end if;
    if is_guesser and now() < r.turn_started_at then
      raise exception 'Wait for the picture! 👀';
    end if;
    if is_guesser and k = any(s.keys) and r.mode = 'obrazek' then
      -- pierwsze 3 poprawne odpowiedzi = 3 / 2 / 1 pkt, bez mnożnika czasu. Wiersz pokoju jest zablokowany (for update),
      -- więc zgłoszenia są szeregowane; unique(turn_id, place) to druga linia obrony.
      select count(*) + 1 into rnk from games.guesses where turn_id = r.turn_id;
      if rnk > least(nsc, 3) then
        perform games.end_turn(r.code, 'All ' || least(nsc, 3) || ' spots taken!');
        return jsonb_build_object('ok', true, 'correct', false, 'full', true);
      end if;
      insert into games.guesses(match_id, turn_id, user_id, nick, nick_key, verified, place)
      values (r.match_id, r.turn_id, u, me.nick, me.nick_key, me.verified, rnk);
      pts := 4 - rnk;
      update games.players set score = score + pts, guessed_turn = r.turn_id where room_code = r.code and user_id = u;
      perform games.sys(r.code, case rnk when 1 then '🥇 1st' when 2 then '🥈 2nd' else '🥉 3rd' end || ' guessed it! ' || me.nick || ' (+' || pts || ')', 'correct');
      select count(*) filter (where p.guessed_turn = r.turn_id), count(*) into done, eligible
        from games.players p where p.room_code = r.code and games.active(p) and not p.is_host;
      if rnk >= least(nsc, 3) then
        perform games.end_turn(r.code, 'Top ' || least(nsc, 3) || ' found!');
      elsif done >= eligible then
        perform games.end_turn(r.code, 'Everyone guessed it!');
      else
        perform games.notify(r.code, 'state');
      end if;
      return jsonb_build_object('ok', true, 'correct', true, 'points', pts, 'place', rnk);
    end if;
    if is_guesser and k = any(s.keys) then
      remaining := least(r.turn_seconds, greatest(0, extract(epoch from r.turn_ends_at - now())));
      select count(*) + 1 into rnk from games.players where room_code = r.code and guessed_turn = r.turn_id;
      pts := 20 + ceil(80 * remaining / greatest(1, r.turn_seconds))::int
             + case rnk when 1 then 15 when 2 then 8 when 3 then 4 else 0 end;
      update games.players set score = score + pts, guessed_turn = r.turn_id where room_code = r.code and user_id = u;
      if r.mode = 'kalambury' then
        update games.players set score = score + 10 where room_code = r.code and user_id = r.drawer_id;
      end if;
      perform games.sys(r.code, me.nick || ' guessed it! (+' || pts || ')', 'correct');
      select count(*) filter (where p.guessed_turn = r.turn_id), count(*) into done, eligible
        from games.players p where p.room_code = r.code and games.active(p)
         and not ((r.mode = 'kalambury' and p.user_id = r.drawer_id) or (r.mode = 'obrazek' and p.is_host));
      if done >= eligible then
        perform games.end_turn(r.code, 'Everyone guessed it!');
      else
        perform games.notify(r.code, 'state');
      end if;
      return jsonb_build_object('ok', true, 'correct', true, 'points', pts);
    end if;
    if is_guesser and s.keys is not null and char_length(k) >= 4
       and exists (select 1 from unnest(s.keys) x where games.lev(k, x) = 1) then
      return jsonb_build_object('ok', true, 'close', true);   -- „blisko!” widzi tylko zgadujący
    end if;
    if me.guessed_turn = r.turn_id or is_master then v_scope := 'guessed'; end if;
    if is_master then v_scope := 'all'; end if;
  end if;

  insert into games.messages(room_code, turn_id, user_id, nick, kind, scope, body)
  values (r.code, r.turn_id, u, me.nick, 'chat', v_scope, games.clean_text(txt))
  returning jsonb_build_object('id', messages.id, 'kind', messages.kind, 'scope', messages.scope, 'nick', messages.nick, 'user_id', messages.user_id, 'body', messages.body, 'at', messages.created_at) into m;
  if v_scope = 'all' then
    perform realtime.send(jsonb_build_object('code', r.code, 'msg', m), 'msg', 'room:' || r.code, true);
  else
    perform realtime.send(jsonb_build_object('code', r.code, 'private', true), 'msg', 'room:' || r.code, true);
  end if;
  return jsonb_build_object('ok', true);
end $$;

create or replace function public.gry_tick(p_code text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; d games.players;
begin
  if not exists (select 1 from games.players where room_code = upper(p_code) and user_id = u and not kicked) then
    return null; end if;
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.mode = 'kalambury' and r.status = 'open' and not exists (
       select 1 from games.players p where p.room_code = r.code and p.user_id = r.host_id and games.active(p)) then
    perform games.pass_host(r.code);
  end if;
  if r.phase = 'turn' and now() >= r.turn_ends_at then
    perform games.end_turn(r.code, 'Time''s up!');
  elsif r.phase = 'turn' and r.mode = 'kalambury' then
    select * into d from games.players where room_code = r.code and user_id = r.drawer_id;
    if d.user_id is null or not games.active(d) then perform games.end_turn(r.code, 'The drawer disconnected.'); end if;
  elsif r.phase = 'reveal' and now() >= r.next_at then
    perform games.next_turn(r.code);
  end if;
  return (select version from games.rooms where code = r.code);
end $$;

create or replace function public.gry_skip(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.phase <> 'turn' then return; end if;
  if u is distinct from r.drawer_id and u is distinct from r.host_id then raise exception 'You can''t skip this turn'; end if;
  perform games.end_turn(r.code, 'Turn skipped.');
end $$;

create or replace function public.gry_finish(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the room moderator can do that'; end if;
  if r.phase in ('lobby','finished') then return; end if;
  perform games.finish(r.code);
end $$;

create or replace function public.gry_kick(p_code text, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; n text;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if r.host_id is distinct from u then raise exception 'Only the room moderator (host) can kick players'; end if;
  if p_user = u then raise exception 'You can''t kick yourself'; end if;
  update games.players set kicked = true where room_code = r.code and user_id = p_user returning nick into n;
  if n is null then return; end if;
  perform games.sys(r.code, n || ' was removed by the ' || case when r.mode = 'kalambury' then 'moderator' else 'host' end);
  perform games.notify(r.code, 'kicked', jsonb_build_object('user_id', p_user));
  if r.phase = 'turn' and r.drawer_id = p_user then perform games.end_turn(r.code, 'The drawer was removed.'); end if;
end $$;

-- ---------- lobby, harmonogram, sezon ----------
create or replace function public.gry_lobby() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform games.cleanup();
  return jsonb_build_object(
    'now', now(),
    'season', games.season_at(now()),
    'event', (select jsonb_build_object('id', id, 'title', title, 'mode', mode, 'starts_at', starts_at, 'room_code', room_code)
              from games.events where starts_at > now() - interval '3 hours' order by starts_at limit 1),
    'rooms', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
               select jsonb_build_object('code', r.code, 'mode', r.mode, 'title', r.title, 'phase', r.phase, 'created_at', r.created_at,
                 'ranked', r.mode = 'obrazek',
                 'max_players', (select case when r.mode = 'kalambury' then casual_max_players else max_players end from games.config where id = 1),
                 'players', (select count(*) from games.players p where p.room_code = r.code and games.active(p))) x
               from games.rooms r where r.status = 'open' and r.updated_at > now() - interval '12 hours') q
              where (x->>'players')::int > 0 or x->>'mode' = 'obrazek'), '[]'::jsonb));
end $$;

create or replace function public.gry_season() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('now', now(), 'season', games.season_at(now()))
$$;

create or replace function public.gry_set_event(p_title text, p_mode text, p_starts_at timestamptz, p_room_code text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if not games.is_host_user(u) then raise exception 'Only a host can do that'; end if;
  delete from games.events where starts_at > now() - interval '3 hours';
  insert into games.events(title, mode, starts_at, room_code, created_by)
  values (left(p_title, 80), coalesce(p_mode, 'obrazek'), p_starts_at, upper(nullif(p_room_code, '')), u);
end $$;

-- ---------- ranking ----------
-- p_period: 'season' (bieżący sezon, tylko rankingowe Guess the Picture) | 'season:N' | 'all' (wszystkie rankingowe)
-- (stare 'week'/'fun' = 'season'; Draw & Guess nie ma rankingu)
create or replace function games.rank_rows(p_from timestamptz, p_to timestamptz, p_ranked boolean, p_season int, p_mode text)
returns jsonb language sql stable security definer set search_path = '' as $$
  -- Guess the Picture: punkty = suma 3 / 2 / 1 za 1./2./3. trafienie. Tie-break: więcej 1. miejsc, więcej 2. miejsc,
  -- potem kto wcześniej osiągnął swój wynik (czas ostatniego punktującego trafienia). Bez losowości.
  with mm as (select m.id from games.matches m
               where m.mode = 'obrazek' and m.finished_at is not null
                 and m.finished_at >= p_from and m.finished_at < p_to
                 and (p_ranked is null or m.ranked = p_ranked)
                 and (p_season is null or m.season_no = p_season)
                 and (p_mode is null or p_mode = 'obrazek')),
  g as (select case when gs.verified then 'u:' || gs.user_id::text else 'g:' || gs.nick_key end k,
               sum(4 - gs.place)::int pts, count(*) filter (where gs.place = 1) firsts, count(*) filter (where gs.place = 2) seconds, max(gs.at) last_at,
               (array_agg(gs.nick order by gs.at desc))[1] nick, bool_or(gs.verified) verified, (array_agg(gs.user_id))[1] uid
          from games.guesses gs where gs.match_id in (select id from mm) group by 1),
  res as (select case when r.verified then 'u:' || r.user_id::text else 'g:' || r.nick_key end k,
                 count(distinct r.match_id) games, count(*) filter (where r.place = 1) wins
            from games.results r where r.match_id in (select id from mm) group by 1)
  select coalesce((select jsonb_agg(x order by (x->>'place')::int, x->>'nick') from (
      select jsonb_build_object('place', rank() over (order by g.pts desc, g.firsts desc, g.seconds desc, g.last_at asc),
             'nick', coalesce(pr.nick, g.nick), 'verified', g.verified, 'points', g.pts, 'firsts', g.firsts, 'seconds', g.seconds,
             'games', coalesce(res.games, 0), 'wins', coalesce(res.wins, 0)) x
      from g left join res on res.k = g.k
      left join games.profiles pr on g.verified and pr.user_id = g.uid) q), '[]'::jsonb)
$$;

create or replace function public.gry_ranking(p_period text default 'season') returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare se jsonb := games.season_at(now()); f timestamptz; n int;
begin
  if p_period = 'all' then
    return jsonb_build_object('period', 'all', 'label', 'All seasons', 'season', se,
      'rows', games.rank_rows('-infinity', 'infinity', true, null, null));
  end if;
  n := case when p_period like 'season:%' then nullif(split_part(p_period, ':', 2), '')::int else (se->>'no')::int end;
  return jsonb_build_object('period', 'season', 'season_no', n, 'season', se,
    'label', coalesce((select max(m.season_name) from games.matches m where m.season_no = n), se->>'name', 'Season ' || n),
    'rows', case when n is null then '[]'::jsonb else games.rank_rows('-infinity', 'infinity', true, n, null) end);
end $$;

-- Hall of Fame: top 3 każdego zakończonego sezonu (po 10 tygodniach, także w trakcie przerwy)
create or replace function public.gry_hall_of_fame() returns jsonb
language sql stable security definer set search_path = '' as $$
  with se as (select games.season_at(now()) s)
  select coalesce(jsonb_agg(jsonb_build_object('season', z.season_name, 'season_no', z.season_no, 'top', z.top) order by z.season_no desc), '[]'::jsonb)
  from (
    select m.season_no, max(m.season_name) season_name,
           games.rank_rows('-infinity', 'infinity', true, m.season_no, null) all_rows
    from games.matches m, se
    where m.ranked and m.season_no is not null
      and (m.season_no < coalesce((se.s->>'no')::int, 0) or (m.season_no = (se.s->>'no')::int and se.s->>'phase' = 'break'))
    group by m.season_no
  ) y, lateral (select y.season_no, y.season_name,
      (select jsonb_agg(e) from jsonb_array_elements(y.all_rows) e where (e->>'place')::int <= 3) top) z
$$;

create or replace function public.gry_recent_games(p_limit int default 10) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(g order by (g->>'finished_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', m.id, 'title', m.title, 'mode', m.mode, 'finished_at', m.finished_at, 'ranked', m.ranked, 'season', m.season_name,
           'results', (select jsonb_agg(jsonb_build_object('place', place, 'nick', nick, 'verified', verified, 'points', points)
                        order by place, nick) from games.results where match_id = m.id)) g
    from games.matches m where m.finished_at is not null and m.mode = 'obrazek' order by m.finished_at desc limit least(greatest(p_limit, 1), 50)) z
$$;

-- >>> TABLE GAMES (generated from supabase/parts/tables_*.sql)
-- =====================================================================
--  TABLE GAMES (2 graczy): Chess, Checkers (English draughts), Connect Four
--  Wszystkie ruchy liczone i sprawdzane w Postgresie (plpgsql). Klient dostaje listę legalnych ruchów od serwera.
-- =====================================================================
alter table games.config add column if not exists table_forfeit_seconds int not null default 180;       -- gracz nieobecny > N s = walkower
alter table games.config add column if not exists table_message_cooldown_seconds int not null default 2; -- czat przy stole: 1 wiadomość / N s
alter table games.config add column if not exists table_idle_minutes int not null default 30;           -- stół bez aktywnych osób → zamknięty
alter table games.config add column if not exists tables_per_user int not null default 1;
alter table games.config add column if not exists tables_per_ip int not null default 3;
alter table games.config add column if not exists tables_total int not null default 60;
alter table games.config add column if not exists table_creates_per_hour int not null default 10;
alter table games.config add column if not exists table_max_spectators int not null default 30;

create table if not exists games.tables (
  code text primary key,
  game text not null check (game in ('chess','checkers','connect4')),
  private boolean not null default false,          -- tylko przez link z zaproszeniem (nie ma go w lobby)
  spectators boolean not null default true,
  creator_id uuid not null,
  creator_ip text,                                 -- skrót IP (jak w pokojach), tylko do limitów
  status text not null default 'waiting' check (status in ('waiting','playing','finished','closed')),
  p1 uuid, p2 uuid,                                -- p1 zaczyna: White (szachy) / Black (warcaby) / Red (Connect Four)
  pos text not null,                               -- pozycja (format zależny od gry)
  turn smallint not null default 1 check (turn in (1,2)),
  legal text[] not null default '{}',              -- legalne ruchy strony na ruchu (liczone na serwerze)
  last_move text,
  history text[] not null default '{}',
  reps text[] not null default '{}',               -- szachy: klucze pozycji od ostatniego nieodwracalnego ruchu (powtórzenia)
  result text check (result in ('p1','p2','draw')),
  reason text,
  draw_offer smallint,
  rematch smallint not null default 0,             -- bity: 1 = p1 chce rewanżu, 2 = p2
  game_no int not null default 1,
  version bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  move_at timestamptz
);
create index if not exists tables_status_idx on games.tables(status);
-- zegary (v2): szachy = czas na partię + dodatek (Fischer), warcaby / Connect Four = limit na ruch
alter table games.config add column if not exists table_first_move_seconds int not null default 60;   -- szachy z zegarem: pierwszy ruch każdej strony
alter table games.tables add column if not exists tc_base int not null default 0;     -- szachy: czas bazowy w s (0 = bez zegara)
alter table games.tables add column if not exists tc_inc int not null default 0;      -- szachy: dodatek za ruch w s
alter table games.tables add column if not exists tc_move int not null default 0;     -- warcaby / C4: limit na ruch w s (0 = brak)
alter table games.tables add column if not exists clock1 int;                         -- pozostały czas (ms) strony 1 / 2, stan na clock_at
alter table games.tables add column if not exists clock2 int;
alter table games.tables add column if not exists clock_at timestamptz;              -- od kiedy biegnie zegar strony na ruchu (czas serwera)
-- Sea Battle (v3): nowa gra; rozstawienie floty tylko w games.table_fleets (RLS bez polityk → nikt poza funkcjami serwera tego nie czyta)
alter table games.tables drop constraint if exists tables_game_check;
alter table games.tables add constraint tables_game_check check (game in ('chess','checkers','connect4','battleship'));
alter table games.tables add column if not exists bs_notouch boolean not null default false;   -- Sea Battle: statki nie mogą się stykać
alter table games.config add column if not exists table_place_seconds int not null default 120;  -- Sea Battle: czas na rozstawienie floty
create table if not exists games.table_fleets (
  table_code text not null references games.tables(code) on delete cascade,
  seat smallint not null check (seat in (1,2)),
  fleet text not null,                             -- 100 znaków: '.' woda, '1'..'5' numer statku (TAJNE do końca partii)
  created_at timestamptz not null default now(),
  primary key (table_code, seat)
);
alter table games.table_fleets enable row level security;
revoke all on games.table_fleets from public;
create table if not exists games.table_members (
  table_code text not null references games.tables(code) on delete cascade,
  user_id uuid not null,
  nick text not null,
  nick_key text not null,
  verified boolean not null default false,
  seq bigint generated always as identity,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  left_at timestamptz,
  last_msg_at timestamptz,
  primary key (table_code, user_id)
);
create table if not exists games.table_messages (
  id bigint generated always as identity primary key,
  table_code text not null references games.tables(code) on delete cascade,
  user_id uuid,
  nick text,
  kind text not null default 'chat' check (kind in ('chat','system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists table_messages_idx on games.table_messages(table_code, id desc);
alter table games.tables enable row level security;
alter table games.table_members enable row level security;
alter table games.table_messages enable row level security;

-- ---------------------------------------------------------------------
--  SZACHY. Plansza: 64 znaki, indeks = rank*8 + file (a1 = 0, h8 = 63), 'PNBRQK' białe, 'pnbrqk' czarne, '.' puste.
--  Pozycja: board|strona(w/b)|roszady(KQkq lub -)|ep(indeks pola en passant lub -1)|halfmove|fullmove
--  Ruchy w notacji UCI: e2e4, e7e8q (promocja), e1g1 (roszada).
-- ---------------------------------------------------------------------
create or replace function games.ch_sq(i int) returns text language sql immutable as $$
  select chr(97 + i % 8) || (i / 8 + 1)::text $$;
create or replace function games.ch_idx(s text) returns int language sql immutable as $$
  select (ascii(substr(s, 1, 1)) - 97) + (substr(s, 2, 1)::int - 1) * 8 $$;

create or replace function games.ch_attacked(b text, sq int, by_white boolean) returns boolean
language plpgsql immutable as $$
declare f int := sq % 8; r int := sq / 8; i int; nf int; nr int; p text; d int;
  kn int[] := array[1,2, 2,1, 2,-1, 1,-2, -1,-2, -2,-1, -2,1, -1,2];
  kg int[] := array[1,0, 1,1, 0,1, -1,1, -1,0, -1,-1, 0,-1, 1,-1];
  a_n text := case when by_white then 'N' else 'n' end; a_k text := case when by_white then 'K' else 'k' end;
  a_b text := case when by_white then 'B' else 'b' end; a_r text := case when by_white then 'R' else 'r' end;
  a_q text := case when by_white then 'Q' else 'q' end;
begin
  if by_white then
    if r > 0 then
      if f > 0 and substr(b, sq - 8, 1) = 'P' then return true; end if;      -- pionek na sq-9
      if f < 7 and substr(b, sq - 6, 1) = 'P' then return true; end if;      -- pionek na sq-7
    end if;
  else
    if r < 7 then
      if f > 0 and substr(b, sq + 8, 1) = 'p' then return true; end if;      -- sq+7
      if f < 7 and substr(b, sq + 10, 1) = 'p' then return true; end if;     -- sq+9
    end if;
  end if;
  for i in 0..7 loop
    nf := f + kn[2*i+1]; nr := r + kn[2*i+2];
    if nf between 0 and 7 and nr between 0 and 7 and substr(b, nr*8 + nf + 1, 1) = a_n then return true; end if;
    nf := f + kg[2*i+1]; nr := r + kg[2*i+2];
    if nf between 0 and 7 and nr between 0 and 7 and substr(b, nr*8 + nf + 1, 1) = a_k then return true; end if;
  end loop;
  for i in 0..7 loop   -- kierunki parzyste: ortogonalne (wieża), nieparzyste: po skosie (goniec)
    nf := f; nr := r;
    loop
      nf := nf + kg[2*i+1]; nr := nr + kg[2*i+2];
      exit when nf < 0 or nf > 7 or nr < 0 or nr > 7;
      p := substr(b, nr*8 + nf + 1, 1);
      if p <> '.' then
        if p = a_q or (i % 2 = 0 and p = a_r) or (i % 2 = 1 and p = a_b) then return true; end if;
        exit;
      end if;
    end loop;
  end loop;
  return false;
end $$;

-- pseudo-legalne ruchy (bez sprawdzania, czy własny król zostaje w szachu; roszady już ze sprawdzeniem pól)
create or replace function games.ch_moves(b text, w boolean, c text, ep int) returns text[]
language plpgsql immutable as $$
declare mv text[] := '{}'; sq int; p text; f int; r int; t int; tp text; i int; nf int; nr int; up text; fs text; d int; pr text;
  kn int[] := array[1,2, 2,1, 2,-1, 1,-2, -1,-2, -2,-1, -2,1, -1,2];
  kg int[] := array[1,0, 1,1, 0,1, -1,1, -1,0, -1,-1, 0,-1, 1,-1];
  dir int := case when w then 8 else -8 end; start_r int := case when w then 1 else 6 end; last_r int := case when w then 7 else 0 end;
begin
  for sq in 0..63 loop
    p := substr(b, sq + 1, 1);
    continue when p = '.' or (p = upper(p)) <> w;
    up := upper(p); f := sq % 8; r := sq / 8; fs := games.ch_sq(sq);
    if up = 'P' then
      t := sq + dir;
      if substr(b, t + 1, 1) = '.' then
        if t / 8 = last_r then
          foreach pr in array array['q','r','b','n'] loop mv := mv || (fs || games.ch_sq(t) || pr); end loop;
        else
          mv := mv || (fs || games.ch_sq(t));
          if r = start_r and substr(b, t + dir + 1, 1) = '.' then mv := mv || (fs || games.ch_sq(t + dir)); end if;
        end if;
      end if;
      for d in -1..1 by 2 loop
        nf := f + d; continue when nf < 0 or nf > 7;
        t := sq + dir + d; tp := substr(b, t + 1, 1);
        if (tp <> '.' and (tp = upper(tp)) <> w) or t = ep then
          if t / 8 = last_r then
            foreach pr in array array['q','r','b','n'] loop mv := mv || (fs || games.ch_sq(t) || pr); end loop;
          else mv := mv || (fs || games.ch_sq(t)); end if;
        end if;
      end loop;
    elsif up = 'N' or up = 'K' then
      for i in 0..7 loop
        if up = 'N' then nf := f + kn[2*i+1]; nr := r + kn[2*i+2]; else nf := f + kg[2*i+1]; nr := r + kg[2*i+2]; end if;
        continue when nf < 0 or nf > 7 or nr < 0 or nr > 7;
        tp := substr(b, nr*8 + nf + 1, 1);
        if tp = '.' or (tp = upper(tp)) <> w then mv := mv || (fs || games.ch_sq(nr*8 + nf)); end if;
      end loop;
      if up = 'K' then
        if w and sq = 4 then
          if position('K' in c) > 0 and substr(b, 6, 2) = '..' and substr(b, 8, 1) = 'R'
             and not games.ch_attacked(b, 4, false) and not games.ch_attacked(b, 5, false) and not games.ch_attacked(b, 6, false) then
            mv := mv || 'e1g1'::text; end if;
          if position('Q' in c) > 0 and substr(b, 2, 3) = '...' and substr(b, 1, 1) = 'R'
             and not games.ch_attacked(b, 4, false) and not games.ch_attacked(b, 3, false) and not games.ch_attacked(b, 2, false) then
            mv := mv || 'e1c1'::text; end if;
        elsif not w and sq = 60 then
          if position('k' in c) > 0 and substr(b, 62, 2) = '..' and substr(b, 64, 1) = 'r'
             and not games.ch_attacked(b, 60, true) and not games.ch_attacked(b, 61, true) and not games.ch_attacked(b, 62, true) then
            mv := mv || 'e8g8'::text; end if;
          if position('q' in c) > 0 and substr(b, 58, 3) = '...' and substr(b, 57, 1) = 'r'
             and not games.ch_attacked(b, 60, true) and not games.ch_attacked(b, 59, true) and not games.ch_attacked(b, 58, true) then
            mv := mv || 'e8c8'::text; end if;
        end if;
      end if;
    else
      for i in 0..7 loop
        continue when (up = 'R' and i % 2 = 1) or (up = 'B' and i % 2 = 0);
        nf := f; nr := r;
        loop
          nf := nf + kg[2*i+1]; nr := nr + kg[2*i+2];
          exit when nf < 0 or nf > 7 or nr < 0 or nr > 7;
          tp := substr(b, nr*8 + nf + 1, 1);
          if tp = '.' then mv := mv || (fs || games.ch_sq(nr*8 + nf));
          else
            if (tp = upper(tp)) <> w then mv := mv || (fs || games.ch_sq(nr*8 + nf)); end if;
            exit;
          end if;
        end loop;
      end loop;
    end if;
  end loop;
  return mv;
end $$;

-- wykonanie ruchu na planszy (en passant, roszada, promocja)
create or replace function games.ch_make(b text, m text) returns text
language plpgsql immutable as $$
declare fr int := games.ch_idx(substr(m, 1, 2)); tt int := games.ch_idx(substr(m, 3, 2)); pr text := substr(m, 5, 1);
        p text := substr(b, fr + 1, 1); tp text := substr(b, tt + 1, 1);
begin
  b := overlay(b placing '.' from fr + 1 for 1);
  if (p = 'P' or p = 'p') and fr % 8 <> tt % 8 and tp = '.' then
    b := overlay(b placing '.' from (case when p = 'P' then tt - 8 else tt + 8 end) + 1 for 1);
  end if;
  if (p = 'K' or p = 'k') and abs(tt - fr) = 2 then
    if tt = 6 then b := overlay(overlay(b placing '.' from 8 for 1) placing 'R' from 6 for 1);
    elsif tt = 2 then b := overlay(overlay(b placing '.' from 1 for 1) placing 'R' from 4 for 1);
    elsif tt = 62 then b := overlay(overlay(b placing '.' from 64 for 1) placing 'r' from 62 for 1);
    elsif tt = 58 then b := overlay(overlay(b placing '.' from 57 for 1) placing 'r' from 60 for 1);
    end if;
  end if;
  if pr <> '' then p := case when p = 'P' then upper(pr) else lower(pr) end; end if;
  return overlay(b placing p from tt + 1 for 1);
end $$;

-- legalne ruchy: pseudo-legalne minus te, po których własny król jest atakowany
create or replace function games.ch_legal(pos text) returns text[]
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); w boolean := split_part(pos, '|', 2) = 'w';
        c text := split_part(pos, '|', 3); ep int := split_part(pos, '|', 4)::int;
        m text; nb text; k int; res text[] := '{}';
begin
  foreach m in array games.ch_moves(b, w, c, ep) loop
    nb := games.ch_make(b, m);
    k := position(case when w then 'K' else 'k' end in nb) - 1;
    if k >= 0 and not games.ch_attacked(nb, k, not w) then res := res || m; end if;
  end loop;
  return res;
end $$;

create or replace function games.ch_play(pos text, m text) returns text
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); s text := split_part(pos, '|', 2); c text := replace(split_part(pos, '|', 3), '-', '');
        h int := split_part(pos, '|', 5)::int; fm int := split_part(pos, '|', 6)::int;
        fr int := games.ch_idx(substr(m, 1, 2)); tt int := games.ch_idx(substr(m, 3, 2));
        p text := substr(b, fr + 1, 1); cap boolean; nep int := -1;
begin
  cap := substr(b, tt + 1, 1) <> '.' or ((p = 'P' or p = 'p') and fr % 8 <> tt % 8);
  if p = 'K' then c := translate(c, 'KQ', ''); elsif p = 'k' then c := translate(c, 'kq', ''); end if;
  if fr = 0 or tt = 0 then c := replace(c, 'Q', ''); end if;
  if fr = 7 or tt = 7 then c := replace(c, 'K', ''); end if;
  if fr = 56 or tt = 56 then c := replace(c, 'q', ''); end if;
  if fr = 63 or tt = 63 then c := replace(c, 'k', ''); end if;
  if (p = 'P' or p = 'p') and abs(tt - fr) = 16 then nep := (fr + tt) / 2; end if;
  h := case when p = 'P' or p = 'p' or cap then 0 else h + 1 end;
  if s = 'b' then fm := fm + 1; end if;
  return games.ch_make(b, m) || '|' || case when s = 'w' then 'b' else 'w' end || '|' || coalesce(nullif(c, ''), '-')
         || '|' || nep || '|' || h || '|' || fm;
end $$;

-- FEN → pozycja (testy, perft)
create or replace function games.ch_from_fen(fen text) returns text
language plpgsql immutable as $$
declare parts text[] := regexp_split_to_array(trim(fen), '\s+'); ranks text[] := string_to_array(parts[1], '/');
        b text := ''; rk text; row text; ch text; i int; j int;
begin
  for i in reverse 8..1 loop
    rk := ranks[i]; row := '';
    for j in 1..char_length(rk) loop
      ch := substr(rk, j, 1);
      if ch ~ '[1-8]' then row := row || repeat('.', ch::int); else row := row || ch; end if;
    end loop;
    b := b || row;
  end loop;
  return b || '|' || parts[2] || '|' || coalesce(parts[3], '-') || '|'
         || case when coalesce(parts[4], '-') = '-' then '-1' else games.ch_idx(parts[4])::text end
         || '|' || coalesce(parts[5], '0') || '|' || coalesce(parts[6], '1');
end $$;

create or replace function games.ch_perft(pos text, depth int) returns bigint
language plpgsql immutable as $$
declare ms text[] := games.ch_legal(pos); m text; n bigint := 0;
begin
  if depth <= 1 then return cardinality(ms); end if;
  foreach m in array ms loop n := n + games.ch_perft(games.ch_play(pos, m), depth - 1); end loop;
  return n;
end $$;

-- za mało materiału do mata: K-K, K+lekka-K, K+gońce-K(+gońce) na polach jednego koloru
create or replace function games.ch_insufficient(b text) returns boolean
language plpgsql immutable as $$
declare rest text := regexp_replace(b, '[.Kk]', '', 'g'); i int; colors int := 0; p text;
begin
  if rest = '' or rest in ('N','n','B','b') then return true; end if;
  if rest !~ '^[Bb]+$' then return false; end if;
  for i in 0..63 loop
    p := substr(b, i + 1, 1);
    if p in ('B','b') then colors := colors | (1 << ((i % 8 + i / 8) % 2)); end if;
  end loop;
  return colors <> 3;
end $$;

-- czy strona (white = białe) może jeszcze dać mata jakąkolwiek serią legalnych ruchów (FIDE 6.9: przekroczenie czasu → remis, jeśli nie)
-- Bez szans na mata: sam król; król + 1 skoczek przeciw samemu królowi; król + gońce jednego koloru pól,
-- gdy rywal ma tylko króla lub gońce tego samego koloru pól. Wszystko inne (np. K+S przeciw K+pion) = mat możliwy.
create or replace function games.ch_can_mate(b text, white boolean) returns boolean
language plpgsql immutable as $$
declare mine text; opp text; i int; p text; colors int := 0;
begin
  mine := regexp_replace(b, case when white then '[^PNBRQ]' else '[^pnbrq]' end, '', 'g');
  opp  := regexp_replace(b, case when white then '[^pnbrq]' else '[^PNBRQ]' end, '', 'g');
  if mine = '' then return false; end if;
  if lower(mine) = 'n' and opp = '' then return false; end if;
  if lower(mine) ~ '^b+$' and (opp = '' or lower(opp) ~ '^b+$') then
    for i in 0..63 loop
      p := substr(b, i + 1, 1);
      if p in ('B','b') then colors := colors | (1 << ((i % 8 + i / 8) % 2)); end if;
    end loop;
    if colors <> 3 then return false; end if;
  end if;
  return true;
end $$;

-- ---------------------------------------------------------------------
--  WARCABY (English draughts / checkers 8x8). Plansza jak w szachach (a1 = 0); grają ciemne pola ((rank+file) parzyste).
--  'b' czarny pionek, 'B' czarna damka (zaczynają, idą „w górę”), 'w' / 'W' białe (idą „w dół”).
--  Pozycja: board|strona(b/w)|ruchy bez bicia i bez ruchu pionkiem (półruchy)
--  Ruch: c3-d4 (zwykły), c3xe5xg7 (bicie, także wielokrotne). Bicie obowiązkowe; rozpoczęte bicie trzeba dokończyć
--  (wolno wybrać dowolną sekwencję, niekoniecznie najdłuższą); pionek, który dojdzie do ostatniego rzędu, zostaje damką
--  i ruch się kończy; damka chodzi i bije o 1 pole we wszystkich 4 kierunkach po skosie.
-- ---------------------------------------------------------------------
create or replace function games.ck_jumps(b text, sq int, pc text, path text) returns text[]
language plpgsql immutable as $$
declare res text[] := '{}'; f int := sq % 8; r int := sq / 8; dr int; df int; mid text; dst int; nb text; np text; sub text[];
        black boolean := lower(pc) = 'b'; king boolean := pc = upper(pc);
begin
  for dr in -1..1 by 2 loop
    continue when not king and ((black and dr < 0) or (not black and dr > 0));
    for df in -1..1 by 2 loop
      continue when f + 2*df < 0 or f + 2*df > 7 or r + 2*dr < 0 or r + 2*dr > 7;
      mid := substr(b, (r + dr)*8 + f + df + 1, 1);
      dst := (r + 2*dr)*8 + f + 2*df;
      continue when substr(b, dst + 1, 1) <> '.';
      continue when not (case when black then mid in ('w','W') else mid in ('b','B') end);
      -- zbity pionek zostaje na planszy jako 'x' do końca ruchu (nie da się go bić drugi raz ani przez niego przejść)
      nb := overlay(overlay(overlay(b placing 'x' from (r + dr)*8 + f + df + 1 for 1) placing '.' from sq + 1 for 1) placing pc from dst + 1 for 1);
      np := path || 'x' || games.ch_sq(dst);
      if not king and dst / 8 = (case when black then 7 else 0 end) then
        res := res || np;                                  -- koronacja kończy ruch
      else
        sub := games.ck_jumps(nb, dst, pc, np);
        if cardinality(sub) = 0 then res := res || np; else res := res || sub; end if;
      end if;
    end loop;
  end loop;
  return res;
end $$;

create or replace function games.ck_legal(pos text) returns text[]
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); black boolean := split_part(pos, '|', 2) = 'b';
        sq int; p text; caps text[] := '{}'; simple text[] := '{}'; f int; r int; dr int; df int; t int; king boolean;
begin
  for sq in 0..63 loop
    p := substr(b, sq + 1, 1);
    continue when not (case when black then p in ('b','B') else p in ('w','W') end);
    caps := caps || games.ck_jumps(b, sq, p, games.ch_sq(sq));
    king := p = upper(p); f := sq % 8; r := sq / 8;
    for dr in -1..1 by 2 loop
      continue when not king and ((black and dr < 0) or (not black and dr > 0));
      for df in -1..1 by 2 loop
        continue when f + df < 0 or f + df > 7 or r + dr < 0 or r + dr > 7;
        t := (r + dr)*8 + f + df;
        if substr(b, t + 1, 1) = '.' then simple := simple || (games.ch_sq(sq) || '-' || games.ch_sq(t)); end if;
      end loop;
    end loop;
  end loop;
  return case when cardinality(caps) > 0 then caps else simple end;   -- bicie obowiązkowe
end $$;

create or replace function games.ck_play(pos text, m text) returns text
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); s text := split_part(pos, '|', 2); q int := split_part(pos, '|', 3)::int;
        sqs text[] := regexp_split_to_array(m, '[-x]'); i int; a int; z int; p text; man boolean; cap boolean := position('x' in m) > 0;
begin
  a := games.ch_idx(sqs[1]); p := substr(b, a + 1, 1); man := p = lower(p);
  for i in 2..cardinality(sqs) loop
    z := games.ch_idx(sqs[i]);
    if abs(z / 8 - a / 8) = 2 then b := overlay(b placing '.' from (a + z) / 2 + 1 for 1); end if;
    a := z;
  end loop;
  b := overlay(b placing '.' from games.ch_idx(sqs[1]) + 1 for 1);
  if man and a / 8 = (case when p = 'b' then 7 else 0 end) then p := upper(p); end if;
  b := overlay(b placing p from a + 1 for 1);
  q := case when cap or man then 0 else q + 1 end;
  return b || '|' || case when s = 'b' then 'w' else 'b' end || '|' || q;
end $$;

-- ---------------------------------------------------------------------
--  CONNECT FOUR 7x6. Plansza: 42 znaki, indeks = row*7 + col (row 0 = dół), 'r' / 'y' / '.'.
--  Pozycja: board|strona(r/y)|indeks ostatniego krążka (-1). Ruch = numer kolumny 1..7.
-- ---------------------------------------------------------------------
create or replace function games.c4_legal(pos text) returns text[]
language sql immutable as $$
  select coalesce(array_agg(c::text order by c), '{}') from generate_series(1, 7) c
  where substr(split_part(pos, '|', 1), 35 + c, 1) = '.'
$$;
create or replace function games.c4_play(pos text, m text) returns text
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); s text := split_part(pos, '|', 2); c int := m::int - 1; rw int;
begin
  for rw in 0..5 loop
    if substr(b, rw*7 + c + 1, 1) = '.' then
      return overlay(b placing s from rw*7 + c + 1 for 1) || '|' || case when s = 'r' then 'y' else 'r' end || '|' || (rw*7 + c);
    end if;
  end loop;
  raise exception 'Illegal move';
end $$;
-- 4 w linii przez ostatni krążek → indeksy wygrywającej czwórki (lub null)
create or replace function games.c4_win(pos text) returns int[]
language plpgsql immutable as $$
declare b text := split_part(pos, '|', 1); i int := split_part(pos, '|', 3)::int; ch text; d int; k int; c int; rw int;
        dc int[] := array[1, 0, 1, 1]; dr int[] := array[0, 1, 1, -1]; line int[]; sgn int; nc int; nr int;
begin
  if i < 0 then return null; end if;
  ch := substr(b, i + 1, 1); c := i % 7; rw := i / 7;
  for d in 1..4 loop
    line := array[i];
    foreach sgn in array array[1, -1] loop
      for k in 1..3 loop
        nc := c + sgn*k*dc[d]; nr := rw + sgn*k*dr[d];
        exit when nc < 0 or nc > 6 or nr < 0 or nr > 5 or substr(b, nr*7 + nc + 1, 1) <> ch;
        line := line || (nr*7 + nc);
      end loop;
    end loop;
    if cardinality(line) >= 4 then return line; end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------
--  SEA BATTLE 10x10 (statki 5, 4, 3, 3, 2). Pole: indeks = wiersz*10 + kolumna, nazwa = litera a–j + wiersz 1–10 (a1 = lewy górny róg).
--  Flota: "a1h5,c3v4,…" (początek, h = poziomo / v = pionowo, długość). Klasycznie: jeden strzał na turę (trafienie nie daje
--  dodatkowego strzału). Pozycja publiczna: faza (place/fire)|strzały gracza 1|strzały gracza 2|gotowość (bity 1, 2);
--  strzały: '.' nieznane, 'o' pudło, 'x' trafiony, '#' zatopiony (zatopiony statek jest odsłaniany).
-- ---------------------------------------------------------------------
create or replace function games.bs_parse(p_ships text, p_notouch boolean) returns text
language plpgsql immutable as $$
declare parts text[]; s text; m text[]; c int; rw int; o text; len int; lens int[] := '{}'; bd text := repeat('.', 100);
        k int; idx int; n int := 0; dr int; dc int; nr int; nc int; q text;
begin
  parts := string_to_array(lower(trim(coalesce(p_ships, ''))), ',');
  if coalesce(cardinality(parts), 0) <> 5 then raise exception 'Place all 5 ships'; end if;
  foreach s in array parts loop
    m := regexp_match(s, '^([a-j])(10|[1-9])([hv])([2-5])$');
    if m is null then raise exception 'Bad ship placement'; end if;
    n := n + 1; c := ascii(m[1]) - 97; rw := m[2]::int - 1; o := m[3]; len := m[4]::int; lens := lens || len;
    for k in 0..len - 1 loop
      nr := rw + case when o = 'v' then k else 0 end; nc := c + case when o = 'h' then k else 0 end;
      if nr > 9 or nc > 9 then raise exception 'A ship sticks out of the board'; end if;
      idx := nr * 10 + nc;
      if substr(bd, idx + 1, 1) <> '.' then raise exception 'Ships overlap'; end if;
      bd := overlay(bd placing n::text from idx + 1 for 1);
    end loop;
  end loop;
  if (select array_agg(x order by x) from unnest(lens) x) <> array[2,3,3,4,5] then raise exception 'The fleet is 5, 4, 3, 3 and 2'; end if;
  if p_notouch then
    for idx in 0..99 loop
      continue when substr(bd, idx + 1, 1) = '.';
      for dr in -1..1 loop for dc in -1..1 loop
        nr := idx / 10 + dr; nc := idx % 10 + dc;
        continue when nr < 0 or nr > 9 or nc < 0 or nc > 9;
        q := substr(bd, nr * 10 + nc + 1, 1);
        if q <> '.' and q <> substr(bd, idx + 1, 1) then raise exception 'Ships may not touch (no-touch rule)'; end if;
      end loop; end loop;
    end loop;
  end if;
  return bd;
end $$;
create or replace function games.bs_name(i int) returns text language sql immutable as $$ select chr(97 + i % 10) || (i / 10 + 1)::text $$;
create or replace function games.bs_legal(pos text, seat int) returns text[] language sql immutable as $$
  select coalesce(array_agg(games.bs_name(i - 1) order by i), '{}') from generate_series(1, 100) i
   where substr(split_part(pos, '|', seat + 1), i, 1) = '.'
$$;
-- strzał gracza seat w pole mv (flota przeciwnika = fleet) → {pos, mark: o|x|#, won}
create or replace function games.bs_shot(pos text, fleet text, seat int, mv text) returns jsonb
language plpgsql immutable as $$
declare x text[] := string_to_array(pos, '|'); sh text := x[seat + 1]; idx int; ship text; mark text; i int; sunk boolean := true;
begin
  idx := (substr(mv, 2)::int - 1) * 10 + ascii(substr(mv, 1, 1)) - 97;
  ship := substr(fleet, idx + 1, 1);
  if ship = '.' then sh := overlay(sh placing 'o' from idx + 1 for 1); mark := 'o';
  else
    sh := overlay(sh placing 'x' from idx + 1 for 1);
    for i in 0..99 loop if substr(fleet, i + 1, 1) = ship and substr(sh, i + 1, 1) = '.' then sunk := false; end if; end loop;
    if sunk then
      for i in 0..99 loop if substr(fleet, i + 1, 1) = ship then sh := overlay(sh placing '#' from i + 1 for 1); end if; end loop;
      mark := '#';
    else mark := 'x'; end if;
  end if;
  x[seat + 1] := sh;
  return jsonb_build_object('pos', array_to_string(x, '|'), 'mark', mark, 'won', char_length(sh) - char_length(replace(sh, '#', '')) = 17);
end $$;

-- ---------------------------------------------------------------------
--  wspólne: start, ruch, ocena pozycji (legalne ruchy + wynik)
-- ---------------------------------------------------------------------
create or replace function games.tg_start(g text) returns text language sql immutable as $$
  select case g
    when 'chess' then 'RNBQKBNRPPPPPPPP' || repeat('.', 32) || 'pppppppprnbqkbnr|w|KQkq|-1|0|1'
    when 'checkers' then (select string_agg(case when (i / 8 + i % 8) % 2 = 0 and i / 8 <= 2 then 'b'
                                                 when (i / 8 + i % 8) % 2 = 0 and i / 8 >= 5 then 'w' else '.' end, '' order by i)
                          from generate_series(0, 63) i) || '|b|0'
    when 'battleship' then 'place|' || repeat('.', 100) || '|' || repeat('.', 100) || '|0'
    else repeat('.', 42) || '|r|-1' end
$$;
create or replace function games.tg_play(g text, pos text, m text) returns text language sql immutable as $$
  select case g when 'chess' then games.ch_play(pos, m) when 'checkers' then games.ck_play(pos, m) else games.c4_play(pos, m) end
$$;
create or replace function games.tg_legal(g text, pos text) returns text[] language sql immutable as $$
  select case g when 'chess' then games.ch_legal(pos) when 'checkers' then games.ck_legal(pos) when 'battleship' then '{}'::text[] else games.c4_legal(pos) end
$$;
-- strona na ruchu → miejsce (1 = zaczynający)
create or replace function games.tg_seat(g text, pos text) returns int language sql immutable as $$
  select case when split_part(pos, '|', 2) in ('w','r') and g <> 'checkers' or (g = 'checkers' and split_part(pos, '|', 2) = 'b') then 1 else 2 end
$$;
-- klucz pozycji do powtórzeń w szachach (ep tylko, gdy bicie w przelocie jest naprawdę możliwe)
create or replace function games.ch_key(pos text, legal text[]) returns text language sql immutable as $$
  select array_to_string((string_to_array(pos, '|'))[1:3], '|') || '|' ||
    case when split_part(pos, '|', 4)::int >= 0 and exists (
        select 1 from unnest(legal) m where substr(m, 3, 2) = games.ch_sq(split_part(pos, '|', 4)::int)
          and upper(substr(split_part(pos, '|', 1), games.ch_idx(substr(m, 1, 2)) + 1, 1)) = 'P')
      then split_part(pos, '|', 4) else '-' end
$$;
-- ocena nowej pozycji: {legal, result: p1|p2|draw|null, reason, check}
create or replace function games.tg_eval(g text, pos text, reps text[]) returns jsonb
language plpgsql immutable as $$
declare lg text[] := games.tg_legal(g, pos); seat int := games.tg_seat(g, pos); other text := case when seat = 1 then 'p2' else 'p1' end;
        b text := split_part(pos, '|', 1); chk boolean := false; k int; key text;
begin
  if g = 'connect4' then
    if games.c4_win(pos) is not null then return jsonb_build_object('legal', '{}'::text[], 'result', other, 'reason', 'four in a row'); end if;
    if cardinality(lg) = 0 then return jsonb_build_object('legal', lg, 'result', 'draw', 'reason', 'the board is full'); end if;
    return jsonb_build_object('legal', lg, 'result', null);
  elsif g = 'checkers' then
    if cardinality(lg) = 0 then return jsonb_build_object('legal', lg, 'result', other, 'reason',
        case when b !~ case when seat = 1 then '[bB]' else '[wW]' end then 'all pieces captured' else 'no moves left' end); end if;
    if split_part(pos, '|', 3)::int >= 80 then return jsonb_build_object('legal', '{}'::text[], 'result', 'draw', 'reason', '40 moves each without a capture or a man moving'); end if;
    return jsonb_build_object('legal', lg, 'result', null);
  end if;
  k := position(case when seat = 1 then 'K' else 'k' end in b) - 1;
  chk := k >= 0 and games.ch_attacked(b, k, seat = 2);
  if cardinality(lg) = 0 then
    return jsonb_build_object('legal', lg, 'check', chk, 'result', case when chk then other else 'draw' end,
                              'reason', case when chk then 'checkmate' else 'stalemate' end);
  end if;
  if games.ch_insufficient(b) then return jsonb_build_object('legal', '{}'::text[], 'check', chk, 'result', 'draw', 'reason', 'insufficient material'); end if;
  if split_part(pos, '|', 5)::int >= 100 then return jsonb_build_object('legal', '{}'::text[], 'check', chk, 'result', 'draw', 'reason', '50-move rule'); end if;
  key := games.ch_key(pos, lg);
  if (select count(*) from unnest(reps) x where x = key) >= 3 then
    return jsonb_build_object('legal', '{}'::text[], 'check', chk, 'result', 'draw', 'reason', 'threefold repetition'); end if;
  return jsonb_build_object('legal', lg, 'check', chk, 'result', null);
end $$;

-- ---------------------------------------------------------------------
--  stoły: pomocnicze
-- ---------------------------------------------------------------------
-- walidacja nicku (te same zasady co w pokojach: filtr, zarezerwowane nicki z Discorda)
create or replace function games.valid_nick(u uuid, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare d jsonb := games.discord_identity(u); prof games.profiles; nick text := trim(coalesce(p_nick, '')); k text;
begin
  if d is not null then
    select * into prof from games.profiles where user_id = u;
    if prof.user_id is not null and (nick = '' or games.nick_key(nick) = prof.nick_key) then nick := prof.nick; end if;
  end if;
  if nick = '' then raise exception 'Enter a nickname'; end if;
  if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]{2,20}$' then
    raise exception 'Nickname: 2–20 characters, letters, digits, space, _ . -'; end if;
  if games.is_profane(nick) then raise exception 'That nickname did not pass the filter. Pick another one.'; end if;
  k := games.nick_key(nick);
  if char_length(k) < 2 then raise exception 'Nickname is too short'; end if;
  if exists (select 1 from games.profiles where nick_key = k and user_id <> u) then
    raise exception 'That nickname is reserved by a verified (Discord) player'; end if;
  if d is not null then
    insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name) values (u, nick, k, d->>'id', d->>'name')
    on conflict (user_id) do update set nick = excluded.nick, nick_key = excluded.nick_key, discord_name = excluded.discord_name;
  end if;
  return jsonb_build_object('nick', nick, 'key', k, 'verified', d is not null);
end $$;

create or replace function games.tnotify(p_code text, p_event text default 'state') returns void
language plpgsql security definer set search_path = '' as $$
declare v bigint;
begin
  update games.tables set version = version + 1, updated_at = now() where code = p_code returning version into v;
  perform realtime.send(jsonb_build_object('code', p_code, 'v', v), p_event, 'table:' || p_code, true);
end $$;

create or replace function games.tsys(p_code text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare m jsonb;
begin
  insert into games.table_messages(table_code, kind, body) values (p_code, 'system', p_body)
  returning jsonb_build_object('id', id, 'kind', kind, 'body', body, 'nick', null, 'at', created_at) into m;
  perform realtime.send(jsonb_build_object('code', p_code, 'msg', m), 'msg', 'table:' || p_code, true);
end $$;

create or replace function games.tseat_name(g text, seat int) returns text language sql immutable as $$
  select case g when 'chess' then (array['White','Black'])[seat] when 'checkers' then (array['Black','White'])[seat]
                when 'battleship' then (array['Blue','Orange'])[seat] else (array['Red','Yellow'])[seat] end
$$;
create or replace function games.tgame_name(g text) returns text language sql immutable as $$
  select case g when 'chess' then 'Chess' when 'checkers' then 'Checkers' when 'battleship' then 'Sea Battle' else 'Connect Four' end $$;

create or replace function games.tc_label(g text, base int, inc int, mv int) returns text language sql immutable as $$
  select case when g = 'chess' then
           case when coalesce(base, 0) = 0 then 'No clock'
                else coalesce(case (base, inc) when (60, 0) then 'Bullet ' when (120, 1) then 'Bullet ' when (180, 2) then 'Blitz '
                                   when (300, 0) then 'Blitz ' when (600, 0) then 'Rapid ' when (900, 10) then 'Rapid ' end, 'Custom ')
                     || (base / 60) || '+' || inc end
         else case when coalesce(mv, 0) = 0 then 'No move limit' else mv || 's per move' end end
$$;

-- zegar na teraz (czas serwera): szachy → pozostały czas obu stron w ms; warcaby / C4 → czas na bieżący ruch.
-- Szachy: zegar rusza po pierwszym ruchu każdej strony (jak na lichess): białe – po pierwszym ruchu czarnych, czarne – po drugim ruchu białych.
-- Na pierwszy ruch każda strona ma table_first_move_seconds; bez niego partia jest przerywana (bez wyniku).
create or replace function games.tclock(t games.tables) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare el int := 0; running int; fm int := (select table_first_move_seconds from games.config where id = 1);
        since int := (extract(epoch from now() - coalesce(t.move_at, now())) * 1000)::int;
begin
  if t.game = 'battleship' and split_part(t.pos, '|', 1) = 'place' then   -- Sea Battle: czas na rozstawienie floty (zawsze)
    return jsonb_build_object('kind', 'place', 'running', null, 'ready', split_part(t.pos, '|', 4)::int,
      'left', case when t.status = 'playing' then greatest(0, (select table_place_seconds from games.config where id = 1) * 1000 - since) end);
  end if;
  if t.game = 'chess' and t.tc_base > 0 then
    running := case when t.status = 'playing' and cardinality(t.history) >= 2 then t.turn end;
    if running is not null then el := (extract(epoch from now() - t.clock_at) * 1000)::int; end if;
    return jsonb_build_object('kind', 'clock', 'running', running,
      'left', jsonb_build_array(greatest(0, t.clock1 - case when running = 1 then el else 0 end),
                                greatest(0, t.clock2 - case when running = 2 then el else 0 end)),
      'first_move_left', case when t.status = 'playing' and cardinality(t.history) < 2 then greatest(0, fm * 1000 - since) end);
  elsif t.tc_move > 0 then
    return jsonb_build_object('kind', 'move', 'per_move', t.tc_move, 'running', case when t.status = 'playing' then t.turn end,
      'left', case when t.status = 'playing' then greatest(0, t.tc_move * 1000 - since) end);
  end if;
  return null;
end $$;

-- spadnięcie flagi (sprawdzane czasem serwera): przy ruchu, przy każdym odświeżeniu stanu, przez gry_table_flag i w sprzątaniu
create or replace function games.ttime(p_code text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare t games.tables; c jsonb; n text;
begin
  select * into t from games.tables where code = p_code for update;
  if not found or t.status <> 'playing' then return false; end if;
  c := games.tclock(t);
  if c is null then return false; end if;
  if c->>'kind' = 'place' then
    if (c->>'left')::int > 0 then return false; end if;
    if (c->>'ready')::int = 0 then perform games.tfinish(p_code, null, 'nobody placed the ships in time'); return true; end if;
    select nick into n from games.table_members where table_code = p_code and user_id = case when (c->>'ready')::int = 1 then t.p2 else t.p1 end;
    perform games.tfinish(p_code, case when (c->>'ready')::int = 1 then 'p1' else 'p2' end, coalesce(n, 'opponent') || ' did not place the ships in time');
    return true;
  end if;
  if c->>'kind' = 'clock' then
    if c ? 'first_move_left' and jsonb_typeof(c->'first_move_left') = 'number' then
      if (c->>'first_move_left')::int > 0 then return false; end if;
      select nick into n from games.table_members where table_code = p_code and user_id = case when t.turn = 1 then t.p1 else t.p2 end;
      perform games.tfinish(p_code, null, coalesce(n, games.tseat_name(t.game, t.turn)) || ' did not make a first move');
      return true;
    end if;
    if (c->'left'->>(t.turn - 1))::int > 0 then return false; end if;
  elsif (c->>'left')::int > 0 then return false;
  end if;
  select nick into n from games.table_members where table_code = p_code and user_id = case when t.turn = 1 then t.p1 else t.p2 end;
  n := coalesce(n, games.tseat_name(t.game, t.turn));
  if t.game = 'chess' and not games.ch_can_mate(split_part(t.pos, '|', 1), t.turn = 2) then
    perform games.tfinish(p_code, 'draw', n || ' ran out of time, opponent cannot mate');
  else
    perform games.tfinish(p_code, case when t.turn = 1 then 'p2' else 'p1' end, n || ' ran out of time');
  end if;
  return true;
end $$;

-- koniec partii (p_result null = partia przerwana, bez wyniku)
create or replace function games.tfinish(p_code text, p_result text, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare t games.tables; wn text; c jsonb;
begin
  select * into t from games.tables where code = p_code;
  c := games.tclock(t);   -- zegar szachowy zatrzymany: zapisujemy pozostały czas
  update games.tables set status = 'finished', result = p_result, reason = p_reason, legal = '{}', draw_offer = null, rematch = 0,
         clock1 = case when c->>'kind' = 'clock' then (c->'left'->>0)::int else clock1 end,
         clock2 = case when c->>'kind' = 'clock' then (c->'left'->>1)::int else clock2 end
   where code = p_code;
  if p_result is null then
    perform games.tsys(p_code, 'Game aborted (' || p_reason || ')');
  elsif p_result = 'draw' then
    perform games.tsys(p_code, 'Draw (' || p_reason || ')');
  else
    select nick into wn from games.table_members where table_code = p_code and user_id = case when p_result = 'p1' then t.p1 else t.p2 end;
    perform games.tsys(p_code, coalesce(wn, games.tseat_name(t.game, case when p_result = 'p1' then 1 else 2 end)) || ' wins (' || p_reason || ')');
  end if;
end $$;

-- walkower za nieobecność (> table_forfeit_seconds) i zamykanie pustych stołów
create or replace function games.tcheck(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare t games.tables; fs int := (select table_forfeit_seconds from games.config where id = 1);
        a1 boolean; a2 boolean; n text;
begin
  select * into t from games.tables where code = p_code for update;
  if t.status <> 'playing' then return; end if;
  if games.ttime(p_code) then perform games.tnotify(p_code); return; end if;
  select coalesce(bool_or(m.left_at is null and m.last_seen > now() - make_interval(secs => fs)), false) into a1
    from games.table_members m where m.table_code = p_code and m.user_id = t.p1;
  select coalesce(bool_or(m.left_at is null and m.last_seen > now() - make_interval(secs => fs)), false) into a2
    from games.table_members m where m.table_code = p_code and m.user_id = t.p2;
  if a1 and a2 then return; end if;
  if not a1 and not a2 then
    perform games.tfinish(p_code, 'draw', 'both players left');
  else
    select nick into n from games.table_members where table_code = p_code and user_id = case when a1 then t.p2 else t.p1 end;
    perform games.tfinish(p_code, case when a1 then 'p1' else 'p2' end, coalesce(n, 'opponent') || ' left the table');
  end if;
  perform games.tnotify(p_code);
end $$;

create or replace function games.tables_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
declare im int := (select table_idle_minutes from games.config where id = 1);
        fs int := (select table_forfeit_seconds from games.config where id = 1); c text;
begin
  for c in select t.code from games.tables t where t.status = 'playing' and exists (
             select 1 from games.table_members m where m.table_code = t.code and m.user_id in (t.p1, t.p2)
               and (m.left_at is not null or m.last_seen < now() - make_interval(secs => fs))) loop
    perform games.tcheck(c);
  end loop;
  for c in select t.code from games.tables t where t.status = 'playing' and (t.tc_base > 0 or t.tc_move > 0) loop
    perform games.tcheck(c);   -- flaga spada także wtedy, gdy nikt nie odświeża stołu
  end loop;
  -- nikt aktywny przy stole przez table_idle_minutes → zamknięty; czekający stół bez nikogo przy nim po 3 min też
  update games.tables t set status = 'closed', updated_at = now()
   where t.status in ('waiting','playing','finished')
     and not exists (select 1 from games.table_members m where m.table_code = t.code and m.left_at is null
                       and m.last_seen > now() - case when t.status = 'waiting' then make_interval(secs => fs) else make_interval(mins => im) end);
  -- dane minimalne: zamknięte stoły (z czatem i listą osób) usuwane po godzinie
  delete from games.tables where status = 'closed' and updated_at < now() - interval '1 hour';
end $$;

-- ---------------------------------------------------------------------
--  API stołów
-- ---------------------------------------------------------------------
drop function if exists public.gry_table_create(text, text, boolean, boolean);   -- stara sygnatura (bez zegara)
drop function if exists public.gry_table_create(text, text, boolean, boolean, int, int, int);   -- v2 (bez Sea Battle)
-- p_minutes / p_increment: szachy (0 = bez zegara; 1–60 min, 0–30 s dodatku); p_move_seconds: warcaby / C4 (0, 30, 60)
create or replace function public.gry_table_create(p_game text, p_nick text, p_private boolean default false, p_spectators boolean default true,
                                                   p_minutes int default 0, p_increment int default 0, p_move_seconds int default 0,
                                                   p_no_touch boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); cfg games.config; ip text; c text; existing text; nk jsonb; i int; len int;
        alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; st text;
        v_base int := 0; v_inc int := 0; v_mv int := 0;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  if p_game not in ('chess','checkers','connect4','battleship') then raise exception 'Unknown game'; end if;
  if p_game = 'chess' then
    if coalesce(p_minutes, 0) not between 0 and 60 then raise exception 'Clock: 1–60 minutes per player'; end if;
    if coalesce(p_increment, 0) not between 0 and 30 then raise exception 'Increment: 0–30 seconds'; end if;
    v_base := coalesce(p_minutes, 0) * 60; v_inc := case when v_base > 0 then coalesce(p_increment, 0) else 0 end;
  else
    if coalesce(p_move_seconds, 0) not in (0, 30, 60) then raise exception 'Move timer: no limit, 30 s or 60 s'; end if;
    v_mv := coalesce(p_move_seconds, 0);
  end if;
  nk := games.valid_nick(u, p_nick);
  perform games.tables_cleanup();
  select * into cfg from games.config where id = 1;
  ip := games.client_ip_hash();
  select t.code into existing from games.tables t join games.table_members m on m.table_code = t.code and m.user_id = u and m.left_at is null
   where t.creator_id = u and t.status <> 'closed' order by t.created_at desc limit 1;
  if existing is not null and (select count(*) from games.tables t join games.table_members m on m.table_code = t.code and m.user_id = u and m.left_at is null
                               where t.creator_id = u and t.status <> 'closed') >= cfg.tables_per_user then
    raise exception 'You already have an open table (%). Go back to it or leave it first.', existing; end if;
  if (select count(*) from games.tables where creator_id = u and created_at > now() - interval '1 hour') >= cfg.table_creates_per_hour then
    raise exception 'You created too many tables. Try again later.'; end if;
  if ip is not null and (select count(*) from games.tables where creator_ip = ip and status <> 'closed') >= cfg.tables_per_ip then
    raise exception 'Too many open tables from your network. Join one of them instead.'; end if;
  if (select count(*) from games.tables where status <> 'closed') >= cfg.tables_total then
    raise exception 'All tables are busy right now. Join an open one!'; end if;
  len := case when coalesce(p_private, false) then 8 else 6 end;   -- prywatne: dłuższy kod (trudny do zgadnięcia)
  loop
    c := '';
    for i in 1..len loop c := c || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from games.tables where code = c);
  end loop;
  st := games.tg_start(p_game);
  insert into games.tables(code, game, private, spectators, creator_id, creator_ip, p1, pos, turn, legal, reps, tc_base, tc_inc, tc_move, clock1, clock2, bs_notouch)
  values (c, p_game, coalesce(p_private, false), coalesce(p_spectators, true), u, ip, u, st, 1, games.tg_legal(p_game, st),
          case when p_game = 'chess' then array[games.ch_key(st, games.tg_legal(p_game, st))] else '{}' end,
          v_base, v_inc, v_mv, v_base * 1000, v_base * 1000, p_game = 'battleship' and coalesce(p_no_touch, false));
  insert into games.table_members(table_code, user_id, nick, nick_key, verified) values (c, u, nk->>'nick', nk->>'key', (nk->>'verified')::boolean);
  perform games.tsys(c, (nk->>'nick') || ' opened a ' || games.tgame_name(p_game) || ' table and plays ' || games.tseat_name(p_game, 1)
                          || ' · ' || games.tc_label(p_game, v_base, v_inc, v_mv)
                          || case when p_game = 'battleship' and coalesce(p_no_touch, false) then ' · no-touch rule' else '' end);
  return c;
end $$;

create or replace function public.gry_table_state(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; me games.table_members; seat int; cfg games.config; fs int; joined boolean;
begin
  select * into t from games.tables where code = upper(p_code);
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  select * into me from games.table_members where table_code = t.code and user_id = u;
  joined := me.user_id is not null and me.left_at is null;
  if joined then
    update games.table_members set last_seen = now() where table_code = t.code and user_id = u;
    if t.status = 'playing' then perform games.tcheck(t.code); select * into t from games.tables where code = t.code; end if;
  end if;
  select * into cfg from games.config where id = 1; fs := cfg.table_forfeit_seconds;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  return jsonb_build_object(
    'now', now(),
    'table', jsonb_build_object('code', t.code, 'game', t.game, 'private', t.private, 'spectators', t.spectators, 'status', t.status,
        'turn', t.turn, 'last_move', t.last_move, 'result', t.result, 'reason', t.reason, 'draw_offer', t.draw_offer, 'rematch', t.rematch,
        'game_no', t.game_no, 'version', t.version, 'creator_id', t.creator_id, 'move_at', t.move_at,
        -- pozycja i lista ruchów tylko dla osób przy stole (gracze + widzowie)
        'pos', case when joined then t.pos end, 'moves', case when joined then to_jsonb(t.history) end,
        'legal', case when joined and t.status = 'playing' then to_jsonb(t.legal) end,
        'check', case when joined and t.game = 'chess' then
            games.ch_attacked(split_part(t.pos, '|', 1), position(case when t.turn = 1 then 'K' else 'k' end in split_part(t.pos, '|', 1)) - 1, t.turn = 2) end,
        'win_line', case when t.game = 'connect4' and t.result in ('p1','p2') then to_jsonb(games.c4_win(t.pos)) end,
        'tc', jsonb_build_object('base', t.tc_base, 'inc', t.tc_inc, 'move', t.tc_move, 'label', games.tc_label(t.game, t.tc_base, t.tc_inc, t.tc_move)),
        'no_touch', t.bs_notouch),
    -- Sea Battle: własna flota tylko dla właściciela; obie floty dla wszystkich dopiero po końcu partii
    'fleet', case when t.game = 'battleship' and seat is not null and joined then
        (select f.fleet from games.table_fleets f where f.table_code = t.code and f.seat = (case when u = t.p1 then 1 else 2 end)) end,
    'fleets', case when t.game = 'battleship' and joined and t.status = 'finished' then
        (select jsonb_object_agg(f.seat::text, f.fleet) from games.table_fleets f where f.table_code = t.code) end,
    'clock', games.tclock(t),
    'players', (select coalesce(jsonb_agg(jsonb_build_object('seat', s.seat, 'color', games.tseat_name(t.game, s.seat), 'user_id', m.user_id,
          'nick', m.nick, 'verified', m.verified, 'left', m.left_at is not null,
          'active', m.left_at is null and m.last_seen > now() - interval '45 seconds',
          'away_for', greatest(0, extract(epoch from now() - m.last_seen))::int) order by s.seat), '[]'::jsonb)
        from (values (1, t.p1), (2, t.p2)) s(seat, uid) join games.table_members m on m.table_code = t.code and m.user_id = s.uid),
    'spectators', (select coalesce(jsonb_agg(jsonb_build_object('nick', m.nick, 'verified', m.verified) order by m.seq), '[]'::jsonb)
        from games.table_members m where m.table_code = t.code and m.left_at is null and m.user_id is distinct from t.p1
          and m.user_id is distinct from t.p2 and m.last_seen > now() - interval '45 seconds'),
    'me', jsonb_build_object('user_id', u, 'joined', joined, 'seat', seat, 'nick', me.nick,
        'cooldown_left', case when me.last_msg_at is null then 0 else
            greatest(0, extract(epoch from me.last_msg_at + make_interval(secs => cfg.table_message_cooldown_seconds) - now()))::float8 end),
    'forfeit_seconds', fs, 'cooldown', cfg.table_message_cooldown_seconds,
    'messages', case when joined then coalesce((select jsonb_agg(x order by (x->>'id')::bigint) from (
        select jsonb_build_object('id', m.id, 'kind', m.kind, 'nick', m.nick, 'user_id', m.user_id, 'body', m.body, 'at', m.created_at) x
        from games.table_messages m where m.table_code = t.code order by m.id desc limit 50) q), '[]'::jsonb) else '[]'::jsonb end);
end $$;

create or replace function public.gry_table_join(p_code text, p_nick text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; me games.table_members; nk jsonb; seat int; specs int;
begin
  if u is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into t from games.tables where code = upper(p_code) for update;
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  select * into me from games.table_members where table_code = t.code and user_id = u;
  nk := games.valid_nick(u, coalesce(nullif(trim(coalesce(p_nick, '')), ''), me.nick));
  if exists (select 1 from games.table_members m where m.table_code = t.code and m.nick_key = nk->>'key' and m.user_id <> u
             and m.left_at is null and m.last_seen > now() - interval '45 seconds') then
    raise exception 'Someone at this table already uses that nickname'; end if;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null and t.status = 'waiting' then
    seat := case when t.p1 is null then 1 when t.p2 is null then 2 end;
  end if;
  if seat is null and (me.user_id is null or me.left_at is not null) then
    if not t.spectators then raise exception 'This table is full (no spectators allowed)'; end if;
    select count(*) into specs from games.table_members m where m.table_code = t.code and m.left_at is null
       and m.user_id is distinct from t.p1 and m.user_id is distinct from t.p2 and m.last_seen > now() - interval '45 seconds';
    if specs >= (select table_max_spectators from games.config where id = 1) then raise exception 'This table has too many spectators right now'; end if;
  end if;
  insert into games.table_members(table_code, user_id, nick, nick_key, verified)
  values (t.code, u, nk->>'nick', nk->>'key', (nk->>'verified')::boolean)
  on conflict (table_code, user_id) do update set nick = excluded.nick, nick_key = excluded.nick_key, verified = excluded.verified,
    left_at = null, last_seen = now();
  if seat = 1 and t.p1 is null then update games.tables set p1 = u where code = t.code; end if;
  if seat = 2 and t.p2 is null then update games.tables set p2 = u where code = t.code; end if;
  select * into t from games.tables where code = t.code;
  if me.user_id is null or me.left_at is not null then
    if seat is null then perform games.tsys(t.code, (nk->>'nick') || ' is watching');
    else perform games.tsys(t.code, (nk->>'nick') || ' sat down as ' || games.tseat_name(t.game, seat)); end if;
  end if;
  if t.status = 'waiting' and t.p1 is not null and t.p2 is not null then
    update games.tables set status = 'playing', move_at = now() where code = t.code;
    perform games.tsys(t.code, case when t.game = 'battleship' then 'Game on! Both players: place your ships.'
                                    else 'Game on! ' || games.tseat_name(t.game, 1) || ' moves first.' end);
  end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

create or replace function public.gry_table_move(p_code text, p_move text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; np text; ev jsonb; v_reps text[]; mv text := lower(trim(coalesce(p_move, '')));
        c1 int; c2 int; cat timestamptz; el int;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null then raise exception 'Spectators can''t move'; end if;
  if not exists (select 1 from games.table_members m where m.table_code = t.code and m.user_id = u and m.left_at is null) then
    raise exception 'You left this table'; end if;
  if t.status <> 'playing' then raise exception 'The game is not running'; end if;
  if t.turn <> seat then raise exception 'Not your turn'; end if;
  -- czas skończył się przed ruchem → partia przegrana na czas (bez wyjątku, żeby wynik został zapisany)
  if games.ttime(t.code) then perform games.tnotify(t.code); return public.gry_table_state(t.code); end if;
  if not (mv = any(t.legal)) then raise exception 'Illegal move'; end if;
  if t.game = 'battleship' then   -- strzał rozstrzyga serwer na podstawie tajnej floty przeciwnika
    select f.fleet into np from games.table_fleets f where f.table_code = t.code and f.seat = (case when u = t.p1 then 2 else 1 end);
    ev := games.bs_shot(t.pos, np, seat, mv);
    update games.table_members set last_seen = now() where table_code = t.code and user_id = u;
    update games.tables set pos = ev->>'pos', turn = 3 - seat, last_move = mv || (ev->>'mark'), history = history || (mv || (ev->>'mark')),
           legal = games.bs_legal(ev->>'pos', 3 - seat), draw_offer = null, move_at = now()
     where code = t.code;
    if (ev->>'won')::boolean then perform games.tfinish(t.code, case when seat = 1 then 'p1' else 'p2' end, 'whole fleet sunk'); end if;
    perform games.tnotify(t.code);
    return public.gry_table_state(t.code);
  end if;
  c1 := t.clock1; c2 := t.clock2; cat := t.clock_at;
  if t.game = 'chess' and t.tc_base > 0 then
    if cardinality(t.history) >= 2 then   -- zegar tej strony biegł: odejmujemy czas serwera, dodajemy dodatek
      el := (extract(epoch from now() - t.clock_at) * 1000)::int;
      if seat = 1 then c1 := c1 - el + t.tc_inc * 1000; else c2 := c2 - el + t.tc_inc * 1000; end if;
    end if;
    cat := now();
  end if;
  np := games.tg_play(t.game, t.pos, mv);
  v_reps := t.reps;
  if t.game = 'chess' then
    if split_part(np, '|', 5)::int = 0 then v_reps := '{}'; end if;   -- ruch nieodwracalny: powtórzenia liczone od nowa
    v_reps := v_reps || games.ch_key(np, games.ch_legal(np));
  end if;
  ev := games.tg_eval(t.game, np, v_reps);
  update games.table_members set last_seen = now() where table_code = t.code and user_id = u;
  update games.tables set pos = np, turn = 3 - seat, last_move = mv, history = history || mv, reps = v_reps,
         legal = array(select jsonb_array_elements_text(ev->'legal')), draw_offer = null, move_at = now(),
         clock1 = c1, clock2 = c2, clock_at = cat
   where code = t.code;
  if ev->>'result' is not null then perform games.tfinish(t.code, ev->>'result', ev->>'reason'); end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

create or replace function public.gry_table_resign(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; n text;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null then raise exception 'Only players can resign'; end if;
  if t.status <> 'playing' then raise exception 'The game is not running'; end if;
  select nick into n from games.table_members where table_code = t.code and user_id = u;
  perform games.tfinish(t.code, case when seat = 1 then 'p2' else 'p1' end, n || ' resigned');
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

-- „flaga”: każdy (gracz albo widz) może poprosić serwer o sprawdzenie czasu; serwer liczy wg własnego zegara
create or replace function public.gry_table_flag(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare t games.tables;
begin
  if auth.uid() is null then raise exception 'Join as a guest or log in with Discord first'; end if;
  select * into t from games.tables where code = upper(p_code);
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  if t.status = 'playing' then perform games.tcheck(t.code); end if;
  return public.gry_table_state(t.code);
end $$;

-- Sea Battle: rozstawienie floty (raz na partię; drugi gotowy gracz rozpoczyna ostrzał, gracz 1 strzela pierwszy)
create or replace function public.gry_table_fleet(p_code text, p_ships text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; v_seat int; fl text; rd int; n text; x text[];
begin
  select * into t from games.tables where code = upper(p_code) for update;
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  if t.game <> 'battleship' then raise exception 'Not a Sea Battle table'; end if;
  v_seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if v_seat is null then raise exception 'Only players place ships'; end if;
  if t.status <> 'playing' then raise exception 'The game is not running'; end if;
  if games.ttime(t.code) then perform games.tnotify(t.code); return public.gry_table_state(t.code); end if;
  if split_part(t.pos, '|', 1) <> 'place' then raise exception 'Ships are already placed'; end if;
  rd := split_part(t.pos, '|', 4)::int;
  if rd & v_seat > 0 then raise exception 'Your fleet is already placed'; end if;
  fl := games.bs_parse(p_ships, t.bs_notouch);
  insert into games.table_fleets(table_code, seat, fleet) values (t.code, v_seat, fl)
  on conflict (table_code, seat) do update set fleet = excluded.fleet, created_at = now();
  rd := rd | v_seat; x := string_to_array(t.pos, '|'); x[4] := rd::text;
  select nick into n from games.table_members where table_code = t.code and user_id = u;
  update games.table_members set last_seen = now() where table_code = t.code and user_id = u;
  if rd = 3 then
    x[1] := 'fire';
    update games.tables set pos = array_to_string(x, '|'), turn = 1, legal = games.bs_legal(array_to_string(x, '|'), 1), move_at = now() where code = t.code;
    perform games.tsys(t.code, n || ' is ready. All ships placed — ' ||
      coalesce((select nick from games.table_members where table_code = t.code and user_id = t.p1), 'Blue') || ' fires first.');
  else
    update games.tables set pos = array_to_string(x, '|') where code = t.code;
    perform games.tsys(t.code, n || ' placed the ships');
  end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

-- p_action: offer | accept | decline
create or replace function public.gry_table_draw(p_code text, p_action text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; n text;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null then raise exception 'Only players can do that'; end if;
  if t.status <> 'playing' then raise exception 'The game is not running'; end if;
  if t.game = 'battleship' then raise exception 'There are no draws in Sea Battle'; end if;
  select nick into n from games.table_members where table_code = t.code and user_id = u;
  if p_action = 'offer' then
    if t.draw_offer = seat then return public.gry_table_state(t.code); end if;
    if t.draw_offer = 3 - seat then p_action := 'accept';
    else
      update games.tables set draw_offer = seat where code = t.code;
      perform games.tsys(t.code, n || ' offers a draw');
    end if;
  end if;
  if p_action = 'accept' then
    if t.draw_offer is distinct from 3 - seat then raise exception 'There is no draw offer to accept'; end if;
    perform games.tfinish(t.code, 'draw', 'agreed');
  elsif p_action = 'decline' then
    if t.draw_offer is distinct from 3 - seat then raise exception 'There is no draw offer to decline'; end if;
    update games.tables set draw_offer = null where code = t.code;
    perform games.tsys(t.code, n || ' declined the draw');
  elsif p_action <> 'offer' then raise exception 'Unknown action';
  end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

-- rewanż: obaj gracze klikają → nowa partia, kolory zamienione
create or replace function public.gry_table_rematch(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; bits int; n text; st text;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is null then raise exception 'Only players can ask for a rematch'; end if;
  if t.status <> 'finished' then raise exception 'The game is still running'; end if;
  if exists (select 1 from games.table_members m where m.table_code = t.code and m.user_id = case when seat = 1 then t.p2 else t.p1 end
             and (m.left_at is not null or m.last_seen < now() - interval '2 minutes')) then
    raise exception 'Your opponent left the table'; end if;
  bits := t.rematch | (case when seat = 1 then 1 else 2 end);
  select nick into n from games.table_members where table_code = t.code and user_id = u;
  if bits = 3 then
    st := games.tg_start(t.game);
    delete from games.table_fleets where table_code = t.code;
    update games.tables set p1 = t.p2, p2 = t.p1, pos = st, turn = 1, legal = games.tg_legal(t.game, st), last_move = null,
           history = '{}', reps = case when t.game = 'chess' then array[games.ch_key(st, games.tg_legal(t.game, st))] else '{}' end, result = null, reason = null, draw_offer = null, rematch = 0, game_no = game_no + 1,
           status = 'playing', move_at = now(), clock1 = t.tc_base * 1000, clock2 = t.tc_base * 1000, clock_at = null
     where code = t.code;
    perform games.tsys(t.code, 'Rematch! Colors swapped: ' ||
      (select nick from games.table_members where table_code = t.code and user_id = t.p2) || ' plays ' || games.tseat_name(t.game, 1) || ' now.');
  else
    update games.tables set rematch = bits where code = t.code;
    perform games.tsys(t.code, n || ' wants a rematch');
  end if;
  perform games.tnotify(t.code);
  return public.gry_table_state(t.code);
end $$;

create or replace function public.gry_table_leave(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; seat int; n text;
begin
  select * into t from games.tables where code = upper(p_code) for update;
  if not found then return; end if;
  update games.table_members set left_at = now() where table_code = t.code and user_id = u and left_at is null returning nick into n;
  if n is null then return; end if;
  seat := case when u = t.p1 then 1 when u = t.p2 then 2 end;
  if seat is not null and t.status = 'playing' then
    perform games.tfinish(t.code, case when seat = 1 then 'p2' else 'p1' end, n || ' left the table');
  elsif seat is not null and t.status = 'waiting' then
    update games.tables set p1 = case when seat = 1 then null else p1 end, p2 = case when seat = 2 then null else p2 end where code = t.code;
  end if;
  perform games.tsys(t.code, n || ' left');
  if not exists (select 1 from games.table_members m where m.table_code = t.code and m.left_at is null) then
    update games.tables set status = 'closed' where code = t.code;
  end if;
  perform games.tnotify(t.code);
end $$;

create or replace function public.gry_table_chat(p_code text, p_text text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); t games.tables; me games.table_members; txt text := trim(coalesce(p_text, ''));
        cd int := greatest(coalesce((select table_message_cooldown_seconds from games.config where id = 1), 0), 0); m jsonb;
begin
  select * into t from games.tables where code = upper(p_code);
  if not found or t.status = 'closed' then raise exception 'This table does not exist or is closed'; end if;
  select * into me from games.table_members where table_code = t.code and user_id = u for update;
  if me.user_id is null or me.left_at is not null then raise exception 'Join the table first'; end if;
  if txt = '' then return jsonb_build_object('ok', false); end if;
  if cd > 0 and me.last_msg_at is not null and me.last_msg_at > now() - make_interval(secs => cd) then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from me.last_msg_at + make_interval(secs => cd) - now()))::int);
  end if;
  update games.table_members set last_msg_at = now(), last_seen = now() where table_code = t.code and user_id = u;
  insert into games.table_messages(table_code, user_id, nick, body) values (t.code, u, me.nick, games.clean_text(left(txt, 200)))
  returning jsonb_build_object('id', id, 'kind', kind, 'nick', nick, 'user_id', user_id, 'body', body, 'at', created_at) into m;
  perform realtime.send(jsonb_build_object('code', t.code, 'msg', m), 'msg', 'table:' || t.code, true);
  return jsonb_build_object('ok', true, 'msg', m);
end $$;

-- lobby: publiczne stoły (prywatnych nie widać)
create or replace function public.gry_tables_lobby() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform games.tables_cleanup();
  return coalesce((select jsonb_agg(x order by x->>'status' desc, x->>'created_at' desc) from (
    select jsonb_build_object('code', t.code, 'game', t.game, 'status', t.status, 'spectators', t.spectators, 'created_at', t.created_at,
      'tc', games.tc_label(t.game, t.tc_base, t.tc_inc, t.tc_move), 'timed', t.tc_base > 0 or t.tc_move > 0, 'no_touch', t.bs_notouch,
      'creator', (select m.nick from games.table_members m where m.table_code = t.code and m.user_id = t.creator_id),
      'players', (select jsonb_agg(m.nick order by case when m.user_id = t.p1 then 1 else 2 end) from games.table_members m
                  where m.table_code = t.code and m.user_id in (t.p1, t.p2)),
      'watching', (select count(*) from games.table_members m where m.table_code = t.code and m.left_at is null
                   and m.user_id is distinct from t.p1 and m.user_id is distinct from t.p2 and m.last_seen > now() - interval '45 seconds')) x
    from games.tables t where not t.private and t.status in ('waiting','playing','finished') order by t.created_at desc limit 50) q), '[]'::jsonb);
end $$;
-- <<< TABLE GAMES

-- ---------- uprawnienia do kanałów Realtime (używane w politykach realtime.messages) ----------
-- topic: room:KOD (tylko odczyt), draw:KOD:TURA (pisze tylko rysujący), img:KOD:TURA (pisze tylko host)
create or replace function public.gry_can_access(p_topic text, p_write boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); parts text[] := string_to_array(p_topic, ':'); r games.rooms;
begin
  if u is null or array_length(parts, 1) < 2 then return false; end if;
  -- table:KOD — stoły (gracze i widzowie czytają; nikt nie pisze bezpośrednio, ruchy idą przez RPC)
  if parts[1] = 'table' then
    return not p_write and exists (select 1 from games.table_members m join games.tables t on t.code = m.table_code
                                   where m.table_code = parts[2] and m.user_id = u and m.left_at is null and t.status <> 'closed');
  end if;
  -- tycoon:KOD — Frog Tycoon (supabase/tycoon.sql): read only, for players + spectators at the table
  if parts[1] = 'tycoon' then
    return not p_write and games.tycoon_can_read(parts[2], u);
  end if;
  select * into r from games.rooms where code = parts[2];
  if not found then return false; end if;
  if not exists (select 1 from games.players p where p.room_code = r.code and p.user_id = u and not p.kicked) then
    return false; end if;
  if not p_write then return parts[1] in ('room','draw','img'); end if;
  if parts[1] = 'draw' then
    return r.mode = 'kalambury' and r.phase = 'turn' and r.drawer_id = u and r.turn_id::text = parts[3];
  elsif parts[1] = 'img' then
    return r.mode = 'obrazek' and r.host_id = u and r.turn_id::text = parts[3];
  end if;
  return false;
end $$;

-- ---------- uprawnienia: tylko funkcje gry_* są wywoływalne ----------
do $$ declare f regprocedure; begin
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'games' loop
    execute format('revoke all on function %s from public', f);
  end loop;
  for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'gry\_%' loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
grant execute on function public.gry_lobby(), public.gry_ranking(text), public.gry_hall_of_fame(),
  public.gry_recent_games(int), public.gry_season(), public.gry_tables_lobby() to anon;

-- ---------- migracja: Draw & Guess bez trwałego rankingu (idempotentne) ----------
update games.rooms x set match_id = null where x.mode = 'kalambury' and x.match_id in (select id from games.matches where mode = 'kalambury');
delete from games.used_words w using games.matches m where m.id = w.match_id and m.mode = 'kalambury';
delete from games.matches where mode = 'kalambury';    -- results: on delete cascade

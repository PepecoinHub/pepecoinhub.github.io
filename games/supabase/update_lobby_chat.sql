-- PEP Games: czat w lobby + licznik „ile osób jest online”. Uruchom RAZ w Supabase → SQL Editor
-- (New query → wklej całość → Run). Bezpieczne do powtórzenia. Jeśli Supabase pokaże „Potential issues detected”,
-- wybierz „Run and enable RLS” (jak przy schema.sql).
--  • czytać może każdy (także niezalogowany), pisać tylko gracz z nickiem (gość) albo z Discorda
--  • tylko tekst i nasze emotki (:pep: itp. rysuje strona); żadnych obrazków ani linków
--  • limit: 1 wiadomość na 3 s i max 20 na 5 minut, do 200 znaków; wulgaryzmy są maskowane gwiazdkami (games.badwords)
--  • najcięższe treści (wykorzystywanie dzieci, terroryzm; lista games.blocked_terms) są odrzucane, a autor
--    dostaje 24 h wyciszenia; wiadomości o seed phrase / kluczach prywatnych są odrzucane (ochrona przed oszustami)
--  • wiadomości znikają po 24 h; host (games.host_discord) może ukryć wiadomość albo wyciszyć gracza
--  • „online” = osoby, które miały otwarte lobby w ciągu ostatnich 90 s (losowy identyfikator przeglądarki, bez IP)

create table if not exists games.lobby_chat (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  nick text not null,
  verified boolean not null default false,
  body text not null,
  created_at timestamptz not null default now(),
  hidden_at timestamptz
);
create index if not exists lobby_chat_created on games.lobby_chat (created_at);
create index if not exists lobby_chat_user on games.lobby_chat (user_id, created_at);
alter table games.lobby_chat enable row level security;

create table if not exists games.lobby_seen (          -- kto ma otwarte lobby (do licznika online), kasowane po 10 min
  visitor text primary key,
  user_id uuid,
  seen_at timestamptz not null default now()
);
alter table games.lobby_seen enable row level security;

create table if not exists games.lobby_mutes (         -- wyciszeni w czacie lobby
  user_id uuid primary key,
  until timestamptz not null,
  reason text
);
alter table games.lobby_mutes enable row level security;

-- Najcięższe treści. how: 'word' = fragment jednego słowa, 'exact' = całe słowo, 'phrase' = w całym tekście bez spacji.
-- Porównanie po games.profanity_key (małe litery, bez znaków, 0→o, 1→i…, bez powtórzonych liter).
create table if not exists games.blocked_terms (
  term text primary key,
  how text not null default 'word' check (how in ('word', 'exact', 'phrase'))
);
alter table games.blocked_terms enable row level security;
insert into games.blocked_terms(term, how) values
  ('pedofil', 'word'), ('pedophil', 'word'), ('paedophil', 'word'), ('lolicon', 'word'), ('shotacon', 'word'),
  ('jailbait', 'word'), ('zoofil', 'word'), ('zoophil', 'word'), ('bestialit', 'word'), ('csam', 'exact'),
  ('childporn', 'phrase'), ('kiddieporn', 'phrase'), ('kiddyporn', 'phrase'), ('childabuse', 'phrase'),
  ('pornodzieci', 'phrase'), ('dzieciporno', 'phrase'), ('pornografiadziecieca', 'phrase'), ('dzieciecapornografia', 'phrase'),
  ('isis', 'exact'), ('daesh', 'word'), ('jihad', 'word'), ('dzihad', 'word'), ('alqaeda', 'phrase'), ('alkaida', 'phrase'),
  ('makeabomb', 'phrase'), ('bombmaking', 'phrase'), ('buildabomb', 'phrase'), ('jakzrobicbombe', 'phrase'), ('zamachbombowy', 'phrase'),
  ('schoolshooting', 'phrase'), ('massshooting', 'phrase'), ('heilhitler', 'phrase'), ('siegheil', 'phrase'), ('1488', 'exact'),
  ('killyourself', 'phrase'), ('zabijsie', 'phrase'), ('kys', 'exact')
on conflict (term) do nothing;

alter table games.config add column if not exists lobby_cleanup_at timestamptz;

create or replace function games.is_blocked(t text) returns boolean
language sql stable security definer set search_path = '' as $$
  with w as (select games.profanity_key(x) k from regexp_split_to_table(coalesce(t, ''), '\s+') x)
  select exists (
    select 1 from games.blocked_terms b
     where (b.how = 'phrase' and position(games.profanity_key(b.term) in games.profanity_key(t)) > 0)
        or (b.how = 'word' and exists (select 1 from w where position(games.profanity_key(b.term) in w.k) > 0))
        or (b.how = 'exact' and exists (select 1 from w where w.k = games.profanity_key(b.term))))
$$;

-- sprzątanie czatu lobby najwyżej raz na minutę (wołane przy odczycie czatu)
create or replace function games.lobby_cleanup() returns void
language plpgsql security definer set search_path = '' as $$
begin
  update games.config set lobby_cleanup_at = now()
   where id = 1 and (lobby_cleanup_at is null or lobby_cleanup_at < now() - interval '60 seconds');
  if not found then return; end if;
  delete from games.lobby_chat where created_at < now() - interval '24 hours';
  delete from games.lobby_seen where seen_at < now() - interval '10 minutes';
  delete from games.lobby_mutes where until < now();
end $$;

-- Odczyt: nowe wiadomości po p_after (max 50 z ostatnich 24 h), ukryte przez hosta, licznik online.
-- p_visitor: losowy identyfikator tej przeglądarki (localStorage), tylko do licznika online.
create or replace function public.gry_lobby_chat(p_after bigint default 0, p_visitor text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); v text := left(trim(coalesce(p_visitor, '')), 40);
begin
  perform games.lobby_cleanup();
  if v ~ '^[A-Za-z0-9-]{8,40}$' then
    insert into games.lobby_seen(visitor, user_id, seen_at) values (v, u, now())
    on conflict (visitor) do update set seen_at = now(), user_id = coalesce(excluded.user_id, games.lobby_seen.user_id)
     where games.lobby_seen.seen_at < now() - interval '15 seconds';
  end if;
  return jsonb_build_object(
    'now', now(),
    'online', (select count(*) from games.lobby_seen where seen_at > now() - interval '90 seconds'),
    'muted_until', (select until from games.lobby_mutes where user_id = u and until > now()),
    'can_mod', u is not null and games.is_host_user(u),
    'hidden', coalesce((select jsonb_agg(id) from games.lobby_chat where hidden_at is not null and id <= coalesce(p_after, 0)
                          and created_at > now() - interval '24 hours'), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'user_id', q.user_id, 'nick', q.nick, 'verified', q.verified,
                                                              'body', q.body, 'at', q.created_at) order by q.id)
                          from (select * from games.lobby_chat
                                 where id > coalesce(p_after, 0) and hidden_at is null and created_at > now() - interval '24 hours'
                                 order by id desc limit 50) q), '[]'::jsonb));
end $$;

-- Wysłanie wiadomości. Nick jak przy wejściu do pokoju: gracz z Discorda pisze swoim zarezerwowanym nickiem.
create or replace function public.gry_lobby_say(p_text text, p_nick text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); txt text := trim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g'));
        nick text := trim(coalesce(p_nick, '')); d jsonb; prof games.profiles; is_ver boolean; k text;
        last_at timestamptz; n5 int; mu timestamptz; m games.lobby_chat;
begin
  if u is null then raise exception 'Pick a nickname or log in with Discord to chat'; end if;
  select until into mu from games.lobby_mutes where user_id = u and until > now();
  if mu is not null then raise exception 'You are muted in the lobby chat for now'; end if;
  if txt = '' then return null; end if;
  if char_length(txt) > 200 then raise exception 'Messages can be up to 200 characters'; end if;

  d := games.discord_identity(u);
  is_ver := d is not null;
  if is_ver then
    select * into prof from games.profiles where user_id = u;
    if prof.user_id is not null then nick := prof.nick; end if;
  end if;
  if nick = '' then raise exception 'Pick a nickname first'; end if;
  if nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]{2,20}$' then
    raise exception 'Nickname: 2–20 characters, letters, digits, space, _ . -'; end if;
  if games.is_profane(nick) or games.is_blocked(nick) then raise exception 'That nickname did not pass the filter. Pick another one.'; end if;
  k := games.nick_key(nick);
  if char_length(k) < 2 then raise exception 'Nickname is too short'; end if;
  if exists (select 1 from games.profiles where nick_key = k and user_id <> u) then
    raise exception 'That nickname is reserved by a verified (Discord) player'; end if;

  perform pg_advisory_xact_lock(hashtext('lobbychat:' || u::text));   -- równoległe wysyłki tego gracza liczą się po kolei
  select max(created_at), count(*) into last_at, n5 from games.lobby_chat where user_id = u and created_at > now() - interval '5 minutes';
  if last_at is not null and last_at > now() - interval '3 seconds' then
    raise exception 'Slow down — wait %s', greatest(1, ceil(extract(epoch from last_at + interval '3 seconds' - now()))::int); end if;
  if n5 >= 20 then raise exception 'Slow down: up to 20 messages in 5 minutes'; end if;

  if txt ~* '(https?://|www\.|discord\.gg|t\.me/|\m[a-z0-9-]+\.(com|net|org|io|xyz|gg|me|ly|co|ru|app|link|site|top|info|biz|online|live|fun|finance|exchange|money|pro|vip|cc|to)\M)' then
    raise exception 'Links are not allowed in the lobby chat'; end if;
  if games.norm(txt) ~ '(seedphrase|seedwords|recoveryphrase|secretphrase|privatekey|mnemonic|walletpassword|frazaseed|kluczprywatny|haslodoportfela)' then
    raise exception 'For your safety, messages about seed phrases, private keys or wallet passwords are blocked. Never share them with anyone.'; end if;
  if games.is_blocked(txt) then
    insert into games.lobby_mutes(user_id, until, reason) values (u, now() + interval '24 hours', 'blocked words')
    on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
    -- no exception here: it would undo the mute. The page shows "error" like any other refusal.
    return jsonb_build_object('error', 'That message is not allowed here. You are muted in the lobby chat for 24 hours.');
  end if;

  insert into games.lobby_chat(user_id, nick, verified, body) values (u, nick, is_ver, games.clean_text(txt)) returning * into m;
  return jsonb_build_object('id', m.id, 'user_id', m.user_id, 'nick', m.nick, 'verified', m.verified, 'body', m.body, 'at', m.created_at);
end $$;

-- Host: ukryj wiadomość
create or replace function public.gry_lobby_hide(p_id bigint) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  update games.lobby_chat set hidden_at = now() where id = p_id and hidden_at is null;
end $$;

-- Host: wycisz gracza na p_hours godzin (domyślnie 24) i ukryj jego wiadomości z ostatnich 24 h
create or replace function public.gry_lobby_mute(p_user uuid, p_hours int default 24) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  insert into games.lobby_mutes(user_id, until, reason) values (p_user, now() + make_interval(hours => least(greatest(coalesce(p_hours, 24), 1), 720)), 'host')
  on conflict (user_id) do update set until = excluded.until, reason = excluded.reason;
  update games.lobby_chat set hidden_at = now() where user_id = p_user and hidden_at is null;
end $$;

-- uprawnienia: funkcje games.* tylko wewnętrznie; czat czytają wszyscy, piszą zalogowani (gość lub Discord)
revoke all on function games.is_blocked(text), games.lobby_cleanup() from public;
revoke all on function public.gry_lobby_chat(bigint, text), public.gry_lobby_say(text, text), public.gry_lobby_hide(bigint),
  public.gry_lobby_mute(uuid, int) from public, anon;
grant execute on function public.gry_lobby_chat(bigint, text) to anon, authenticated;
grant execute on function public.gry_lobby_say(text, text), public.gry_lobby_hide(bigint), public.gry_lobby_mute(uuid, int) to authenticated;

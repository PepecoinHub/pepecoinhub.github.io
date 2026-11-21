-- Pond Map (Mapa Stawu): six map pieces behind the Golden Foot painting and the founder's message at 6 of 6.
-- Apply after update_fren_passport.sql, update_passport_season.sql and update_passport_awards.sql. Safe to run twice.
--
-- THIS FILE HOLDS NO ANSWERS. The repository is public. The six words and the accepted Find answers live only
-- in games.map_words, which you fill once by hand in the Supabase SQL editor (a separate private seed you do NOT
-- commit). The founder's message lives only in games.map_config (and its screenshot in the private bucket below).
--
-- What the server checks (the browser decides nothing):
--   * Discord sign-in; the Treasure Hunter stamp (10 secrets) opens the painting.
--   * Before launch (map_config.open <> 'true') only hosts and listed testers can play.
--   * Words: one table, compared after lower-casing and dropping everything but a-z and 0-9 (FROG = Frog = frog).
--   * Four words count only after the server saw the player do the step itself (a "gate"):
--       piece 2: the locked zip, code = days since 30 Jan 2024 (computed here, changes every day);
--       piece 3: Find, the accepted answers come from map_words.gate_answers;
--       piece 5: "Touch grass", at least 69 seconds by the server clock between start and end.
--     The other two (pure reasoning) count with the word alone. A shared list of words is useless for the gated four.
--   * Limits: 10 wrong words and 10 wrong codes per player per 10 minutes.
--   * The founder's message and the screenshot are readable only at 6 of 6.
begin;

-- ---------- private tables (no API access; only the functions below touch them) ----------
create table if not exists games.map_words (
  piece smallint primary key check (piece between 1 and 6),
  word text not null check (word ~ '^[a-z0-9]{3,32}$'),
  gated boolean not null default false,
  gate_answers text[] not null default '{}'
);
create table if not exists games.map_config (k text primary key, v text not null);
create table if not exists games.map_gates (
  user_id uuid not null references auth.users(id) on delete cascade,
  piece smallint not null check (piece between 1 and 6),
  at timestamptz not null default clock_timestamp(),
  primary key (user_id, piece)
);
create table if not exists games.map_found (
  user_id uuid not null references auth.users(id) on delete cascade,
  piece smallint not null check (piece between 1 and 6),
  at timestamptz not null default clock_timestamp(),
  primary key (user_id, piece)
);
create table if not exists games.map_wait (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz not null
);
create table if not exists games.map_tries (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  at timestamptz not null default clock_timestamp()
);
create index if not exists map_tries_recent on games.map_tries (user_id, kind, at);
-- Notes on the table in the PepeGochi room: kept on the server, so they survive a new browser or phone.
-- intro = the player found the slot; clue_N = the frog's clue for piece N; word_N = the word a step gave (pieces 2, 3, 5)
create table if not exists games.map_notes (
  user_id uuid not null references auth.users(id) on delete cascade,
  note_key text not null check (note_key ~ '^(intro|clue_[1-6]|word_[235])$'),
  at timestamptz not null default clock_timestamp(),
  primary key (user_id, note_key)
);
create table if not exists games.map_finishers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  finished_at timestamptz not null default clock_timestamp()
);

alter table games.map_words enable row level security;
alter table games.map_config enable row level security;
alter table games.map_gates enable row level security;
alter table games.map_found enable row level security;
alter table games.map_wait enable row level security;
alter table games.map_tries enable row level security;
alter table games.map_finishers enable row level security;
alter table games.map_notes enable row level security;
revoke all on games.map_words, games.map_config, games.map_gates, games.map_found, games.map_wait,
  games.map_tries, games.map_finishers, games.map_notes from public, anon, authenticated;

-- ---------- helpers ----------
create or replace function games.map_norm(t text) returns text
language sql immutable set search_path = '' as $$
  select regexp_replace(lower(coalesce(t, '')), '[^a-z0-9]', '', 'g')
$$;

create or replace function games.map_cfg(key text) returns text
language sql stable security definer set search_path = '' as $$
  select v from games.map_config where k = key
$$;

-- a tester list: comma separated auth user ids in map_config 'testers'
create or replace function games.map_tester(u uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and (games.is_host_user(u) or u::text = any (string_to_array(replace(coalesce(games.map_cfg('testers'), ''), ' ', ''), ',')))
$$;

-- who may play right now: null = yes, otherwise the reason
create or replace function games.map_block(u uuid) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if u is null or games.discord_identity(u) is null then return 'discord'; end if;
  if games.map_tester(u) then return null; end if;
  if coalesce(games.map_cfg('open'), '') <> 'true' then return 'closed'; end if;
  if not exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = 'treasure_hunter') then
    return 'locked';
  end if;
  return null;
end $$;

create or replace function games.map_count(u uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from games.map_found where user_id = u
$$;

-- wrong attempts in the last 10 minutes (kind: 'word' or 'code')
create or replace function games.map_limited(u uuid, p_kind text) returns boolean
language sql stable security definer set search_path = '' as $$
  select count(*) >= 10 from games.map_tries
   where user_id = u and kind = p_kind and at > clock_timestamp() - interval '10 minutes'
$$;

create or replace function games.map_miss(u uuid, p_kind text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into games.map_tries (user_id, kind) values (u, p_kind);
  delete from games.map_tries where at < clock_timestamp() - interval '1 day';
$$;

-- Passport rows only in the real season: before launch testers leave no stamps behind.
create or replace function games.map_stamp(u uuid, s text) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  if coalesce(games.map_cfg('open'), '') = 'true' and games.passport_open() then
    insert into games.passport_secrets (user_id, secret_id) values (u, s) on conflict do nothing;
  end if;
end $$;

-- ---------- RPC: state of the painting for this player ----------
create or replace function public.gry_map_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); why text; n integer; fin timestamptz; rnk integer;
begin
  why := games.map_block(u);
  if why is not null then return jsonb_build_object('allowed', false, 'reason', why); end if;
  n := games.map_count(u);
  select f.finished_at into fin from games.map_finishers f where f.user_id = u;
  if fin is not null then select count(*)::integer into rnk from games.map_finishers f where f.finished_at <= fin; end if;
  return jsonb_build_object('allowed', true, 'test', coalesce(games.map_cfg('open'), '') <> 'true',
    'found', coalesce((select jsonb_agg(piece order by piece) from games.map_found where user_id = u), '[]'::jsonb),
    'count', n, 'done', n >= 6, 'rank', rnk,
    'wait', games.map_limited(u, 'word'));
end $$;

-- ---------- RPC: type a word in the painting window ----------
create or replace function public.gry_map_try(p_word text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); why text; w text := games.map_norm(left(p_word, 64)); r games.map_words; n integer; fresh boolean;
begin
  why := games.map_block(u);
  if why is not null then return jsonb_build_object('ok', false, 'reason', why); end if;
  perform pg_advisory_xact_lock(hashtext('map:' || u::text));
  if games.map_limited(u, 'word') then return jsonb_build_object('ok', false, 'wait', true); end if;
  if length(w) < 3 then return jsonb_build_object('ok', false); end if;
  select * into r from games.map_words where word = w;
  -- a gated word without its gate is answered exactly like a wrong word
  if r.piece is null or (r.gated and not exists (select 1 from games.map_gates g where g.user_id = u and g.piece = r.piece)) then
    perform games.map_miss(u, 'word');
    return jsonb_build_object('ok', false);
  end if;
  insert into games.map_found (user_id, piece) values (u, r.piece) on conflict do nothing;
  fresh := found;
  if fresh then perform games.map_stamp(u, 'pond_map_' || r.piece); end if;
  n := games.map_count(u);
  if n >= 6 then
    perform pg_advisory_xact_lock(hashtext('map:finishers'));
    insert into games.map_finishers (user_id) values (u) on conflict do nothing;
    if found then perform games.map_stamp(u, 'pond_archivist'); end if;
  end if;
  return jsonb_build_object('ok', true, 'piece', r.piece, 'new', fresh, 'count', n, 'done', n >= 6);
end $$;

-- ---------- RPC: open a gate (piece 2 the zip, piece 3 Find) ----------
create or replace function public.gry_map_unlock(p_piece integer, p_answer text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); why text; r games.map_words; a text := games.map_norm(left(p_answer, 64)); ok boolean := false; days integer;
begin
  why := games.map_block(u);
  if why is not null then return jsonb_build_object('ok', false, 'reason', why); end if;
  if p_piece not in (2, 3) then return jsonb_build_object('ok', false); end if;
  perform pg_advisory_xact_lock(hashtext('map:' || u::text));
  if games.map_limited(u, 'code') then return jsonb_build_object('ok', false, 'wait', true); end if;
  select * into r from games.map_words where piece = p_piece;
  if r.piece is null then return jsonb_build_object('ok', false); end if;
  if p_piece = 2 then
    -- the PondOS clock: whole days since Pepecoin's launch on 30 Jan 2024 (UTC); one day of slack for time zones
    days := floor(extract(epoch from (clock_timestamp() - timestamptz '2024-01-30 00:00:00+00')) / 86400)::integer;
    ok := a ~ '^[0-9]{1,6}$' and abs(a::integer - days) <= 1;
  else
    ok := length(a) >= 4 and exists (select 1 from unnest(r.gate_answers) g where games.map_norm(g) = a);
  end if;
  if not ok then perform games.map_miss(u, 'code'); return jsonb_build_object('ok', false); end if;
  insert into games.map_gates (user_id, piece) values (u, p_piece) on conflict do nothing;
  insert into games.map_notes (user_id, note_key) values (u, 'word_' || p_piece) on conflict do nothing;
  return jsonb_build_object('ok', true, 'word', upper(r.word));
end $$;

-- ---------- RPC: "Touch grass" (piece 5): start, then end after at least 69 seconds ----------
create or replace function public.gry_map_grass(p_end boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); why text; t timestamptz; r games.map_words; secs numeric;
begin
  why := games.map_block(u);
  if why is not null then return jsonb_build_object('ok', false, 'reason', why); end if;
  if not coalesce(p_end, false) then
    insert into games.map_wait (user_id, started_at) values (u, clock_timestamp())
    on conflict (user_id) do update set started_at = excluded.started_at;
    return jsonb_build_object('ok', true, 'started', true);
  end if;
  select started_at into t from games.map_wait where user_id = u;
  if t is null then return jsonb_build_object('ok', false); end if;
  secs := extract(epoch from clock_timestamp() - t);
  if secs < 68.5 then return jsonb_build_object('ok', false, 'early', true); end if;   -- the screen shows 69 s
  delete from games.map_wait where user_id = u;
  if secs > 3600 then return jsonb_build_object('ok', false); end if;                    -- left the tab for an hour
  select * into r from games.map_words where piece = 5;
  if r.piece is null then return jsonb_build_object('ok', false); end if;
  insert into games.map_gates (user_id, piece) values (u, 5) on conflict do nothing;
  insert into games.map_notes (user_id, note_key) values (u, 'word_5') on conflict do nothing;
  return jsonb_build_object('ok', true, 'word', upper(r.word));
end $$;

-- ---------- RPC: notes on the table ----------
-- The browser may save only 'intro' and the frog's clues (their texts are public riddles in the page code).
-- word_N notes are written only by the server, when the step was really done.
create or replace function public.gry_map_note(p_key text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if games.map_block(u) is not null or p_key is null or p_key !~ '^(intro|clue_[1-6])$' then return false; end if;
  insert into games.map_notes (user_id, note_key) values (u, p_key) on conflict do nothing;
  return true;
end $$;

create or replace function public.gry_map_notes()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if games.map_block(u) is not null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('key', n.note_key, 'at', n.at,
      'word', case when n.note_key like 'word\_%' then upper(w.word) end) order by n.at)
    from games.map_notes n
    left join games.map_words w on n.note_key like 'word\_%' and w.piece = substr(n.note_key, 6)::smallint
      and exists (select 1 from games.map_gates g where g.user_id = u and g.piece = w.piece)
   where n.user_id = u), '[]'::jsonb);
end $$;

-- ---------- RPC: the founder's message, only at 6 of 6 ----------
create or replace function public.gry_map_done()
returns boolean language sql stable security definer set search_path = '' as $$
  select games.map_block(auth.uid()) is null and games.map_count(auth.uid()) >= 6
$$;

create or replace function public.gry_map_finale()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); fin timestamptz; rnk integer;
begin
  if not public.gry_map_done() then return jsonb_build_object('ok', false); end if;
  select finished_at into fin from games.map_finishers where user_id = u;
  select count(*)::integer into rnk from games.map_finishers where finished_at <= coalesce(fin, clock_timestamp());
  return jsonb_build_object('ok', true, 'rank', rnk, 'finished_at', fin,
    'title', games.map_cfg('finale_title'), 'text', games.map_cfg('finale_text'),
    'signature', games.map_cfg('finale_signature'), 'image', games.map_cfg('finale_image'));
end $$;

-- ---------- RPC: the wall of finders (only for players who may open the painting) ----------
create or replace function public.gry_map_wall()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if games.map_block(auth.uid()) is not null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('rank', x.rnk, 'name', x.name, 'at', x.finished_at) order by x.rnk)
    from (select row_number() over (order by f.finished_at) as rnk, f.finished_at,
                 coalesce(p.nick, games.discord_identity(f.user_id)->>'name', 'fren') as name
            from games.map_finishers f left join games.profiles p on p.user_id = f.user_id
           order by f.finished_at limit 100) x), '[]'::jsonb);
end $$;

-- ---------- grants ----------
revoke all on function games.map_norm(text), games.map_cfg(text), games.map_tester(uuid), games.map_block(uuid),
  games.map_count(uuid), games.map_limited(uuid, text), games.map_miss(uuid, text), games.map_stamp(uuid, text)
  from public, anon, authenticated;
revoke all on function public.gry_map_state(), public.gry_map_try(text), public.gry_map_unlock(integer, text),
  public.gry_map_grass(boolean), public.gry_map_done(), public.gry_map_finale(), public.gry_map_wall(),
  public.gry_map_note(text), public.gry_map_notes()
  from public, anon;
grant execute on function public.gry_map_state(), public.gry_map_try(text), public.gry_map_unlock(integer, text),
  public.gry_map_grass(boolean), public.gry_map_done(), public.gry_map_finale(), public.gry_map_wall(),
  public.gry_map_note(text), public.gry_map_notes()
  to authenticated;

-- ---------- the founder's screenshot: a PRIVATE bucket, readable only at 6 of 6 ----------
-- Upload the picture by hand in Supabase Storage (bucket pond-finale), then put its file name in map_config 'finale_image'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pond-finale', 'pond-finale', false, 2097152, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png'];
drop policy if exists pond_finale_select on storage.objects;
create policy pond_finale_select on storage.objects for select to authenticated
  using (bucket_id = 'pond-finale' and public.gry_map_done());

-- closed until you say so
insert into games.map_config (k, v) values ('open', 'false') on conflict (k) do nothing;

commit;

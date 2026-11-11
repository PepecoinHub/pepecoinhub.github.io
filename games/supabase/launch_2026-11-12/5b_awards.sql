-- update_passport_awards.sql, part 2 of 4 (run after 5a)
begin;
-- ---------- board games (chess, checkers, Connect Four, Sea Battle) ----------
-- Good Game: a game played to its end by two different Discord players. A resignation, a player who left,
-- an aborted game and very short games (fewer than 10 moves; Sea Battle always takes longer) do not count.
-- Checkmate!: the winner of a chess game that ended in checkmate under the same conditions.
create or replace function games.passport_table_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v1 boolean; v2 boolean; w uuid;
begin
  if new.status = 'finished' and old.status is distinct from 'finished' and new.result is not null
     and new.p1 is not null and new.p2 is not null and new.p1 <> new.p2 then
    begin
      if coalesce(new.reason, '') ~* '(resigned|left the table|players left|did not place|did not make)' then return null; end if;
      if new.game <> 'battleship' and coalesce(array_length(new.history, 1), 0) < 10 then return null; end if;
      select coalesce(bool_or(m.verified) filter (where m.user_id = new.p1), false),
             coalesce(bool_or(m.verified) filter (where m.user_id = new.p2), false)
        into v1, v2 from games.table_members m where m.table_code = new.code;
      if not (v1 and v2) then return null; end if;
      perform games.passport_award(new.p1, 'good_game');
      perform games.passport_award(new.p2, 'good_game');
      if new.game = 'chess' and new.reason = 'checkmate' and new.result in ('p1', 'p2') then
        w := case new.result when 'p1' then new.p1 else new.p2 end;
        perform games.passport_award(w, 'checkmate');
      end if;
    exception when others then
      raise warning 'passport table hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_table_au on games.tables;
create trigger passport_table_au after update of status on games.tables
  for each row execute function games.passport_table_after();

-- a mention row exists only when a verified player really @mentioned another reserved nickname
create or replace function games.passport_mention_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    if not exists (select 1 from games.passport_badges b where b.user_id = new.from_user and b.badge_id = 'hey_fren') then
      perform games.passport_award(new.from_user, 'hey_fren', new.created_at);
    end if;
  exception when others then
    raise warning 'passport mention hook: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists passport_mention_ai on games.lobby_mentions;
create trigger passport_mention_ai after insert on games.lobby_mentions
  for each row execute function games.passport_mention_after();

-- ---------- letters to the editor ----------
create or replace function games.passport_letter_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if new.discord and games.passport_open() then
    begin
      insert into games.passport_progress (user_id, letters) values (new.user_id, 1)
      on conflict (user_id) do update set letters = games.passport_progress.letters + 1
      returning letters into n;
      if n >= 1 then perform games.passport_award(new.user_id, 'dear_editor', new.created_at); end if;
    exception when others then
      raise warning 'passport letter hook: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists passport_letter_ai on games.letters;
create trigger passport_letter_ai after insert on games.letters
  for each row execute function games.passport_letter_after();

-- ---------- owner tools: "Printed" letters, Bug Hunter, BALI ----------
-- Junior Editor (1), Senior Editor (5) and Vox Populi (10) count the letters the owner marked as printed
-- in The Pond Gazette. Only letters whose writer ticked "OK to print" can be marked. The marks live in
-- their own table, because games.letters deletes read letters beyond the newest 2000 and the count must
-- not drop. Unmarking a letter (a mis-click) takes back a stamp the count no longer reaches.
create table if not exists games.passport_printed (
  letter_id  bigint primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  printed_at timestamptz not null default clock_timestamp()
);
create index if not exists passport_printed_user on games.passport_printed (user_id);
alter table games.passport_printed enable row level security;

create or replace function games.passport_printed_check(u uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare n integer;
begin
  select count(*) into n from games.passport_printed p where p.user_id = u and p.printed_at >= games.passport_start();
  if n >= 1 then perform games.passport_award(u, 'junior_editor'); end if;
  if n >= 5 then perform games.passport_award(u, 'senior_editor'); end if;
  if n >= 10 then perform games.passport_award(u, 'vox_populi'); end if;
  delete from games.passport_badges b
   where b.user_id = u and ((b.badge_id = 'junior_editor' and n < 1) or (b.badge_id = 'senior_editor' and n < 5)
                            or (b.badge_id = 'vox_populi' and n < 10));
  return n;
end
$$;
revoke all on function games.passport_printed_check(uuid) from public, anon, authenticated;

create or replace function public.gry_letter_printed(p_id bigint, p_printed boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare l record; n integer := 0;
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  select x.id, x.user_id, x.discord, x.print_ok into l from games.letters x where x.id = p_id;
  if not found then raise exception 'That letter is gone'; end if;
  if coalesce(p_printed, false) then
    if not l.print_ok then raise exception 'This fren did not tick "OK to print", so it cannot be marked as printed'; end if;
    insert into games.passport_printed (letter_id, user_id) values (l.id, l.user_id) on conflict (letter_id) do nothing;
  else
    delete from games.passport_printed p where p.letter_id = l.id;
  end if;
  if l.discord then n := games.passport_printed_check(l.user_id); end if;
  return jsonb_build_object('ok', true, 'printed', coalesce(p_printed, false), 'printed_count', n);
end
$$;
revoke all on function public.gry_letter_printed(bigint, boolean) from public, anon;
grant execute on function public.gry_letter_printed(bigint, boolean) to authenticated;

-- Bug Hunter: the owner gives it to the Discord writer of a letter that reported a real, fixed bug.
create or replace function public.gry_letter_bug_hunter(p_id bigint, p_on boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare l record;
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  select x.user_id, x.discord into l from games.letters x where x.id = p_id;
  if not found then raise exception 'That letter is gone'; end if;
  if not l.discord or games.discord_identity(l.user_id) is null then
    raise exception 'Bug Hunter is a Passport stamp, and this letter came from a guest (no Discord)';
  end if;
  if coalesce(p_on, true) then
    perform games.passport_award(l.user_id, 'bug_hunter');
  else
    delete from games.passport_badges b where b.user_id = l.user_id and b.badge_id = 'bug_hunter';
  end if;
  return jsonb_build_object('ok', true, 'bug_hunter', coalesce(p_on, true));
end
$$;
revoke all on function public.gry_letter_bug_hunter(bigint, boolean) from public, anon;
grant execute on function public.gry_letter_bug_hunter(bigint, boolean) to authenticated;

-- BALI: the owner opens it on the day Pepecoin reaches $0.01. From then on every Discord fren gets the
-- mythic stamp on their next PondOS visit (games.passport_daily). Closing it again stops new awards and
-- takes nothing back.
create or replace function public.gry_passport_bali(p_open boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  if coalesce(p_open, false) then
    insert into games.passport_meta (k) values ('bali_open') on conflict (k) do nothing;
    perform games.passport_award(auth.uid(), 'bali');
  else
    delete from games.passport_meta m where m.k = 'bali_open';
  end if;
  return jsonb_build_object('ok', true, 'bali_open', exists (select 1 from games.passport_meta m where m.k = 'bali_open'));
end
$$;
revoke all on function public.gry_passport_bali(boolean) from public, anon;
grant execute on function public.gry_passport_bali(boolean) to authenticated;

-- The owner's mailbox: as update_letters_community.sql, plus each letter's "printed" mark, whether its
-- writer has Bug Hunter, how many of their letters were printed, and whether BALI is open.
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
    'bali_open', exists (select 1 from games.passport_meta m where m.k = 'bali_open'),
    'letters', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'at', q.created_at, 'name', q.name,
               'discord', q.discord, 'print', q.print_ok, 'body', q.body,
               'page', q.page, 'read', q.read_at is not null,
               'printed', exists (select 1 from games.passport_printed p where p.letter_id = q.id),
               'printed_count', case when q.discord then (select count(*) from games.passport_printed p where p.user_id = q.user_id) else 0 end,
               'bug_hunter', q.discord and exists (select 1 from games.passport_badges b
                                                    where b.user_id = q.user_id and b.badge_id = 'bug_hunter'))
             order by q.created_at desc)
      from (select * from games.letters
            order by created_at desc limit lim) q), '[]'::jsonb));
end
$fn$;
revoke all on function public.gry_letters(int) from public, anon;
grant execute on function public.gry_letters(int) to authenticated;

-- ---------- Pepe Miner ----------
-- The game sends its cloud save every 60 s while it runs (docs/games/js/miner.js), and gry_miner_save
-- accepts at most one save per 20 s. Play time is the server's own clock between two accepted saves
-- that are at most 120 s apart; a longer gap starts a new session. The game's own numbers are ignored.
create or replace function games.passport_miner_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not games.passport_open() then return null; end if;
  begin
    insert into games.passport_progress (user_id, miner_last_at) values (new.user_id, clock_timestamp())
    on conflict (user_id) do update set
      miner_seconds = games.passport_progress.miner_seconds
        + case when games.passport_progress.miner_last_at > clock_timestamp() - interval '120 seconds'
               then greatest(0, ceil(extract(epoch from clock_timestamp() - games.passport_progress.miner_last_at)))::integer
               else 0 end,
      miner_last_at = clock_timestamp()
    returning miner_seconds into n;
    -- Happy Mining!: the first cloud save (v3). Play time is still counted for a future stamp.
    perform games.passport_award(new.user_id, 'rookie_miner');
  exception when others then
    raise warning 'passport miner hook: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists passport_miner_aiu on games.miner_saves;
create trigger passport_miner_aiu after insert or update on games.miner_saves
  for each row execute function games.passport_miner_after();

-- ---------- PondOS visits: Welcome Back!, 14-Day Streak, Guess You Like It Here, and new-stamp notices ----------
-- Called by PondOS (docs/meme/meme.js) when a Discord player opens a page. It writes one row per UTC day
-- at most, and hands back the stamps the player has not been told about yet (each one only once).
-- ---------- Pond Polls: I Voted ----------
create or replace function games.passport_poll_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified then
    begin perform games.passport_award(new.user_id, 'i_voted', new.voted_at);
    exception when others then raise warning 'passport poll hook: %', sqlerrm; end;
  end if;
  return null;
end
$$;

-- ---------- FUD Invaders and PEP Snake: FUD Buster (2,000 points), Long Snake (40 blocks) ----------
create or replace function games.passport_arcade_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified and new.user_id is not null then
    begin
      if new.game = 'fud' and new.score >= 2000 then perform games.passport_award(new.user_id, 'fud_buster', new.created_at); end if;
      if new.game = 'snake' and new.score >= 40 then perform games.passport_award(new.user_id, 'long_snake', new.created_at); end if;
    exception when others then raise warning 'passport arcade hook: %', sqlerrm; end;
  end if;
  return null;
end
$$;

-- ---------- secrets: Secret Starter (1), Treasure Hunter (6) ----------
create or replace function games.passport_secret_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  begin
    -- the two event days are for everyone who visits, so they are not "found" and do not count here
    select count(*) into n from games.passport_secrets
     where user_id = new.user_id and secret_id not in ('pep_birthday', 'thanksgiving_fren')
       and discovered_at >= games.passport_start();
    if n >= 1 then perform games.passport_award(new.user_id, 'secret_starter', new.discovered_at); end if;
    if n >= 6 then perform games.passport_award(new.user_id, 'treasure_hunter', new.discovered_at); end if;
  exception when others then raise warning 'passport secret hook: %', sqlerrm; end;
  return null;
end
$$;

-- ---------- Pepe Pictures: Podium (top 3), Game Night (a scheduled night), Quiz Master (hosted, 4+ ranked players) ----------
create or replace function games.passport_result_after()
returns trigger language plpgsql security definer set search_path = '' as $$
declare m games.matches; host uuid; n integer;
begin
  begin
    select * into m from games.matches where id = new.match_id;
    if m.id is null or m.mode <> 'obrazek' then return null; end if;
    if new.verified then
      if new.place <= 3 then perform games.passport_award(new.user_id, 'podium', new.finished_at); end if;
      if exists (select 1 from games.events e where e.room_code = m.room_code
                   and e.starts_at between m.started_at - interval '3 hours' and m.started_at + interval '3 hours') then
        perform games.passport_award(new.user_id, 'game_night', new.finished_at);
      end if;
    end if;
    select count(*) into n from games.results where match_id = new.match_id;
    if n >= 4 then
      select r.host_id into host from games.rooms r where r.code = m.room_code;
      if host is not null and host <> new.user_id then perform games.passport_award(host, 'quiz_master', new.finished_at); end if;
    end if;
  exception when others then raise warning 'passport result hook: %', sqlerrm; end;
  return null;
end
$$;

-- the triggers are created only where the game tables exist (every game migration runs before this file)
do $$ begin
  if to_regclass('games.poll_votes') is not null then
    drop trigger if exists passport_poll_ai on games.poll_votes;
    create trigger passport_poll_ai after insert on games.poll_votes for each row execute function games.passport_poll_after();
  end if;
  if to_regclass('games.arcade_scores') is not null then
    drop trigger if exists passport_arcade_ai on games.arcade_scores;
    create trigger passport_arcade_ai after insert on games.arcade_scores for each row execute function games.passport_arcade_after();
  end if;
  drop trigger if exists passport_secret_ai on games.passport_secrets;
  create trigger passport_secret_ai after insert on games.passport_secrets for each row execute function games.passport_secret_after();
  drop trigger if exists passport_result_ai on games.results;
  create trigger passport_result_ai after insert on games.results for each row execute function games.passport_result_after();
end $$;

commit;

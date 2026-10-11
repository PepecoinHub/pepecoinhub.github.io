-- PEP Games: tips and airdrops in the room chat (PEP addresses for Discord players; nobody's coins pass through the site).
-- Run ONCE in Supabase → SQL Editor (New query → paste everything → Run). Safe to run again, deletes nothing.
-- If Supabase shows "Potential issues detected", choose "Run and enable RLS".

-- ---------- tips and airdrops: the site never holds or sends coins ----------
-- Players logged in with Discord can save their PEP address. Tips and airdrop payouts are sent by players
-- from their own wallets; the database only stores addresses and who joined an airdrop.
create table if not exists games.wallets (
  user_id uuid primary key,
  pep_address text not null check (pep_address ~ '^P[1-9A-HJ-NP-Za-km-z]{33}$'),
  updated_at timestamptz not null default now()
);
alter table games.wallets enable row level security;
create table if not exists games.airdrops (
  id bigint generated always as identity primary key,
  room_code text not null references games.rooms(code) on delete cascade,
  creator_id uuid not null,
  creator_nick text not null,
  amount numeric(20,8) not null check (amount > 0 and amount <= 100000000),
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now()
);
create index if not exists airdrops_room_idx on games.airdrops(room_code, id desc);
alter table games.airdrops enable row level security;
create table if not exists games.airdrop_claims (
  airdrop_id bigint not null references games.airdrops(id) on delete cascade,
  user_id uuid not null,
  nick text not null,
  pep_address text not null,
  claimed_at timestamptz not null default now(),
  primary key (airdrop_id, user_id)
);
alter table games.airdrop_claims enable row level security;
alter table games.players add column if not exists tip_at timestamptz;

create or replace function games.airdrop_close_due(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare a games.airdrops; n int; share numeric;
begin
  for a in select * from games.airdrops where room_code = p_code and status = 'open' and ends_at <= now() for update loop
    update games.airdrops set status = 'closed' where id = a.id;
    select count(*) into n from games.airdrop_claims where airdrop_id = a.id;
    if n = 0 then
      perform games.sys(p_code, 'Airdrop by ' || a.creator_nick || ' ended. Nobody claimed it.');
    else
      share := trunc(a.amount / n, 8);
      perform games.sys(p_code, 'Airdrop by ' || a.creator_nick || ' ended: ' || n || ' player' || case when n = 1 then '' else 's' end
        || case when n = 1 then ' gets ' else ' get ' end || trim_scale(share)::text || ' PEP each. ' || a.creator_nick || ' sends it from their own wallet.');
    end if;
    perform games.notify(p_code, 'state');
  end loop;
end $$;

create or replace function public.gry_wallet_get() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then return jsonb_build_object('verified', false, 'address', null); end if;
  return jsonb_build_object('verified', games.discord_identity(u) is not null,
                            'address', (select w.pep_address from games.wallets w where w.user_id = u));
end $$;

create or replace function public.gry_wallet_set(p_address text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a text := trim(coalesce(p_address, ''));
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Log in with Discord to add a PEP address'; end if;
  if a = '' then delete from games.wallets where user_id = u; return; end if;
  if a !~ '^P[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That does not look like a PEP address (it starts with P and has 34 characters)'; end if;
  insert into games.wallets(user_id, pep_address) values (u, a)
  on conflict (user_id) do update set pep_address = excluded.pep_address, updated_at = now();
end $$;

create or replace function public.gry_tip_info(p_code text, p_nick text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.players; ver boolean;
begin
  if not exists (select 1 from games.players where room_code = upper(p_code) and user_id = u and not kicked and left_at is null) then
    raise exception 'You are not in this room'; end if;
  select * into p from games.players where room_code = upper(p_code) and lower(nick) = lower(trim(coalesce(p_nick, '')))
     and not kicked and left_at is null limit 1;
  if p.user_id is null then raise exception 'No player called % in this room', trim(coalesce(p_nick, '')); end if;
  ver := games.discord_identity(p.user_id) is not null;
  return jsonb_build_object('nick', p.nick, 'verified', ver, 'self', p.user_id = u,
    'address', case when ver then (select w.pep_address from games.wallets w where w.user_id = p.user_id) end);
end $$;

create or replace function public.gry_tip_announce(p_code text, p_nick text, p_amount numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); me games.players; p games.players;
begin
  select * into me from games.players where room_code = upper(p_code) and user_id = u for update;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if me.tip_at is not null and me.tip_at > now() - interval '10 seconds' then raise exception 'Slow down — wait a few seconds'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Tip amount: more than 0 and at most 100,000,000 PEP'; end if;
  select * into p from games.players where room_code = me.room_code and lower(nick) = lower(trim(coalesce(p_nick, '')))
     and not kicked and left_at is null limit 1;
  if p.user_id is null or p.user_id = u then raise exception 'Pick another player'; end if;
  update games.players set tip_at = now() where room_code = me.room_code and user_id = u;
  perform games.sys(me.room_code, me.nick || ' tipped ' || p.nick || ' ' || trim_scale(round(p_amount, 8))::text || ' PEP.');
end $$;

create or replace function public.gry_airdrop_start(p_code text, p_amount numeric, p_seconds int default 20) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; me games.players; v_id bigint;
        secs int := least(greatest(coalesce(p_seconds, 20), 10), 300);
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found or r.status <> 'open' then raise exception 'Room not found'; end if;
  select * into me from games.players where room_code = r.code and user_id = u;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if games.discord_identity(u) is null then raise exception 'Log in with Discord to start an airdrop'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 100000000 then raise exception 'Airdrop amount: more than 0 and at most 100,000,000 PEP'; end if;
  perform games.airdrop_close_due(r.code);
  if exists (select 1 from games.airdrops where room_code = r.code and status = 'open') then raise exception 'An airdrop is already running in this room'; end if;
  if exists (select 1 from games.airdrops where creator_id = u and created_at > now() - interval '60 seconds') then
    raise exception 'Wait a minute before the next airdrop'; end if;
  insert into games.airdrops(room_code, creator_id, creator_nick, amount, ends_at)
  values (r.code, u, me.nick, round(p_amount, 8), now() + make_interval(secs => secs)) returning id into v_id;
  perform games.sys(r.code, me.nick || ' started an airdrop: ' || trim_scale(round(p_amount, 8))::text || ' PEP, ' || secs || ' seconds. Click Claim to join!');
  perform games.notify(r.code, 'state');
  return v_id;
end $$;

create or replace function public.gry_airdrop_claim(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); me games.players; a games.airdrops; addr text;
begin
  select * into me from games.players where room_code = upper(p_code) and user_id = u;
  if me.user_id is null or me.kicked or me.left_at is not null then raise exception 'You are not in this room'; end if;
  if games.discord_identity(u) is null then raise exception 'Log in with Discord and add your PEP address to claim airdrops'; end if;
  select w.pep_address into addr from games.wallets w where w.user_id = u;
  if addr is null then raise exception 'Add your PEP address first'; end if;
  select * into a from games.airdrops where room_code = me.room_code and status = 'open' order by id desc limit 1 for update;
  if not found or now() >= a.ends_at then raise exception 'This airdrop is over'; end if;
  if a.creator_id = u then raise exception 'This is your own airdrop'; end if;
  insert into games.airdrop_claims(airdrop_id, user_id, nick, pep_address) values (a.id, u, me.nick, addr) on conflict do nothing;
  perform games.notify(me.room_code, 'state');
end $$;

create or replace function public.gry_tick(p_code text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; d games.players;
begin
  if not exists (select 1 from games.players where room_code = upper(p_code) and user_id = u and not kicked) then
    return null; end if;
  select * into r from games.rooms where code = upper(p_code) for update;
  perform games.airdrop_close_due(r.code);
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
        'last_answer', case when r.phase in ('reveal','waiting','finished') then r.last_answer end,
        'question_total', r.question_total, 'scorers', r.scorers, 'last_turn_no', r.last_turn_no, 'last_mult', r.last_mult,
        'final_turn', games.final_turn(r.last_turn_no, r.question_total)),
    'next', case when r.phase = 'reveal' and r.mode = 'kalambury' then games.next_info(r.code) end,
    'mask', games.mask(r.code),
    'secret', sec,
    'podium', case when r.mode = 'obrazek' and r.phase in ('turn','reveal') then
        coalesce((select jsonb_agg(jsonb_build_object('place', g.place, 'nick', g.nick, 'user_id', g.user_id) order by g.place)
                  from games.guesses g where g.turn_id = r.turn_id), '[]'::jsonb) end,
    'spots', case when r.mode = 'obrazek' then least((select picture_scorers from games.config where id = 1), r.scorers, 3) end,
    'airdrop', (select jsonb_build_object('id', a.id, 'creator_nick', a.creator_nick, 'mine', a.creator_id = u, 'amount', trim_scale(a.amount),
        'ends_at', a.ends_at, 'status', a.status,
        'nicks', (select coalesce(jsonb_agg(c.nick order by c.claimed_at), '[]'::jsonb) from games.airdrop_claims c where c.airdrop_id = a.id),
        'me_claimed', exists (select 1 from games.airdrop_claims c where c.airdrop_id = a.id and c.user_id = u),
        'payout', case when a.creator_id = u and a.status = 'closed' then
          (select coalesce(jsonb_agg(jsonb_build_object('nick', c.nick, 'address', c.pep_address) order by c.claimed_at), '[]'::jsonb)
             from games.airdrop_claims c where c.airdrop_id = a.id) end)
      from games.airdrops a where a.room_code = r.code and (a.status = 'open' or a.created_at > now() - interval '15 minutes')
      order by a.id desc limit 1),
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

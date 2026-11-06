-- Pond Gazette polls. Run once in the Supabase SQL editor (after schema.sql). Safe to run again.
--
-- Everyone can vote: Discord players and guests (a guest account comes from the one-click guest log-on
-- with its bot check). One vote per account per poll, and guests also one vote per network per poll
-- (salted IP hash, games.client_ip_hash), so making new guest accounts does not stuff the box.
-- The server counts everything. A vote is final: no changing, no second vote. Results show to a player
-- after they vote, and to everyone once the poll has closed.
--
-- Add a poll with one insert (see the seed at the end). The Gazette issue shows it by its id.
-- The first poll ('like_polls') closes 2 days after this file first runs.
begin;

create table if not exists games.polls (
  id         text primary key check (id ~ '^[a-z0-9_]{3,40}$'),
  question   text not null check (char_length(question) between 3 and 200),
  -- [{"id": "yes", "label": "Yes"}, ...], 2 to 8 options
  options    jsonb not null check (jsonb_typeof(options) = 'array' and jsonb_array_length(options) between 2 and 8),
  opens_at   timestamptz not null default now(),
  closes_at  timestamptz not null,
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create table if not exists games.poll_votes (
  poll_id  text not null references games.polls(id) on delete cascade,
  user_id  uuid not null references auth.users(id) on delete cascade,
  choice   text not null check (choice ~ '^[a-z0-9_]{1,40}$'),
  voted_at timestamptz not null default now(),
  verified boolean not null default false,   -- Discord at the time of the vote
  ip_hash  text,                             -- guests only: one guest vote per network per poll
  primary key (poll_id, user_id)
);
alter table games.poll_votes add column if not exists verified boolean not null default false;
alter table games.poll_votes add column if not exists ip_hash text;
create index if not exists poll_votes_guest_ip on games.poll_votes (poll_id, ip_hash) where ip_hash is not null;
alter table games.polls enable row level security;
alter table games.poll_votes enable row level security;
revoke all on games.polls, games.poll_votes from public, anon, authenticated;

-- What a page may show: the question, the options, and the counts only when they may be seen.
create or replace function games.poll_view(p games.polls, u uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare mine text; is_open boolean := now() >= p.opens_at and now() < p.closes_at; show boolean; total integer; opts jsonb;
begin
  if u is not null then select v.choice into mine from games.poll_votes v where v.poll_id = p.id and v.user_id = u; end if;
  show := mine is not null or not is_open;
  select count(*) into total from games.poll_votes v where v.poll_id = p.id;
  select jsonb_agg(jsonb_build_object('id', o->>'id', 'label', o->>'label',
           'votes', case when show then (select count(*) from games.poll_votes v where v.poll_id = p.id and v.choice = o->>'id') end)
         order by n)
    into opts from jsonb_array_elements(p.options) with ordinality as x(o, n);
  return jsonb_build_object('id', p.id, 'question', p.question, 'options', opts, 'closes_at', p.closes_at,
    'open', is_open, 'my_choice', mine, 'show_results', show, 'total', case when show then total end,
    'can_vote', is_open and mine is null and u is not null);
end $$;

create or replace function public.gry_poll(p_poll text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare p games.polls;
begin
  select * into p from games.polls where id = p_poll;
  if p.id is null then return null; end if;
  return games.poll_view(p, auth.uid());
end $$;

create or replace function public.gry_poll_vote(p_poll text, p_choice text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.polls; is_d boolean; ip text;
begin
  if u is null then raise exception 'Log on (as a guest or with Discord) to vote' using errcode = '42501'; end if;
  is_d := games.discord_identity(u) is not null;
  select * into p from games.polls where id = p_poll;
  if p.id is null then raise exception 'Unknown poll' using errcode = '22023'; end if;
  if now() < p.opens_at or now() >= p.closes_at then raise exception 'This poll is closed' using errcode = 'P0001'; end if;
  if p_choice is null or not exists (select 1 from jsonb_array_elements(p.options) o where o->>'id' = p_choice) then
    raise exception 'Unknown answer' using errcode = '22023';
  end if;
  if not is_d and not exists (select 1 from games.poll_votes v where v.poll_id = p.id and v.user_id = u) then
    ip := games.client_ip_hash();
    if ip is null then raise exception 'Log on with Discord to vote' using errcode = '42501'; end if;
    -- guests on one network vote one after another, so two tabs cannot both slip through
    perform pg_advisory_xact_lock(hashtext('poll:' || p.id || ':' || ip));
    if exists (select 1 from games.poll_votes v where v.poll_id = p.id and v.ip_hash = ip) then
      raise exception 'A guest on your network has already voted. Log on with Discord to vote too.' using errcode = 'P0001';
    end if;
  end if;
  insert into games.poll_votes (poll_id, user_id, choice, verified, ip_hash) values (p.id, u, p_choice, is_d, case when is_d then null else ip end)
  on conflict (poll_id, user_id) do nothing;   -- a vote is final; a second click changes nothing
  return games.poll_view(p, u);
end $$;

revoke all on function games.poll_view(games.polls, uuid) from public, anon, authenticated;
revoke all on function public.gry_poll(text), public.gry_poll_vote(text, text) from public, anon, authenticated;
grant execute on function public.gry_poll(text) to anon, authenticated;
grant execute on function public.gry_poll_vote(text, text) to authenticated;

-- The Pond Gazette #5 test poll: open for 2 days from the first run of this file.
insert into games.polls (id, question, options, closes_at)
values ('like_polls', 'Do you like polls?', '[{"id": "yes", "label": "Yes"}, {"id": "no", "label": "No"}]', now() + interval '2 days')
on conflict (id) do nothing;

commit;

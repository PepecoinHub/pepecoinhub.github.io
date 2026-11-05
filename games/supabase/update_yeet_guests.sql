-- YEET THE PEP: guests in the Hall of Fren too. Run after update_yeet.sql. Safe to run again.
-- Guests send a nickname with their flight; Discord players stay verified (bold with a frog in the game).
-- Same checks as the Discord records: distance must fit the flight time. Plus: 6 sends per 10 min per network,
-- nickname rules and the profanity filter, and a guest cannot take the name of a Discord pilot.
create table if not exists games.yeet_guests (
nick text primary key,
shown text not null,
best integer not null check (best between 1 and 60000),
duration_ms integer not null,
ip_hash text,
achieved_at timestamptz not null default now()
);
create table if not exists games.yeet_guest_sends (ip_hash text, at timestamptz not null default now());
create index if not exists yeet_guest_sends_ip on games.yeet_guest_sends (ip_hash, at);
alter table games.yeet_guests enable row level security;
alter table games.yeet_guest_sends enable row level security;
revoke all on games.yeet_guests, games.yeet_guest_sends from public, anon, authenticated;

-- the top 10: Discord records and guest records together, each row says if it is verified
create or replace function games.yeet_top() returns jsonb
language sql stable security definer set search_path = '' as $$
select coalesce(jsonb_agg(jsonb_build_object('nick', t.nick, 'score', t.best, 'verified', t.ver) order by t.best desc, t.at), '[]'::jsonb)
from (select * from (
select nick, best, achieved_at at, true ver from games.yeet_records where best > 0
union all
select shown, best, achieved_at, false from games.yeet_guests) a
order by best desc, at limit 10) t
$$;
revoke all on function games.yeet_top() from public, anon, authenticated;

create or replace function public.gry_yeet_guest_submit(p_nick text, p_score integer, p_ms integer, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g')); ip text := games.client_ip_hash(); n int; old int;
begin
if p_version is distinct from 1 then raise exception 'Refresh the game before submitting'; end if;
if p_score is null or p_score < 1 or p_score > 60000 then raise exception 'Invalid flight distance'; end if;
if p_ms is null or p_ms < 1000 or p_ms > 360500 then raise exception 'Invalid flight duration'; end if;
if p_score::bigint > p_ms::bigint + 100 then raise exception 'That distance does not match the flight time'; end if;
if char_length(v) < 2 or char_length(v) > 20 or v !~ '^[A-Za-z0-9 _.\-]+$' then raise exception 'Nickname: 2 to 20 letters, digits, spaces, _ . -'; end if;
if games.is_profane(v) then raise exception 'Pick a different nickname'; end if;
if exists (select 1 from games.yeet_records r where lower(r.nick) = lower(v)) then raise exception 'That name belongs to a Discord pilot. Log in with Discord, or pick another'; end if;
perform 1 from games.config where id = 1 for update;
select count(*) into n from games.yeet_guest_sends s where s.ip_hash is not distinct from ip and s.at > now() - interval '10 minutes';
if n >= (case when ip is null then 40 else 6 end) then raise exception 'Slow down a little, fren'; end if;
insert into games.yeet_guest_sends (ip_hash) values (ip);
delete from games.yeet_guest_sends where at < now() - interval '1 day';
select best into old from games.yeet_guests where nick = lower(v);
if old is null then
insert into games.yeet_guests (nick, shown, best, duration_ms, ip_hash) values (lower(v), v, p_score, p_ms, ip);
elsif p_score > old then
update games.yeet_guests set shown = v, best = p_score, duration_ms = p_ms, ip_hash = ip, achieved_at = now() where nick = lower(v);
end if;
-- keep only the best 300 guest records
delete from games.yeet_guests g where g.nick not in (select nick from games.yeet_guests order by best desc, achieved_at limit 300);
return jsonb_build_object('best', greatest(coalesce(old, 0), p_score), 'saved', old is null or p_score > old, 'top', games.yeet_top());
end $$;
revoke all on function public.gry_yeet_guest_submit(text, integer, integer, integer) from public;
grant execute on function public.gry_yeet_guest_submit(text, integer, integer, integer) to anon, authenticated;

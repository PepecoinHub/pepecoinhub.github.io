-- Where's Pepe SQL, part 5 of 6 (run the parts in order)
create or replace function public.gry_wp_host_queue() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
return coalesce((select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'day', day, 'num', num, 'title', title, 'lat', lat, 'lon', lon,
'country', country, 'continent', continent, 'wiki_url', wiki_url, 'credit', credit, 'license', license, 'source_url', source_url)
order by (status = 'pending') desc, day nulls last, decided_at, id)
from games.wp_puzzles where status <> 'rejected' and (day is null or day >= games.wp_utc_day())), '[]'::jsonb);
end $$;

create or replace function public.gry_wp_host_image(p_id bigint) returns text
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
return (select data from games.wp_images where puzzle_id = p_id);
end $$;

create or replace function public.gry_wp_host_decide(p_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
update games.wp_puzzles set status = case when p_ok then 'approved' else 'rejected' end, decided_at = now()
where id = p_id and day is null;
if not found then raise exception 'That puzzle is already live, or gone'; end if;
if not p_ok then delete from games.wp_images where puzzle_id = p_id; end if;
end $$;

create or replace function public.gry_wp_host_claims() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
return jsonb_build_object(
'claims', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nick', k.nick, 'address', k.address, 'pep', k.pep, 'status', k.status,
'num', q.num, 'points', x.points, 'at', k.created_at,
'other_players_on_address', (select count(distinct z.user_id) from games.wp_claims z where z.address = k.address and z.user_id <> k.user_id)) order by k.created_at)
from games.wp_claims k join games.wp_puzzles q on q.id = k.puzzle_id
left join games.wp_plays x on x.puzzle_id = k.puzzle_id and x.user_id = k.user_id
where k.status in ('open', 'held')), '[]'::jsonb),
'paid', coalesce((select jsonb_agg(t) from (select txid, sum(pep) pep, count(*) n, max(paid_at) at from games.wp_claims
where status = 'paid' group by txid order by max(paid_at) desc limit 10) t), '[]'::jsonb),
'settings', (select jsonb_build_object('per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week, 'open', wp_rewards_open) from games.config where id = 1));
end $$;

create or replace function public.gry_wp_host_paid(p_ids bigint[], p_txid text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
if coalesce(lower(btrim(p_txid)), '') !~ '^[0-9a-f]{64}$' then raise exception 'A transaction id is 64 characters 0-9 a-f'; end if;
update games.wp_claims set status = 'paid', txid = lower(btrim(p_txid)), paid_at = now() where id = any(p_ids) and status = 'open';
get diagnostics n = row_count;
return n;
end $$;

create or replace function public.gry_wp_host_hold(p_id bigint, p_hold boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
update games.wp_claims set status = case when p_hold then 'held' else 'open' end where id = p_id and status <> 'paid';
end $$;

create or replace function public.gry_wp_host_settings(p_per_50 numeric, p_max_day int, p_max_week int, p_open boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
if p_per_50 < 0 or p_per_50 > 1000 or p_max_day < 0 or p_max_week < 0 or p_max_week > 1000000 then raise exception 'Those numbers look wrong'; end if;
update games.config set wp_pep_per_50 = p_per_50, wp_max_day = p_max_day, wp_max_week = p_max_week, wp_rewards_open = p_open where id = 1;
end $$;


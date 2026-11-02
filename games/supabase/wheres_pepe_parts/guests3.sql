-- Where's Pepe guest rewards, part 3 of 3 (run in order)
create or replace function public.gry_wp_host_claims() returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
return jsonb_build_object(
'claims', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'nick', k.nick, 'address', k.address, 'pep', k.pep, 'status', k.status,
'num', q.num, 'points', x.points, 'at', k.created_at, 'verified', k.verified,
'secs', round(extract(epoch from x.guessed_at - x.started_at)),
'other_players_on_address', (select count(distinct z.user_id) from games.wp_claims z where z.address = k.address and z.user_id <> k.user_id),
'accounts_on_network', case when k.ip_hash is null then 0 else (select count(distinct y.user_id) from games.wp_plays y where y.puzzle_id = k.puzzle_id and y.ip_hash = k.ip_hash) end
) order by k.created_at)
from games.wp_claims k join games.wp_puzzles q on q.id = k.puzzle_id
left join games.wp_plays x on x.puzzle_id = k.puzzle_id and x.user_id = k.user_id
where k.status in ('open', 'held')), '[]'::jsonb),
'paid', coalesce((select jsonb_agg(t) from (select txid, sum(pep) pep, count(*) n, max(paid_at) at from games.wp_claims
where status = 'paid' group by txid order by max(paid_at) desc limit 10) t), '[]'::jsonb),
'budget_left', games.wp_budget_left(),
'settings', (select jsonb_build_object('per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week, 'open', wp_rewards_open,
'guest_max_day', wp_guest_max_day, 'guest_max_week', wp_guest_max_week, 'guest_streak', wp_guest_streak, 'week_budget', wp_week_budget) from games.config where id = 1));
end $$;

create or replace function public.gry_wp_host_settings2(p jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
if (p->>'per_50')::numeric not between 0 and 1000 or (p->>'max_day')::int < 0 or (p->>'max_week')::int < 0
or (p->>'guest_max_day')::int < 0 or (p->>'guest_max_week')::int < 0 or (p->>'guest_streak')::int not between 1 and 30
or (p->>'week_budget')::numeric not between 0 and 100000000 then raise exception 'Those numbers look wrong'; end if;
update games.config set wp_pep_per_50 = (p->>'per_50')::numeric, wp_max_day = (p->>'max_day')::int, wp_max_week = (p->>'max_week')::int,
wp_rewards_open = (p->>'open')::boolean, wp_guest_max_day = (p->>'guest_max_day')::int, wp_guest_max_week = (p->>'guest_max_week')::int,
wp_guest_streak = (p->>'guest_streak')::int, wp_week_budget = (p->>'week_budget')::numeric where id = 1;
end $$;

revoke all on function games.wp_play_ip(), games.wp_streak(uuid, date), games.wp_budget_left() from public, anon, authenticated;

revoke all on function public.gry_wp_rewards(), public.gry_wp_claim(text), public.gry_wp_host_claims(), public.gry_wp_host_settings2(jsonb) from public;

grant execute on function public.gry_wp_rewards() to anon, authenticated;

grant execute on function public.gry_wp_claim(text), public.gry_wp_host_claims(), public.gry_wp_host_settings2(jsonb) to authenticated;


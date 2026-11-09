-- Pepe Guesser: the weekly payout list for the robot (.github/workflows/wp-payouts.yml, scripts/wp_payouts.py).
-- Run once in the Supabase SQL editor (after update_wheres_pepe.sql). Safe to run again.
-- The robot uses the same WP_ROBOT_TOKEN as the puzzle robot. It only reads: open rewards summed per address
-- (held ones stay out), plus the warning counts the host panel shows. Marking as paid stays in the host panel.
create or replace function public.gry_wp_robot_payouts(p_token text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not games.wp_robot_ok(p_token) then raise exception 'Not allowed'; end if;
  return jsonb_build_object(
    'rows', coalesce((select jsonb_agg(jsonb_build_object('address', t.address, 'pep', t.pep, 'claims', t.n, 'nicks', t.nicks) order by t.pep desc, t.address)
      from (select k.address, sum(k.pep) pep, count(*) n, string_agg(distinct k.nick, ', ') nicks
              from games.wp_claims k where k.status = 'open' group by k.address) t), '[]'::jsonb),
    'held', (select count(*) from games.wp_claims where status = 'held'),
    'shared_addresses', (select count(distinct k.address) from games.wp_claims k where k.status = 'open'
                          and exists (select 1 from games.wp_claims z where z.address = k.address and z.user_id <> k.user_id)));
end $$;

revoke all on function public.gry_wp_robot_payouts(text) from public;
grant execute on function public.gry_wp_robot_payouts(text) to anon, authenticated;

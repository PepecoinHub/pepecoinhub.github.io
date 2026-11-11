-- Pepe Guesser: rewards paid through a Discord tip bot (e.g. Filippy) have no transaction id on the chain.
-- "Paid" may now be marked without a txid (it stays empty); with a txid it is still checked as before.
-- Run once in the Supabase SQL editor (after update_wheres_pepe.sql). Safe to run again. Grants stay as they are.
create or replace function public.gry_wp_host_paid(p_ids bigint[], p_txid text) returns int
language plpgsql security definer set search_path = '' as $$
declare n int; t text := nullif(lower(btrim(coalesce(p_txid, ''))), '');
begin
  if not games.is_host_user(auth.uid()) then raise exception 'Only the host can do this'; end if;
  if t is not null and t !~ '^[0-9a-f]{64}$' then raise exception 'A transaction id is 64 characters 0-9 a-f (or leave it empty)'; end if;
  update games.wp_claims set status = 'paid', txid = t, paid_at = now() where id = any(p_ids) and status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;

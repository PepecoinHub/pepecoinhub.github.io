-- Take away the "callable without logging in" right from functions that only work for a logged-on player
-- (guest or Discord) or for the host. Review 2026-11-27 (thread "Uporządkuj prywatność, CREDITS i drafty").
--
-- Why: Supabase gives every new function in `public` a direct EXECUTE grant to `anon` (default privileges).
-- Our migration files say `revoke ... from public` + `grant ... to authenticated` for these functions, but
-- `revoke from public` does not remove that direct `anon` grant. So these are callable with only the public
-- key today. Each one checks auth.uid() / is_host_user() inside and refuses, so nothing is open now; this is
-- a second lock in case a future version forgets the check.
--
-- Safe to run more than once. Nothing changes for logged-on players: the site's PondOS and games always call
-- these with a session (meme.js wpRpc -> freshSession, host panel needs logon).
-- Not included on purpose: gry_goldhook_me (Gold Hook may call it before logon and expects null).

begin;

revoke execute on function
  public.gry_wp_host_claims(),
  public.gry_wp_host_decide(bigint, boolean),
  public.gry_wp_host_hold(bigint, boolean),
  public.gry_wp_host_image(bigint),
  public.gry_wp_host_paid(bigint[], text),
  public.gry_wp_host_queue(),
  public.gry_wp_host_settings(numeric, integer, integer, boolean),
  public.gry_wp_host_settings2(jsonb),
  public.gry_wp_claim(text),
  public.gry_wp_start(text),
  public.gry_wp_guess(double precision, double precision),
  public.gry_wp_hint(),
  public.gry_wp_leave(),
  public.gry_wp_stats(uuid),
  public.gry_wp_my_claims()
from anon, public;

-- logged-on players (guests are `authenticated` too) keep them
grant execute on function
  public.gry_wp_host_claims(),
  public.gry_wp_host_decide(bigint, boolean),
  public.gry_wp_host_hold(bigint, boolean),
  public.gry_wp_host_image(bigint),
  public.gry_wp_host_paid(bigint[], text),
  public.gry_wp_host_queue(),
  public.gry_wp_host_settings(numeric, integer, integer, boolean),
  public.gry_wp_host_settings2(jsonb),
  public.gry_wp_claim(text),
  public.gry_wp_start(text),
  public.gry_wp_guess(double precision, double precision),
  public.gry_wp_hint(),
  public.gry_wp_leave(),
  public.gry_wp_stats(uuid),
  public.gry_wp_my_claims()
to authenticated;

commit;

-- Check (should list none of the functions above):
-- select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public' and p.proname like 'gry_wp_%' and has_function_privilege('anon', p.oid, 'EXECUTE')
-- order by 1;

-- OPTIONAL, decide separately: stop new functions from being callable by anon automatically.
-- After this, every new function meant for visitors without logon needs an explicit
-- `grant execute ... to anon` (most of our files already do this). Forgetting it shows up as an error, not as a hole.
-- alter default privileges for role postgres in schema public revoke execute on functions from public, anon;

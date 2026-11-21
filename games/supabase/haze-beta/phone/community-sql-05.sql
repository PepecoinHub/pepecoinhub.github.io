-- Haze community install, part 5 of 5. Run IN ORDER after the tip/group SQL. Repeatable; everything stays OFF.
begin;
create or replace function public.community_v1_cleanup(p_args jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 delete from games.community_codes where expires_at<clock_timestamp()-interval '1 hour';
 delete from games.community_sessions where expires_at<clock_timestamp()-interval '1 day' or revoked_at<clock_timestamp()-interval '1 day';
 delete from games.community_budgets where window_start<clock_timestamp()-interval '1 day';
 return jsonb_build_object('cleaned',true);
end $$;
-- All credential operations require PH's Edge service role. A public key or
-- ordinary PH user JWT cannot mint/inspect/use these database entry points.
do $$ declare f record;begin
 for f in select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname in ('public','games') and left(p.proname,13)='community_v1_'
 loop
  execute format('revoke all on function %I.%I(%s) from public,anon,authenticated',f.nspname,f.proname,f.args);
  if f.nspname='public' then execute format('grant execute on function %I.%I(%s) to service_role',f.nspname,f.proname,f.args);end if;
 end loop;
end $$;
commit;

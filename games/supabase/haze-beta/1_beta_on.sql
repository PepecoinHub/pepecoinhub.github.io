-- Haze closed beta: turn it ON for the testers only. Run AFTER the install SQL.
-- Change only the names in the array: the testers' Discord names (any letter case, without @).
-- Each tester must have signed in to pepecoinhub.com with Discord at least once.
-- One block, so it works in the Supabase SQL editor: nothing changes unless every name matches exactly one account.
-- The result row is the value for the Edge Function secret HAZE_ACCESS: copy it there.
do $$
declare
  names text[] := array['lewisbong','BYL_DISCORD_USERNAME'];
  nm text; hits int; uid uuid;
begin
  foreach nm in array names loop
    select count(distinct i.user_id), min(i.user_id::text)::uuid into hits, uid
      from auth.identities i
     where i.provider='discord'
       and lower(nm) in (lower(regexp_replace(coalesce(i.identity_data->>'name',''),'#0$','')),
                         lower(coalesce(i.identity_data->>'full_name','')),
                         lower(coalesce(i.identity_data->>'user_name','')),
                         lower(coalesce(i.identity_data->>'preferred_username','')),
                         lower(coalesce(i.identity_data->'custom_claims'->>'global_name','')));
    if hits<>1 then
      raise exception 'Discord name "%" matches % accounts (needs exactly 1). Sign in once with Discord, or check the spelling.', nm, hits;
    end if;
    insert into games.haze_testers(user_id,label) values(uid,nm) on conflict (user_id) do update set label=excluded.label;
  end loop;
  update games.haze_settings set beta_only=true, enabled=true, groups_enabled=true where haze_settings.id;
end $$;

select string_agg(user_id::text, ',' order by label) as "HAZE_ACCESS (copy into Edge Function secrets)" from games.haze_testers;

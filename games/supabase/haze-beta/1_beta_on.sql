-- Haze closed beta: turn it ON for the testers only. Run AFTER 0_install.sql.
-- Change only the list on the next line: the testers' Discord usernames (lowercase, without @).
-- Each tester must have signed in to pepecoinhub.com with Discord at least once.
-- Nothing changes unless every name matches exactly one PepecoinHub account (the whole script rolls back).
-- The last result row is the value for the Edge Function secret HAZE_ACCESS: copy it there.
begin;
create temporary table haze_beta_names(name text primary key) on commit drop;
insert into haze_beta_names values ('lewisbong'), ('BYL_DISCORD_USERNAME');

do $$
declare n record; hits int; id uuid;
begin
  for n in select name from haze_beta_names loop
    select count(distinct i.user_id), min(i.user_id::text)::uuid into hits, id
      from auth.identities i
     where i.provider='discord'
       and lower(n.name) in (lower(regexp_replace(coalesce(i.identity_data->>'name',''),'#0$','')),
                             lower(coalesce(i.identity_data->>'full_name','')),
                             lower(coalesce(i.identity_data->>'user_name','')),
                             lower(coalesce(i.identity_data->'custom_claims'->>'global_name','')));
    if hits<>1 then
      raise exception 'Discord name "%" matches % accounts (needs exactly 1). Sign in once with Discord, or fix the spelling.', n.name, hits;
    end if;
    insert into games.haze_testers(user_id,label) values(id,n.name) on conflict (user_id) do update set label=excluded.label;
  end loop;
end $$;

update games.haze_settings set beta_only=true, enabled=true, groups_enabled=true where id;
commit;

select t.label as tester, t.user_id, s.enabled, s.groups_enabled, s.beta_only
  from games.haze_testers t cross join games.haze_settings s order by t.label;
select string_agg(user_id::text, ',' order by label) as "HAZE_ACCESS (copy into Edge Function secrets)" from games.haze_testers;

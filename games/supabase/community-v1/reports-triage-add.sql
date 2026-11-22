-- Who else gets bug reports (the owner always gets all of them). Run AFTER update_bug_reports.sql.
-- scope 'haze' = only reports about Haze Wallet / tips; 'all' = every report.
-- Names: PepecoinHub nick or Discord name (any letter case). Each must have signed in with Discord once.
-- Nothing changes unless every name matches exactly one Discord account.
do $$
declare
  people text[][] := array[['lewisbong', 'haze']];
  i int; nm text; sc text; hits int; uid uuid;
begin
  for i in 1 .. array_length(people, 1) loop
    nm := people[i][1]; sc := people[i][2];
    if sc not in ('all', 'haze') then raise exception 'Scope for "%" must be all or haze.', nm; end if;
    select count(distinct x.user_id), min(x.user_id::text)::uuid into hits, uid from (
      select p.user_id from games.profiles p
       where lower(p.nick) = lower(nm) and exists (select 1 from auth.identities d where d.user_id = p.user_id and d.provider = 'discord')
      union
      select d.user_id from auth.identities d
       where d.provider = 'discord'
         and lower(nm) in (lower(regexp_replace(coalesce(d.identity_data->>'name', ''), '#0$', '')),
                           lower(coalesce(d.identity_data->>'full_name', '')),
                           lower(coalesce(d.identity_data->>'user_name', '')),
                           lower(coalesce(d.identity_data->>'preferred_username', '')),
                           lower(coalesce(d.identity_data->'custom_claims'->>'global_name', '')))) x;
    if hits <> 1 then raise exception 'Name "%" matches % Discord accounts (needs exactly 1).', nm, hits; end if;
    insert into games.report_triage(user_id, label, scope) values (uid, nm, sc)
      on conflict (user_id) do update set label = excluded.label, scope = excluded.scope;
  end loop;
end $$;

select t.label, p.nick as nick_on_site, t.scope from games.report_triage t left join games.profiles p on p.user_id = t.user_id;

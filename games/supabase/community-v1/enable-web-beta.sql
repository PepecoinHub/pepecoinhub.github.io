-- Review first. Replace BYL_DISCORD_USERNAME with Byl's real Discord account
-- name. Both testers must already have signed in on PH with Discord.
-- This changes only the new limited Community gate, not public PH tipping.
do $$
declare names text[]:=array['lewisbong','BYL_DISCORD_USERNAME'];nm text;hits integer;u uuid;
begin
 foreach nm in array names loop
  select count(distinct i.user_id),min(i.user_id::text)::uuid into hits,u
  from auth.identities i where i.provider='discord' and lower(nm) in
  (lower(regexp_replace(coalesce(i.identity_data->>'name',''),'#0$','')),
   lower(coalesce(i.identity_data->>'full_name','')),
   lower(coalesce(i.identity_data->>'user_name','')),
   lower(coalesce(i.identity_data->>'preferred_username','')),
   lower(coalesce(i.identity_data->'custom_claims'->>'global_name','')));
  if hits<>1 then raise exception 'Discord name "%" matches % accounts; expected exactly one.',nm,hits;end if;
  insert into games.haze_testers(user_id,label) values(u,nm) on conflict(user_id) do update set label=excluded.label;
 end loop;
 update games.community_settings set enabled=true,beta_only=true where id;
 update games.community_clients set enabled=true where id='haze-web';
end $$;
select id,label,enabled,redirect_uri,origins from games.community_clients order by id;

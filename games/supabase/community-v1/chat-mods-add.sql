-- Make frens chat moderators (delete messages, mute players up to 72 h). Run AFTER update_chat_moderators.sql.
-- Change only the names in the array: their PepecoinHub nick or Discord name (any letter case, without @).
-- Each one must have signed in to pepecoinhub.com with Discord at least once.
-- Nothing changes unless every name matches exactly one Discord account. The last result lists all moderators.
do $$
declare
  names text[] := array['Lemon'];
  nm text; hits int; uid uuid;
begin
  foreach nm in array names loop
    select count(distinct x.user_id), min(x.user_id::text)::uuid into hits, uid from (
      select p.user_id from games.profiles p
       where lower(p.nick) = lower(nm) and exists (select 1 from auth.identities i where i.user_id = p.user_id and i.provider = 'discord')
      union
      select i.user_id from auth.identities i
       where i.provider = 'discord'
         and lower(nm) in (lower(regexp_replace(coalesce(i.identity_data->>'name', ''), '#0$', '')),
                           lower(coalesce(i.identity_data->>'full_name', '')),
                           lower(coalesce(i.identity_data->>'user_name', '')),
                           lower(coalesce(i.identity_data->>'preferred_username', '')),
                           lower(coalesce(i.identity_data->'custom_claims'->>'global_name', '')))) x;
    if hits <> 1 then
      raise exception 'Name "%" matches % Discord accounts (needs exactly 1). Check the spelling, or ask them to sign in once with Discord.', nm, hits;
    end if;
    insert into games.chat_mods(user_id, label) values (uid, nm) on conflict (user_id) do update set label = excluded.label;
  end loop;
end $$;

select m.label as moderator, p.nick as nick_on_site, m.added_at from games.chat_mods m
  left join games.profiles p on p.user_id = m.user_id order by m.added_at;

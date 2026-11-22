-- Before adding a moderator: who is this Discord name? Read-only. Expect exactly one row.
-- Compare discord_id with Discord: Settings → Advanced → Developer Mode, then long-press the user → Copy User ID.
select p.nick as nick_on_site,
       i.identity_data->>'user_name' as discord_username,
       coalesce(i.identity_data->'custom_claims'->>'global_name', i.identity_data->>'full_name') as discord_display,
       i.identity_data->>'provider_id' as discord_id,
       u.created_at::date as account_since,
       u.last_sign_in_at as last_sign_in
from auth.identities i
join auth.users u on u.id = i.user_id
left join games.profiles p on p.user_id = i.user_id
where i.provider = 'discord'
  and (lower(coalesce(i.identity_data->>'user_name', '')) in ('.lemontart.', 'lemontart')
       or lower(coalesce(i.identity_data->>'name', '')) in ('.lemontart.', 'lemontart')
       or lower(coalesce(p.nick, '')) = 'lemon');

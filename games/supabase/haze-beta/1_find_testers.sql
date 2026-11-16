-- Haze closed beta, step 1: find the Supabase user IDs of the two testers (Byl and Lewisbong).
-- Read-only. Run in the Supabase SQL editor of the PRODUCTION project and copy the two `user_id` values.
-- Each tester must have signed in to pepecoinhub.com with Discord at least once.
select i.user_id,
       i.identity_data->>'full_name'                     as discord_name,
       i.identity_data->>'name'                          as discord_username,
       i.identity_data->'custom_claims'->>'global_name'  as display_name,
       p.nick                                            as pepecoinhub_nick,
       u.last_sign_in_at
from auth.identities i
join auth.users u on u.id = i.user_id
left join games.profiles p on p.user_id = i.user_id
where i.provider = 'discord'
  and (i.identity_data::text ilike '%lewisbong%' or i.identity_data::text ilike '%byl%' or p.nick ilike any (array['%lewisbong%','%byl%']))
order by u.last_sign_in_at desc nulls last;

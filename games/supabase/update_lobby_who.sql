-- LAN Party 2: "who is online" list for the PondOS chat.
-- Run once in the Supabase SQL editor after update_open_chat.sql. Safe to run again.
--
-- Reads only: nothing new is stored. The chat already keeps games.lobby_seen (who has the chat open,
-- refreshed by gry_lobby_chat, deleted after 10 minutes). This function turns it into a list:
--   * frens: verified (Discord) players with the chat open in the last 90 seconds, by their reserved nickname;
--   * guests: nicknames of guests who wrote in the last 15 minutes (guests have no account to show as "online");
--   * lurkers: everyone else with the chat open, as a number only.
-- No IP hashes, Discord ids or visitor ids leave the database. user_id is returned for verified frens only,
-- because the chat messages already carry it (it opens the Fren Passport).

create or replace function public.gry_lobby_who(p_visitor text default null) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare u uuid := auth.uid(); fr jsonb; gu jsonb; n_on int; n_fr int; n_gu int;
begin
  select count(*) into n_on from games.lobby_seen where seen_at > now() - interval '90 seconds';

  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'nick', x.nick, 'me', x.user_id = u) order by lower(x.nick)), '[]'::jsonb), count(*)
    into fr, n_fr
    from (select distinct p.user_id, p.nick
            from games.lobby_seen s join games.profiles p on p.user_id = s.user_id
           where s.seen_at > now() - interval '90 seconds' and p.discord_id is not null
           limit 60) x;

  select coalesce(jsonb_agg(jsonb_build_object('nick', g.nick) order by g.last_at desc), '[]'::jsonb), count(*)
    into gu, n_gu
    from (select nick, max(created_at) last_at from games.lobby_chat
           where created_at > now() - interval '15 minutes' and hidden_at is null and not verified
           group by nick order by max(created_at) desc limit 30) g;

  return jsonb_build_object('frens', fr, 'guests', gu, 'lurkers', greatest(0, n_on - n_fr - n_gu));
end $$;

revoke all on function public.gry_lobby_who(text) from public;
grant execute on function public.gry_lobby_who(text) to anon, authenticated;

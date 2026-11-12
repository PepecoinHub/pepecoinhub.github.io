-- Flipsuite (Flippy) custom quest check: "does this Discord fren have stamp X in their PondOS passport?"
-- Used only by the edge function flip-verify (service role). Nobody on the site can call it: anon and
-- logged-in users get no access, so it cannot be used to look people up.
-- Safe to run twice. Supabase > SQL Editor > New query > paste > Run.
begin;

create or replace function public.flip_has_badge(p_discord_id text, p_badge text)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'linked', exists (select 1 from auth.identities i where i.provider = 'discord' and i.provider_id = p_discord_id),
    'has', exists (
      select 1 from auth.identities i
      join games.passport_badges b on b.user_id = i.user_id
      where i.provider = 'discord' and i.provider_id = p_discord_id and b.badge_id = p_badge),
    'earned_at', (
      select min(b.earned_at) from auth.identities i
      join games.passport_badges b on b.user_id = i.user_id
      where i.provider = 'discord' and i.provider_id = p_discord_id and b.badge_id = p_badge))
$$;

revoke all on function public.flip_has_badge(text, text) from public, anon, authenticated;
grant execute on function public.flip_has_badge(text, text) to service_role;

commit;

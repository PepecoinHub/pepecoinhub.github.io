-- Fren Passport: look at another fren's passport (read only).
-- DRAFT. Apply to PH-games only after review, after update_fren_passport.sql and update_fren_avatar.sql.
-- update_passport_awards.sql can run before or after this file. Safe to run twice. It writes nothing.
--
-- Owner decisions (2026-11-08):
--   * Only players logged on with Discord can look, and only Discord players have a passport to look at
--     (guests and e-mail accounts have none).
--   * Everything the owner sees in their own booklet is public: the Fren (avatar), nickname, member since,
--     stamps with their dates, secrets with their dates, items and the best YEET flight. There is no switch
--     to hide a passport.
--   * Not shared: the counters behind the owner's Next Milestone bar (PondOS days and streak, chat days,
--     letters sent, Pepe Miner minutes, Pepe Guesser days and streak). They would show when someone is
--     around, and the letters and chat counters are kept off every screen on purpose. The Discord account
--     id and the e-mail address are never sent.
--   * A passport is found by its user id only (the LAN Party chat gets it with each verified message),
--     never by nickname, so nobody can walk the list of players.
--   * The browser UI stays behind /meme/?beta=fren until the owner opens the Passport to everyone.
--
-- The stamp list is the same one gry_passport_state() gives the owner: First Fren (Discord linked), every
-- stored stamp, and Moonwalker from the YEET record when the awards migration has not stored it yet.
-- 'times' is passed on when the badges table has that column (repeatable stamps, Frog of the Week).
begin;

create or replace function public.gry_passport_public(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb;
  pond_nick text;
  joined timestamptz;
  best_distance integer := 0;
  best_date timestamptz;
  stamps jsonb;
  discovered jsonb;
  owned_items jsonb;
  look jsonb;
begin
  -- the one looking: logged on with Discord (anonymous Supabase guests also have auth.uid())
  if u is null or games.discord_identity(u) is null then
    return jsonb_build_object('signed_in', false);
  end if;
  -- the one looked at: a Discord player
  d := games.discord_identity(p_user);
  if d is null then
    return jsonb_build_object('signed_in', true, 'found', false);
  end if;

  select au.created_at into joined from auth.users au where au.id = p_user;
  select p.nick into pond_nick from games.profiles p where p.user_id = p_user;

  select coalesce(y.best, 0), y.achieved_at into best_distance, best_date
    from games.yeet_records y where y.user_id = p_user;
  best_distance := coalesce(best_distance, 0);

  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', b.badge_id,
           'title', case b.badge_id when 'first_avatar' then 'Fresh Fren' else b.badge_id end,
           'earned_at', b.earned_at,
           'times', to_jsonb(b) -> 'times')) order by b.earned_at), '[]'::jsonb)
    into stamps
    from games.passport_badges b where b.user_id = p_user;
  stamps := jsonb_build_array(jsonb_build_object('id', 'first_fren', 'title', 'First Fren', 'earned_at', joined)) || stamps;
  if best_distance >= 60000 and best_date is not null and not exists (
       select 1 from games.passport_badges b where b.user_id = p_user and b.badge_id = 'moonwalker') then
    stamps := stamps || jsonb_build_array(jsonb_build_object('id', 'moonwalker', 'title', 'Moonwalker', 'earned_at', best_date));
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.secret_id, 'discovered_at', s.discovered_at) order by s.discovered_at), '[]'::jsonb)
    into discovered
    from games.passport_secrets s where s.user_id = p_user;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.item_id, 'quantity', i.quantity, 'earned_at', i.earned_at) order by i.earned_at), '[]'::jsonb)
    into owned_items
    from games.passport_items i where i.user_id = p_user;

  select jsonb_build_object('schema_version', a.schema_version,
           'bg', a.bg, 'clothing', a.clothing,
           'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'accessory', a.accessory, 'special', a.special)
    into look
    from games.passport_avatars a where a.user_id = p_user;

  return jsonb_build_object(
    'signed_in', true,
    'found', true,
    'user_id', p_user,
    'nickname', coalesce(nullif(d->>'name', ''), 'Discord fren'),
    'nick', pond_nick,
    'member_since', joined,
    'yeet_best', best_distance,
    'achievements', stamps,
    'achievements_earned', (select count(*) from jsonb_array_elements(stamps) x where x->>'earned_at' is not null),
    'secrets', discovered,
    'items', owned_items,
    'avatar', look
  );
end
$$;

revoke all on function public.gry_passport_public(uuid) from public, anon, authenticated;
grant execute on function public.gry_passport_public(uuid) to authenticated;

commit;

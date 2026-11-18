-- Fren avatar: the "Long Live the King" stamp unlocks the King Fren special avatar; the Crown hat stays free for everyone (owner, 2026-11-18).
-- Run once in the Supabase SQL editor (after update_fren_avatar.sql, which is already live). Safe to run again.
-- Only replaces public.gry_passport_avatar_save, the same body as update_fren_avatar.sql (keep the two equal;
-- tests/passport.test.mjs checks it). It does NOT touch gry_passport_state, so running it cannot undo the newer
-- Passport read path from update_passport_awards.sql (re-running update_fren_avatar.sql alone would).
--  * special_king is saveable only with the long_live_the_king stamp (10 Pond King duels won in one reign).
--  * special_crown_breaker is saveable only with the crown_breaker stamp (ending a reign after 13 defenses).
--  * A reward part already on a player's saved look is never refused.
begin;

-- the six-part version of this RPC is replaced (one signature only; an old page that sends six parts
-- still works, because p_special has a default)
drop function if exists public.gry_passport_avatar_save(text, text, text, text, text, text);
create or replace function public.gry_passport_avatar_save(
  p_bg text, p_clothing text, p_mouth text, p_eyes text, p_hat text, p_accessory text, p_special text default 'special_none')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  cooldown constant interval := interval '3 seconds';
  daily_budget constant integer := 40;
  today date := (now() at time zone 'utc')::date;
  saved games.passport_avatars%rowtype;
  first_save boolean := false;
  changed boolean := true;
  badge_new timestamptz;
  badge_at timestamptz;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Log on with Discord to save your Fren' using errcode = '42501';
  end if;
  -- Exact per-slot allowlists, in manifest order: every part of the manifest,
  -- the free ones first, then the reward parts (the ones with an 'unlock' key).
  if p_bg is null or p_bg not in ('bg_sky', 'bg_night', 'bg_city', 'bg_snow', 'bg_forest', 'bg_sunset')
     or p_clothing is null or p_clothing not in ('clothing_none', 'clothing_blue', 'clothing_purple_hoodie', 'clothing_black_hoodie', 'clothing_shirt_tie', 'clothing_camo', 'clothing_suit')
     or p_mouth is null or p_mouth not in ('mouth_flat', 'mouth_smile', 'mouth_open', 'mouth_tongue', 'mouth_teeth', 'mouth_smirk', 'mouth_shout', 'mouth_wide_tongue', 'mouth_laugh')
     or p_eyes is null or p_eyes not in ('eyes_classic', 'eyes_sleepy', 'eyes_angry', 'eyes_bloodshot', 'eyes_3d', 'eyes_hypno', 'eyes_side', 'eyes_happy', 'eyes_hearts')
     or p_hat is null or p_hat not in ('hat_none', 'hat_pep_cap', 'hat_beanie', 'hat_bucket', 'hat_crown', 'hat_hardhat', 'hat_detective', 'hat_explorer')
     or p_accessory is null or p_accessory not in ('accessory_none', 'accessory_shades', 'accessory_round', 'accessory_orange', 'accessory_cigarette', 'accessory_pipe', 'accessory_headphones')
     or p_special is null or p_special not in ('special_none', 'special_explorer', 'special_batman', 'special_vampire', 'special_smile', 'special_nerd', 'special_soldier', 'special_straw', 'special_knight',
                                                   'special_seeker', 'special_looking', 'special_sherlock', 'special_scribe', 'special_editor',
                                                   'special_birthday', 'special_santa', 'special_turkey',
                                                   'special_gamer', 'special_gigachad', 'special_party', 'special_cupid', 'special_juice', 'special_beanie', 'special_chill', 'special_bigfren', 'special_dolphin', 'special_retro', 'special_king', 'special_crown_breaker') then
    raise exception 'Unknown avatar option' using errcode = '22023';
  end if;
  -- Reward parts: saveable only by a player who holds the stamp that unlocks them
  -- (the manifest's 'unlock' keys; stamps are awarded by the server only).
  if exists (
    select 1 from (values ('bg_sunset', 'yeet_adept'), ('clothing_suit', 'detective_fren'), ('hat_hardhat', 'rookie_miner'),
                          ('hat_detective', 'detective_fren'), ('accessory_headphones', 'arcade_hopper'),
                          ('hat_explorer', 'scout_fren'), ('special_explorer', 'scout_fren'),
                          ('special_knight', 'good_game'),
                          ('special_batman', 'why_tho'), ('special_vampire', 'midnight_fren'), ('special_smile', 'happy_fren'),
                          ('special_nerd', 'nerd_alert'), ('special_soldier', 'born_to_fren'), ('special_straw', 'bali_dreamer'),
                          ('special_seeker', 'secret_starter'), ('special_looking', 'find_fren'), ('special_sherlock', 'address_check'),
                          ('special_scribe', 'dear_editor'), ('special_editor', 'senior_editor'), ('special_birthday', 'pep_birthday'),
                          ('special_santa', 'frogmas'), ('special_turkey', 'thanksgiving_fren'),
                          ('special_gamer', 'arcade_hopper'), ('special_gigachad', 'share_fren'), ('special_party', 'old_frog'), ('special_cupid', 'valentine_fren'), ('special_juice', 'welcome_back'), ('special_beanie', 'streak_14'), ('special_chill', 'like_it_here'), ('special_bigfren', 'certified_fren'), ('special_dolphin', 'nasa_is_hiring'), ('special_retro', 'fud_buster'), ('special_king', 'long_live_the_king'), ('special_crown_breaker', 'crown_breaker')) r(part, stamp)
     where r.part in (p_bg, p_clothing, p_hat, p_accessory, p_special)
       -- the unlock is a stamp, or (for most special avatars) a secret
       and not exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = r.stamp)
       and not exists (select 1 from games.passport_secrets s where s.user_id = u and s.secret_id = r.stamp)
       -- a part already on the player's saved look stays allowed (a reward part never locks a saved look)
       and not exists (select 1 from games.passport_avatars a where a.user_id = u
                          and r.part in (a.bg, a.clothing, a.hat, a.accessory, a.special))) then
    raise exception 'That part is locked: earn its stamp first' using errcode = '42501';
  end if;

  -- First save. A concurrent first save of the same player waits on the
  -- primary key here, then takes the update path below.
  insert into games.passport_avatars (user_id, bg, clothing, mouth, eyes, hat, accessory, special)
  values (u, p_bg, p_clothing, p_mouth, p_eyes, p_hat, p_accessory, p_special)
  on conflict (user_id) do nothing
  returning * into saved;
  first_save := found;

  if not first_save then
    -- One save at a time per player.
    select * into saved from games.passport_avatars a where a.user_id = u for update;
    changed := (saved.bg, saved.clothing, saved.mouth, saved.eyes, saved.hat, saved.accessory, saved.special)
               is distinct from (p_bg, p_clothing, p_mouth, p_eyes, p_hat, p_accessory, p_special);
    -- Saving the same look again (a double click, a retry) is a no-op success.
    if changed then
      if saved.updated_at > now() - cooldown then
        raise exception 'Saving too fast. Wait a few seconds and try again.' using errcode = 'P0001';
      end if;
      if saved.budget_day = today and saved.budget_used >= daily_budget then
        raise exception 'Daily save limit reached. Your Fren can change again tomorrow (UTC).' using errcode = 'P0001';
      end if;
      update games.passport_avatars a
         set bg = p_bg, clothing = p_clothing, mouth = p_mouth, eyes = p_eyes, hat = p_hat, accessory = p_accessory, special = p_special,
             updated_at = now(),
             budget_used = case when a.budget_day = today then a.budget_used + 1 else 1 end,
             budget_day = today
       where a.user_id = u
      returning * into saved;
    end if;
  end if;
  -- Fresh Fren: the first save from the season start on (a look saved in the beta does not count), once per player.
  if games.passport_open() then
    insert into games.passport_badges (user_id, badge_id)
    values (u, 'first_avatar')
    on conflict (user_id, badge_id) do nothing
    returning earned_at into badge_new;
  end if;

  select b.earned_at into badge_at
    from games.passport_badges b
   where b.user_id = u and b.badge_id = 'first_avatar';

  return jsonb_build_object(
    'avatar', jsonb_build_object(
      'schema_version', saved.schema_version,
      'bg', saved.bg, 'clothing', saved.clothing,
      'mouth', saved.mouth, 'eyes', saved.eyes, 'hat', saved.hat, 'accessory', saved.accessory, 'special', saved.special),
    'updated_at', saved.updated_at,
    'first_save', first_save,
    'changed', changed,
    'badge', case when badge_at is null then null else jsonb_build_object(
      'id', 'first_avatar', 'earned_at', badge_at, 'new', badge_new is not null) end
  );
end
$$;

revoke all on function public.gry_passport_avatar_save(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.gry_passport_avatar_save(text, text, text, text, text, text, text) to authenticated;

commit;

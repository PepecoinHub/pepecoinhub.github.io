-- Fren Avatar Maker v2: one saved Fren look per Discord player, and the
-- Fresh Fren achievement (first_avatar) for the first look the server saves.
-- DRAFT. Apply to PH-games only after review, after update_fren_passport.sql.
-- Safe to run twice. It awards nothing by itself.
--
-- v2 schema (Stage D): the avatar is a stack of 512x512 SVG layers described in
-- docs/meme/avatar-options.json (schema_version 2). layers_order is
-- [bg, base, clothing, mouth, eyes, hat, accessory]. 'base' (defaults.base =
-- 'base_frog') is a single implied constant layer painted between bg and
-- clothing; it is NOT a saved column. The saveable slots (columns) are:
-- bg, clothing, mouth, eyes, hat, accessory.
--
-- v1 -> v2 column changes versus the previous draft of this file:
--   * schema_version default+check bumped from 1 to 2.
--   * outfit column RENAMED to clothing (regex '^clothing_[a-z0-9_]{1,40}$').
--   * bg column ADDED (regex '^bg_[a-z0-9_]{1,40}$').
--   * accessory column ADDED (regex '^accessory_[a-z0-9_]{1,40}$').
--   * mouth/eyes/hat columns kept as-is.
-- This stage targets a FRESH apply (create table if not exists with the v2
-- columns below). The live v1 table is NOT migrated by this file. To migrate an
-- existing v1 games.passport_avatars in place, run (reviewed, outside this
-- draft) something like:
--     alter table games.passport_avatars
--       rename column outfit to clothing;
--     alter table games.passport_avatars
--       drop constraint if exists passport_avatars_outfit_check,
--       add constraint passport_avatars_clothing_check
--         check (clothing ~ '^clothing_[a-z0-9_]{1,40}$'),
--       add column bg text not null default 'bg_sky'
--         check (bg ~ '^bg_[a-z0-9_]{1,40}$'),
--       add column accessory text not null default 'accessory_none'
--         check (accessory ~ '^accessory_[a-z0-9_]{1,40}$'),
--       alter column schema_version set default 2,
--       drop constraint if exists passport_avatars_schema_version_check,
--       add constraint passport_avatars_schema_version_check
--         check (schema_version = 2);
--   plus backfilling existing rows' bg/accessory and remapping any legacy
--   'outfit_*' ids to 'clothing_*'. Do this only after review; this file does
--   not touch the live table.
--
-- Trust boundary:
--   * The browser only sends six option IDs. No user ID, badge ID or image.
--   * auth.uid() plus a real Discord identity decide whose row is written.
--   * Option IDs must match the fixed lists below exactly. They mirror the
--     options in docs/meme/avatar-options.json
--     (tests/passport-avatar-sql.test.mjs checks this).
--   * first_avatar is inserted only by the first save, in the same transaction
--     as the avatar row, so a failed save never leaves a badge behind.
--   * A save can be rejected (too fast, daily budget). Errors are never success.
--
-- REWARD PARTS:
--   Some manifest options carry an 'unlock' key. They are saveable only when
--   the player already holds that stamp in games.passport_badges (stamps are
--   awarded by the server, see update_passport_awards.sql); otherwise the save
--   is rejected with 'That part is locked' (errcode 42501). Tampering with the
--   browser cannot unlock them. The reward parts are:
--     hat_hardhat        (unlock rookie_miner: first Pepe Miner cloud save)
--     hat_detective      (unlock detective_fren)
--     clothing_suit      (unlock detective_fren)
--     bg_sunset          (unlock yeet_adept, not earnable yet)
--     accessory_headphones (unlock arcade_hopper, not earnable yet)
--     hat_explorer       (unlock scout_fren)
--     special_explorer   (unlock scout_fren)
--     special_knight     (unlock good_game: a board game played to the end with another Discord player)
--     special_batman, special_vampire, special_smile, special_nerd, special_soldier, special_straw
--                        (unlocked by the secrets why_tho, midnight_fren, happy_fren, nerd_alert, born_to_fren, bali_dreamer)
--     special_seeker (secret_starter), special_scribe (dear_editor), special_editor (senior_editor),
--     special_santa (frogmas), special_looking and special_sherlock (the secrets find_fren, address_check),
--     special_birthday and special_turkey (the event days pep_birthday, thanksgiving_fren)
--
-- SPECIAL AVATARS: the 'special' slot holds a whole drawn character (by Lily) for a
-- big milestone. 'special_none' means the normal stacked parts; any other id
-- replaces every part layer except the background in the browser. The parts are
-- still saved, so turning the special avatar off brings the old look back.
begin;

create table if not exists games.passport_avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version smallint not null default 2 check (schema_version = 2),
  bg text not null check (bg ~ '^bg_[a-z0-9_]{1,40}$'),
  clothing text not null check (clothing ~ '^clothing_[a-z0-9_]{1,40}$'),
  mouth text not null check (mouth ~ '^mouth_[a-z0-9_]{1,40}$'),
  eyes text not null check (eyes ~ '^eyes_[a-z0-9_]{1,40}$'),
  hat text not null check (hat ~ '^hat_[a-z0-9_]{1,40}$'),
  accessory text not null check (accessory ~ '^accessory_[a-z0-9_]{1,40}$'),
  special text not null default 'special_none' check (special ~ '^special_[a-z0-9_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- save budget, never sent to the browser
  budget_day date not null default (now() at time zone 'utc')::date,
  budget_used smallint not null default 1 check (budget_used between 0 and 1000)
);

-- Private table: no direct client access. Only the RPCs below touch it.
alter table games.passport_avatars add column if not exists special text not null default 'special_none'
  check (special ~ '^special_[a-z0-9_]{1,40}$');
alter table games.passport_avatars enable row level security;
revoke all on games.passport_avatars from public, anon, authenticated;

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
                                                   'special_birthday', 'special_santa', 'special_turkey') then
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
                          ('special_santa', 'frogmas'), ('special_turkey', 'thanksgiving_fren')) r(part, stamp)
     where r.part in (p_bg, p_clothing, p_hat, p_accessory, p_special)
       -- the unlock is a stamp, or (for most special avatars) a secret
       and not exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = r.stamp)
       and not exists (select 1 from games.passport_secrets s where s.user_id = u and s.secret_id = r.stamp)) then
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

-- Passport read path: the same snapshot as update_fren_passport.sql, plus
-- avatar {schema_version, bg, clothing, mouth, eyes, hat, accessory} or null.
-- base ('base_frog') is a constant implied layer and is omitted here to match
-- the manifest note. Keep the two files in sync; this file is the newer one.
create or replace function public.gry_passport_state()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  d jsonb;
  joined timestamptz;
  best_distance integer := 0;
  best_date timestamptz;
  extra_badges jsonb;
  discovered jsonb;
  owned_items jsonb;
  earned_count integer;
  badge_catalog jsonb;
  look jsonb;
begin
  -- Anonymous Supabase users also have auth.uid(). Require Discord specifically.
  if u is null then
    return jsonb_build_object('signed_in', false);
  end if;
  d := games.discord_identity(u);
  if d is null then
    return jsonb_build_object('signed_in', false);
  end if;

  select au.created_at into joined
    from auth.users au where au.id = u;

  select coalesce(y.best, 0), y.achieved_at
    into best_distance, best_date
    from games.yeet_records y where y.user_id = u;
  best_distance := coalesce(best_distance, 0);

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.badge_id,
           'title', case b.badge_id when 'first_avatar' then 'Fresh Fren' else b.badge_id end,
           'description', 'Awarded by a PepecoinHub game',
           'earned_at', b.earned_at) order by b.earned_at), '[]'::jsonb)
    into extra_badges
    from games.passport_badges b where b.user_id = u and b.badge_id <> 'certified_fren';

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.secret_id, 'discovered_at', s.discovered_at)
           order by s.discovered_at), '[]'::jsonb)
    into discovered
    from games.passport_secrets s where s.user_id = u;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.item_id, 'quantity', i.quantity, 'earned_at', i.earned_at)
           order by i.earned_at), '[]'::jsonb)
    into owned_items
    from games.passport_items i where i.user_id = u;

  select jsonb_build_object('schema_version', a.schema_version,
           'bg', a.bg, 'clothing', a.clothing,
           'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'accessory', a.accessory, 'special', a.special)
    into look
    from games.passport_avatars a where a.user_id = u;

  badge_catalog := jsonb_build_array(
    jsonb_build_object('id', 'first_fren', 'title', 'First Fren',
      'description', 'Joined the pond with Discord.',
      'earned_at', case when games.passport_open() then greatest(joined, games.passport_start()) end),
    jsonb_build_object('id', 'moonwalker', 'title', 'Moonwalker',
      'description', 'Recorded a 6000 m YEET flight. Moon Rock inventory validation is not enabled yet.',
      -- stored by update_passport_awards.sql from the season start; old records are not backfilled
      'earned_at', (select b.earned_at from games.passport_badges b where b.user_id = u and b.badge_id = 'moonwalker')),
    jsonb_build_object('id', 'certified_fren', 'title', 'Certified Fren',
      'description', '100 distinct care days in PepeGochi.',
      'earned_at', (select b.earned_at from games.passport_badges b
                    where b.user_id = u and b.badge_id = 'certified_fren'))
  );
  select count(*) into earned_count from jsonb_array_elements(badge_catalog) x
    where x->>'earned_at' is not null;
  earned_count := earned_count + jsonb_array_length(extra_badges);

  return jsonb_build_object(
    'signed_in', true,
    'nickname', coalesce(nullif(d->>'name', ''), 'Discord fren'),
    'member_since', joined,
    'yeet_best', best_distance,
    'achievements', badge_catalog || extra_badges,
    'achievements_earned', earned_count,
    'secrets', discovered,
    'items', owned_items,
    'avatar', look,
    'care_days', null
  );
end
$$;

revoke all on function public.gry_passport_state() from public, anon, authenticated;
grant execute on function public.gry_passport_state() to authenticated;

commit;

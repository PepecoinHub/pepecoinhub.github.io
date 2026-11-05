-- Fren Avatar Maker v1: one saved Fren look per Discord player, and the
-- Fresh Fren achievement (first_avatar) for the first look the server saves.
-- DRAFT. Apply to PH-games only after review, after update_fren_passport.sql.
-- Safe to run twice. It awards nothing by itself.
--
-- Trust boundary:
--   * The browser only sends four option IDs. No user ID, badge ID or image.
--   * auth.uid() plus a real Discord identity decide whose row is written.
--   * Option IDs must match the fixed lists below exactly. They mirror
--     docs/meme/avatar-options.json (tests/passport-avatar.test.mjs checks this).
--   * first_avatar is inserted only by the first save, in the same transaction
--     as the avatar row, so a failed save never leaves a badge behind.
--   * A save can be rejected (too fast, daily budget). Errors are never success.
begin;

create table if not exists games.passport_avatars (
  user_id uuid primary key references auth.users(id) on delete cascade,
  schema_version smallint not null default 1 check (schema_version = 1),
  mouth text not null check (mouth ~ '^mouth_[a-z0-9_]{1,40}$'),
  eyes text not null check (eyes ~ '^eyes_[a-z0-9_]{1,40}$'),
  hat text not null check (hat ~ '^hat_[a-z0-9_]{1,40}$'),
  outfit text not null check (outfit ~ '^outfit_[a-z0-9_]{1,40}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- save budget, never sent to the browser
  budget_day date not null default (now() at time zone 'utc')::date,
  budget_used smallint not null default 1 check (budget_used between 0 and 1000)
);

-- Private table: no direct client access. Only the RPCs below touch it.
alter table games.passport_avatars enable row level security;
revoke all on games.passport_avatars from public, anon, authenticated;

create or replace function public.gry_passport_avatar_save(
  p_mouth text, p_eyes text, p_hat text, p_outfit text)
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
  if p_mouth is null or p_mouth not in ('mouth_smile', 'mouth_grin', 'mouth_open', 'mouth_tongue')
     or p_eyes is null or p_eyes not in ('eyes_classic', 'eyes_sleepy', 'eyes_wide', 'eyes_shades', 'eyes_round', 'eyes_3d')
     or p_hat is null or p_hat not in ('hat_none', 'hat_pep_cap', 'hat_beanie', 'hat_bucket', 'hat_crown')
     or p_outfit is null or p_outfit not in ('outfit_blue', 'outfit_purple_hoodie', 'outfit_black_hoodie', 'outfit_white_pep', 'outfit_orange_vest') then
    raise exception 'Unknown avatar option' using errcode = '22023';
  end if;

  -- First save. A concurrent first save of the same player waits on the
  -- primary key here, then takes the update path below.
  insert into games.passport_avatars (user_id, mouth, eyes, hat, outfit)
  values (u, p_mouth, p_eyes, p_hat, p_outfit)
  on conflict (user_id) do nothing
  returning * into saved;
  first_save := found;

  if not first_save then
    -- One save at a time per player.
    select * into saved from games.passport_avatars a where a.user_id = u for update;
    changed := (saved.mouth, saved.eyes, saved.hat, saved.outfit)
               is distinct from (p_mouth, p_eyes, p_hat, p_outfit);
    -- Saving the same look again (a double click, a retry) is a no-op success.
    if changed then
      if saved.updated_at > now() - cooldown then
        raise exception 'Saving too fast. Wait a few seconds and try again.' using errcode = 'P0001';
      end if;
      if saved.budget_day = today and saved.budget_used >= daily_budget then
        raise exception 'Daily save limit reached. Your Fren can change again tomorrow (UTC).' using errcode = 'P0001';
      end if;
      update games.passport_avatars a
         set mouth = p_mouth, eyes = p_eyes, hat = p_hat, outfit = p_outfit,
             updated_at = now(),
             budget_used = case when a.budget_day = today then a.budget_used + 1 else 1 end,
             budget_day = today
       where a.user_id = u
      returning * into saved;
    end if;
  else
    -- Fresh Fren: only the first saved look can mint it, once per player.
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
      'mouth', saved.mouth, 'eyes', saved.eyes, 'hat', saved.hat, 'outfit', saved.outfit),
    'updated_at', saved.updated_at,
    'first_save', first_save,
    'changed', changed,
    'badge', case when badge_at is null then null else jsonb_build_object(
      'id', 'first_avatar', 'earned_at', badge_at, 'new', badge_new is not null) end
  );
end
$$;

revoke all on function public.gry_passport_avatar_save(text, text, text, text) from public, anon, authenticated;
grant execute on function public.gry_passport_avatar_save(text, text, text, text) to authenticated;

-- Passport read path: the same snapshot as update_fren_passport.sql, plus
-- avatar {schema_version, mouth, eyes, hat, outfit} or null. Keep the two in
-- sync; this file is the newer definition.
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
           'mouth', a.mouth, 'eyes', a.eyes, 'hat', a.hat, 'outfit', a.outfit)
    into look
    from games.passport_avatars a where a.user_id = u;

  badge_catalog := jsonb_build_array(
    jsonb_build_object('id', 'first_fren', 'title', 'First Fren',
      'description', 'Joined the pond with Discord.', 'earned_at', joined),
    jsonb_build_object('id', 'moonwalker', 'title', 'Moonwalker',
      'description', 'Recorded a 6000 m YEET flight. Moon Rock inventory validation is not enabled yet.',
      'earned_at', case when best_distance = 60000 then best_date else null end),
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

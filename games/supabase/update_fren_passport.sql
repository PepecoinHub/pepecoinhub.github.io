-- Fren Passport v1: private collections and read-only profile snapshot.
-- Apply to PH-games after games/supabase/schema.sql and update_yeet.sql.
-- This migration does NOT grant any badge, Moon Rock or secret to a user.
-- Future games must award collectibles through authenticated, server-validated actions.
begin;

create table if not exists games.passport_badges (
  user_id uuid not null references auth.users(id) on delete cascade,
  badge_id text not null check (badge_id ~ '^[a-z0-9_]{3,48}$'),
  earned_at timestamptz not null default clock_timestamp(),
  primary key (user_id, badge_id)
);
create table if not exists games.passport_secrets (
  user_id uuid not null references auth.users(id) on delete cascade,
  secret_id text not null check (secret_id ~ '^[a-z0-9_]{3,48}$'),
  discovered_at timestamptz not null default clock_timestamp(),
  primary key (user_id, secret_id)
);
create table if not exists games.passport_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  item_id text not null check (item_id ~ '^[a-z0-9_]{3,48}$'),
  quantity integer not null default 1 check (quantity between 1 and 999),
  earned_at timestamptz not null default clock_timestamp(),
  primary key (user_id, item_id)
);

-- No public API access to collection tables. Their rows can only be read
-- through the identity-checked, read-only RPC below.
alter table games.passport_badges enable row level security;
alter table games.passport_secrets enable row level security;
alter table games.passport_items enable row level security;
revoke all on games.passport_badges from public, anon, authenticated;
revoke all on games.passport_secrets from public, anon, authenticated;
revoke all on games.passport_items from public, anon, authenticated;

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
           'id', b.badge_id, 'title', b.badge_id,
           'description', 'Awarded by a PepecoinHub game',
           'earned_at', b.earned_at) order by b.earned_at), '[]'::jsonb)
    into extra_badges
    from games.passport_badges b where b.user_id = u;

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

  badge_catalog := jsonb_build_array(
    jsonb_build_object('id', 'first_fren', 'title', 'First Fren',
      'description', 'Joined the pond with Discord.', 'earned_at', joined),
    jsonb_build_object('id', 'moonwalker', 'title', 'Moonwalker',
      'description', 'Recorded a 6000 m YEET flight. Moon Rock inventory validation is not enabled yet.',
      'earned_at', case when best_distance = 60000 then best_date else null end),
    jsonb_build_object('id', 'certified_fren', 'title', 'Certified Fren',
      'description', '100 distinct care days in PepeGochi.', 'earned_at', null,
      'coming_soon', true)
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
    'care_days', null
  );
end
$$;

revoke all on function public.gry_passport_state() from public, anon, authenticated;
grant execute on function public.gry_passport_state() to authenticated;
commit;

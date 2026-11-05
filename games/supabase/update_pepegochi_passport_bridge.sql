-- Optional bridge: PepeGochi care days -> Certified Fren in Fren Passport.
-- PRECONDITIONS:
-- 1. games/supabase/update_pepegochi_v1.sql installed and tested
-- 2. PR #184's games/supabase/update_fren_passport.sql installed and tested
--
-- This is the ONLY automatic collectible this bridge can grant. No Moon Rock.
-- Run AFTER the base PepeGochi SQL. If you later re-run its base script,
-- re-run this bridge, because the base script installs a no-op milestone hook.
begin;

create or replace function games.pepegochi_milestone_hook(
  p_user_id uuid, p_care_days integer
)
returns void
language plpgsql security invoker set search_path = ''
as $$
begin
  if p_care_days = 100 then
    insert into games.passport_badges (user_id, badge_id)
      select p.user_id, 'certified_fren'
      from games.pepegochi_pets p
      where p.user_id = p_user_id
        and p.care_days >= 100
    on conflict (user_id, badge_id) do nothing;
  end if;
end
$$;
revoke all on function games.pepegochi_milestone_hook(uuid, integer)
  from public, anon, authenticated;

-- One-time / repeatable backfill for users who already reached 100 before
-- this bridge was deployed. Never trust a client-provided care-day count.
insert into games.passport_badges (user_id, badge_id)
select p.user_id, 'certified_fren'
from games.pepegochi_pets p
where p.care_days >= 100
on conflict (user_id, badge_id) do nothing;

commit;

-- PepeGochi v2 → Fren Passport bridge (PR C). DRAFT: not installed anywhere.
--
-- Run after, in this order: schema.sql, the Fren Passport files (update_fren_passport.sql,
-- update_fren_avatar.sql, update_passport_awards.sql) and update_pepegochi_v2.sql. Safe to run again.
--
-- What it does
--   * Replaces the no-op hook games.pepegochi_passport_sync(u) from update_pepegochi_v2.sql. The hook turns
--     the account milestones that PepeGochi records (games.pepegochi_milestones) into Passport stamps:
--       first_adoption -> first_hatch   "First Hatch"
--       froglet        -> little_fren   "Little Fren"      (2nd care day)
--       adult          -> grown_fren    "One Small Step"   (7th care day)
--   * Every stamp goes through games.passport_award(): its allowlist, the Discord check and "once per account".
--     The stamp's date is the moment of the milestone, also when it is delivered later.
--   * Backfill: it delivers every milestone that is still pending when the file runs.
--
-- What it does not do
--   * No stamp is awardable yet. The three stamps are "planned" in docs/meme/passport-catalog.json, and the
--     Passport rule is that only live stamps can be earned (tests/passport-awards.test.mjs). So they are not in
--     passport_award()'s allowlist, and this hook leaves their milestones pending, silently. The release PR
--     adds the three IDs to the allowlist in update_passport_awards.sql and sets them live in the catalog;
--     then the next accepted PepeGochi action (or running this file again) delivers everything pending,
--     with the original dates. Nothing is lost while the stamps wait.
--   * good_parent stays pending: its stamp and the catalog text change come with PR D.
--   * certified_fren is never awarded by PepeGochi (it means 100 days of PondOS activity).
--   * It does not change gry_passport_state(), passport_award() or any Passport table.
--
-- Errors: "not in the allowlist" is the only error the hook catches itself. Anything else (a broken
-- Passport table, a failing trigger) reaches games.pepegochi_sync(), which logs a warning, keeps the care
-- action and leaves the milestone pending for the next accepted write.

do $$ begin
  if to_regclass('games.pepegochi_milestones') is null then
    raise exception 'Run update_pepegochi_v2.sql before update_pepegochi_passport.sql';
  end if;
  if to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is null then
    raise exception 'Run update_passport_awards.sql before update_pepegochi_passport.sql';
  end if;
end $$;

-- milestone -> Passport stamp. null: not a stamp (yet).
create or replace function games.pepegochi_passport_stamp(m text)
returns text language sql immutable set search_path = '' as $$
  select case m
    when 'first_adoption' then 'first_hatch'
    when 'froglet' then 'little_fren'
    when 'adult' then 'grown_fren'
  end
$$;

-- Called by games.pepegochi_sync(u) inside the PepeGochi RPCs (as their owner), only while this account has
-- pending milestones. Same signature as the no-op in update_pepegochi_v2.sql, so create or replace works.
create or replace function games.pepegochi_passport_sync(u uuid)
returns void language plpgsql volatile set search_path = '' as $$
declare
  m record;
  s text;
begin
  for m in
    select ms.milestone, ms.reached_at from games.pepegochi_milestones ms
     where ms.user_id = u and ms.synced_at is null
     order by ms.reached_at, ms.milestone
       for update
  loop
    s := games.pepegochi_passport_stamp(m.milestone);
    continue when s is null;
    begin
      perform games.passport_award(u, s, m.reached_at);
    exception when raise_exception then
      -- "Unknown passport stamp": the Passport does not accept it yet (planned). It stays pending.
      -- Any other raised error is passed on.
      if sqlerrm not like 'Unknown passport stamp %' then raise; end if;
      continue;
    end;
    -- passport_award() answers false both for "had it already" and for "no Discord": the stamp row decides
    update games.pepegochi_milestones ms set synced_at = games.pepegochi_clock()
     where ms.user_id = u and ms.milestone = m.milestone
       and exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = s);
  end loop;
end
$$;

revoke all on function games.pepegochi_passport_stamp(text), games.pepegochi_passport_sync(uuid)
  from public, anon, authenticated;

-- backfill: every account with a pending milestone (a no-op on an empty database, and while the stamps wait)
select games.pepegochi_passport_sync(x.user_id)
  from (select distinct user_id from games.pepegochi_milestones where synced_at is null) x;

-- PepeGochi room rewards and Pond Decorator (launch, owner decisions 2026-11-09). DRAFT: not installed anywhere.
--
-- Run last, after: schema.sql, the Fren Passport files (update_fren_passport.sql, update_fren_avatar.sql,
-- update_passport_awards.sql), update_pepegochi_v2.sql, update_pepegochi_passport.sql and
-- update_pepegochi_room_v1.sql. Safe to run again.
--
-- What it does
--   * Four room decorations come with four Passport stamps the server already checks:
--       moonwalker      -> moon_rock     "Moon Rock"     (YEET 6000 m; the YEET page calls it a Pepegachi souvenir)
--       frog_of_the_week -> paper_crown  "Paper crown"
--       treasure_hunter -> golden_fly    "Golden fly"    (10 secrets)
--       secret_starter  -> floppy_disk   "Floppy disk"
--     The item belongs to the account (games.pepegochi_room_inventory), once, with a server source key
--     ('stamp:<badge>'). Nothing comes from the browser. The grant happens when the stamp is written, or, for a
--     fren who earned the stamp before adopting a frog, when the account adopts its first frog.
--   * Pond Decorator (interior_designer): 3 different earned decorations placed in the room at the same time
--     (the starter furniture does not count). Through games.passport_award() like every stamp.
--   * Retires the "Lost Pond artifact" item (The Secret Pond was dropped): not offered, nothing deleted.
--
-- Errors: a failing hook never undoes the stamp, the adoption or the room edit. It logs a warning, and the next
-- run of this file (or the next stamp) catches up, because every grant is idempotent.
begin;

do $$
begin
  if to_regclass('games.pepegochi_room_inventory') is null then
    raise exception 'Run update_pepegochi_room_v1.sql before update_pepegochi_rewards.sql';
  end if;
  if to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is null then
    raise exception 'Run update_passport_awards.sql before update_pepegochi_rewards.sql';
  end if;
end $$;

insert into games.pepegochi_room_catalog
  (item_id, display_name, category, sprite_key, borrowable, is_starter, starter_slot_id) values
  ('golden_fly', 'Golden fly', 'trophy', 'golden_fly', false, false, null)
on conflict (item_id) do nothing;
update games.pepegochi_room_catalog set active = false where item_id = 'lost_pond_artifact';

-- stamp -> decoration. null: no decoration.
create or replace function games.pepegochi_reward_item(b text)
returns text language sql immutable set search_path = '' as $$
  select case b
    when 'moonwalker' then 'moon_rock'
    when 'frog_of_the_week' then 'paper_crown'
    when 'treasure_hunter' then 'golden_fly'
    when 'secret_starter' then 'floppy_disk'
  end
$$;

-- Gives the account every decoration its stamps entitle it to. Needs a PepeGochi account (the inventory belongs to
-- it); without one it does nothing, and the first adoption calls it again.
create or replace function games.pepegochi_reward_sync(u uuid)
returns integer language plpgsql volatile set search_path = '' as $$
declare n integer := 0; k integer;
begin
  if not exists (select 1 from games.pepegochi_owners o where o.user_id = u) then return 0; end if;
  insert into games.pepegochi_room_inventory (user_id, item_id, source_key, acquired_at)
  select u, games.pepegochi_reward_item(b.badge_id), 'stamp:' || b.badge_id, b.earned_at
    from games.passport_badges b
    join games.pepegochi_room_catalog c on c.item_id = games.pepegochi_reward_item(b.badge_id) and c.active
   where b.user_id = u
  on conflict (user_id, source_key) do nothing;
  get diagnostics k = row_count;
  n := n + k;
  return n;
end
$$;

-- Pond Decorator: 3 different earned (non-starter) decorations placed at the same time
create or replace function games.pepegochi_decorator_check(u uuid)
returns void language plpgsql volatile set search_path = '' as $$
begin
  if (select count(distinct i.item_id)
        from games.pepegochi_room_placements p
        join games.pepegochi_room_inventory i on i.item_instance_id = p.item_instance_id and i.user_id = p.user_id
        join games.pepegochi_room_catalog c on c.item_id = i.item_id
       where p.user_id = u and not c.is_starter) >= 3 then
    perform games.passport_award(u, 'interior_designer');
  end if;
end
$$;

revoke all on function games.pepegochi_reward_item(text), games.pepegochi_reward_sync(uuid),
  games.pepegochi_decorator_check(uuid) from public, anon, authenticated;

-- hooks: a stamp is written; an account adopts its first frog; the room changes
create or replace function games.pepegochi_reward_badge_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if games.pepegochi_reward_item(new.badge_id) is not null then
    begin
      perform games.pepegochi_reward_sync(new.user_id);
    exception when others then
      raise warning 'pepegochi reward sync: %', sqlerrm;
    end;
  end if;
  return null;
end
$$;
drop trigger if exists pepegochi_reward_badge_ai on games.passport_badges;
create trigger pepegochi_reward_badge_ai after insert on games.passport_badges
  for each row execute function games.pepegochi_reward_badge_after();

create or replace function games.pepegochi_reward_owner_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform games.pepegochi_reward_sync(new.user_id);
  exception when others then
    raise warning 'pepegochi reward sync: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists pepegochi_reward_owner_ai on games.pepegochi_owners;
create trigger pepegochi_reward_owner_ai after insert on games.pepegochi_owners
  for each row execute function games.pepegochi_reward_owner_after();

create or replace function games.pepegochi_decorator_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  begin
    perform games.pepegochi_decorator_check(new.user_id);
  exception when others then
    raise warning 'pepegochi decorator: %', sqlerrm;
  end;
  return null;
end
$$;
drop trigger if exists pepegochi_decorator_aiu on games.pepegochi_room_placements;
create trigger pepegochi_decorator_aiu after insert or update on games.pepegochi_room_placements
  for each row execute function games.pepegochi_decorator_after();

revoke all on function games.pepegochi_reward_badge_after(), games.pepegochi_reward_owner_after(),
  games.pepegochi_decorator_after() from public, anon, authenticated;

-- backfill: every PepeGochi account gets what its stamps already entitle it to; rooms already decorated count
select games.pepegochi_reward_sync(o.user_id) from games.pepegochi_owners o;
select games.pepegochi_decorator_check(r.user_id) from games.pepegochi_room_revisions r;

commit;

-- PepeGochi Room-4: when a frog moves out it takes ONE random item that stood in the room (owner, 2026-11-13;
-- design: docs/design/pepegochi-v2/RANDOM_MOVE_OUT_SPEC_V1.md in PR #219).
--
-- DRAFT. Not applied anywhere. Test on a local database only (tests/pepegochi-room-departure-sql.test.mjs).
-- Do NOT run in the production SQL editor without the owner's explicit approval.
--
-- Rules:
--  * The server picks the item, in the same statement that writes the move-out (games.pepegochi_settle), from the
--    items PLACED in that account's room whose catalog row is borrowable (the six starter props). Earned decorations
--    (Moon Rock, Paper Crown, Golden Fly, Floppy Disk) are never taken. The browser sends nothing.
--  * The pick is stored on the life as letter_variant = 'took_<item_id>' ('took_nothing' for an empty room), so it is
--    the same on every reload, tab and letter read. GOODBYE.TXT's P.S. and the room picture follow it.
--  * Nothing is deleted: the item stays owned and placed; it is only hidden in the picture until a new frog moves in.
--  * Late room edits cannot change the pick: the room RPCs already refuse edits once the frog is effectively gone.
--  * gry_pepegochi_settle(): one call without arguments that writes a due move-out (and so the pick) when the player
--    comes back, so the room can show the gap before the letter is opened. Read-only state stays read-only.
--
-- Dependency: update_pepegochi_v2.sql and update_pepegochi_room_v1.sql. Safe to run twice.
begin;

create or replace function games.pepegochi_pick_taken(u uuid)
returns text language sql volatile security definer set search_path = '' as $$
  select coalesce((
    select 'took_' || c.item_id
    from games.pepegochi_room_placements p
    join games.pepegochi_room_inventory i on i.user_id = p.user_id and i.item_instance_id = p.item_instance_id
    join games.pepegochi_room_catalog c on c.item_id = i.item_id
    where p.user_id = u and c.borrowable and c.active
    order by random() limit 1), 'took_nothing')
$$;

-- Runs inside the update that writes the move-out: the pick and departed_at are one write.
create or replace function games.pepegochi_departure_pick()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'departed' and old.status = 'active' then
    new.letter_variant := games.pepegochi_pick_taken(new.user_id);
  end if;
  return new;
end
$$;

drop trigger if exists pepegochi_departure_pick_bu on games.pepegochi_lives;
create trigger pepegochi_departure_pick_bu before update of status on games.pepegochi_lives
  for each row execute function games.pepegochi_departure_pick();

revoke all on function games.pepegochi_pick_taken(uuid), games.pepegochi_departure_pick()
  from public, anon, authenticated;

-- Writes a move-out that is due (nothing else): the window calls it once, when the state says the frog has gone but
-- the move-out is not saved yet. Repeated calls change nothing.
create or replace function public.gry_pepegochi_settle()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  r jsonb := games.pepegochi_rules();
  t timestamptz;
  l games.pepegochi_lives%rowtype;
  has_owner boolean;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode = '42501';
  end if;
  select true into has_owner from games.pepegochi_owners o where o.user_id = u for update;
  if has_owner is not null then
    select * into l from games.pepegochi_lives x where x.user_id = u order by x.generation desc limit 1 for update;
    t := games.pepegochi_clock();   -- after the locks
    if found and l.status = 'active' then perform games.pepegochi_settle(l, t, r); end if;
  end if;
  return games.pepegochi_view(u, games.pepegochi_clock());
end
$$;
revoke all on function public.gry_pepegochi_settle() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_settle() to authenticated;

commit;

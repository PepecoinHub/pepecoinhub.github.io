-- PepeGochi v2 Room-2 (DRAFT): account-owned inventory and room placements.
-- Dependency: games/supabase/update_pepegochi_v2.sql from PR #221 (A2).
-- Never apply to PH-games without explicit owner approval. Test on disposable PostgreSQL only.
-- This file does NOT award Moon Rock, real PEP, or anything earned in other games.
-- Browser roles cannot access tables, receive arbitrary gifts, or select another user.
-- No updates to PepeGochi lives, Passport, milestones, or departure logic.
begin;

-- Keep the backend's existing account and life tables authoritative.
do $$
begin
  if to_regclass('games.pepegochi_owners') is null
     or to_regclass('games.pepegochi_lives') is null
     or to_regprocedure('games.pepegochi_eval(games.pepegochi_lives,timestamp with time zone,jsonb)') is null then
    raise exception 'Install PepeGochi A1/A2 from PR #221 before Room-2';
  end if;
end $$;

-- Item definitions are internal allowlisted content, not a source of rewards by themselves.
create table if not exists games.pepegochi_room_catalog (
  item_id         text primary key check (item_id ~ '^[a-z][a-z0-9_]{2,49}$'),
  display_name    text not null check (char_length(display_name) between 1 and 80),
  category        text not null check (category in ('wall','small','trophy','lamp','electronics','large','plant','toy')),
  sprite_key      text not null check (sprite_key ~ '^[a-z][a-z0-9_]{2,63}$'),
  borrowable      boolean not null default false,
  active          boolean not null default true,
  is_starter      boolean not null default false,
  starter_slot_id text,
  check (not is_starter or starter_slot_id is not null)
);

create table if not exists games.pepegochi_room_slots (
  slot_id            text primary key check (slot_id ~ '^[a-z][a-z0-9_]{2,49}$'),
  label              text not null,
  x                  smallint not null check (x between 0 and 640),
  y                  smallint not null check (y between 0 and 400),
  z                  smallint not null check (z between 0 and 100),
  allowed_categories text[] not null check (coalesce(array_length(allowed_categories,1),0) between 1 and 8)
);

-- A single row per account tracks compare-and-swap edits across tabs.
create table if not exists games.pepegochi_room_revisions (
  user_id     uuid primary key references games.pepegochi_owners(user_id) on delete cascade,
  revision    bigint not null default 1 check (revision >= 1),
  updated_at  timestamptz not null default clock_timestamp()
);

-- Item instances belong to the ACCOUNT, not to a specific frog life.
-- source_key is a trusted server-defined idempotency key (not accepted from browser).
create table if not exists games.pepegochi_room_inventory (
  item_instance_id uuid primary key default gen_random_uuid(),
  user_id          uuid not null references games.pepegochi_owners(user_id) on delete cascade,
  item_id          text not null references games.pepegochi_room_catalog(item_id),
  source_key       text not null check (char_length(source_key) between 5 and 160),
  acquired_at      timestamptz not null default clock_timestamp(),
  unique (user_id, item_instance_id),
  unique (user_id, source_key)
);
create index if not exists pepegochi_room_inventory_owner
  on games.pepegochi_room_inventory (user_id, item_id);

create table if not exists games.pepegochi_room_placements (
  user_id          uuid not null references games.pepegochi_room_revisions(user_id) on delete cascade,
  slot_id          text not null references games.pepegochi_room_slots(slot_id),
  item_instance_id uuid not null,
  placed_at        timestamptz not null default clock_timestamp(),
  primary key (user_id, slot_id),
  unique (item_instance_id),
  foreign key (user_id, item_instance_id)
    references games.pepegochi_room_inventory(user_id, item_instance_id) on delete cascade
);

-- Defense in depth: even if someone grants usage of schema games later, the tables stay private.
alter table games.pepegochi_room_catalog enable row level security;
alter table games.pepegochi_room_slots enable row level security;
alter table games.pepegochi_room_revisions enable row level security;
alter table games.pepegochi_room_inventory enable row level security;
alter table games.pepegochi_room_placements enable row level security;
revoke all on games.pepegochi_room_catalog, games.pepegochi_room_slots,
  games.pepegochi_room_revisions, games.pepegochi_room_inventory,
  games.pepegochi_room_placements from public, anon, authenticated;

-- 640x400 logical anchors. Exact positions can be adjusted before shipping artwork.
insert into games.pepegochi_room_slots (slot_id, label, x, y, z, allowed_categories) values
  ('wall_left','Left wall',169,96,30,array['wall']),
  ('wall_right','Right wall',414,112,30,array['wall']),
  ('shelf_a','Shelf A',252,140,40,array['small','trophy']),
  ('shelf_b','Shelf B',318,140,40,array['small','trophy']),
  ('dresser_top','Dresser',90,215,50,array['lamp','small']),
  ('tv_stand','TV stand',546,240,50,array['electronics','large']),
  ('table_top','Table',453,258,50,array['small','toy']),
  ('floor_left','Left floor',170,345,50,array['plant','large']),
  ('floor_right','Right floor',559,331,50,array['plant','large']),
  ('rug_left','Rug left',246,341,70,array['toy','small']),
  ('rug_right','Rug right',398,341,70,array['toy','small'])
on conflict (slot_id) do nothing;

insert into games.pepegochi_room_catalog
  (item_id, display_name, category, sprite_key, borrowable, is_starter, starter_slot_id) values
  ('p_poster','P poster','wall','p_poster',true,true,'wall_left'),
  ('crt_tv','CRT television','electronics','crt_tv',true,true,'tv_stand'),
  ('lava_lamp','Lava lamp','lamp','lava_lamp',true,true,'dresser_top'),
  ('potted_plant','Potted plant','plant','potted_plant',true,true,'floor_left'),
  ('rubber_duck','Rubber duck','toy','rubber_duck',true,true,'rug_left'),
  ('mug','Fren mug','small','mug',true,true,'table_top'),
  ('floppy_disk','Floppy disk','small','floppy_disk',false,false,null),
  ('paper_crown','Paper crown','trophy','paper_crown',false,false,null),
  ('moon_rock','Moon Rock','trophy','moon_rock',false,false,null),
  ('lost_pond_artifact','Lost Pond artifact','trophy','lost_pond_artifact',false,false,null)
on conflict (item_id) do nothing;

-- Internal helper. It uses the caller's privileges, and browser roles have no EXECUTE on it.
-- This helper intentionally never sees or writes another user's items via a public argument.
create or replace function games.pepegochi_room_view(p_user_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  payload jsonb;
  slots jsonb;
  items jsonb;
  placed jsonb;
  rev bigint;
begin
  select r.revision into rev from games.pepegochi_room_revisions r where r.user_id = p_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_id',s.slot_id,'label',s.label,'x',s.x,'y',s.y,'z',s.z,
           'allowed_categories',s.allowed_categories) order by s.z,s.slot_id),'[]'::jsonb)
    into slots from games.pepegochi_room_slots s;
  select coalesce(jsonb_agg(jsonb_build_object(
           'item_instance_id',i.item_instance_id,'item_id',i.item_id,
           'display_name',c.display_name,'category',c.category,
           'sprite_key',c.sprite_key,'borrowable',c.borrowable,
           'acquired_at',i.acquired_at) order by i.acquired_at,i.item_instance_id),'[]'::jsonb)
    into items from games.pepegochi_room_inventory i
    join games.pepegochi_room_catalog c on c.item_id=i.item_id
    where i.user_id = p_user_id;
  select coalesce(jsonb_agg(jsonb_build_object(
           'slot_id',p.slot_id,'item_instance_id',p.item_instance_id) order by p.slot_id),'[]'::jsonb)
    into placed from games.pepegochi_room_placements p where p.user_id = p_user_id;
  payload := jsonb_build_object('version',1,'initialized',rev is not null,
    'revision',rev,'slots',slots,'inventory',items,'placements',placed);
  return payload;
end
$$;
revoke all on function games.pepegochi_room_view(uuid) from public, anon, authenticated;

-- Common internal lock/check for write RPCs. Always: owner -> latest life -> room revision.
-- Do not settle the frog in this module; A1/A2 remains the only owner of life transitions.
create or replace function games.pepegochi_room_can_edit(p_user_id uuid)
returns boolean language plpgsql volatile set search_path = '' as $$
declare
  l games.pepegochi_lives%rowtype;
  current_status text;
begin
  select * into l from games.pepegochi_lives x where x.user_id=p_user_id
    order by x.generation desc limit 1 for update;
  if not found or l.status <> 'active' then return false; end if;
  select e.status into current_status from games.pepegochi_eval(l, games.pepegochi_clock(), games.pepegochi_rules()) e;
  return current_status <> 'departed';
end
$$;
revoke all on function games.pepegochi_room_can_edit(uuid) from public, anon, authenticated;

-- Public read has no client-supplied identity. Never implicitly changes starter inventory.
create or replace function public.gry_pepegochi_room_state()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode='42501';
  end if;
  return games.pepegochi_room_view(u);
end
$$;
revoke all on function public.gry_pepegochi_room_state() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_room_state() to authenticated;

-- Called once after adoption or on the first entry to the room; repeated calls are no-ops.
-- Uses ONLY known starter catalog rows, no client-controlled item ids or award evidence.
create or replace function public.gry_pepegochi_room_initialize()
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  starter record;
  owner_exists boolean;
  inst uuid;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode='42501';
  end if;
  select true into owner_exists from games.pepegochi_owners o where o.user_id=u for update;
  if owner_exists is distinct from true then
    raise exception 'Adopt a Fren before furnishing the room' using errcode='22023';
  end if;
  if not games.pepegochi_room_can_edit(u) then
    raise exception 'Your Fren must be present to initialize the room' using errcode='22023';
  end if;
  if exists (select 1 from games.pepegochi_room_revisions r where r.user_id=u) then
    return games.pepegochi_room_view(u);
  end if;
  insert into games.pepegochi_room_revisions (user_id,revision) values (u,1);
  for starter in
    select c.item_id, c.starter_slot_id from games.pepegochi_room_catalog c
    where c.active and c.is_starter order by c.item_id
  loop
    -- source_key is not accepted from the user.
    insert into games.pepegochi_room_inventory(user_id,item_id,source_key)
      values (u,starter.item_id,'starter:' || starter.item_id)
      on conflict (user_id,source_key) do nothing;
    select i.item_instance_id into inst from games.pepegochi_room_inventory i
       where i.user_id=u and i.item_id=starter.item_id and i.source_key='starter:' || starter.item_id;
    insert into games.pepegochi_room_placements(user_id,slot_id,item_instance_id)
      values (u,starter.starter_slot_id,inst)
      on conflict (user_id,slot_id) do nothing;
  end loop;
  return games.pepegochi_room_view(u);
end
$$;
revoke all on function public.gry_pepegochi_room_initialize() from public, anon, authenticated;
grant execute on function public.gry_pepegochi_room_initialize() to authenticated;

-- Moves an owned item to a compatible fixed slot, atomically. Replacing an occupied slot
-- unplaces its previous object but never deletes it from inventory. No arbitrary x/y/z.
create or replace function public.gry_pepegochi_room_place(
  p_item_instance_id uuid, p_slot_id text, p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  rev bigint;
  category text;
  permitted text[];
  target_item uuid;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode='42501';
  end if;
  if p_item_instance_id is null or p_slot_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid room placement arguments' using errcode='22023';
  end if;
  perform 1 from games.pepegochi_owners o where o.user_id=u for update;
  if not found or not games.pepegochi_room_can_edit(u) then
    raise exception 'An active Fren is required to arrange the room' using errcode='22023';
  end if;
  select r.revision into rev from games.pepegochi_room_revisions r where r.user_id=u for update;
  if rev is null then raise exception 'Initialize the room first' using errcode='22023'; end if;
  if rev <> p_expected_revision then
    raise exception 'ROOM_REVISION_CONFLICT' using errcode='P0001';
  end if;
  select c.category into category
    from games.pepegochi_room_inventory i
    join games.pepegochi_room_catalog c on c.item_id=i.item_id
    where i.user_id=u and i.item_instance_id=p_item_instance_id and c.active;
  if category is null then raise exception 'Item not owned or unavailable' using errcode='42501'; end if;
  select s.allowed_categories into permitted from games.pepegochi_room_slots s where s.slot_id=p_slot_id;
  if permitted is null or not (category=any(permitted)) then
    raise exception 'Item does not fit the chosen slot' using errcode='22023';
  end if;
  select p.item_instance_id into target_item
    from games.pepegochi_room_placements p where p.user_id=u and p.slot_id=p_slot_id;
  if target_item=p_item_instance_id then return games.pepegochi_room_view(u); end if;
  -- First remove any previous location of this instance, then replace the target.
  delete from games.pepegochi_room_placements p
    where p.user_id=u and p.item_instance_id=p_item_instance_id;
  insert into games.pepegochi_room_placements(user_id,slot_id,item_instance_id)
    values (u,p_slot_id,p_item_instance_id)
    on conflict (user_id,slot_id) do update
    set item_instance_id=excluded.item_instance_id, placed_at=clock_timestamp();
  update games.pepegochi_room_revisions r
    set revision=rev+1, updated_at=clock_timestamp() where r.user_id=u;
  return games.pepegochi_room_view(u);
end
$$;
revoke all on function public.gry_pepegochi_room_place(uuid,text,bigint) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_room_place(uuid,text,bigint) to authenticated;

-- Remove from scene, not from the inventory (and never touch another user's items).
create or replace function public.gry_pepegochi_room_unplace(
  p_slot_id text, p_expected_revision bigint)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  rev bigint;
  removed uuid;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Discord sign-in required' using errcode='42501';
  end if;
  if p_slot_id is null or p_expected_revision is null or p_expected_revision < 1 then
    raise exception 'Invalid room slot or revision' using errcode='22023';
  end if;
  perform 1 from games.pepegochi_owners o where o.user_id=u for update;
  if not found or not games.pepegochi_room_can_edit(u) then
    raise exception 'An active Fren is required to arrange the room' using errcode='22023';
  end if;
  select r.revision into rev from games.pepegochi_room_revisions r where r.user_id=u for update;
  if rev is null then raise exception 'Initialize the room first' using errcode='22023'; end if;
  if rev <> p_expected_revision then
    raise exception 'ROOM_REVISION_CONFLICT' using errcode='P0001';
  end if;
  if not exists(select 1 from games.pepegochi_room_slots s where s.slot_id=p_slot_id) then
    raise exception 'Unknown room slot' using errcode='22023';
  end if;
  delete from games.pepegochi_room_placements p
    where p.user_id=u and p.slot_id=p_slot_id returning p.item_instance_id into removed;
  if removed is not null then
    update games.pepegochi_room_revisions r
      set revision=rev+1, updated_at=clock_timestamp() where r.user_id=u;
  end if;
  return games.pepegochi_room_view(u);
end
$$;
revoke all on function public.gry_pepegochi_room_unplace(text,bigint) from public, anon, authenticated;
grant execute on function public.gry_pepegochi_room_unplace(text,bigint) to authenticated;

-- Item awards from other games intentionally NOT implemented yet. Future trusted
-- server-to-server grants must have unique source-event IDs and independent tests.
-- Departure's immutable taken_item snapshot intentionally belongs to a later Room-4 PR.
commit;
-- Pepe Miner cloud save for players signed in with Discord. Run once in the Supabase SQL editor. Safe to run again.
--
-- The game keeps its progress in the browser (localStorage). A player signed in with Discord also gets
-- one copy on the server, so the same mine opens on another phone or computer. Game PEP are points, not
-- coins, so the save is trusted as sent; the server only limits its size and how often it is written.
-- Guests (anonymous sign-in) do not get a cloud save: their account lives in one browser anyway.

create table if not exists games.miner_saves (
  user_id    uuid primary key,
  data       jsonb not null,
  all_time   double precision not null default 0,     -- all-time game PEP, to pick the better of two saves
  updated_at timestamptz not null default now()
);
alter table games.miner_saves enable row level security;
revoke all on games.miner_saves from public, anon, authenticated;

create or replace function public.gry_miner_load() returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when auth.uid() is null or games.discord_identity(auth.uid()) is null then null
         else (select jsonb_build_object('data', s.data, 'all_time', s.all_time, 'updated_at', s.updated_at)
                 from games.miner_saves s where s.user_id = auth.uid()) end
$$;

create or replace function public.gry_miner_save(p_data jsonb, p_all double precision) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); prev timestamptz;
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Sign in with Discord to save your mine online'; end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then raise exception 'Nothing to save'; end if;
  if octet_length(p_data::text) > 100000 then raise exception 'That save is too big'; end if;
  select updated_at into prev from games.miner_saves where user_id = u;
  if prev is not null and prev > now() - interval '20 seconds' then return jsonb_build_object('saved', false); end if;
  insert into games.miner_saves(user_id, data, all_time, updated_at)
  values (u, p_data, greatest(coalesce(p_all, 0), 0), now())
  on conflict (user_id) do update set data = excluded.data, all_time = excluded.all_time, updated_at = now();
  return jsonb_build_object('saved', true);
end $$;

revoke all on function public.gry_miner_load(), public.gry_miner_save(jsonb, double precision) from public, anon;
grant execute on function public.gry_miner_load(), public.gry_miner_save(jsonb, double precision) to authenticated;

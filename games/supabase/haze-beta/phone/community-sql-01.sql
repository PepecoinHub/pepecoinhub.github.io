-- Haze community install, part 1 of 5. Run IN ORDER after the tip/group SQL. Repeatable; everything stays OFF.
begin;
create table if not exists games.community_settings (
 id boolean primary key default true check(id), enabled boolean not null default false,
 beta_only boolean not null default true
);
insert into games.community_settings(id) values(true) on conflict do nothing;
create table if not exists games.community_clients (
 id text primary key, label text not null, redirect_uri text not null,
 origins text[] not null, scopes text[] not null, enabled boolean not null default false
);
-- Optional per-client account allowlist (null = every allowed account). Lets one client (e.g. a mobile build in
-- device testing) be limited to named accounts while other clients stay open. Checked on every operation.
alter table games.community_clients add column if not exists allowed_users uuid[];
insert into games.community_clients(id,label,redirect_uri,origins,scopes) values
 ('haze-web','Haze Wallet web','https://hazewallet.com/community-auth.html',array['https://hazewallet.com'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write']),
 ('haze-native','Haze Wallet mobile','hazewallet://community-auth',array['capacitor://localhost','https://localhost'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write']),
 ('haze-chrome','Haze Wallet Chrome','https://nidammajcicbihnibjecaknikfblnhmb.chromiumapp.org/community-auth',array['chrome-extension://nidammajcicbihnibjecaknikfblnhmb'],array['profile:read','chat:read','chat:write','wallet:link','tips:read','tips:write','groups:read','groups:write'])
on conflict do nothing;
create table if not exists games.community_codes (
 code_hash text primary key check(code_hash ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references games.community_clients(id),
 redirect_uri text not null, challenge text not null check(challenge ~ '^[A-Za-z0-9_-]{43}$'), scopes text[] not null,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '5 minutes', consumed_at timestamptz
);
create index if not exists community_codes_owner on games.community_codes(user_id,created_at);
create index if not exists community_codes_expiry on games.community_codes(expires_at);
create table if not exists games.community_sessions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null references games.community_clients(id), audience text not null default 'ph-community-v1' check(audience='ph-community-v1'),
 scopes text[] not null, access_hash text unique not null check(access_hash ~ '^[a-f0-9]{64}$'),
 refresh_hash text unique not null check(refresh_hash ~ '^[a-f0-9]{64}$'), previous_refresh_hash text,
 created_at timestamptz not null default clock_timestamp(),
 expires_at timestamptz not null default clock_timestamp()+interval '8 hours',
 access_expires_at timestamptz not null default clock_timestamp()+interval '15 minutes', revoked_at timestamptz
);
create index if not exists community_sessions_owner on games.community_sessions(user_id,client_id,expires_at);
create index if not exists community_sessions_expiry on games.community_sessions(expires_at);
create table if not exists games.community_budgets (
 user_id uuid primary key references auth.users(id) on delete cascade,
 window_start timestamptz not null, requests integer not null check(requests>0)
);
alter table games.community_settings enable row level security;
alter table games.community_clients enable row level security;
alter table games.community_codes enable row level security;
alter table games.community_sessions enable row level security;
alter table games.community_budgets enable row level security;
revoke all on games.community_settings,games.community_clients,games.community_codes,games.community_sessions,games.community_budgets from public,anon,authenticated;
create or replace function games.community_v1_user(u uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not coalesce((select enabled from games.community_settings where id),false)
 or u is null or games.discord_identity(u) is null
 or not exists(select 1 from auth.users where id=u)
 or (coalesce((select beta_only from games.community_settings where id),true)
     and not exists(select 1 from games.haze_testers where user_id=u))
 then raise exception 'Community access is unavailable for this account.';end if;
end $$;
create or replace function games.community_v1_budget(u uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n integer;t timestamptz:=clock_timestamp();
begin
 insert into games.community_budgets(user_id,window_start,requests) values(u,t,1)
 on conflict(user_id) do update set
 requests=case when community_budgets.window_start<t-interval '1 minute' then 1 else community_budgets.requests+1 end,
 window_start=case when community_budgets.window_start<t-interval '1 minute' then t else community_budgets.window_start end
 returning requests into n;
 if n>180 then raise exception 'Community request limit reached. Try again shortly.';end if;
end $$;
create or replace function games.community_v1_keys(a jsonb,allowed text[]) returns boolean
language sql immutable set search_path='' as $$
 select jsonb_typeof(a)='object' and not exists(select 1 from jsonb_object_keys(a) k where not(k=any(allowed)))
$$;
commit;

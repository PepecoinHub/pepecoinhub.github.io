-- A14: EMPTY quest engine. Apply only after Passport awards, in a reviewed environment.
-- Never seed this public file. Keep pond_case_private outside the Data API exposed schemas.
begin;

create schema if not exists pond_case_private;
revoke all on schema pond_case_private from public, anon, authenticated;
create table if not exists pond_case_private.campaign (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  title text not null check (char_length(title) between 1 and 120),
  intro text not null check (char_length(intro) between 1 and 2000),
  stage_count integer not null check (stage_count between 3 and 12),
  final_message text check (final_message is null or char_length(final_message) between 1 and 16000),
  final_credit text check (final_credit is null or char_length(final_credit) between 1 and 120),
  check (not enabled or (nullif(btrim(final_message), '') is not null and nullif(btrim(final_credit), '') is not null))
);
create table if not exists pond_case_private.steps (
  campaign_id integer not null references pond_case_private.campaign(id),
  step_no integer not null check (step_no between 1 and 12),
  title text not null check (char_length(title) between 1 and 120),
  clue text not null check (char_length(clue) between 1 and 4000),
  hint text not null check (char_length(hint) between 1 and 2000),
  salt text not null check (salt ~ '^[a-f0-9]{64}$'),
  answer_hash text not null check (answer_hash ~ '^[a-f0-9]{64}$'),
  primary key (campaign_id, step_no)
);
create table if not exists pond_case_private.progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  completed integer not null default 0 check (completed between 0 and 12),
  window_started timestamptz,
  wrong_count integer not null default 0 check (wrong_count between 0 and 5),
  last_attempt_at timestamptz,
  last_request uuid,
  last_step integer,
  last_outcome text check (last_outcome in ('correct','wrong'))
);
alter table pond_case_private.campaign enable row level security;
alter table pond_case_private.steps enable row level security;
alter table pond_case_private.progress enable row level security;
revoke all on all tables in schema pond_case_private from public, anon, authenticated;

-- ASCII letters/numbers only after normalization; formatting and case do not matter.
create or replace function pond_case_private.normalize(p text)
returns text language sql immutable set search_path = '' as $$
  select translate(regexp_replace(coalesce(p, ''), '[^A-Za-z0-9]', '', 'g'), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz')
$$;

create or replace function pond_case_private.ready()
returns boolean language sql volatile set search_path = '' as $$
  select exists (
    select 1 from pond_case_private.campaign c
    where c.id = 1 and c.enabled and games.passport_open()
      and c.stage_count = (select count(*) from pond_case_private.steps s where s.campaign_id = c.id)
      and c.stage_count = (select max(s.step_no) from pond_case_private.steps s where s.campaign_id = c.id)
  )
$$;

-- Internal projection, no public access; future steps, hashes and other players never leave this function.
create or replace function pond_case_private.view_for(u uuid, p_hint boolean)
returns jsonb language plpgsql volatile set search_path = '' as $$
declare c pond_case_private.campaign%rowtype; s pond_case_private.steps%rowtype;
  p pond_case_private.progress%rowtype; done integer; retry_at timestamptz; t timestamptz := clock_timestamp();
begin
  if not pond_case_private.ready() then return jsonb_build_object('status','closed'); end if;
  select * into c from pond_case_private.campaign where id = 1;
  select * into p from pond_case_private.progress where user_id = u;
  done := coalesce(p.completed, 0);
  if done >= c.stage_count then
    return jsonb_build_object('status','complete','title',c.title,'completed',c.stage_count,'total',c.stage_count,
      'message',c.final_message,'credit',c.final_credit);
  end if;
  select * into s from pond_case_private.steps where campaign_id = 1 and step_no = done + 1;
  if p.wrong_count >= 5 and p.window_started + interval '15 minutes' > t then retry_at := p.window_started + interval '15 minutes';
  elsif p.last_attempt_at + interval '2 seconds' > t then retry_at := p.last_attempt_at + interval '2 seconds'; end if;
  return jsonb_build_object('status','active','title',c.title,'intro',c.intro,'completed',done,'total',c.stage_count,
    'step',s.step_no,'step_title',s.title,'clue',s.clue,'hint',case when p_hint is true then s.hint else null end,
    'retry_after',case when retry_at is null then 0 else greatest(0, ceil(extract(epoch from retry_at - t))::integer) end);
end
$$;

create or replace function pond_case_private.read_case(p_hint boolean)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Discord sign-in required'; end if;
  -- Hold a share lock on config: curator cannot change the campaign during a projection.
  perform 1 from pond_case_private.campaign where id = 1 for share;
  return pond_case_private.view_for(u, p_hint);
end
$$;

create or replace function pond_case_private.answer_case(p_step integer, p_answer text, p_request uuid)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare u uuid := auth.uid(); p pond_case_private.progress%rowtype; s pond_case_private.steps%rowtype;
  c pond_case_private.campaign%rowtype; t timestamptz; normalized text; correct boolean; outcome text;
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Discord sign-in required'; end if;
  select * into c from pond_case_private.campaign where id = 1 for share;
  if not pond_case_private.ready() then return jsonb_build_object('outcome','closed','state',jsonb_build_object('status','closed')); end if;
  if p_request is null or p_step is null or p_step not between 1 and c.stage_count or p_answer is null or octet_length(p_answer) > 320 then
    return jsonb_build_object('outcome','invalid','state',pond_case_private.view_for(u,false));
  end if;
  normalized := pond_case_private.normalize(p_answer);
  if char_length(normalized) not between 3 and 80 then
    return jsonb_build_object('outcome','invalid','state',pond_case_private.view_for(u,false));
  end if;
  insert into pond_case_private.progress(user_id) values (u) on conflict (user_id) do nothing;
  select * into p from pond_case_private.progress where user_id = u for update;
  t := clock_timestamp();
  -- Retry of the latest accepted request is idempotent, including a lost final response.
  if p.last_request = p_request and p.last_step = p_step then
    return jsonb_build_object('outcome',p.last_outcome,'state',pond_case_private.view_for(u,false));
  end if;
  if p.completed >= c.stage_count or p_step <> p.completed + 1 then
    return jsonb_build_object('outcome','stale','state',pond_case_private.view_for(u,false));
  end if;
  if p.wrong_count >= 5 and p.window_started + interval '15 minutes' > t or p.last_attempt_at + interval '2 seconds' > t then
    return jsonb_build_object('outcome','rate_limited','state',pond_case_private.view_for(u,false));
  end if;
  if p.window_started is null or p.window_started + interval '15 minutes' <= t then
    p.window_started := t; p.wrong_count := 0;
  end if;
  select * into s from pond_case_private.steps where campaign_id = 1 and step_no = p_step;
  correct := encode(sha256(convert_to(s.salt || ':' || normalized, 'UTF8')), 'hex') = s.answer_hash;
  if correct then p.completed := p.completed + 1; outcome := 'correct';
  else p.wrong_count := p.wrong_count + 1; outcome := 'wrong'; end if;
  update pond_case_private.progress set completed = p.completed, window_started = p.window_started, wrong_count = p.wrong_count,
    last_attempt_at = t, last_request = p_request, last_step = p_step, last_outcome = outcome where user_id = u;
  -- The final secret and last step commit together. The generic legacy discover RPC cannot grant this ID.
  if correct and p.completed = c.stage_count then
    insert into games.passport_secrets(user_id, secret_id) values (u, 'founders_letter') on conflict (user_id, secret_id) do nothing;
  end if;
  return jsonb_build_object('outcome',outcome,'state',pond_case_private.view_for(u,false));
end
$$;

-- Security-definer implementation stays in a non-exposed schema. Public invoker wrappers take no user ID.
revoke all on all functions in schema pond_case_private from public, anon, authenticated;
grant usage on schema pond_case_private to authenticated;
grant execute on function pond_case_private.read_case(boolean), pond_case_private.answer_case(integer,text,uuid) to authenticated;

create or replace function public.gry_pond_case_state(p_hint boolean default false)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select pond_case_private.read_case(p_hint)
$$;
create or replace function public.gry_pond_case_answer(p_step integer,p_answer text,p_request uuid)
returns jsonb language sql volatile security invoker set search_path = '' as $$
  select pond_case_private.answer_case(p_step,p_answer,p_request)
$$;
revoke all on function public.gry_pond_case_state(boolean), public.gry_pond_case_answer(integer,text,uuid) from public, anon, authenticated;
grant execute on function public.gry_pond_case_state(boolean), public.gry_pond_case_answer(integer,text,uuid) to authenticated;
commit;

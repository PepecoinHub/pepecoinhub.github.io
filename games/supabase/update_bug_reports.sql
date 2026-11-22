-- Bug reports from the chat (owner, 2026-11-22). "? → Report a problem" in the lobby chat and LAN Party saves the
-- report here instead of sending people to GitHub. The owner sees every report in "? → Reports inbox" and gets a
-- PondOS notification (the same channel as mentions; on a phone only if notifications are on there). Haze reports
-- also go to the Haze people listed in games.report_triage (games/supabase/community-v1/reports-triage-add.sql).
-- Signed-in frens only (Discord or guest), a few reports per hour, seed-phrase talk is refused.
-- Run once in the Supabase SQL editor (after update_push.sql if you use notifications). Safe to run again.
begin;
create table if not exists games.bug_reports(
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null,
  nick text not null,
  verified boolean not null default false,
  area text not null check (area in ('chat', 'haze', 'games', 'pondos', 'other')),
  body text not null,
  page text not null default '',
  client text not null default '',
  ip_hash text,
  status text not null default 'new' check (status in ('new', 'seen', 'fixed', 'wontfix', 'duplicate')),
  handled_by text,
  handled_at timestamptz
);
create index if not exists bug_reports_recent on games.bug_reports(created_at desc);
create table if not exists games.report_triage(
  user_id uuid primary key references auth.users(id) on delete cascade,
  label text not null default '',
  scope text not null default 'haze' check (scope in ('all', 'haze'))
);
alter table games.bug_reports enable row level security;
alter table games.report_triage enable row level security;
revoke all on games.bug_reports, games.report_triage from public, anon, authenticated;

-- Who may read a report: the owner(s) every report; triage 'all' every report; triage 'haze' Haze reports only.
create or replace function games.can_triage(u uuid, p_area text) returns boolean
language sql stable security definer set search_path = '' as $$
  select u is not null and (games.is_owner(u)
    or exists (select 1 from games.report_triage t where t.user_id = u and (t.scope = 'all' or (t.scope = 'haze' and p_area = 'haze'))))
$$;
revoke all on function games.can_triage(uuid, text) from public, anon, authenticated;

create or replace function public.gry_report_bug(p_area text, p_body text, p_page text default '', p_client text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); ip text := games.client_ip_hash(); b text := btrim(regexp_replace(coalesce(p_body, ''), '[[:cntrl:]]+', ' ', 'g'));
        a text := lower(coalesce(p_area, 'other')); nk text; ver boolean; r games.bug_reports; who record;
begin
  if u is null then raise exception 'Sign in (Discord or guest) to send a report.'; end if;
  if a not in ('chat', 'haze', 'games', 'pondos', 'other') then a := 'other'; end if;
  if char_length(b) < 10 then raise exception 'Tell us a bit more: what happened, and what did you expect?'; end if;
  if char_length(b) > 1500 then raise exception 'Keep it under 1500 characters, please.'; end if;
  if games.norm(b) ~ '(seedphrase|seedwords|recoveryphrase|secretphrase|privatekey|mnemonic|walletpassword)' then
    raise exception 'Never send seed phrases, private keys or wallet passwords, not even to us. Describe the problem without them.'; end if;
  perform pg_advisory_xact_lock(hashtext('bugreport:' || u::text));
  if (select count(*) from games.bug_reports where user_id = u and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from games.bug_reports where user_id = u and created_at > now() - interval '1 day') >= 10
     or (ip is not null and (select count(*) from games.bug_reports where ip_hash = ip and created_at > now() - interval '1 hour') >= 20) then
    raise exception 'Thanks! That is plenty of reports for now. Try again a bit later.'; end if;
  ver := games.discord_identity(u) is not null;
  nk := coalesce((select nick from games.profiles where user_id = u), 'Guest');
  insert into games.bug_reports(user_id, nick, verified, area, body, page, client, ip_hash)
  values (u, nk, ver, a, b, left(coalesce(p_page, ''), 200), left(coalesce(p_client, ''), 300), ip) returning * into r;
  -- Notify everyone who may read it (a missing notification setup never blocks the report).
  for who in
    select distinct i.user_id from auth.identities i join games.owners o on o.discord_id = i.provider_id where i.provider = 'discord'
    union select t.user_id from games.report_triage t where t.scope = 'all' or (t.scope = 'haze' and a = 'haze')
  loop
    begin
      perform games.push_enqueue('mention', who.user_id, u, '🐞 Report · ' || a, nk || ': ' || left(b, 120), '/meme/#lan', 'report-' || r.id);
    exception when others then null;
    end;
  end loop;
  return jsonb_build_object('id', r.id);
end $$;

-- The inbox: newest first, only the reports this person may read. p_open: only new and seen ones.
create or replace function public.gry_reports(p_open boolean default true) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if not (games.can_triage(u, 'haze') or games.can_triage(u, 'other')) then raise exception 'Only the report inbox team can see this.'; end if;
  return jsonb_build_object(
    'new', (select count(*) from games.bug_reports k where k.status = 'new' and games.can_triage(u, k.area)),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('id', k.id, 'at', k.created_at, 'nick', k.nick, 'verified', k.verified,
        'area', k.area, 'body', k.body, 'page', k.page, 'client', k.client, 'status', k.status, 'handled_by', k.handled_by) order by k.id desc)
      from (select * from games.bug_reports k where games.can_triage(u, k.area) and (not p_open or k.status in ('new', 'seen'))
            order by k.id desc limit 100) k), '[]'::jsonb));
end $$;

-- How many new reports (for the badge on ?). Null when this person has no inbox.
create or replace function public.gry_reports_new() returns int
language sql stable security definer set search_path = '' as $$
  select case when games.can_triage(auth.uid(), 'haze') or games.can_triage(auth.uid(), 'other')
    then (select count(*)::int from games.bug_reports k where k.status = 'new' and games.can_triage(auth.uid(), k.area)) end
$$;

create or replace function public.gry_report_set(p_id bigint, p_status text) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); k games.bug_reports;
begin
  select * into k from games.bug_reports where id = p_id;
  if k.id is null or not games.can_triage(u, k.area) then raise exception 'Report not found.'; end if;
  if p_status not in ('new', 'seen', 'fixed', 'wontfix', 'duplicate') then raise exception 'Unknown status.'; end if;
  update games.bug_reports set status = p_status, handled_at = now(),
    handled_by = coalesce((select nick from games.profiles where user_id = u), 'host') where id = p_id;
end $$;

revoke all on function public.gry_report_bug(text, text, text, text), public.gry_reports(boolean), public.gry_reports_new(), public.gry_report_set(bigint, text) from public, anon;
grant execute on function public.gry_report_bug(text, text, text, text), public.gry_reports(boolean), public.gry_reports_new(), public.gry_report_set(bigint, text) to authenticated;
commit;

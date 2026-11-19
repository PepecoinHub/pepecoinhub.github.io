-- Run after update_lobby_mentions.sql, update_open_chat.sql and update_page_stats.sql.
-- Byl's @everyone reaches Discord players who have mentions enabled.
alter table games.lobby_chat add column if not exists broadcast boolean not null default false;

create or replace function games.lobby_broadcast_before_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.broadcast := coalesce(new.verified, false)
    and new.user_id is not null
    and games.is_owner(new.user_id)
    and exists (select 1 from auth.identities i
                 where i.user_id = new.user_id and i.provider = 'discord'
                   and i.provider_id = '1177554593014628383')
    and new.body ~* '(^|[^[:alnum:]_])@everyone($|[^[:alnum:]_])';
  return new;
end $$;

drop trigger if exists lobby_broadcast_bi on games.lobby_chat;
create trigger lobby_broadcast_bi before insert on games.lobby_chat
  for each row execute function games.lobby_broadcast_before_insert();

create or replace function games.lobby_mentions_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
declare rest text; p record; n int := 0; recent int; d jsonb;
begin
  if not new.verified then return new; end if;
  d := games.discord_identity(new.user_id);
  if d is null then return new; end if;
  insert into games.profiles(user_id, nick, nick_key, discord_id, discord_name)
  values (new.user_id, new.nick, games.nick_key(new.nick), d->>'id', d->>'name')
  on conflict do nothing;
  if position('@' in new.body) = 0 then return new; end if;

  if new.broadcast then
    insert into games.lobby_mentions(msg_id, to_user, from_user, from_nick)
    select distinct new.id, i.user_id, new.user_id, new.nick
      from auth.identities i
     where i.provider = 'discord' and i.user_id <> new.user_id
       and not exists (select 1 from games.mention_optout o where o.user_id = i.user_id)
    on conflict do nothing;
    return new;
  end if;

  select count(*) into recent from games.lobby_mentions
   where from_user = new.user_id and created_at > now() - interval '10 minutes';
  if recent >= 15 then return new; end if;
  rest := lower(new.body);
  for p in
    select pr.user_id, pr.nick from games.profiles pr
     where pr.user_id <> new.user_id
       and position('@' || lower(pr.nick) in rest) > 0
       and not exists (select 1 from games.mention_optout o where o.user_id = pr.user_id)
     order by char_length(pr.nick) desc limit 20
  loop
    exit when n >= 3 or recent + n >= 15;
    if rest ~ ('@' || regexp_replace(lower(p.nick), '([.\-])', '\\\1', 'g') || '($|[^a-z0-9ąćęłńóśźż_.\-])') then
      insert into games.lobby_mentions(msg_id, to_user, from_user, from_nick)
      values (new.id, p.user_id, new.user_id, new.nick);
      n := n + 1;
      rest := replace(rest, '@' || lower(p.nick), ' ');
    end if;
  end loop;
  return new;
end $$;

-- Preserve the open chat RPC's network mute and online counter behavior.
create or replace function public.gry_lobby_chat(p_after bigint default 0, p_visitor text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); v text := left(trim(coalesce(p_visitor, '')), 40); ip text := games.client_ip_hash();
begin
  perform games.lobby_cleanup();
  if v ~ '^[A-Za-z0-9-]{8,40}$' then
    insert into games.lobby_seen(visitor, user_id, seen_at) values (v, u, now())
    on conflict (visitor) do update set seen_at = now(), user_id = coalesce(excluded.user_id, games.lobby_seen.user_id)
     where games.lobby_seen.seen_at < now() - interval '15 seconds';
  end if;
  return jsonb_build_object(
    'now', now(),
    'online', (select count(*) from games.lobby_seen where seen_at > now() - interval '90 seconds'),
    'muted_until', (select max(t) from (
                      select until t from games.lobby_mutes where user_id = u and until > now()
                      union all select until from games.lobby_ip_mutes where ip is not null and ip_hash = ip and until > now()) x),
    'can_mod', u is not null and games.is_host_user(u),
    'hidden', coalesce((select jsonb_agg(id) from games.lobby_chat where hidden_at is not null and id <= coalesce(p_after, 0)
                          and created_at > now() - interval '24 hours'), '[]'::jsonb),
    'messages', coalesce((select jsonb_agg(jsonb_build_object('id', q.id, 'user_id', q.user_id, 'nick', q.nick, 'verified', q.verified,
                                                              'body', q.body, 'at', q.created_at, 'broadcast', q.broadcast) order by q.id)
                          from (select * from games.lobby_chat
                                 where id > coalesce(p_after, 0) and hidden_at is null and created_at > now() - interval '24 hours'
                                 order by id desc limit 50) q), '[]'::jsonb));
end $$;

revoke all on function games.lobby_broadcast_before_insert() from public;

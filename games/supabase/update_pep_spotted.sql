-- PEP SPOTTED (PondOS desktop): frens pin links where Pepecoin got a mention (a post on X, a Reddit thread,
-- a video, an article) and other frens tip the finder with Haze (owner idea, 28 Nov 2026).
-- Run ONCE in Supabase → SQL Editor (New query → paste everything → Run). Safe to run again, keeps all data.
-- Needs update_lobby_chat.sql, update_haze_tips.sql and update_page_stats.sql (games.is_owner) run first.
--
--  • READ: everyone (also guests) sees the pinned finds, newest first
--  • PIN: Discord frens only (tips need a Discord account anyway); 3 finds a day, 2 minutes apart; no duplicates
--  • TIPS: a pinned find also writes one short line in LAN Party ("spotted PEP on X..."). Haze tips belong to a chat
--    message on the server (gry_haze_tip_begin), so the find is tipped through that line, with no change to the tip
--    code, and the tips show in the chat too. The server lets a message be tipped for 24 hours, so a find can
--    be tipped for 24 hours after it was pinned; its tip count stays afterwards.
--  • MODERATION: the finder can take their own find down; the owner can take any find down or mark it
--    "in the Gazette". The page shows every link as plain text with its host, opened in a new tab.
begin;

create table if not exists games.pep_spotted (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  nick        text not null check (char_length(nick) between 1 and 40),
  url         text not null check (char_length(url) between 12 and 400),
  url_key     text not null,                    -- lower case, no trailing slash: the duplicate check
  host        text not null check (char_length(host) between 3 and 100),
  kind        text not null check (kind in ('x', 'reddit', 'youtube', 'tiktok', 'telegram', 'article')),
  note        text not null default '' check (char_length(note) <= 140),
  chat_id     bigint,                           -- the LAN Party line that carries the tips
  created_at  timestamptz not null default now(),
  featured_at timestamptz,                      -- the owner marked it "in the Gazette"
  hidden_at   timestamptz
);
create index if not exists pep_spotted_new on games.pep_spotted (created_at desc) where hidden_at is null;
create index if not exists pep_spotted_user on games.pep_spotted (user_id, created_at desc);
create unique index if not exists pep_spotted_url on games.pep_spotted (url_key) where hidden_at is null;
alter table games.pep_spotted enable row level security;   -- no policies: only through the functions below
revoke all on games.pep_spotted from public, anon, authenticated;

-- one find as the page sees it (no ip, no url_key)
create or replace function games.spotted_row(s games.pep_spotted, me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', s.id, 'user_id', s.user_id, 'nick', s.nick, 'url', s.url, 'host', s.host, 'kind', s.kind,
    'note', s.note, 'at', s.created_at, 'featured', s.featured_at is not null, 'mine', s.user_id = me,
    'chat_id', s.chat_id,
    'tip_until', (select c.created_at + interval '24 hours' from games.lobby_chat c
                  where c.id = s.chat_id and c.hidden_at is null and c.created_at > now() - interval '24 hours'),
    'tips', (select count(*) from games.haze_tips t where t.message_id = s.chat_id and t.confirmed_at is not null))
$$;

create or replace function public.gry_spotted_list(p_limit int default 30) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare me uuid := auth.uid();
begin
  return jsonb_build_object(
    'items', coalesce((select jsonb_agg(games.spotted_row(s, me) order by s.created_at desc)
      from games.pep_spotted s where s.id in (select x.id from games.pep_spotted x where x.hidden_at is null
        order by x.created_at desc limit least(greatest(coalesce(p_limit, 30), 1), 60))), '[]'::jsonb),
    'week', (select count(*) from games.pep_spotted where hidden_at is null and created_at > now() - interval '7 days'),
    'total', (select count(*) from games.pep_spotted where hidden_at is null),
    'can_pin', me is not null and games.discord_identity(me) is not null,
    'mod', me is not null and games.is_owner(me));
end $$;

create or replace function public.gry_spotted_pin(p_url text, p_note text default '') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); raw text := trim(coalesce(p_url, '')); n text := trim(regexp_replace(coalesce(p_note, ''), '\s+', ' ', 'g'));
  h text; k text; kd text; v_nick text; prev games.pep_spotted; s games.pep_spotted; c games.lobby_chat; place text;
begin
  if u is null or games.discord_identity(u) is null then raise exception 'Log on with Discord to pin a find.'; end if;
  if exists (select 1 from games.lobby_mutes where user_id = u and until > now()) then raise exception 'You are muted in the pond for now.'; end if;
  -- a full https link, no spaces, no user:password@, a real host name
  if raw !~ '^https://[A-Za-z0-9.-]+\.[A-Za-z]{2,}(:[0-9]{2,5})?(/[^\s<>"]*)?$' or char_length(raw) > 400 then
    raise exception 'Paste a full link that starts with https://'; end if;
  h := lower(substring(raw from '^https://([^/:]+)'));
  h := regexp_replace(h, '^(www\.|m\.|mobile\.|old\.)', '');
  if h ~ '^[0-9.]+$' or h in ('localhost') then raise exception 'Paste a link to a real website.'; end if;
  if h in ('bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'ow.ly', 'buff.ly', 'shorturl.at', 'tiny.cc') then
    raise exception 'Paste the full link, not a short one.'; end if;
  kd := case when h in ('x.com', 'twitter.com') then 'x' when h in ('reddit.com', 'redd.it') then 'reddit'
    when h in ('youtube.com', 'youtu.be') then 'youtube' when h = 'tiktok.com' then 'tiktok' when h = 't.me' then 'telegram' else 'article' end;
  -- posts on X carry tracking (?s=20&t=...): keep the clean address
  if kd = 'x' then raw := regexp_replace(raw, '[?#].*$', ''); end if;
  k := regexp_replace(lower(regexp_replace(raw, '^https://(www\.|m\.|mobile\.|old\.)?', 'https://')), '/+$', '');
  if kd = 'x' then k := replace(k, 'https://twitter.com/', 'https://x.com/'); end if;
  if char_length(n) > 140 then raise exception 'The note can be up to 140 characters.'; end if;
  if n ~* '(https?://|www\.|discord\.gg)' or n ~ '[[:cntrl:]]' then raise exception 'The note is plain text, no links.'; end if;
  if games.is_profane(n) or games.is_blocked(n) or games.is_blocked(raw) then raise exception 'That find did not pass the filter.'; end if;

  perform pg_advisory_xact_lock(hashtext('pepspotted:' || u::text));
  select * into prev from games.pep_spotted where url_key = k and hidden_at is null;
  if found then raise exception 'Already pinned by %. Tip them instead! 💚', prev.nick; end if;
  if exists (select 1 from games.pep_spotted where user_id = u and created_at > now() - interval '2 minutes') then
    raise exception 'One find at a time: wait 2 minutes.'; end if;
  if (select count(*) from games.pep_spotted where user_id = u and created_at > now() - interval '24 hours') >= 3 then
    raise exception 'That is 3 finds today. Come back tomorrow with more PEP sightings.'; end if;

  select p.nick into v_nick from games.profiles p where p.user_id = u;
  v_nick := coalesce(nullif(v_nick, ''), 'Fren');
  place := case kd when 'x' then 'on X' when 'reddit' then 'on Reddit' when 'youtube' then 'on YouTube' when 'tiktok' then 'on TikTok'
    when 'telegram' then 'on Telegram' else 'in an article' end;
  insert into games.lobby_chat(user_id, nick, verified, body)
    values (u, v_nick, true, '📰 spotted PEP ' || place || '! Read it in PEP Spotted on the desktop' || case when n <> '' then ': “' || left(games.clean_text(n), 90) || '”' else '' end)
    returning * into c;
  insert into games.pep_spotted(user_id, nick, url, url_key, host, kind, note, chat_id)
    values (u, v_nick, raw, k, h, kd, games.clean_text(n), c.id) returning * into s;
  return games.spotted_row(s, u);
end $$;

-- the finder takes their own find down; the owner can take any down
create or replace function public.gry_spotted_hide(p_id bigint) returns boolean
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'Log on first.'; end if;
  update games.pep_spotted set hidden_at = now()
    where id = p_id and hidden_at is null and (user_id = u or games.is_owner(u));
  if not found then raise exception 'That find is not yours to take down.'; end if;
  return true;
end $$;

-- the owner marks a find "in the Gazette" (or takes the mark off)
create or replace function public.gry_spotted_feature(p_id bigint, p_on boolean default true) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or not games.is_owner(auth.uid()) then raise exception 'Only the editor can do that.'; end if;
  update games.pep_spotted set featured_at = case when p_on then coalesce(featured_at, now()) end where id = p_id;
  return found;
end $$;

revoke all on function games.spotted_row(games.pep_spotted, uuid) from public, anon, authenticated;
revoke all on function public.gry_spotted_list(int), public.gry_spotted_pin(text, text), public.gry_spotted_hide(bigint),
  public.gry_spotted_feature(bigint, boolean) from public;
grant execute on function public.gry_spotted_list(int) to anon, authenticated;
grant execute on function public.gry_spotted_pin(text, text), public.gry_spotted_hide(bigint), public.gry_spotted_feature(bigint, boolean) to authenticated;

commit;

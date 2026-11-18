-- The Pond Gazette NEWSROOM: the site owner writes and publishes Gazette issues and PEP-TV ads from PondOS
-- (Frog Mail → 📰 Newsroom), on a computer or a phone, without changing the site code.
-- Run ONCE in Supabase → SQL Editor (New query → paste everything → Run). Safe to run again, keeps all data.
-- Needs update_page_stats.sql (games.owners, games.is_owner) and update_polls.sql (games.polls) run first.
-- If Supabase shows "Potential issues detected", pick "Run and enable RLS".
--
--  • READ: everyone (also without logging on) sees published issues and ads; drafts only the owner
--  • WRITE: only the owner (games.owners, Discord account); every save is checked here, on the server
--  • pictures: the owner uploads them to the public Storage bucket "gazette" (max 1 MB, images only)
--  • issues #2–#10 stay in the site code; issues from the Newsroom start at #11
--  • a "Pond Poll" block in an issue creates its poll in games.polls on save (options locked after the first vote)
begin;

create table if not exists games.gazette_issues (
  num          int primary key check (num between 11 and 9999),
  title        text not null default '' check (char_length(title) <= 120),
  edition      text not null default 'Weekly' check (char_length(edition) <= 40),
  foot         text not null default '' check (char_length(foot) <= 200),
  blocks       jsonb not null default '[]' check (jsonb_typeof(blocks) = 'array'),
  published_at timestamptz,               -- null = draft (only the owner sees it)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create table if not exists games.gazette_ads (
  id           text primary key check (id ~ '^[a-z0-9][a-z0-9_]{1,40}\.mpg$'),
  title        text not null check (char_length(title) between 1 and 80),
  ch           text not null default '' check (char_length(ch) <= 80),
  look         text not null default '' check (look in ('', 'news', 'tabloid', 'shop', 'travel', 'fight', 'telethon', 'psychic', 'gameshow')),
  kitsch       boolean not null default false,
  icon         text not null default '' check (char_length(icon) <= 300),
  scenes       jsonb not null default '[]' check (jsonb_typeof(scenes) = 'array'),
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
alter table games.gazette_issues enable row level security;   -- no policies: only through the functions below
alter table games.gazette_ads enable row level security;
revoke all on games.gazette_issues, games.gazette_ads from public, anon, authenticated;

-- size and shape checks for what the Newsroom sends (the page escapes every text when it shows it)
create or replace function games.gz_check(p_list jsonb, p_max int, p_what text) returns void
language plpgsql immutable set search_path = '' as $$
begin
  if p_list is null or jsonb_typeof(p_list) <> 'array' then raise exception '% must be a list', p_what; end if;
  if jsonb_array_length(p_list) > p_max then raise exception 'Too many %: at most %', p_what, p_max; end if;
  if octet_length(p_list::text) > 60000 then raise exception 'Too much text: make it shorter (max about 50,000 characters)'; end if;
  if exists (select 1 from jsonb_array_elements(p_list) e where jsonb_typeof(e) <> 'object') then raise exception 'Broken % list', p_what; end if;
end $$;

-- Archive for everyone: published issues (number, title, date) + published PEP-TV ads (whole, they are small).
create or replace function public.gry_gazette_list() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'issues', coalesce((select jsonb_agg(jsonb_build_object('num', num, 'title', title, 'at', published_at) order by num desc)
                        from games.gazette_issues where published_at is not null and published_at <= now()), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'ch', ch, 'look', look, 'kitsch', kitsch,
                                                         'icon', icon, 'scenes', scenes, 'at', published_at) order by published_at)
                     from games.gazette_ads where published_at is not null and published_at <= now()), '[]'::jsonb))
$$;

-- One issue. Published: everyone. Draft: only the owner (for the preview).
create or replace function public.gry_gazette_issue(p_num int) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r games.gazette_issues;
begin
  select * into r from games.gazette_issues where num = p_num;
  if not found or ((r.published_at is null or r.published_at > now()) and not games.is_owner(auth.uid())) then return null; end if;
  return jsonb_build_object('num', r.num, 'title', r.title, 'edition', r.edition, 'foot', r.foot, 'blocks', r.blocks,
                            'at', r.published_at, 'draft', r.published_at is null);
end $$;

-- The owner's desk: everything, drafts too. Others get null (the page then shows nothing).
create or replace function public.gry_newsroom() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then return null; end if;
  return jsonb_build_object(
    'issues', coalesce((select jsonb_agg(jsonb_build_object('num', num, 'title', title, 'edition', edition, 'foot', foot, 'blocks', blocks,
                                                            'at', published_at, 'updated', updated_at) order by num desc)
                        from games.gazette_issues), '[]'::jsonb),
    'ads', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'title', title, 'ch', ch, 'look', look, 'kitsch', kitsch, 'icon', icon,
                                                         'scenes', scenes, 'at', published_at, 'updated', updated_at) order by updated_at desc)
                     from games.gazette_ads), '[]'::jsonb));
end $$;

-- Save an issue. p_publish: true = publish (keeps the first publish date), false = back to draft, null = keep as it is.
create or replace function public.gry_newsroom_save_issue(p_num int, p_title text, p_edition text, p_foot text, p_blocks jsonb,
                                                          p_publish boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare b jsonb; pid text; q text; opts jsonb; days int; r games.gazette_issues;
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  if p_num is null or p_num < 11 or p_num > 9999 then raise exception 'Issue numbers from the Newsroom start at 11'; end if;
  perform games.gz_check(p_blocks, 20, 'stories');
  -- Pond Poll blocks: create the poll (or update it while nobody has voted yet)
  for b in select e from jsonb_array_elements(p_blocks) e where e->>'style' = 'poll' loop
    pid := b #>> '{poll,id}'; q := trim(coalesce(b #>> '{poll,question}', ''));
    days := least(greatest(coalesce(nullif(b #>> '{poll,days}', '')::int, 2), 1), 30);
    if pid is null or pid !~ '^gz[0-9]{2,4}_[a-z0-9]{3,12}$' then raise exception 'Broken poll id'; end if;
    if char_length(q) not between 3 and 200 then raise exception 'Poll question: 3 to 200 characters'; end if;
    select jsonb_agg(jsonb_build_object('id', 'o' || n, 'label', left(trim(o), 60)) order by n) into opts
      from jsonb_array_elements_text(coalesce(b #> '{poll,options}', '[]')) with ordinality x(o, n) where trim(o) <> '';
    if opts is null or jsonb_array_length(opts) not between 2 and 8 then raise exception 'A poll needs 2 to 8 answers'; end if;
    if exists (select 1 from games.polls where id = pid) then
      if not exists (select 1 from games.poll_votes where poll_id = pid) then
        update games.polls set question = q, options = opts, closes_at = greatest(opens_at + interval '1 hour', now() + make_interval(days => days)) where id = pid;
      end if;
    else
      insert into games.polls (id, question, options, closes_at) values (pid, q, opts, now() + make_interval(days => days));
    end if;
  end loop;
  insert into games.gazette_issues as g (num, title, edition, foot, blocks, published_at)
  values (p_num, left(trim(coalesce(p_title, '')), 120), left(trim(coalesce(nullif(trim(p_edition), ''), 'Weekly')), 40),
          left(trim(coalesce(p_foot, '')), 200), p_blocks, case when p_publish then now() end)
  on conflict (num) do update set title = excluded.title, edition = excluded.edition, foot = excluded.foot, blocks = excluded.blocks,
    published_at = case when p_publish is null then g.published_at when p_publish then coalesce(g.published_at, now()) end,
    updated_at = now()
  returning * into r;
  return jsonb_build_object('num', r.num, 'at', r.published_at, 'updated', r.updated_at);
end $$;

create or replace function public.gry_newsroom_delete_issue(p_num int) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  delete from games.gazette_issues where num = p_num;
end $$;

create or replace function public.gry_newsroom_save_ad(p_id text, p_title text, p_ch text, p_look text, p_kitsch boolean, p_icon text,
                                                       p_scenes jsonb, p_publish boolean default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r games.gazette_ads;
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  if p_id is null or p_id !~ '^[a-z0-9][a-z0-9_]{1,40}\.mpg$' then raise exception 'File name: small letters, digits and _, ending in .mpg'; end if;
  perform games.gz_check(p_scenes, 10, 'scenes');
  if jsonb_array_length(p_scenes) < 1 then raise exception 'An ad needs at least one scene'; end if;
  insert into games.gazette_ads as a (id, title, ch, look, kitsch, icon, scenes, published_at)
  values (p_id, left(trim(coalesce(nullif(trim(p_title), ''), p_id)), 80), left(trim(coalesce(p_ch, '')), 80), coalesce(p_look, ''),
          coalesce(p_kitsch, false), left(coalesce(p_icon, ''), 300), p_scenes, case when p_publish then now() end)
  on conflict (id) do update set title = excluded.title, ch = excluded.ch, look = excluded.look, kitsch = excluded.kitsch,
    icon = excluded.icon, scenes = excluded.scenes,
    published_at = case when p_publish is null then a.published_at when p_publish then coalesce(a.published_at, now()) end,
    updated_at = now()
  returning * into r;
  return jsonb_build_object('id', r.id, 'at', r.published_at, 'updated', r.updated_at);
end $$;

create or replace function public.gry_newsroom_delete_ad(p_id text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not games.is_owner(auth.uid()) then raise exception 'Only the site owner can do that'; end if;
  delete from games.gazette_ads where id = p_id;
end $$;

-- Storage policies call this (they run as the visitor, who cannot call games.is_owner directly)
create or replace function public.gry_gazette_can_upload() returns boolean
language sql stable security definer set search_path = '' as $$ select games.is_owner(auth.uid()) $$;

revoke all on function games.gz_check(jsonb, int, text) from public;
revoke all on function public.gry_gazette_list(), public.gry_gazette_issue(int), public.gry_newsroom(),
  public.gry_newsroom_save_issue(int, text, text, text, jsonb, boolean), public.gry_newsroom_delete_issue(int),
  public.gry_newsroom_save_ad(text, text, text, text, boolean, text, jsonb, boolean), public.gry_newsroom_delete_ad(text),
  public.gry_gazette_can_upload() from public, anon;
grant execute on function public.gry_gazette_list(), public.gry_gazette_issue(int) to anon, authenticated;
grant execute on function public.gry_newsroom(), public.gry_newsroom_save_issue(int, text, text, text, jsonb, boolean),
  public.gry_newsroom_delete_issue(int), public.gry_newsroom_save_ad(text, text, text, text, boolean, text, jsonb, boolean),
  public.gry_newsroom_delete_ad(text), public.gry_gazette_can_upload() to authenticated;

-- Pictures: a public bucket (anyone can look at a picture by its link), only the owner can add, list or remove.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gazette', 'gazette', true, 1048576, array['image/webp', 'image/jpeg', 'image/png', 'image/gif'])
on conflict (id) do update set public = true, file_size_limit = 1048576, allowed_mime_types = array['image/webp', 'image/jpeg', 'image/png', 'image/gif'];
drop policy if exists gazette_owner_insert on storage.objects;
drop policy if exists gazette_owner_select on storage.objects;
drop policy if exists gazette_owner_delete on storage.objects;
create policy gazette_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gazette' and public.gry_gazette_can_upload());
create policy gazette_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'gazette' and public.gry_gazette_can_upload());
create policy gazette_owner_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gazette' and public.gry_gazette_can_upload());

commit;

-- Where's Pepe SQL, part 3 of 6 (run the parts in order)
create or replace function public.gry_wp_today() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare p games.wp_puzzles := games.wp_today(); u uuid := auth.uid(); pl games.wp_plays; s int := 0; d date;
begin
if u is not null and p.id is not null then
select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
if pl.user_id is not null and pl.guessed_at is null and pl.started_at < now() - interval '130 seconds' then
pl := games.wp_finish(p, pl, null, null);
end if;
end if;
if u is not null then   -- streak: days in a row with a finished play, up to today or yesterday
d := games.wp_utc_day();
if not exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id where x.user_id = u and q.day = d and x.guessed_at is not null) then d := d - 1; end if;
while exists (select 1 from games.wp_plays x join games.wp_puzzles q on q.id = x.puzzle_id where x.user_id = u and q.day = d and x.guessed_at is not null) loop
s := s + 1; d := d - 1;
end loop;
end if;
return jsonb_build_object(
'live', p.id is not null, 'num', p.num, 'day', coalesce(p.day, games.wp_utc_day()),
'next_at', (games.wp_utc_day() + 1)::timestamp at time zone 'utc', 'now', now(), 'streak', s,
'signed_in', u is not null, 'verified', u is not null and games.discord_identity(u) is not null,
'is_host', u is not null and games.is_host_user(u),
'rewards', (select jsonb_build_object('open', wp_rewards_open, 'per_50', wp_pep_per_50, 'max_day', wp_max_day, 'max_week', wp_max_week) from games.config where id = 1),
'played', pl.user_id is not null, 'mine', case when pl.user_id is not null then games.wp_view(p, pl, pl.guessed_at is not null) end);
end $$;

create or replace function public.gry_wp_start(p_nick text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles; pl games.wp_plays; d jsonb; v_nick text := btrim(regexp_replace(coalesce(p_nick, ''), '\s+', ' ', 'g'));
begin
if u is null then raise exception 'Log on first (Discord or guest) to play'; end if;
p := games.wp_today();
if p.id is null then raise exception 'Pepe is still packing. No puzzle today yet, come back later'; end if;
select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
if pl.user_id is null then
d := games.discord_identity(u);
if d is not null then
v_nick := coalesce((select nick from games.profiles where user_id = u), left(d->>'name', 32));
else
if char_length(v_nick) < 2 or char_length(v_nick) > 20 or v_nick !~ '^[A-Za-z0-9ĄĆĘŁŃÓŚŹŻąćęłńóśźż _.\-]+$' then v_nick := 'guest'; end if;
if games.is_profane(v_nick) then v_nick := 'guest'; end if;
end if;
insert into games.wp_plays (puzzle_id, user_id, nick, verified) values (p.id, u, v_nick, d is not null)
on conflict do nothing;
select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
end if;
if pl.guessed_at is null and pl.started_at < now() - interval '130 seconds' then pl := games.wp_finish(p, pl, null, null); end if;
return games.wp_view(p, pl, true);
end $$;

create or replace function public.gry_wp_leave() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles := games.wp_today(); n int;
begin
update games.wp_plays set leaves = leaves + 1
where puzzle_id = p.id and user_id = u and guessed_at is null and started_at > now() - interval '130 seconds'
returning leaves into n;
return jsonb_build_object('leaves', coalesce(n, 0));
end $$;

create or replace function public.gry_wp_hint() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); p games.wp_puzzles := games.wp_today(); pl games.wp_plays;
begin
select * into pl from games.wp_plays where puzzle_id = p.id and user_id = u;
if pl.user_id is null then raise exception 'Press Start first'; end if;
return games.wp_view(p, pl, false) - 'image';
end $$;


-- Where's Pepe SQL, part 6 of 6 (run the parts in order)
create or replace function public.gry_wp_robot_status(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
if not games.wp_robot_ok(p_token) then raise exception 'Not allowed'; end if;
return jsonb_build_object(
'pending', (select count(*) from games.wp_puzzles where status = 'pending'),
'approved_waiting', (select count(*) from games.wp_puzzles where status = 'approved' and day is null),
'used', (select count(*) from games.wp_puzzles));
end $$;

create or replace function public.gry_wp_robot_add(p_token text, p jsonb, p_image text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r games.wp_puzzles;
begin
if not games.wp_robot_ok(p_token) then raise exception 'Not allowed'; end if;
if (select count(*) from games.wp_puzzles where status = 'pending') >= 30 then raise exception 'The queue is full'; end if;
if p_image is null or p_image !~ '^data:image/(webp|jpeg);base64,[A-Za-z0-9+/=]+$' or length(p_image) > 700000 then raise exception 'Bad picture'; end if;
if exists (select 1 from games.wp_puzzles where qid = p->>'qid') then return jsonb_build_object('duplicate', true); end if;
insert into games.wp_puzzles (qid, title, lat, lon, country, country_code, continent, wiki_url, credit, license, source_url)
values (left(p->>'qid', 20), left(p->>'title', 120), (p->>'lat')::double precision, (p->>'lon')::double precision,
left(p->>'country', 80), upper(left(p->>'country_code', 2)), left(p->>'continent', 40), left(p->>'wiki_url', 300),
left(p->>'credit', 200), left(p->>'license', 60), left(p->>'source_url', 300))
returning * into r;
insert into games.wp_images (puzzle_id, data) values (r.id, p_image);
return jsonb_build_object('id', r.id);
end $$;

revoke all on function games.wp_today(), games.wp_view(games.wp_puzzles, games.wp_plays, boolean),
games.wp_finish(games.wp_puzzles, games.wp_plays, double precision, double precision), games.wp_robot_ok(text),
games.wp_reveal(games.wp_puzzles), games.wp_km(double precision, double precision, double precision, double precision) from public, anon, authenticated;

revoke all on function public.gry_wp_today(), public.gry_wp_start(text), public.gry_wp_leave(), public.gry_wp_hint(),
public.gry_wp_guess(double precision, double precision), public.gry_wp_top(text), public.gry_wp_claim(text), public.gry_wp_my_claims(),
public.gry_wp_host_queue(), public.gry_wp_host_image(bigint), public.gry_wp_host_decide(bigint, boolean), public.gry_wp_host_claims(),
public.gry_wp_host_paid(bigint[], text), public.gry_wp_host_hold(bigint, boolean), public.gry_wp_host_settings(numeric, int, int, boolean),
public.gry_wp_robot_status(text), public.gry_wp_robot_add(text, jsonb, text) from public;

grant execute on function public.gry_wp_today(), public.gry_wp_top(text), public.gry_wp_robot_status(text), public.gry_wp_robot_add(text, jsonb, text) to anon, authenticated;

grant execute on function public.gry_wp_start(text), public.gry_wp_leave(), public.gry_wp_hint(), public.gry_wp_guess(double precision, double precision),
public.gry_wp_claim(text), public.gry_wp_my_claims(),
public.gry_wp_host_queue(), public.gry_wp_host_image(bigint), public.gry_wp_host_decide(bigint, boolean), public.gry_wp_host_claims(),
public.gry_wp_host_paid(bigint[], text), public.gry_wp_host_hold(bigint, boolean), public.gry_wp_host_settings(numeric, int, int, boolean) to authenticated;


-- Where's Pepe guest rewards, part 2 of 3 (run in order)
create or replace function public.gry_wp_claim(p_address text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); a text := btrim(coalesce(p_address, '')); c games.config; pl games.wp_plays; q games.wp_puzzles;
pep numeric; wk numeric; ver boolean; ip text := games.client_ip_hash(); mx_d numeric; mx_w numeric;
begin
if u is null then raise exception 'Log on first'; end if;
ver := games.discord_identity(u) is not null;
select * into c from games.config where id = 1 for update;   -- one claim at a time: the budget stays exact
if not c.wp_rewards_open then raise exception 'Rewards are paused right now'; end if;
if a !~ '^P[1-9A-HJ-NP-Za-km-z]{33}$' then raise exception 'That is not a PEP address (it starts with P and has 34 characters)'; end if;
select x.* into pl from games.wp_plays x join games.wp_puzzles w on w.id = x.puzzle_id
where x.user_id = u and x.guessed_at is not null and w.day >= games.wp_utc_day() - 1
and not exists (select 1 from games.wp_claims k where k.puzzle_id = x.puzzle_id and k.user_id = u)
order by w.day desc limit 1;
if pl.user_id is null then raise exception 'Nothing to claim: play today''s puzzle first (one reward per puzzle)'; end if;
select * into q from games.wp_puzzles where id = pl.puzzle_id;
if exists (select 1 from games.wp_claims k where k.address = a and k.user_id <> u and k.created_at > now() - interval '90 days') then
raise exception 'That address is already used by another player'; end if;
if not ver then
if ip is null then raise exception 'Guest rewards need a normal connection. Log on with Discord instead'; end if;
if games.wp_streak(u, q.day) < c.wp_guest_streak then
raise exception 'Guest rewards start on day % of your streak. Keep playing every day, or log on with Discord', c.wp_guest_streak; end if;
-- the network you claim from and the network you played from: each gives one guest reward a day
if exists (select 1 from games.wp_claims k left join games.wp_plays y on y.puzzle_id = k.puzzle_id and y.user_id = k.user_id
where k.puzzle_id = q.id and not k.verified and (k.ip_hash in (ip, pl.ip_hash) or y.ip_hash in (ip, pl.ip_hash))) then
raise exception 'Someone on this network already took today''s guest reward. Log on with Discord for your own'; end if;
end if;
mx_d := case when ver then c.wp_max_day else c.wp_guest_max_day end;
mx_w := case when ver then c.wp_max_week else c.wp_guest_max_week end;
pep := least(mx_d, floor(coalesce(pl.points, 0) / 50.0) * c.wp_pep_per_50);
select coalesce(sum(k.pep), 0) into wk from games.wp_claims k where k.user_id = u and k.status <> 'held' and k.created_at > now() - interval '7 days';
pep := least(pep, greatest(0, mx_w - wk), games.wp_budget_left());
if pep <= 0 then
if games.wp_budget_left() <= 0 then raise exception 'This week''s PEP budget is used up. More next week!'; end if;
raise exception 'No reward this time (score too low, or your weekly limit is reached)';
end if;
insert into games.wp_claims (puzzle_id, user_id, nick, address, pep, verified, ip_hash) values (pl.puzzle_id, u, pl.nick, a, pep, ver, ip);
return jsonb_build_object('pep', pep, 'status', 'open', 'num', q.num);
end $$;


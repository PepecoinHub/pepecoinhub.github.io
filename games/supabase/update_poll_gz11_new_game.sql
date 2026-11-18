-- The Pond Gazette #11 poll: "Do you want a new game?" 15 YES votes and Pepe Gold Hook opens for everyone,
-- by itself: the page asks gry_new_game() and, once it says open, shows Gold Hook to every visitor (icons, menus,
-- Leaders, the PEP-TV ad). Nobody has to deploy anything when the 15th YES lands.
-- Run once in the Supabase SQL editor (after update_polls.sql). Safe to run again.
-- The poll closes on Thursday 26 November, 00:00 UTC. Once open, Gold Hook stays open even after the poll closes.
begin;

insert into games.polls (id, question, options, closes_at)
values ('gz11_new_game',
        'Do you want a new game? 15 YES and it opens for everyone, automatically.',
        '[{"id": "yes", "label": "YES, new game! ⛏️"}, {"id": "no", "label": "No"}]',
        '2026-11-26T00:00:00Z')
on conflict (id) do nothing;

-- Public answer for every page: is the new game open, and how close is it? Only the YES count, never who voted.
create or replace function public.gry_new_game()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('yes', y, 'need', 15, 'open', y >= 15)
  from (select count(*)::int as y from games.poll_votes where poll_id = 'gz11_new_game' and choice = 'yes') t
$$;
revoke all on function public.gry_new_game() from public;
grant execute on function public.gry_new_game() to anon, authenticated;

commit;

-- Check: select public.gry_new_game();

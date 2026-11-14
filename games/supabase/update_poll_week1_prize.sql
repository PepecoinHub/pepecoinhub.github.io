-- The Pond Gazette #8 poll: 10 YES votes and the first official Pepe Guesser week (Mon 16 to Sun 22 November 2026, UTC)
-- gets a 10,000 PEP faucet pot and 5,000 PEP for the Weekly Champion.
-- Run once in the Supabase SQL editor (after update_polls.sql), when Gazette #8 goes live. Safe to run again.
-- The poll closes when the week starts: Monday 16 November, 00:00 UTC.
insert into games.polls (id, question, options, closes_at)
values ('week1_prize',
        '10 YES votes and week 1 of Pepe Guesser gets a 10,000 PEP faucet + 5,000 PEP for the champion. You in?',
        '[{"id": "yes", "label": "YES, I''m in 🐸"}, {"id": "no", "label": "No"}]',
        '2026-11-16T00:00:00Z')
on conflict (id) do nothing;

-- How many YES so far (the page only shows results to frens who already voted):
--   select choice, count(*) from games.poll_votes where poll_id = 'week1_prize' group by choice;

-- If YES reaches 10: double the week's faucet pot (run on Monday 16 November, after 00:00 UTC) ...
--   update games.config set wp_week_budget = 10000 where id = 1;
-- ... and put it back after the week (Monday 23 November, after 00:00 UTC):
--   update games.config set wp_week_budget = 5000 where id = 1;
-- The 5,000 PEP for the Weekly Champion is paid by hand, like the faucet payouts. A tie at the top has no champion.

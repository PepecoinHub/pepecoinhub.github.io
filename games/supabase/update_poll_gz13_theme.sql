-- The Pond Gazette #13 poll: light or dark mode? Run once in the Supabase SQL editor (after update_polls.sql).
-- Safe to run again. The poll closes on Sunday 29 November, 00:00 UTC.
begin;

insert into games.polls (id, question, options, closes_at)
values ('gz13_theme',
        'Which PondOS look do you use?',
        '[{"id": "light", "label": "Light ☀️ (classic grey)"}, {"id": "dark", "label": "Dark 🌙"}, {"id": "auto", "label": "Whatever my device says 🔁"}]',
        '2026-11-29T00:00:00Z')
on conflict (id) do nothing;

commit;

-- Check: select * from games.polls where id = 'gz13_theme';

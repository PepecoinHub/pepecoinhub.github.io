-- The Pond Gazette No. 14 (24 Nov 2026): Lemon wins Pepe Guesser week 1, a letter from a guest,
-- Kraken is the new #1 on the rich list, new things on the horizon.
-- Run ONCE in Supabase → SQL Editor AFTER the site update with img/gz14-frog-of-the-week.webp is live.
-- It publishes the issue at once (next free number, at least 14), so the "new Gazette issue" push goes out.
-- Running it again does nothing (it skips when an issue with this title already exists).
-- To fix a typo later: Frog Mail → 📰 Newsroom → open the issue → Save (no new push for an issue already published).
do $$
declare n int;
begin
  if exists (select 1 from games.gazette_issues where title = 'Lemon is champion, Kraken is the new #1') then
    raise notice 'Issue already there, nothing to do'; return;
  end if;
  select greatest(14, coalesce(max(num), 0) + 1) into n from games.gazette_issues;
  insert into games.gazette_issues (num, title, edition, foot, blocks, published_at)
  values (n, 'Lemon is champion, Kraken is the new #1', 'Almost weekly',
          'Keep checking back, frens. See you in the pond. 🐸 The Editor',
          $json$[
  {"style": "breaking", "kicker": "We have a champion",
   "heading": "🏆 Lemon wins Pepe Guesser week 1",
   "img": "gz14-frog-of-the-week.webp", "alt": "The gold Frog of the Week stamp from the Fren Passport",
   "body": "It's official: **Lemon** is the first ever Pepe Guesser Weekly Champion!\n\nOn Saturday the lead was just 176 points, with PepeChad, Grandma_Toad and cHaY all one good pin away. Then came the last photo, the clock hit 23:59 UTC on Sunday, and Lemon was still on top.\n\nCongratulations, Lemon! The **5,000 PEP** Weekly Champion prize is yours, and so is the gold **Frog of the Week** stamp, now shining in your Fren Passport. And a big hand for every fren who chased: what a race.\n\nWeek 2 is already running. The board reset on Monday at 00:00 UTC, so everybody starts from zero again.",
   "btns": [{"label": "Play today's photo →", "go": "wpgo"}, {"label": "Hall of Fame", "go": "hof"}, {"label": "Fren Passport", "go": "pass"}]},
  {"style": "letters", "kicker": "Letters to the Editor",
   "heading": "“PondOs is gud”",
   "img": "newspaper.webp", "alt": "Pepe reading the newspaper",
   "body": "This week's mailbag brought a letter so short that the editor read it three times, just to be sure he didn't miss anything:\n\n> Dear editor,\n> PondOs is gud... that is all\n\n*A guest, 23 November, written on the wallets page*\n\n**The editor replies:** Dear guest, thank you. That is the best review we've ever had, and the shortest. It's going on the wall. And if PondOS is ever not gud, you know where the mailbox is. 🐸",
   "btns": [{"label": "✏️ Write to the Editor", "go": "write"}]},
  {"style": "story", "kicker": "Rich list",
   "heading": "🐋 A new #1 on the rich list: Kraken",
   "img": "wow.webp", "alt": "Pepe with his mouth open in surprise",
   "body": "Since March 2025 the top spot on the [PEP rich list](rich-list.html) belonged to one address of **litecoinpool**. Not anymore. The **Kraken** exchange wallet (PnGBae…bbB) just shot past it:\n- **Sunday:** #15, about 582 million PEP\n- **Monday:** #2, 4.26 billion PEP\n- **Today:** #1, **7.77 billion PEP**, about 7.4% of all PEP in existence\n\nRemember: an exchange wallet is not one rich frog. It holds coins for many Kraken customers. Why it grew so fast, we don't know, and we won't pretend to. Look at the numbers yourself and DYOR.",
   "fine": "Rich list snapshot of 24 November, 07:17 UTC. Not financial advice.",
   "btns": [{"label": "Open the rich list →", "go": "url", "url": "rich-list.html"}]},
  {"style": "notes", "kicker": "Coming soon",
   "heading": "🔭 New things on the horizon",
   "img": "peek.webp", "alt": "Pepe looking through binoculars",
   "body": "The editor can't say much yet. Only this: more is on the way than fits in one issue.\n- 📌 Keep checking back, things will pop up\n- 📌 Turn on Gazette notifications so the next issue finds you\n- 📌 Read the fine print. You know why.",
   "btns": [{"label": "🔔 Notifications", "go": "notify"}]}
]$json$::jsonb, now());
  raise notice 'Published The Pond Gazette No. %', n;
end $$;

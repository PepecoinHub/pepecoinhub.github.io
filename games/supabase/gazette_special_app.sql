-- The Pond Gazette SPECIAL EDITION: PondOS as a phone app, notifications, Haze tips beta (2026-11-19).
-- Run ONCE in Supabase → SQL Editor AFTER the site update with the gz12-*.webp pictures is live.
-- It publishes the issue at once (next free number, at least 12), so the "new Gazette issue" push goes out.
-- Running it again does nothing (it skips when an issue with this title already exists).
-- To fix a typo later: Frog Mail → 📰 Newsroom → open the issue → Save (no new push for an issue already published).
do $$
declare n int;
begin
  if exists (select 1 from games.gazette_issues where title = 'Special: PondOS on your phone, notifications and tips beta') then
    raise notice 'Special edition already there, nothing to do'; return;
  end if;
  select greatest(12, coalesce(max(num), 0) + 1) into n from games.gazette_issues;
  insert into games.gazette_issues (num, title, edition, foot, blocks, published_at)
  values (n, 'Special: PondOS on your phone, notifications and tips beta', 'Special edition',
          'Install it, ping it, tip it. See you in the pond. 🐸 The Editor',
          $json$[
  {"style": "breaking", "kicker": "New · install in 10 seconds",
   "heading": "📲 PondOS is now an app on your phone",
   "img": "gz12-install.webp", "imgSize": "wide", "alt": "The Chrome menu with Install and create shortcut, then the Install button",
   "body": "Frens, did you know you can install PondOS as an app? One tap on the frog icon and you are in the pond. No address bar, no digging through tabs.\n\n**On Android, in Chrome:**\n- Open **pepecoinhub.com/meme/**\n- Tap the **⋮** menu in the top right corner\n- Tap **Install and create shortcut**\n- Tap **Install**\n\nThat's it. The frog now sits on your home screen, next to your other apps.\n\n**On iPhone:** open the same page in Safari, tap **Share**, then **Add to Home Screen**."},
  {"style": "story", "kicker": "New in the Start menu",
   "heading": "🔔 Notifications, only the ones you want",
   "img": "gz12-notify.webp", "imgSize": "wide", "alt": "The PondOS Notifications window with five switches",
   "body": "With PondOS on your phone you can turn on notifications. Go to **Start > Notifications** and pick what may ping you:\n- Someone **@mentions** you in LAN Party (needs a Discord log on)\n- **Announcements** from the Editor, at most one an hour\n- A **new issue of The Pond Gazette**, about once a week\n- **Your challenges**: someone took your Three Lilies challenge, or you lost or kept the Pond King crown\n- **New Three Lilies challenges** on the board, at most one every 30 minutes\n\nEvery switch saves at once, and one button turns it all off again. No spam, pinky promise. 🐸",
   "fine": "On iPhone and iPad notifications work only in the installed app (iOS 16.4 or newer).",
   "btns": [{"label": "Open Notifications", "go": "notify"}]},
  {"style": "breaking", "kicker": "Next up · beta",
   "heading": "💚 Tips in the chat, with Haze Wallet",
   "img": "gz12-tips.webp", "imgSize": "wide", "alt": "LAN Party chat with Wallet not linked buttons next to messages",
   "body": "With the support of **lewisbong** and his **Haze Wallet**, you can now tip frens right in the LAN Party chat. Get ready in three steps:\n- Download **Haze Wallet** from its official site: [hazewallet.com](https://www.hazewallet.com/)\n- Log in to Haze\n- In LAN Party tap **◇ Haze** and link your PEP wallet address\n\nOnly your public address gets linked. PondOS never sees your password or private keys, and linking cannot spend your funds. You approve every tip yourself, inside Haze.\n\nFrens with a linked wallet get a small ◇ next to their name and a **💚 Tip** button on their messages. **Wallet not linked** means they have not joined yet. You can also type **/tip nick amount**, for example /tip Jurek 20.\n\n**For now tips work on phones only. PC is coming soon.** It is a beta, so shout in LAN Party if something looks off.",
   "btns": [{"label": "Open LAN Party", "go": "lan"}, {"label": "Get Haze Wallet ↗", "go": "url", "url": "https://www.hazewallet.com/"}]}
]$json$::jsonb, now());
  raise notice 'Published The Pond Gazette No. % (special edition)', n;
end $$;

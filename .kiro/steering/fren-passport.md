---
inclusion: fileMatch
fileMatchPattern: ["docs/meme/passport*", "docs/meme/avatar*", "games/supabase/update_fren_*", "games/supabase/update_passport_*", "games/FREN_*"]
---
# Fren Passport and Avatar Maker rules (owner decisions)

- Stamps are awarded **only from records the server verifies**, and only to **Discord** accounts. Never build a stamp that only the browser could know about (opening a folder, starting a game).
- Stamps that are not designed yet show as **`???` / "Coming soon"**, without their name.
- **Next Milestone** never suggests letters, chat or @mentions (no spam nudges).
- **Big milestones unlock a special avatar**: a whole character drawn by **Lily**, in the Avatar Maker's Special row (replaces every part except the background). How to add one: `games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md`, section "Special avatars".
- Stamp art follows the existing sprite (`docs/meme/passport-assets/stamps.webp`): perforated edge, coloured panel, heavy black outline, flat colours.
- Rules and sources of every stamp: `games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md`. A new stamp needs a backfill from existing records in its migration.
- Pepe Guesser is the game's name everywhere (the PondOS program is `PepeGuesser.exe`).
- **Other frens' passports** (owner, 2026-11-08): only players logged on with Discord can look; everything in the booklet is public (Fren, nickname, member since, stamps, secrets, items, YEET best) and there is no switch to hide it. The progress counters behind Next Milestone and the Discord account id stay private. Server: `gry_passport_public(p_user uuid)` in `games/supabase/update_passport_public.sql`; it must keep showing the same stamps as `gry_passport_state()`, so a change to one read path needs the same change in the other.
- The Passport, the Avatar Maker, other frens' passports and PepeGochi stay behind the beta flags until the owner says otherwise.

# Launch day: Avatar Maker + Fren Passport + PepeGochi

Everything ships together from PR #236 (`release/pondos-fren-launch`). Nothing runs on production before the owner says go.

## 1. The owner runs the SQL in Supabase (SQL editor), in this order

Each file is one transaction and safe to run twice. Stop at the first error and send it to Claude.

1. `games/supabase/update_fren_passport.sql`
2. `games/supabase/update_fren_avatar.sql`
3. `games/supabase/update_passport_awards.sql`
4. `games/supabase/update_pepegochi_v2.sql`
5. `games/supabase/update_pepegochi_passport.sql`
6. `games/supabase/update_pepegochi_room_v1.sql`
7. `games/supabase/update_pepegochi_rewards.sql`

The game migrations these hook into (YEET, Pepe Guesser, chat, letters, polls, arcade, Pepe Miner cloud saves, board games)
are already live. A hook whose table is missing is skipped, not an error.

## 2. Claude: the release commit (after step 1 succeeds)

- Remove the `?beta=fren` and `?beta=gochi` gates in `docs/meme/meme.js` (FREN and GOCHI become always on).
- Hide the "PEPEGOCHI (local test)" entries (testers only).
- Bump cache versions, run all tests, merge #236 into `main`, close the superseded drafts (#186, #218–#229, #233, #235).

## 3. Check on the live site (owner + Claude)

- Log on with Discord: the Passport opens, First Fren is stamped, the reward dialog shows.
- Create Your Fren saves; Fresh Fren arrives.
- PEPEGOCHI.EXE: adopt an egg, feed it: it hatches, First Hatch arrives. Decorate shows the starter room.
- Owner: Frog Mail → a letter with "OK to print" → 🖨 Mark printed → Junior Editor for its writer.

## 4. Later (not launch)

- BALI: the owner opens it on the day PEP reaches $0.01 (Frog Mail → 🏝 PEP hit $0.01? Open BALI…).
- Bug Hunter and Beta Tester wait (hidden).
- A short Gazette note about secrets, when the owner wants it.

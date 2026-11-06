---
inclusion: always
---
# PepecoinHub site rules (owner decisions)

- **If it works, don't touch it.** No unrequested "improvements", hardening or refactors of working features. The November 2026 CSP hardening (#190) silently blocked the Pepe Guesser map, Pond TV, the guest log-on and every game window in PondOS (#192, #194, #195, #203). Any change to shared infrastructure (CSP, `scripts/add_csp.py`, `chrome.js`, `meme.js` boot code) must be checked in a real browser: open every PondOS window and game before merging.
- After any CSP change, run `node --test tests/csp.test.mjs` and open the games in PondOS (YEET, PEPE SWEEPER, Pepe Miner, FROGAGEDDON, Draw & Guess, Pepe Guesser, Pond TV).
- Bigger features get a PEP-TV ad in the `ADS` list in `docs/meme/meme.js` (late-night infomercial style, real facts, offers marked as not real).
- The Pond Gazette lives in `docs/meme/meme.js` (`gazetteN()`, `MAIL_ISSUE`). A new issue bumps `MAIL_ISSUE`, adds a tab, and moves the previous issue to the archive. Polls: `games/supabase/update_polls.sql` (one row in `games.polls` per poll; everyone votes, guests once per network).

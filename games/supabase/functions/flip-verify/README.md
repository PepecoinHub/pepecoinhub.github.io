# flip-verify: Flipsuite (Flippy) quest check

Flipsuite asks this endpoint "did this Discord fren earn stamp X in PondOS?" and pays the quest reward in PEP from
the community reward wallet only when we answer yes. The site never holds or sends PEP itself.

## Set up (once)
1. Supabase > SQL Editor: run `games/supabase/update_flip_quests.sql`.
2. Supabase > Edge Functions > Deploy a new function > Via editor. Name: `flip-verify`. Paste `index.ts`. Deploy.
3. In the function's settings turn **Verify JWT off**.
4. Edge Functions > Secrets: add `FLIP_SECRET` = a long random string (at least 24 characters).
5. Flipsuite dashboard > Quest > Custom task:
   - URL: `https://azbwciqfbsdpwubznncg.supabase.co/functions/v1/flip-verify?badge=pond_pioneer`
   - Secret: the same `FLIP_SECRET`.
   - Reward: a small PEP amount for the first test, auto-distribute.

## Answers
- 200: has the stamp (Flipsuite pays).
- 400 + message shown to the fren: no stamp yet / not logged on to PondOS with that Discord / not linked.
- 401: wrong secret.

## New quests
Add the stamp id to `ALLOWED` in `index.ts`, redeploy, and use `?badge=<id>` in the quest URL. Weekly winners of
Pepe Guesser need their own check (week + Hall of Fame tables), added after the season starts on 16 XI.

# YEET THE PEP

Entry point: `docs/games/yeet.html`. Static GitHub Pages game, no build and no new production dependency. Existing Supabase configuration and shared Discord session are reused through `docs/games/js/backend.js`.

## Activate the leaderboard

1. In the existing Supabase project `azbwciqfbsdpwubznncg`, execute **all** of `games/supabase/update_yeet.sql` in SQL Editor. It is transactional and safe to repeat. Apply it after the existing `schema.sql`; it uses `games.discord_identity`.
2. Keep the existing Discord OAuth provider and allow `https://pepecoinhub.com/games/**` as a redirect (already documented in `SETUP.md`). No Discord secret goes into the game or repository.
3. Publish the frontend. Log in with a Discord test account, finish a flight, verify the saved record after refreshing and on another device. A guest can play but cannot enter the global leaderboard.

The migration was applied to the connected production project on 2026-11-02. A production read verified the empty leaderboard, enabled RLS and denied direct client table access / guest submissions. There is no admin credential in this checkout. Production Discord login, real score submissions and cross-device reads still need an authenticated production acceptance test after frontend publication.

## Storage and network budget

- Game simulation, artwork animation, controls and synthesized sound run on the player's device. No realtime channels, analytics, background polling or per-frame database calls.
- One row per Discord account. It is retained even outside the top 10; deleting the auth account cascades to the record.
- One leaderboard/personal-best RPC on entry and identity changes; refresh button is throttled to 10 seconds and automatic opens use a 60-second cache. One write for an improved personal record, with a server-side per-account 10-second cooldown. Successful submissions return the top 10 in the same response.
- Failed writes queue the best record locally under that account; Refresh scores retries. Guest records are not silently credited to a later Discord login. Different users on a shared browser have separate local records.
- Artwork is approximately 243 KB total, including both flight poses. Fonts are system fonts, audio is synthesized. The existing locally hosted Supabase SDK is the largest shared script; no external game engine is downloaded.

## Casual competition, not payouts

Distances are integer decimetres in the database and displayed as metres. Ties use achievement time, then account ID. Server checks require a Discord identity, matching rules version, bounded duration and a plausible maximum distance for that duration. Table RLS is enabled and all direct client table privileges are revoked; clients can only use the narrow RPCs. Display names are derived server-side, never supplied by the score request.

These checks do not prove a client played honestly. There are **no PEP payouts**. Valuable prizes would require authoritative replay verification, stronger abuse controls and a separate design.

The Supabase security advisor flags enabled RLS without policies and deliberately callable SECURITY DEFINER RPCs. Here that is intentional: direct table privileges are revoked (deny-all), the public state RPC exposes only the top ten names/distances and the caller's own best, and the submit RPC requires a server-verified Discord identity. All function search paths are empty and all relations qualified. Do not add broad table grants to suppress those notices.

## Verification

`node --test tests/yeet.test.mjs` checks deterministic fixed-step simulation, frame-rate independence, finishing bounds, obstacles and flap limits.

For isolated PostgreSQL integration testing (no live Supabase): install `@electric-sql/pglite@0.5.14` outside this repository, then run `YEET_PGLITE_MODULE=/absolute/path/node_modules/@electric-sql/pglite/dist/index.js node --test tests/yeet-sql.test.mjs`. The test mocks only existing auth helpers and checks the real migration twice, grants, guest rejection, monotonic best scores, cooldown, top-10 order and retention outside the top 10. Without this optional dependency, the default test suite skips this one integration test.

Generated game art was created for this game and optimized to WebP. CSS interface and canvas props are original. The rules version is v1; change the version and review backend bounds if the physics are modified materially.

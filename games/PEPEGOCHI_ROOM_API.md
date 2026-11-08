# PepeGochi Room-2 — serwerowa kolekcja i ustawianie wyposażenia

**Status:** Draft SQL and tests. **Not deployed.** This is not a PEP reward feature.

**Dependencies:** PR #218 (A1), #220 (B1), #221 (A2). This PR is **stacked on the A2 branch** and must be rebased after the preceding PRs land. Related visual-only PR #219 and art assets/editor #222.

## Implemented in this draft

- `games.pepegochi_room_catalog`: 10 allowlisted catalog items: 6 starters plus 4 future collectibles. The 4 future collectibles are **not granted** by this migration.
- `games.pepegochi_room_slots`: eleven named anchors in a 640×400 logical scene, with category allowlists. These are stable identifiers; mobile layout scales the scene.
- `games.pepegochi_room_revisions`: per-account integer revision for safe editing from two browser tabs.
- `games.pepegochi_room_inventory`: account-owned item instances, **not tied to a frog life**; unique owner + source event key prevents double grants when a trusted award hook is later built.
- `games.pepegochi_room_placements`: which owned instance sits in which slot. The composite `(user_id, item_instance_id)` FK enforces that a placement points to the same owner's inventory. Unique item instance prevents placing one object twice.
- Four auth-only, Discord-checked RPCs in `public`: `gry_pepegochi_room_state()`, `gry_pepegochi_room_initialize()`, `gry_pepegochi_room_place(p_item_instance_id,p_slot_id,p_expected_revision)`, `gry_pepegochi_room_unplace(p_slot_id,p_expected_revision)`.
- No public `grant_item` endpoint and no `user_id`, reward ID, item value, balance, position `(x,y)`, or z-index writable from the browser.

## Player flow

1. Log in with Discord and adopt a frog via **existing** A1/A2 RPC. `room_state()` is read-only and initially returns `initialized:false` plus the 11 allowed slots.
2. The first time they open the room, `room_initialize()` adds six ordinary starter objects: TV, lava lamp, potted plant, P poster, rubber duck and mug. It creates six placements. Repeating `initialize()` does not restore a removed object, overwrite a customized room, or add another copy.
3. The editor selects an **owned instance ID** and a **compatible slot**. The server locks `owner → latest life → room revision`, validates Discord, ownership, lifecycle and compatibility, checks expected revision and moves the object. Replacing an occupied slot returns that object to the unplaced inventory, **never deletes it**.
4. `room_unplace()` hides an item without deleting it. A later adopted frog sees the **same** inventory and placements. Even before the old frog is written as departed, its effective server-calculated state blocks late room edits.
5. On stale revision, the client should refetch `room_state()` and let the user retry. No silent overwrite of edits from another tab.

## Critical separation

- **Owning an item** is independent from **placing an item**.
- **Departure** (randomly taking a displayed item, GOODBYE.TXT, a persistent snapshot and temporary visual suppression) is a later **Room-4** PR; it is **not yet in this SQL**. The mockup #222 already demonstrates the intended art. Do not select or store `taken_item_id` in JavaScript as proof.
- **Awards earned in YEET, Passport or The Lost Pond Files** are a separate **Room-3** PR. Server-verifiable, idempotent proofs only. Never infer Moon Rock entitlement from localStorage or client-sent 6000 m claims. The `moon_rock` catalog row is locked, not an ownership grant. No real PEP, no 1.5×.
- This SQL has **no write to** `games.pepegochi_lives`, Passport, stamps or the existing care backend. Keep A1/A2 authoritative.

## Security and tests

Tables: RLS enabled, no browser-role table grants or policies. Internal helpers: `search_path=''`, `EXECUTE` revoked from `PUBLIC`, `anon` and `authenticated`. The public RPCs intentionally use security-definer with an empty `search_path`; their **first operation** validates `auth.uid()` against `games.discord_identity()` before any record is returned or changed.

Static tests: `node --test tests/pepegochi-room-static.test.mjs`.

Real PostgreSQL tests (15+): `PASSPORT_PG_URL=postgres://postgres:pass@127.0.0.1:5432/postgres PASSPORT_PG_MODULE=/abs/path/pg/lib/index.js node --test tests/pepegochi-room-sql.test.mjs`.

The SQL suite creates a **disposable database**, installs `schema.sql` + A2 + Room-2, and destroys the disposable database afterward. It **refuses non-local hostnames** and never connects to PH-games. Test cases include account isolation, denial to `anon` and non-Discord, permission grants, exactly-once initial inventory, tampered item IDs, invalid slot/category, stale revision, unplacement without loss, lifecycle after departure, replay of migration and parallel initialization.

**Important testing status:** The static tests passed locally. No local PostgreSQL server or PGlite was available in this workspace, so the PostgreSQL suite has been **written but not executed**. SQL syntax and race behavior must be verified by Claude using disposable PostgreSQL 17 **before merge**. It is not safe to treat a passing static check as SQL integration QA.

## Suggested next PRs

- **Room-3:** trusted award ledger bridging one server-verifiable event source to inventory; rejection tests for forged scores and double awards.
- **Room-4:** store one eligible taken item on a departed life in the same locked transition as `departed_at`; use that same immutable ID for room rendering, GOODBYE.TXT and history; handle empty/uninitialized rooms.
- **Room-5:** connect #222 approved PNGs to the room RPCs in a hidden beta, with responsive/accessibility tests.

**Release guard:** no production SQL, deployment, merge, or public release without the owner's explicit approval.
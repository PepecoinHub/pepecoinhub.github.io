# PEPaint: surge protection (review / test only)

The previous client paced each room independently, so three full rooms could
produce about 144 drawing messages/s before chat, join events or other PondOS
apps. Supabase Free has a project-wide default of 100 Realtime events/s and
200 concurrent connections. See [Realtime limits](https://supabase.com/docs/guides/realtime/limits).

## Controls

* 12 players/room remains unchanged. A reconnect must also respect the
  room capacity, including reactivation through the state heartbeat.
* At most 100 active PEPaint player-room memberships across the project
  (heartbeat within 45 seconds), including players in waiting rooms.
* At most 8 live PEPaint matches (turn or reveal). New starts are rejected
  politely when full. Existing matches continue and finishing/closing a
  match releases the slot. Empty rooms are closed by the existing cleanup.
* The new drawing RPC reserves a shared rolling one-second budget of
  **48 estimated deliveries**, including an extra event per packet and the
  active room members. The server independently enforces the quota and
  returns a retry interval; more live rooms mean slower updates. Sketching
  remains immediate on the drawing player's own canvas.
* Every normal stroke, clear/undo snapshot and late-join snapshot uses that
  RPC. No direct fallback to Realtime in production. A denied packet is
  retried; an ambiguous transport failure requests an authoritative snapshot.
* This is not a guarantee of 100 real concurrent browsers. Multiple tabs,
  subscriptions without heartbeats, other Realtime apps, chat, auth,
  database CPU, and monthly quotas are separate constraints.
  In particular, Guess the Picture and room/chat broadcasts do not use this
  drawing budget. The 48-event target leaves room for other traffic only
  as long as that other traffic remains within its headroom.

## Rollout (require owner approval before production)

1. Apply `supabase/update_pepaint_viral_capacity.sql` in a separate test
   database. It is idempotent. Run SQL and unit tests below.
2. Review the client on a staging site with actual sockets. Test join,
   reconnect, strokes, clear/undo, late join, finishing a game and room
   admission. Test multiple users simultaneously, and measure server CPU,
   API latency, Realtime events/s, connections and egress.
3. Only with approval, apply the stage 1 SQL to production, then deploy the
   client. Verify the RPC is usable and the drawing appears in other tabs.
   Do not enable the restrictive policy before the new client is deployed.
4. Ensure all old PEPaint tabs are refreshed and old sockets reconnected;
   otherwise older clients can still send direct draw broadcasts. Apply
   `supabase/enforce_pepaint_draw_rpc.sql` only after that. Verify direct
   writes to draw topics fail and Guess the Picture still works.
5. A first public event should be monitored rather than promising a specific
   concurrency. Stop new starts or lower the config limits if actual
   Realtime throughput or database latency approaches the limit.

For rollback, remove the stage 2 restrictive policy first, then roll back the
frontend. Only then remove stage 1 guards if necessary. Never roll back by
granting unrestricted access to the game's private schema.

## Repeatable checks (isolated database)

```sh
npm install --prefix /tmp/pepaint-test @electric-sql/pglite@0.5.17
PEPAINT_PGLITE_MODULE=/tmp/pepaint-test/node_modules/@electric-sql/pglite/dist/index.js \
  node --test tests/pepaint-traffic.test.mjs tests/pepaint-viral-capacity-sql.test.mjs
```

These tests simulate 25, 50 and 100 memberships in real isolated PostgreSQL
logic, check slot release, access controls and the rolling drawing budget.
They do not open 100 live sockets or measure production throughput. A
multi-browser staging load test is still a release gate.

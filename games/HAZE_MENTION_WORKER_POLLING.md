# Haze mention worker — adaptive polling (for the Haze team)

**Status (22 Nov 2026):** the worker that calls `haze-mention-delivery` is not in this repository. It signs requests
with the Haze Ed25519 key (`HAZE_MENTION_WORKER_PUBLIC_KEY`), so it is run by the Haze team. PepecoinHub measured
~8,200 `take` calls a day (one every ~10.5 s, 24/7) with 0 registered phones and 0 queued alerts; 8,212 replies were
the 2-byte `[]`.

## What changed on our side (backwards compatible)

Every `take` reply now has two headers:

| Header | Meaning |
|---|---|
| `X-Haze-Poll-After: N` | seconds to wait before the next `take` (1–60) |
| `Retry-After: N` | same value, for HTTP clients that already honour it |

The body is unchanged (JSON array for `take`, `{}` for `finish`). A 503 carries `X-Haze-Poll-After: 30`.

Values: **60** when the queue is empty, **5** while alerts are in flight, **1** right after a full batch of 10, and
when only a failed alert is waiting for its retry, the seconds until that retry is due.

## What we ask the worker to do

1. **Sleep for `X-Haze-Poll-After` seconds** after each `take` (fall back to 10 s if the header is missing, so
   nothing changes against an older deploy). Never poll faster than 1 s.
2. **Keep the heartbeat.** Phone registration requires a `take` for that platform in the last **3 minutes**. A 60 s
   idle poll keeps it fresh even if two polls are lost; please do not raise the idle interval above 60 s.
3. **Burst while draining.** If a `take` returned 10 items, `finish` them and call `take` again right away (the header
   says 1).
4. **Unchanged:** sign every request (`x-haze-time` within 45 s, Ed25519 over `time.body`), body ≤ 2 KB, call
   `finish` with `sent` / `gone` / anything else for retry, keep using the lease and token from `take`. Retry
   back-off (15 s × 2^attempt, max 15 min), the 8-attempt cap and 2-minute leases stay server-side.
5. **Optional:** add ±10 % jitter to the sleep so several worker instances do not line up; on network errors back
   off to 30 s, then 60 s.

Expected effect: ~1,440 calls a day when idle instead of ~8,200 (about **−82 %**, ~43 k a month instead of ~246 k),
with alerts still delivered within ~60 s of the first mention after a quiet period and within ~1–5 s while busy.

## Optional server change (needs PepecoinHub approval before running on production)

`games/supabase/update_haze_mentions_adaptive.sql` makes the hint exact (time to the next due retry) and writes the
heartbeat row at most every 20 s instead of on every poll. Without it, the Edge Function guesses the hint from the
batch size (0 → 60 s, 1–9 → 5 s, 10 → 1 s), which is enough for the worker change above.

A further step, if the Haze team wants zero idle polling: a Database Webhook on `games.haze_mention_queue` insert
could call a signed "wake" URL on the worker. Then the worker could idle at 60 s purely for the heartbeat.

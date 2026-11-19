# push-send: PondOS notifications

Sends PondOS notifications to phones and computers that switched them on in **Start > Notifications**:
@mentions in LAN Party, Byl's `@everyone`, a new Pond Gazette issue, and challenges (Three Lilies, Pond King).

- `index.ts` is GENERATED (`python3 scripts/build_push_function.py`) from `server.ts` (the handler) and
  `webpush.mjs` (encryption RFC 8291 + VAPID RFC 8292, WebCrypto only, no npm packages). Edit those two, rebuild.
- Tests: `node --test tests/push-webpush.test.mjs tests/push-sw.test.mjs` (+ `tests/push-sql.test.mjs` with a local PostgreSQL).

## Set up (once)
1. Make keys: open `klucze.html` (project files, `powiadomienia/`) in a browser and press the button. It works offline;
   nothing leaves the browser. You get `PUSH_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and one SQL `update`.
   (Same thing on a computer: `npx web-push generate-vapid-keys`.)
2. Supabase > SQL Editor: run `games/supabase/update_push.sql`, then the `update games.push_config ...` from step 1.
3. Supabase > Edge Functions > Deploy a new function > Via editor. Name: `push-send`. Paste ALL of `index.ts`. Deploy.
4. The function's settings: **Verify JWT off** (the database rings it with `PUSH_SECRET`, not with a login).
5. Edge Functions > Secrets: add the three secrets from step 1.
6. PondOS > Start > Notifications > Turn notifications ON. Write `@YourName` from another account in LAN Party to try.

## Safety
- The PRIVATE key lives only in the function's secrets. The database and the site have only the public key.
- The browser can only save / change / delete its own device row (`gry_push_save`, `gry_push_delete`);
  only server triggers write the outbox; only the service role (this function) reads it.
- Only real push services are accepted as addresses (Google, Apple, Mozilla, Microsoft), in the database and here.
- `@everyone` can only come from Byl's account (update_lobby_everyone.sql), and goes out as a push at most once an hour.
- Notes link only to PondOS pages (sw.js rewrites anything else to /meme/).

## Answers
200 `{sent, gone, failed}` · 401 bad secret · 500 keys missing. Gone devices (404/410) are deleted; a device that
fails 20 times is deleted.

# Haze × PepecoinHub limited community beta

This packet replaces the proposed full-PH-session handoff. It is locally tested
source for Byl to review, not an already-deployed integration. PH owns issuance,
the allowed methods, moderation, revocation, data access and deployment.

## Exact changes in this packet

- `supabase/update_haze_community_v1.sql`: private, RLS-protected client/code/
  session/budget tables; hash-only credentials; service-role-only wrappers;
  explicit scoped dispatch to existing PH RPCs; code/refresh/revocation logic.
- `supabase/functions/haze-community/{index.ts,handler.mjs,contract.mjs,deno.json}`:
  a new version-1 Edge endpoint. Reuses sibling `haze-wallet/core.mjs` for pure
  proof/transaction verification. Existing haze-wallet files are unchanged.
- `../docs/games/haze-community.html` and `js/haze-community.{mjs,css}`:
  PH-origin login/consent and connection-revocation screen.
- `../tests/community-v1-postgres.test.mjs` and its fixture: portable Docker/
  PostgreSQL security/behavior checks. Existing PH migrations and actual chat
  RPC bodies run on fictional account/filter/host scaffolding.

No existing games, Passport, moderation, tip SQL or legacy Edge origin policy is
replaced. Haze uses a separate local chat UI, so PH UI changes require Haze UI
updates; backend moderation changes continue to apply through the same RPCs.

## Byl's deployment checklist — do not run on production before review

1. Apply this source patch to the reviewed PH branch. Confirm the existing
   `update_haze_tips.sql` and `update_haze_groups.sql` are already installed;
   then run **update_haze_community_v1.sql**. Re-running it preserves settings.
   New community settings and every registered client default OFF.
2. Publish the three consent-page files through the existing Pages workflow.
   In Supabase Auth URL Configuration, allow the PH return URL:

   ```text
   https://pepecoinhub.com/games/haze-community.html
   ```

   Keep the PH Site URL and Discord provider callback unchanged. **Do not add
   Haze as a full-session Supabase OAuth return destination.** The previous
   Haze-redirect instructions are superseded. If any were already added only
   for this prototype, review/remove those unused entries without disturbing
   unrelated integrations.
3. Deploy only the new Edge function from the PH repo, using `games` as the CLI
   work directory (which contains `supabase/functions`):

   ```text
   supabase functions deploy haze-community --workdir games --project-ref azbwciqfbsdpwubznncg --no-verify-jwt
   ```

   The no-verify-jwt flag is necessary because community tokens deliberately
   are not Supabase JWTs. This function authenticates every action itself: PH
   JWTs only for PH-origin consent/account management; opaque tokens for all
   Haze requests. Never disable JWT checking on unrelated functions.
4. Keep the existing Supabase URL/service-role secret solely on PH Edge.
   Reuse the reviewed `PEP_BLOCKBOOK_URL` secret for transaction verification.
   Never give Haze a service-role key, JWT signing key or full user session.
   The new endpoint's beta gate is `community_settings.beta_only` plus
   `games.haze_testers`; the legacy Edge's `HAZE_ACCESS` policy is unchanged
   and is not the new endpoint's permission mechanism.
5. Enable `pg_cron` in Supabase if it is not already available, then schedule
   the cleanup once under a PH-controlled database owner:

   ```sql
   select cron.schedule('ph-community-v1-cleanup', '*/15 * * * *',
     $$select public.community_v1_cleanup('{}'::jsonb);$$);
   ```

   If that job name already exists, inspect/update it instead of creating a
   duplicate. Tables have global credential-row ceilings and per-account
   limits; scheduled cleanup keeps expired/revoked records from accumulating.
6. Register only intended clients. Web is prefilled for
   `https://hazewallet.com/community-auth.html` / origin `https://hazewallet.com`.
   Native is prefilled for `hazewallet://community-auth`, with exact origins
   `capacitor://localhost` and `https://localhost`. Chrome is prefilled for the
   published extension ID. An unpacked beta has a different ID: before enabling
   `haze-chrome`, update that disabled row to the agreed beta build's exact
   callback/origin pair. The app uses the fixed client ID `haze-chrome`; merely
   adding another client name will not register that build. Restore the published
   ID and revoke that client's old grants when switching to the store build.
   Do not use wildcard origins/redirects. A grant is bound
   to its registered client, exact return URI, reviewed scopes and PKCE.
7. Enroll the verified Discord account UUIDs in the existing `games.haze_testers`
   table. For the first web-only test enable only:

   ```sql
   update games.community_settings set enabled=true,beta_only=true where id;
   update games.community_clients set enabled=true where id='haze-web';
   ```

   Alternatively, edit the two Discord names in
   `supabase/community-v1/enable-web-beta.sql` and run that block. It refuses
   partial activation if a name does not identify exactly one existing account.
   `supabase/community-v1/disable-beta.sql` provides the rollback below.

   Existing PH tipping/database settings must permit the intended test, but do
   not change public tipping access simply to activate this separate beta.
   Roll back this integration without changing normal PH chat/tips:

   ```sql
   update games.community_settings set enabled=false where id;
   update games.community_sessions set revoked_at=clock_timestamp()
     where revoked_at is null;
   ```
8. Haze separately publishes its reviewed beta and enables public discovery.
   Test actual Discord consent/cancel, linking, small manually approved native
   PEP tips, group receipts, both stamps, revocation, refresh and app restarts.
   Logs/APM must exclude Authorization headers, credential/code/verifier bodies
   and token response bodies. This implementation performs no credential
   logging; production proxy/platform log policy remains an operator check.

## community-v1 protocol

All application calls POST JSON to:
`https://azbwciqfbsdpwubznncg.supabase.co/functions/v1/haze-community`
with `version:1`, `Content-Type: application/json`, the PH public `apikey`, and
the browser's real Origin. No cookies or caller-supplied forwarded IP is used.
Replies use no-store and exact registered CORS origins. OPTIONS is discovery,
not authorization; requests independently validate owner/permission in SQL.

PH-only actions (full JWT stays within PH origin/project):

- `describe`: `client_id,redirect_uri`; returns label and exact scopes.
- `authorize`: `client_id,redirect_uri,code_challenge,code_challenge_method:'S256',scopes`;
  requires full PH authentication and explicit user consent on the PH page;
  returns only a short-lived community code and the registered return URI.
- `connections`: optional `revoke_id`; lists/revokes only that account's grants.

Haze actions (no full PH JWT accepted):

- `exchange`: `client_id,redirect_uri,code,code_verifier`, no bearer needed;
  code is `phcode1_` + 43 base64url characters. Returns `version:1`,
  `audience:'ph-community-v1'`, `token_type:'Bearer'`, `access_token`,
  `refresh_token`, `expires_in`, `session_expires_at`, `scope`, `user:{id}`.
- `refresh`: only the limited `refresh_token`; rotates it and the access token.
- `revoke`: limited `refresh_token`; revokes that connection, idempotently.
- `rpc`: `method,args`, plus `Authorization: Bearer phc1_...`; see mapping below.
- `verify`: `request:{action:'link',proof}` or
  `request:{action:'check'|'group-check',intent,txid}`, with the limited bearer.
  These retain the original native PEP proof/manifest/chain rules. No send or
  broadcast API exists. PH reconfirms token authorization before committing a
  link or receipt, including after asynchronous indexer reads.

Scopes and permitted RPCs:

| Scope | Methods |
| --- | --- |
| profile:read | gry_me |
| chat:read | gry_lobby_chat, gry_lobby_who |
| chat:write | gry_lobby_say |
| wallet:link | gry_haze_link_begin; link verification |
| tips:read | gry_haze_status, gry_haze_chat; direct receipt verification |
| tips:write | gry_haze_tip_begin |
| groups:read | gry_haze_groups; group receipt verification |
| groups:write | gry_haze_group_create, gry_haze_group_join, gry_haze_group_review, gry_haze_group_cancel |

Unknown methods, host/game/Passport actions, supplied owner IDs and unknown
argument fields are denied. Existing PH RPCs receive the token owner's identity;
their eligibility, mute, hidden-message, anti-spam, amount and ownership checks
remain authoritative. Network-IP checks see PH Edge egress for wrapped requests;
review capacity with real traffic. The integration never pretends a caller IP
is trusted or bypasses those existing checks. Community adds a durable 180/min
budget per verified user, at most six codes/10 minutes per account, five active
sessions per account and strict 5,000-row code/session ceilings.

Access tokens are opaque `phc1_...`; refresh tokens are opaque `phr1_...`.
Only SHA-256 hashes are stored. Access lasts at most 15 minutes; absolute session
expiry is eight hours and refresh never extends it. Scopes are frozen at consent
and may only shrink on exchange/refresh. Replaying the immediately previous
refresh credential revokes the grant; older unknown credentials are denied.
Lost rotation responses may require reconnecting. PH beta/client/account changes
take effect on each operation. Revocation while a chain lookup is in flight
prevents the final PH commit. No callback or Origin header authorizes spending.

Existing long PH airdrops keep running after a community session expires; the
host reconnects when needed. Haze narrows each wallet review to at most 30
minutes without extending PH's deadline, so PH's newer 12-hour intent retention
does not create a 12-hour wallet authorization. Do not rerun older group
migrations over PH's newer visibility/long-airdrop migrations to install this
packet; the scoped wrapper calls the functions already deployed by PH.

Changes to the agreed v1 field names/meaning require review/compatibility work;
breaking changes should use a separate version. `contract.mjs` and the database
test suite are the executable allowlist/behavior contract for this packet.

## Privacy and commercial review

Suggested user notice: PH handles your Discord login and grants Haze limited
community access. Haze can display chat and submit the actions you approve in
the consent screen. PH keeps posts, moderation, linked public addresses and
receipt records; confirmed transactions are public on-chain. Haze stores only
limited community credentials locally and public pending receipt metadata.
Wallet keys/passwords stay in the self-custody wallet and are never sent to PH.
Disconnect in Haze or revoke from this PH page. If offline, local disconnect
does not prove remote revocation; the session otherwise expires within eight
hours. Device/browser storage removal can require reconnecting.

Branding remains “Powered by PepecoinHub.” No integration fee, revenue share,
ownership transfer, resale/data license or commercial partnership is created
by this technical packet. Those terms still need agreement between operators.

## Local verification and limits

Run `node --test tests/community-v1-postgres.test.mjs` with Node 24+ and Docker.
It creates/removes only its own labeled, network-isolated temporary PostgreSQL
container. The migration is applied twice; expiry, PKCE, concurrent code replay,
scope escalation, owner spoofing, moderation, refresh rotation and both types
of revocation are checked against actual SQL. No real account or funds are used.
Haze's separate browser suite covers the complete limited-token handoff and
signed synthetic direct/group receipts, checking that no full PH credential
reaches Haze. Live Supabase OAuth/Edge ingress, production capacity, indexer
health and physical mobile/installed-extension behavior remain joint checks.

Deployment references: [function JWT configuration](https://supabase.com/docs/guides/local-development/cli/config),
[Edge deployment](https://supabase.com/docs/guides/functions/deploy),
[dependencies](https://supabase.com/docs/guides/functions/dependencies).

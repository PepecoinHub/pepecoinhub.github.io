# PepecoinHub × Haze — review build

This adds Haze wallet linking and direct native PEP message tips to PEP Games
lobby chat and PondOS LAN Party. PepecoinHub holds no deposit, Haze password,
signing key, bot wallet, withdrawal authority or internal balance. Signing and
network-fee approval remain inside Haze. Ordinary chat keeps working if tipping
is disabled or unavailable.

**Disabled review build.** `HAZE_TIPS_ENABLED` in
`docs/games/js/haze-tips.mjs` is false and `games.haze_settings.enabled` starts
false. The independent community-tip switches also stay false. This branch
is based on upstream `673183f` and is intended for code review and joint staging
validation before any activation. The complete Haze companion patch, required
public modules, baseline hashes and reproduction instructions are in
[`haze-review/2026-11-15/`](haze-review/2026-11-15/README.md).

## Local playground

`node scripts/haze-preview.mjs` starts the actual Games lobby/chat at
`http://127.0.0.1:18920/` and the Haze candidate at port 18921. It requires
Node, Docker Desktop (the `postgres:17-alpine` image), and the installed verifier
dependencies. Set `HAZE_WALLET_ROOT` to a local Haze checkout and
`HAZE_TIP_CANDIDATE` to the reviewed directory containing `wallet.js`,
`haze-bridge.js`, `widget-boot.js` and `widget.html`.

The guide creates an encrypted disposable wallet with 2500 synthetic PEP.
Password: `HazePreview!2026`. Review Haze's self-custody terms, then use
**Back to chat**, link Haze and tip Byl's sample message. Confirmations take
about 20 seconds. **Reset demo** restores the simulated balance and stamps.
On a narrow window, open **Chat** in the games navigation.

The real proof signer, transaction signer, independently implemented Edge
verifier, token-protection response validator and actual Haze SQL migration
run locally. The surrounding auth/host tables, Discord account, balances,
funding transaction, protection evidence and chain/indexer are fixtures.
Only preview responses in memory substitute the two origin constants.
Production sources and their switches are unchanged. Browser CSP prevents
connections to production services; the server never proxies a public chain.
The dedicated labelled database has no network and no published port and is
removed on shutdown. Never import or fund a personal wallet in this playground.

`tests/haze-playground-browser.cjs` drives the entire local flow with Playwright,
asserts no production requests or submission before approval, and checks a
single confirmed receipt, SQL-earned stamps and mobile chat visibility.
The public production protocol is separately covered by `haze-core.test.mjs`.

## Flow

1. Use the existing Discord login, then **Link Haze for tips**. A Haze-owned
   frame requests a public-address proof. Supabase binds a one-use, five-minute
   challenge to the user. The edge verifier checks its exact origin, purpose,
   nonce, expiry, signature and Pepecoin address checksum. A receiving address
   can belong to only one platform account. Linking creates no spend authority.
2. Choose **Tip** on another Discord fren's visible message. Pick 1/10/100/1000
   PEP or a custom 1–100000 PEP, a reaction, and an optional note. The server
   freezes the sender, destination, amount and message in an intent. It obtains
   the recipient address from the verified link, never from the tipping client.
   Muted senders cannot create chat tips.
   Only linked recipients have an enabled Tip control; others show
   **Wallet not linked**. The server validates the tip before Haze opens.
   A rejection leaves the picker and draft in place without flashing the wallet.
3. The same chat dialog shows a persistent Haze-owned frame. Its exact-origin
   `haze:tip-review` request contains only `{type,version:1,fragment}`; it opens
   a public review and grants no spend authority. Haze checks the linked sender,
   fixes the amount/destination and calculates the fee automatically. The user
   explicitly approves in Haze. A normal unlocked session can be reused; its
   existing lock policy is respected. The intent expires in 30 minutes.
4. After submission Haze shares only `{type:'haze:tip-submitted',version:1,
   intent,txid}` with the exact PepecoinHub parent (or legacy opener). Chat
   returns automatically with a private pending indicator and follows network
   checks. There is no transaction-ID input. The sender's submitted candidate
   is saved privately by the server and cached in the browser so a refresh
   resumes checking. An unverified candidate never reserves the verified txid,
   credits a receipt or earns a stamp. Nothing automatically sends again.
5. The server checks a configured read-only mainnet Blockbook source, pins the
   genesis block, checks the exact recipient script and integer amount, and
   re-reads every input's previous output to verify the linked sender. Only
   change to the sender is allowed. Two confirmations are required, within the
   two-hour post-expiry checking window. A unique transaction constraint and an
   atomic database transition permit one receipt and one First Tip award.
6. The confirmed chat card includes the reaction, note, explorer link and
   **Powered by Haze Wallet**. Its short animation respects reduced motion.
   Pending and invalid payments receive no confirmed card or stamp.

## Community tips and chat rounds

The additional review build supports **Whole pond**, **Online frens**,
**Away / offline frens**, **Random frens**, **Choose frens**, **Timed airdrop**,
**Trivia round**, and **Say the word** from the same chat dialog and Haze frame.
“Whole pond” means all eligible wallet-linked PepecoinHub accounts. Discord
server membership is not used. Muted accounts, unlinked accounts and the sender
are excluded. Online means activity in this site's lobby within 90 seconds;
away includes members with older or no lobby presence.

The server draws random recipients without replacement and freezes every
recipient address and amount. One native transaction pays 1–200 recipients,
with at least 1 PEP each, at most 100000 PEP total, and at most 20 funding
inputs. The sender must fund the network fee as well. A whole-pond audience
over 200 is rejected with a smaller-audience prompt; nobody is silently dropped.
An integer split preserves the total exactly, assigning any smallest-unit
remainder in the fixed displayed order. Change returns to the linked sender.

Timed rounds snapshot the eligible audience at creation. An away member can
come online to enter a round for which they were eligible. Airdrop entry is free
and each member joins once. Trivia replies use `/answer your answer` in normal
chat, with one attempt per member. The first correct replies win, up to the
host's limit. A word round announces the word; matching chat replies win once
per member. Case and repeated whitespace are normalized. Answers are graded
by a database trigger after normal chat validation; no browser reports winners.
The private trivia answer is salted and hashed and is absent from public feeds.
These rules do not provide protection against several accounts owned by one
person, answer sharing, or guessing a deliberately easy question.

Rounds last 10–300 seconds (the picker offers 15 seconds, 1 minute and 5 minutes)
and can finish early when the winner limit is reached. Results are sealed when
the feed or review is requested. **Closing a round never pays anyone.** The
host reviews the fixed winners, then opens Haze's fee and password approval in
the same dialog. No eligible winners means no payment. There is no entry fee,
escrow, platform balance, automatic payout, popup or transaction-ID input.

Group review requires `capabilities.chatGroupTips === 1`. The only new public
UI command is `{type:'haze:group-tip-review',version:1,request}`, from the exact
PepecoinHub parent. The manifest has exactly `id,sender,title,mode,note,
total_atomic,created_at,expires_at,recipients`; each recipient has exactly
`address,amount,nick`. Haze validates and fixes these values and still requires
the user's explicit approval. The callback remains exactly
`{type:'haze:tip-submitted',version:1,intent,txid}` to PepecoinHub. The Edge
action `group-check` accepts only an intent ID and hash; it obtains the complete
manifest privately. It verifies all exact outputs, one optional sender change,
every funding prevout, mainnet identity, and two confirmations. A shared private
transaction ledger prevents reusing a payment across single and group intents.
Only a verified transaction earns the receipt and existing First Tip stamp.

Apply `supabase/update_haze_groups.sql` **after** `update_haze_tips.sql` in a
reviewed staging project. Community tipping has its own independent switches:
`HAZE_GROUPS_ENABLED=false` and `games.haze_settings.groups_enabled=false`.
The existing direct-tip switches must also be on to use the shared wallet UI.
All switches remain off in committed production files. Games chat is not
rewritten; the new server trigger exits immediately while groups are disabled.
The feature is web-only in this package; mobile browsers use the same dialog.

For the isolated community preview, set `HAZE_PREVIEW_GROUPS=1` and
`HAZE_PREVIEW_BASE_PORT=18940` before starting `scripts/haze-preview.mjs`.
The Haze origin is the next port (18941). Point `HAZE_TIP_CANDIDATE` to the
reviewed group candidate containing the additional `wallet-core.js` and
`assets/haze-group-tips.js`. The **Demo member** selector switches synthetic
members for joining and chat answers. Only Lew's disposable wallet is funded;
participant links are fixtures. Changes to actors, origins, feature flags and
presence fixtures are local preview behavior and are not production auth.

`tests/haze-groups-browser.cjs` checks every audience and game through the actual
UI, including multi-output signatures, wrong-password rejection, no automatic
payout, cache-cleared recovery, two confirmations and narrow screens.
`tests/haze-groups-sql.test.mjs` checks actual PostgreSQL permissions, frozen
eligibility, one attempt, exact splits, deadline closure and global credit-once.
`tests/haze-groups-core.test.mjs` always checks the independent verifier; with
the separate Haze checkout it also tests the actual signer at the 200-recipient
limit and the Haze public manifest/callback. CI runs the portable and SQL tests.

## Coordinated activation

Keep both switches off until maintainer review and staging validation.

The client requires `capabilities.chatTipProtocol === 1` and
`capabilities.chatTipInline === 1`. `transactions:false` remains unchanged:
the UI request cannot sign, approve or broadcast. `haze:tip-cancel` accepts only
`{type,version:1}` from the exact parent and cancels outstanding review work.
Unknown fields and other origins/sources are ignored. An already submitted
intent in the same Haze frame re-announces its existing submission rather than
opening another payment.

1. **Haze maintainer:** review/release the accompanying Haze patch, including
   `wallet.js`, `haze-auth-protocol.js`, `haze-bridge.js`,
   `haze-bridge-config.js`, `assets/haze-chat-tips.js`, and the tip HTML/JS/CSS.
   It permits only `https://pepecoinhub.com`, with a separate linking purpose.
   TokenPrinter's signed message bytes remain unchanged. The receipt origin is
   hardcoded; a link cannot replace it. Native/extension releases and universal
   app links are not included.
2. **PepecoinHub maintainer:** run `games/supabase/update_haze_tips.sql` in a
   staging project first. It depends on existing games, lobby/moderation and
   Passport tables. It is repeatable and keeps tipping off. Browser roles have
   no write access to its tables. Only the edge service role can finish proofs
   or confirm payments. Ordinary game/chat RPCs are not rewritten.
3. Deploy `games/supabase/functions/haze-wallet`. With an authenticated Supabase
   CLI, run from the repository's `games` directory:

   ```sh
   supabase functions deploy haze-wallet --project-ref YOUR_PROJECT --no-verify-jwt
   supabase secrets set PEP_BLOCKBOOK_URL=https://YOUR_REVIEWED_PEP_BLOCKBOOK/ --project-ref YOUR_PROJECT
   ```

   The function **verifies authentication itself** with Supabase's
   `/auth/v1/user`, then requires a Discord identity before privileged calls.
   Disabling the gateway JWT check supports different JWT signing-key formats;
   it does not make this function anonymous. Only PepecoinHub-origin POSTs with
   a bearer session, bounded JSON and the documented actions are accepted.
   Supabase supplies the server-only `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY`. Never put service-role keys, node RPC credentials,
   a bot token, signing key or Haze password into GitHub Pages or config.js.

   The indexer accepts only an HTTPS origin without credentials, query or
   redirect. The client cannot select a URL. Its genesis must be:
   `37981c0c48b8d48965376c8a42ece9a0838daadb93ff975cb091f57f8c2a5faa`.
4. Review both chat layouts. Their CSPs permit the exact Haze frame origin.
   Enable `games.haze_settings.enabled` in the intended project and change
   `HAZE_TIPS_ENABLED` to true in a reviewed frontend release. Validate with
   disposable accounts, then a separately authorized small live payment before
   inviting ordinary users. Turning both switches off stops this integration;
   it cannot reverse a payment already sent on the network.

## Badges and Flippy

`haze_linked` is awarded after ownership verification and removed on unlink.
`haze_first_tip` is awarded only on server confirmation. They are cosmetic
Passport records. Their planned catalog entries remain hidden until earned,
as supported by the existing Passport renderer. No browser API accepts badge
IDs or grants these awards.

The existing `flip-verify` / `flip_has_badge` path can support a separately
reviewed Flipsuite quest. This package does not change its allowed badges,
configure quests or payouts, invite a Discord bot, or access a Flippy wallet.
There are no role tips, rain, batch payments or custodial balances here.

## Limits and trust

- Receipts are read in batches of at most 120 visible messages and 200 receipts.
  The existing lobby doorbell is reused: no extra websocket. Normal receipt
  reads occur at most once a minute, plus confirmed-tip events. Senders check
  at most six times automatically at 20-second intervals; hidden pages pause.
- Challenges have a 30-second creation interval and five proof attempts.
  Intents have a ten-second creation interval, 20/hour account limit,
  15-second check interval and 200/day account checking limit. Guests cannot
  link or create tips. These do not replace Supabase quota/abuse monitoring.
- Public cards show names, amount, reaction, note and transaction link for
  visible messages from the last 24 hours. Addresses and intent records remain
  in private database tables; the sender necessarily learns the recipient's
  public address. Linking Discord to public-chain activity has privacy costs,
  explicitly described in the linking UI. No private-key data is stored.
- Fragments avoid putting payment details in ordinary HTTP request paths;
  browser history, scripts, extensions and people with the link can see them.
- The verifier trusts the operator-configured indexer. Genesis pinning catches
  a wrong network, not a malicious indexer. Two confirmations are not irreversible
  finality. Old cosmetic stamps are not continuously revalidated after reorgs
  and must not automatically unlock monetary rewards.
- A compromised platform frontend/backend could replace receiving details or
  phish a user. Haze displays the full receiving address for review; the sender
  must verify it. Keeping keys in Haze does not remove those trust assumptions.
- No live Supabase schema/account, hosted Haze release, bot wallet or real
  payment was changed or used. This implementation is not an independent
  security audit. Live funded settlement and production deployment remain to
  be validated by the maintainers.

## Tests

```sh
npm ci --prefix games/supabase/functions/haze-wallet --ignore-scripts
node --test tests/haze-core.test.mjs tests/discord-link.test.mjs tests/passport-awards.test.mjs tests/csp.test.mjs
python scripts/add_csp.py --check
deno check --config games/supabase/functions/haze-wallet/deno.json games/supabase/functions/haze-wallet/index.ts
```

Set `HAZE_SQL_DOCKER` to a disposable `haze-ph-qa-*` PostgreSQL container and run
`node --test tests/haze-sql.test.mjs` for real permission, replay, moderation,
unique-credit and badge tests. It creates/drops only its own database. CI
starts an isolated PostgreSQL 17 container. The public proof fixture was
generated by Haze's actual signer; it contains no private key or password.

`tests/haze-client-browser.cjs` uses the actual chat module with simulated
services and a clearly labelled simulated payment window. It checks exact
intent binding, spoofed-source rejection, pending status, one confirmed card,
row replacement and widths 320/390/1100. `PLAYWRIGHT_MODULE` and `HAZE_CHROMIUM`
can select local tooling. The accompanying Haze browser test checks actual
vault unlock, fixed intent terms, wrong-wallet blocking and no automatic
broadcasts with an unfunded disposable wallet. Deno imports and npm dependencies
are pinned; the protocol copy must match the released Haze message bytes.

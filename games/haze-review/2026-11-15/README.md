# Haze companion review package

This is the complete **direct and community tipping** Haze patch used by the
local PepecoinHub preview. It is a review artifact, outside the GitHub Pages
`docs` directory. Nothing here deploys Haze, enables tipping or grants spend
authority. The native signer changes are included for Haze maintainer review.

- `haze-wallet-tipping.patch` changes the wallet UI, native PEP group signer,
  bridge capabilities, widget boot and widget styles, and adds the group
  manifest/callback module.
- `files/` contains the seven required authentication/bridge configuration,
  direct-tip, public payment-recovery and standalone tip page modules. They have production origin
  restrictions; loopback substitution exists only in the local preview server.
- `manifest.json` records normalized SHA-256 hashes for all five original
  runtime files and every resulting file. Normalize CRLF to LF when comparing.
- `preview-mobile.png` shows the actual local chat UI at 390px. All balances,
  accounts and transactions in that preview are synthetic.

## Reproduce the review

Obtain the **matching reviewed Haze web 1.1.8 baseline or complete 1.1.9 runtime** from the Haze maintainer.
An older or different Git checkout may not match these files. Do not force the
patch onto a mismatched wallet. The script recognizes the complete updated
runtime and copies it into the separate review candidate without applying the
patch again. A coordinated Haze release remains an activation requirement.
This package does not include unrelated Haze runtime
dependencies or native/extension builds.

From this PepecoinHub checkout:

```sh
node scripts/prepare-haze-review.mjs /path/to/matching-haze-runtime
npm ci --prefix games/supabase/functions/haze-wallet --ignore-scripts
export HAZE_WALLET_ROOT=/path/to/matching-haze-runtime
export HAZE_TIP_CANDIDATE="$HAZE_WALLET_ROOT/outputs/pepecoinhub-pr-review"
export HAZE_PREVIEW_GROUPS=1
export HAZE_PREVIEW_BASE_PORT=18940
node scripts/haze-preview.mjs
```

The preparation script checks hashes before writing and creates a separate
candidate. It never overwrites the runtime source files or an existing output
directory. Docker Desktop with `postgres:17-alpine` is required for the preview.
Open `http://127.0.0.1:18940/`, prepare the disposable wallet, review the
self-custody terms and link as Lew. The test password is `HazePreview!2026`.
Use **Demo member** for free round entries/chat answers, then return to Lew to
review winners and approve once in Haze. Do not fund or import a personal wallet.

With these environment variables, `node --test tests/haze-groups-core.test.mjs`
also runs the actual native signer and public manifest/callback tests, including
a 200-recipient transaction. `tests/haze-groups-browser.cjs` runs the complete
browser flow when Playwright and Chrome are available (`PLAYWRIGHT_MODULE` and
`HAZE_CHROMIUM` select local installations).

## Review findings and release limits

Haze web 1.1.9 was published on November 15, 2026 US Eastern
(`2026-11-16T01:30:52Z`). All 13 live files match this companion's hashes.
Live read-only browser checks passed the capabilities, exact-parent origin,
production CSP and two-tab recovery tests. The PEP protection service returned
200; its unchanged wallet guard rejected a synthetic nonexistent output.
PepecoinHub flags remain off and funded joint testing remains pending.

The local browser run completed four signed payouts: whole-community,
airdrop, trivia and say-the-word. It also checked online/offline/random/selected
audiences, wrong password/sender, unsupported capabilities, no-winner closure,
cancellation, refresh recovery, automatic confirmation and 320/390/1440px
layouts. The actual PostgreSQL migrations were applied twice and tested for
permissions, frozen recipients/eligibility, one entry/attempt, exact splits and
single/group transaction replay protection. Unverified hashes earn no credit.

The 1.1.9 companion also persists a public payment identity and signed
transaction hash before attempting broadcast, using one atomic IndexedDB
transaction that serializes writes across tabs.
Closing a dialog or reloading can recover that original hash without signing
or broadcasting again. No private key, password, signature or raw transaction
is stored in this journal. Corrupt/unavailable storage or a failed commit
stops a new tip before broadcast. Recovery entries expire after three hours;
an uncertain network result requires checking the original transaction.
Confirmed groups do not resume verification. The embed uses `?haze-chat=1`,
which was checked with production CSP; standalone wallet framing stays blocked.

Auth, surrounding host tables, funding UTXOs, protection evidence and network
confirmations were fixtures. This is not funded mainnet validation or an
independent security audit. Production indexer/protection availability, real
Discord auth, quotas and joint staging review remain release requirements.
All PepecoinHub client and database switches stay off. See
[the integration notes](../../HAZE_TIPPING.md) for protocol and activation details.

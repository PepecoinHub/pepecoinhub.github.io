# Haze × PepecoinHub — technical answers, November 15, 2026

Received from the Haze team in reply to `games/HAZE_QUESTIONS.md` (sections A and B).
Kept verbatim for reference. Sections C (next features) and D (branding/support) are
still unanswered.

KEEP BOTH HUB SWITCHES OFF. Production is partially ready: authentication and
the tip assets are live, but the current web 1.1.8 wallet lacks the reviewed
tip-send hooks. The PEP token/inscription protection reader also currently
returns HTTP 503, launch_indexer_unavailable. Neither blocker should be bypassed.

## A. Haze release

A1. A repair candidate has been prepared against the current 1.1.8 UI and tested
locally. It is not deployed. No release date is committed while the protection
reader and joint live test remain outstanding. Lew should confirm the human
coordinator and test window through the existing Byl/Lew conversation; this
technical work does not assign another contact or promise a deadline.

A2. I tested a read-only handshake from a PepecoinHub-origin browser page against
the real https://hazewallet.com/widget.html. It returns authentication:
'haze-auth-v1', network:'pepecoin-mainnet', transactions:false, combinedUnlock:
true, consentOnly:true and sessionRenewal:true. The live origin allowlist and
protocol recognize https://pepecoinhub.com and exactly 'Link Haze Wallet to
PepecoinHub'. A signed link using your actual backend nonce remains a joint-test
step. Authentication support alone does not establish working payment support.

A3. The live protocol file matches the copy in the supplied review package.
Both authMessage functions also produce identical UTF-8 bytes for the same
challenge/address. Source SHA-256:
da97bc216d2eb191278b81abe8998ba5ef3e3b53c13e6d9c4dd44faf61edaaf7
See protocol-v1-vector.json for the complete public fixture and message hash.
Separators are LF, with no trailing newline. This verifies the supplied copy,
not an unpublished branch modification. Recommended release policy: freeze v1;
future breaking changes use a new version, compatibility tests and advance
coordination before deployment. The maintainers should agree to that policy.

A4. Fragment fields remain exactly: haze-tip, asset, address, amount, recipient,
platform, note, reaction, intent, sender, expires. Unknown fields/duplicates are
rejected. Bound Hub intents require native PEP, sender, UUID intent and ISO UTC
expiry with milliseconds. The sole opener notification is:
{type:'haze:tip-submitted',version:1,intent,txid}
Its target is hardcoded https://pepecoinhub.com. It can follow an uncertain
broadcast attempt too: it is never payment confirmation. Continue checking the
event origin, exact popup source, intent and chain. A lost callback needs the
manual transaction-ID path, never an automatic replacement payment.

A5. The repaired candidate blocks a mismatched sender before opening Send,
fixes amount/destination, checks expiry during review/signing and immediately
before broadcast, and requires normal Haze approval. A broadcast started before
expiry can confirm later. Production's incomplete flow is not certified.

A6. This candidate covers WEB ONLY. Mobile web can use it, but web/native/
extension wallets have separate storage. Store versions and general UI updates
do not establish tip support. Older builds can ignore a fragment; no reliable
tip-specific legacy error existed. Do not infer tipping from auth-v1 alone.

The repair adds chatTipProtocol:1 to capabilities ONLY when the updated wallet
advertises its support marker. Missing/0 means unsupported. Authentication stays
v1 and transactions:false. It also adds CHAT_TIP_PROTOCOL=1 and a versioned
bootstrap guard. Include widget-boot.js AND widget.html in this coordinated
release, in addition to the original package's files. A new bootstrap with an
old runtime displays this tested error:
'Could not start HazeWallet: This Haze build does not support chat tips yet.
Open the updated Haze web wallet and start a new tip on PepecoinHub.'
That is candidate behavior, not a guarantee about old installed builds. Hub
should check the advertised tip version and stop rather than silently fall back.

A7. No public Haze staging origin was established. Isolated localhost QA exists.
Provision explicit staging origins/allowlists, or use a controlled mainnet test
after the repaired release and protection service are healthy. This v1 pins
mainnet, not testnet. The minimum Hub tip is 1 PEP plus fee; a funded test needs
separate authorization.

## B. Network and verification

B1. Haze uses its local pepecoind as primary when configured. Its configured
Blockbook v2 fallback is https://bongendpoint.realmasterkush.com. A public,
unauthenticated GET /api/v2/block/0 returned HTTP 200 and mainnet genesis:
37981c0c48b8d48965376c8a42ece9a0838daadb93ff975cb091f57f8c2a5faa
This is a successful probe, not an uptime/quota commitment or unrestricted-use
approval. No reviewed SLA, rate limit or actual Supabase egress test is available
here. Use an operator-approved endpoint or your own read-only Blockbook v2,
validate its prevout schema, and test from Edge. Server calls need no browser
CORS permission, but WAF/IP restrictions can apply. Keep node RPC credentials
private. Blockbook availability does not establish protection-reader health.

B2. Native PEP tips have one recipient output and optional change back to the
exact fromAddress: at most two outputs. No OP_RETURN, fresh change address,
third-party fee output or token operation is added. Dust change can join the
miner fee, leaving one output. Other inscription/token operations are separate.

B3. The signer checks every previous output's script against the linked
fromAddress. Multiple UTXOs from that same address are allowed; another address
is rejected. Your verifier caps inputs at 20, while an ordinary Haze send could
select more. The repair rejects a bound Hub tip needing >20 inputs BEFORE
approval. That rejection passed with 21 synthetic funding transactions in an
isolated browser fixture. Keep signer and verifier limits coordinated.

B4. The current fee quote was 1002 base units/byte, from local pepecoind's
6-block estimate. A conservative 226-byte, one-input/two-output example is
0.00226452 PEP. More inputs/absorbed dust increase it; the exact Haze review wins.
Never promise a fixed fee. Pepecoin targets one-minute blocks, so 'a few minutes'
is an estimate, not a two-confirmation guarantee.

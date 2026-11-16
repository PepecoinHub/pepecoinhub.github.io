# Questions for the Haze Wallet team

PepecoinHub, 2026-11-15. Context: we reviewed the Haze × PepecoinHub tipping package
(direct native PEP tips in our chat, wallet linking, two Passport stamps). Our side is
ready in a branch with both switches off. Before we turn anything on we need answers to
the questions below.

## A. Release of the Haze side (blocking)

1. Will you release the Haze part of the package (`haze-wallet-tipping.patch`: `wallet.js`,
   `haze-auth-protocol.js`, `haze-bridge.js`, `haze-bridge-config.js`,
   `assets/haze-chat-tips.js`, `assets/tip.html/.js/.css`)? If yes, when, and who on your
   side is our contact for a joint test?
2. Will `https://hazewallet.com/widget.html` answer `capabilities` with
   `authentication: 'haze-auth-v1'` and accept `authenticate` for the audience
   `https://pepecoinhub.com` with the purpose "Link Haze Wallet to PepecoinHub"?
3. Can you confirm that the message Haze signs for linking is byte-for-byte the one in our
   `games/supabase/functions/haze-wallet/protocol.mjs` (`authMessage`)? Any difference
   makes every link fail. Will you tell us before you ever change it?
4. Will `assets/tip.html` keep exactly these URL fragment parameters: `haze-tip`, `asset`,
   `address`, `amount`, `recipient`, `platform`, `note`, `reaction`, `intent`, `sender`,
   `expires`? And after broadcasting, will it send only
   `{type:'haze:tip-submitted', version:1, intent, txid}` to `https://pepecoinhub.com`?
5. Does the tip page refuse to pay when the unlocked wallet is not the `sender` address,
   and refuse after `expires`? Does it ever broadcast without the user pressing approve?
6. Which Haze versions are covered: web only, or also the browser extension and the mobile
   apps? What happens for a user whose Haze build does not support tips yet (error text
   we should expect)?
7. Is there a staging Haze origin we can point a test build at, or do we test against
   production `hazewallet.com` with tiny amounts?

## B. Network and verification

8. Which Blockbook (or other indexer) for Pepecoin mainnet do you use or recommend? Can we
   use it from a Supabase Edge Function (rate limits, uptime, API key)? We will not ship
   until we have a reviewed indexer.
9. Does Haze ever send a tip with more than two outputs (recipient + change back to the
   sender)? Our verifier rejects any other output, including OP_RETURN and change to a
   different address of the same wallet. Does Haze use a fresh change address?
10. Does Haze spend only from the linked address, or can a wallet mix UTXOs from several of
    its addresses in one payment? (We reject inputs that do not come from the linked
    address.)
11. Typical fee and confirmation time for a small tip, so we can word the "waiting for two
    confirmations" message correctly.

## C. Features we want next

12. **Group payment / airdrop**: could the tip page accept one payment to many recipients
    (e.g. "100 PEP split between everyone who joined in 5 minutes")? We would send a list
    of up to N `{address, amount}` pairs bound to one intent and verify one transaction with
    many outputs. What N is practical, and how would you show it for review?
13. **Other surfaces**: we want the same tip flow from PepeGochi rooms and the PEPaint game
    chat. Nothing changes for Haze except `platform`/context text. Is a `context` or
    `source` parameter useful for your UI, or should we keep everything in `note`?
14. **`/tip nick amount` in our chat**: it opens the same tip page, prefilled. Any wording or
    limits you want us to show before the window opens?
15. Can the mobile app open the tip page from a link (universal links / `pepecoin:` scheme)
    so phone users do not need a popup window?

## D. Branding and support

16. Are "Powered by Haze Wallet" and the ◇ mark on our cards fine? Do you want a logo
    file, link or different text?
17. Where should our users go when a tip is stuck (support link or Discord channel)?
18. Any fee, revenue share or agreement you expect for this integration? (The package has
    no Haze surcharge.)

# Pond Wars beta field test

The beta entry is in PondOS Start > Games only. It is not placed on the desktop, Finder or the Games folder. The original game files remain available independently.

## Changes

- Fixed-step simulation with interpolation for rendered frogs and projectiles, without changing simulation coordinates.
- Keyboard aiming updates every physics step instead of depending on operating-system key repeat. Enter charges/releases a shot; Space still jumps and a quick second Space backflips.
- Fused grenades sweep their path in one-pixel increments, reflect off the last clear surface, and cannot skip thin walls.
- Visual effects advance with actual elapsed time and freeze while paused.
- Compact 4-column arsenal with accessible weapon names; desktop controls are small overlays. Touch controls retain 44px targets.
- Warm layered cartoon terrain, with distinct violet rock on Croak Canyon.

## Touch controls (2026-11-05, player feedback from iPhone)

- Tapping or dragging on the battlefield only aims. It never fires. The FIRE button charges while held and fires on release, and the button fills up with the charge. One thumb can hold FIRE while another finger keeps aiming.
- Teleport and candles: tap the spot, then press TELEPORT HERE / DROP CANDLES.
- A held finger no longer selects text or opens the iOS copy/paste bubble (`user-select`/`-webkit-touch-callout` off outside the name fields, `touchstart` cancelled on the battlefield and the hold buttons). A long press no longer opens the arsenal or the Android context menu.
- ↑ reacts on touch-down, so the double tap for a backflip is reliable. Bigger touch targets, safe-area padding for the iPhone notch, a short "TAP TO AIM · HOLD FIRE TO SHOOT" hint at the start of each turn. The arsenal button shows the weapon in hand.
- The power meter is larger: 14 beads (was 10 small dots) with empty outlines showing the full length, a percentage above the frog, and a pulse at full power. On small screens the crosshair and meter scale up to 2× so they stay readable.

## Title screen, frog pop, knockback

- Title screen before the menu: picture `img/pondwars/title.jpg` with a slow zoom, white flash, logo slam with screen shake, shine sweep, typed subtitle, embers, scanlines, blinking PRESS ANY KEY / TAP TO CONTINUE. Click (not pointerdown) dismisses it, so the tap cannot land on the menu below. Reduced motion shows it still. Without the picture a painted fireball stays behind the logo.
- A frog at 0 HP pops when it lands: weapon `frog` (crater radius 20, reach 75, max 15 HP). A neighbour 58 px away takes about 7 HP and a shove. Chain reactions are possible. The gravestone sits at the bottom of the crater.
- Hit frogs move: the blast always has at least a 25% sideways part (a hit from straight above still moves the frog), and shells hand over part of their speed (14%, capped at 80 px/s). Arrows and revolver bullets now shove too. Measured on flat ground: a direct bazooka hit moves the frog about 88 px, a grenade from above about 62 px, an arrow about 51 px.

## Online groundwork

`js/pondwars-beta-net.mjs` (no DOM, runs in Node):

- Every player action goes through `applyInput(g, {m, a})`: held keys as bits plus discrete actions (jump, face, weapon, fire, skip). Local play, the two-tab test and a future online mode use the same path.
- `NetMatch`: the team whose turn it is drives the clock and streams its inputs in batches of 6 steps (10 messages/s). The other client replays them. At each turn change the client that just played sends a full snapshot (terrain as run lengths, a few KB). The other client adopts it on a mismatch before taking control, so floating-point differences between browsers cannot pile up.
- Inputs and snapshots from the peer are validated before they touch the game.
- Two-tab test, nothing leaves the device: open `pondwars-beta.html?net=host` and `pondwars-beta.html?net=join` in two tabs of the same browser (optional `&room=name`).

Not done yet: a real network transport (a Supabase Realtime channel only needs `send` and `onmessage`; the page CSP must then allow the Supabase `wss:` origin), rooms/invites, reconnecting after a dropped connection, and a turn timeout for a peer who disappears. The peer is trusted for its own turns, so ranked play would need server-side checks.

## Reference review

[Squeak & Destroy](https://github.com/lospolosadwords-dev/squeak-and-destroy) is a complete Canvas/JavaScript game, MIT licensed. Its surface collisions, movement feedback and compact artillery interaction are relevant. Existing Pond Wars movement already drew inspiration from it.

[Worms HTML5 Clone](https://github.com/CiaranMcCann/Worms-Armageddon-HTML5-Clone) uses TypeScript/Box2D and Apache 2.0. Its projectile impulse setup and distinct forward/backward jumps were reviewed. We retain our lightweight engine; no source, sprites or sounds were copied from either repository for this beta.

## Verification and limits

34 engine tests passed, including the existing Pond Wars suite against the beta engine, thin-wall grenade collision and matching free-flight gravity. Browser checks covered starting a match, movement, jump, Enter firing, retreat and arsenal selection. Physical Android/iOS devices and high-refresh monitors were not tested. Smooth interpolation is implemented but no device-wide FPS guarantee is made.

YEET verification on 2026-11-05: PR 177 is merged and the public engine contains the airborne finish fix. Live Supabase functions still contain the old 90500ms duration bound; the SQL part has not been deployed. Apply the duration change from PR 177 to both guest and Discord submit functions to complete that release.

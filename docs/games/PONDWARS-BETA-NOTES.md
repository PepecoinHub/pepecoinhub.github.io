# Pond Wars beta field test

The beta entry is in PondOS Start > Games only. It is not placed on the desktop, Finder or the Games folder. The original game files remain available independently.

## Changes

- Fixed-step simulation with interpolation for rendered frogs and projectiles, without changing simulation coordinates.
- Keyboard aiming updates every physics step instead of depending on operating-system key repeat. Enter charges/releases a shot; Space still jumps and a quick second Space backflips.
- Fused grenades sweep their path in one-pixel increments, reflect off the last clear surface, and cannot skip thin walls.
- Visual effects advance with actual elapsed time and freeze while paused.
- Compact 4-column arsenal with accessible weapon names; desktop controls are small overlays. Touch controls retain 44px targets.
- Warm layered cartoon terrain, with distinct violet rock on Croak Canyon.

## Reference review

[Squeak & Destroy](https://github.com/lospolosadwords-dev/squeak-and-destroy) is a complete Canvas/JavaScript game, MIT licensed. Its surface collisions, movement feedback and compact artillery interaction are relevant. Existing Pond Wars movement already drew inspiration from it.

[Worms HTML5 Clone](https://github.com/CiaranMcCann/Worms-Armageddon-HTML5-Clone) uses TypeScript/Box2D and Apache 2.0. Its projectile impulse setup and distinct forward/backward jumps were reviewed. We retain our lightweight engine; no source, sprites or sounds were copied from either repository for this beta.

## Verification and limits

34 engine tests passed, including the existing Pond Wars suite against the beta engine, thin-wall grenade collision and matching free-flight gravity. Browser checks covered starting a match, movement, jump, Enter firing, retreat and arsenal selection. Physical Android/iOS devices and high-refresh monitors were not tested. Smooth interpolation is implemented but no device-wide FPS guarantee is made.

YEET verification on 2026-11-05: PR 177 is merged and the public engine contains the airborne finish fix. Live Supabase functions still contain the old 90500ms duration bound; the SQL part has not been deployed. Apply the duration change from PR 177 to both guest and Discord submit functions to complete that release.

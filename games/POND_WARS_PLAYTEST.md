# POND WARS: Special Foot Edition

Turn-based, local frog artillery in the visual style of a 2000-era game. Choose a character separately for every frog: seven user-supplied Pepe designs plus the existing Traveler. Five source cutouts are preserved with image compression; Farmer and Blue Briefs were prepared as a transparent two-cell sheet using the built-in image generator, with the brief: preserve the supplied faces, clothing and poses, remove the background and ground shadow, no text or extra objects. Final assets live in `docs/games/img/pondwars/players/`; frame bounds are declared in `pondwars-players.mjs`. Open `docs/games/pondwars.html` directly or launch it as a window from the PondOS Start menu or Games folder.

## Setup

- Rename either team and assign different colors from blue, red, green, yellow, purple and orange.
- Choose CPU (easy, normal or hard) or two people sharing one device.
- Choose 2–4 frogs **per team** according to the map: Pond Island and Split Decision support four, Croak Canyon three, Last Lily two. Preview a map, reroll its terrain or roll a random map.
- Each frog starts with 100 HP. Water eliminates a frog instantly; falls can deal up to 40 damage. Explosions deal less damage farther from the center and can hurt either team.

## Turns and controls

- A turn gives 30 seconds to aim and 160 movement units. Walking costs one unit per pixel, jumping 60, a quick second Space for a backward flip another 25.
- After the final shot there are three seconds to escape with a separate 90-unit movement budget. The projectile and fuse continue during this time. The first revolver shot returns to aiming for its second shot without refreshing the original turn timer.
- On a laptop: A/D or left/right arrows walk; W/S or up/down arrows aim; Space jumps; a second Space within 300 ms backflips; hold and release left click to fire. Right click opens the arsenal, Escape closes it, and keys 1–9 select weapons. On a phone, use the visible Arsenal, movement, hop and fire buttons.
- Closing or minimizing the PondOS window pauses the match. Sound is off by default.

## Weapons

| Weapon | Max damage | Team stock | Detail |
| --- | ---: | ---: | --- |
| Bazooka | 42 | Unlimited | Wind affects the rocket |
| Baseball bat | 32 | Unlimited | Close range and knockback |
| Frag grenade | 46 | Unlimited | Three-second fuse |
| Cluster grenade | 28 | 4 | Five fragments, up to 22 damage each |
| Revolver | 25 per shot | Unlimited | Two individually aimed shots |
| Longbow | 35 | Unlimited | Direct hit |
| Golden Foot | 68 | 1 | Five exploding toes, up to 36 damage each |
| Land mine | 50 | 3 | Arms after one second, persists between turns |
| Dynamite | 70 | 2 | Five-second fuse |

CPU players evaluate bazooka, grenade, cluster, golden foot, bow and revolver trajectories, with bat and dynamite considered at close range. They move toward distant targets when terrain permits and retreat after the final shot. Mines remain a player-selectable weapon. Easy/Normal/Hard vary aim error and search resolution. There is no account, saved score or payout for this game.

## Verification and review

Run `node --test tests/pondwars.test.mjs` and `python scripts/check_site.py`. All 20 tests pass. Additional release regressions cover impact hits at 40/60/100/200 pixels, hand-height muzzle placement and shooter collision, side-wall landings, locked CPU revolver follow-up and safe retreat. The first revolver projectile also consumes turn time; charge strength uses elapsed input time rather than the last rendered frame. Pointer cancellation clears charging; resume clears the paused status. Real iOS and Android hardware remains to be checked.

Review images: [character setup](pondwars-release-menu.jpg) and [eight-character match](pondwars-release-game.jpg). The PR contains no database migration or deployment step.

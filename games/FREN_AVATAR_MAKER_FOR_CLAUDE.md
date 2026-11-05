# Fren Avatar Maker — brief for Claude (PondOS 98)

**Scope:** Fren Passport only. PepeGochi is a separate future game.  
**Status:** specification + proposed artwork, NOT integrated or deployed.  
**Update 2026-11-05:** implemented on branch \`claude/fren-avatar-maker\` (stacked on PR #184): Avatar Maker window, Passport portrait, draft migration \`games/supabase/update_fren_avatar.sql\`, SQL and browser tests. The migration has not been run on Supabase and nothing is merged or deployed.  
**Base:** [draft Passport PR #184](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/184) on branch \`codex/fren-passport-foundation\`.  
**Human visual reference:** actual PepecoinHub screenshots in the project conversation. Follow the existing site, not standalone mockup desktop art.

## Nonnegotiable requirements

- Add **Create Your Fren / Avatar Maker** to existing PondOS using its native \`openApp(...)\`, window manager, taskbar and login flow.
- The **customized avatar represents the player**, not their future PepeGochi pet.
- Player can choose **mouth, eyes/glasses, hat, outfit**; show live stacked pixel-art preview; \`Randomize\`, \`Save Look\` and \`Use in Passport\` buttons.
- First **successful SERVER-SAVED avatar** earns achievement \`first_avatar\`, title **Fresh Fren**, description \`Create and save your first custom Fren avatar.\`; never grant it on browser clicks or on localStorage. Repeated saves do not reaward.
- Existing \`first_fren\` for Discord registration is a separate welcome achievement. \`Fresh Fren\` is the first *active* accomplishment.
- The \`first_avatar\` catalog entry is already included in this PR with \`status: planned\`, and its icon is \`docs/meme/avatar-assets/first-avatar-badge.svg\`. Change the catalog to \`live\` **only when the server award logic and UI are tested**.
- All parts of the creator must be **free**. No NFT, PEP spending, XP, levels, rarity odds, artificial streaks or premium inventory.
- Keep the actual dark mountain-lake wallpaper, existing icons, green title bars and graphite panels. Do not replace or recreate PondOS 98.
- UI copy in concise American English. No emojis required. Respects keyboard, touchscreen, reduced motion, light/dark theme and screen readers.

## Source of visual truth

Read \`docs/meme/meme.js\`, \`docs/meme/meme.css\`, \`docs/meme/passport.css\`; do not build a separate operating system in HTML. Relevant existing CSS dark-theme variables:

- \`--chrome: #3c403c\`, \`--chrome-hi: #6a706a\`, \`--chrome-lo: #1c1e1c\`, \`--chrome-face: #4a4f4a\`
- \`--pane: #17211a\`, \`--title: #1f7a40\`, \`--title-2: #4fb36d\`
- \`--f-chrome: "MS Sans Serif", "Microsoft Sans Serif", Tahoma, Verdana, ...\`

Use CSS variables instead of a new palette. Native gray 3D bevel buttons, narrow borders, square corners, 1998–2002 vibe. Existing \`openApp\` can minimize, maximize and close windows. The avatar editor should be approximately **680–740 CSS pixels wide** on desktop, not a giant fullscreen game.

**Desktop:** preview on left, about 240px wide; right has four rows of selectable thumbnails or classic raised buttons. **Phone:** stack preview on top, choices below, ensure no horizontal scrolling and ~44px tappable controls.

Avatar artwork: **64×64 native pixel coordinate system**; nearest-neighbor display at 192×192 or 256×256. Compose from precisely aligned transparent layers, do not use a single screenshot of the designer as the avatar.

## Locked V1 art + option IDs (600 combinations)

The 22 individual art layers are **already committed** in this PR under \`docs/meme/avatar-assets/layers/\`, and the canonical option manifest is \`docs/meme/avatar-options.json\`. The downloadable \`FREN_AVATAR_CLAUDE_PACKAGE.zip\` in the ChatGPT handoff additionally contains a standalone interactive \`avatar-preview.html\`, five example PNGs, asset validation and a full design brief; it is an optional offline mirror, **NOT** a replacement PondOS window.

Layers in paint order:
1. \`bg_pond.svg\`
2. \`base_frog.svg\`
3. \`outfit_*.svg\`
4. \`mouth_*.svg\`
5. \`eyes_*.svg\`
6. \`hat_*.svg\`

All have identical \`viewBox="0 0 64 64"\`, transparent except background. Render using superposed <img> tags with \`position:absolute;inset:0;width:100%;height:100%;image-rendering:pixelated\`. No offsets, generated filters or per-user image upload.

- **Mouth (4):** \`mouth_smile\` / Classic smile, \`mouth_grin\` / Grin, \`mouth_open\` / Laugh, \`mouth_tongue\` / Tongue out.
- **Eyes/Glasses (6):** \`eyes_classic\` / Classic, \`eyes_sleepy\` / Sleepy, \`eyes_wide\` / Wide eyes, \`eyes_shades\` / Pixel shades, \`eyes_round\` / Round glasses, \`eyes_3d\` / 3D glasses.
- **Hat (5):** \`hat_none\` / None, \`hat_pep_cap\` / PEP cap, \`hat_beanie\` / Beanie, \`hat_bucket\` / Bucket hat, \`hat_crown\` / Paper crown.
- **Outfit (5):** \`outfit_blue\` / Blue shirt, \`outfit_purple_hoodie\` / Purple hoodie, \`outfit_black_hoodie\` / Black hoodie, \`outfit_white_pep\` / White PEP T-shirt, \`outfit_orange_vest\` / Orange vest.

Default: \`mouth_smile\`, \`eyes_classic\`, \`hat_none\`, \`outfit_blue\`. Eyes and glasses are one mutually exclusive layer group in v1, to prevent misaligned overlays. No skin color/body-color toggle in v1.

Option choice and Randomize update **only client-side preview**, not Supabase. \`Save Look\` sends one validated RPC. \`Use in Passport\` only claims that the portrait is saved once the server confirms success; with unsaved changes ask to Save, Discard or Cancel.

## Storage and achievement rules

Existing Supabase schema: private \`games\`; existing Passport tables \`games.passport_badges\`, \`games.passport_secrets\`, \`games.passport_items\`, and authenticated Discord lookup through \`games.discord_identity(auth.uid())\`. Reuse these; never make separate auth or allow direct client CRUD on collection tables.

**New v1 storage:** \`games.passport_avatars\`, single row per verified Discord user:

| Field | Meaning |
|---|---|
| \`user_id uuid PRIMARY KEY\` | \`auth.users(id)\`, on delete cascade |
| \`schema_version smallint\` | 1 |
| \`mouth text\` | Server-validated option ID |
| \`eyes text\` | Server-validated option ID |
| \`hat text\` | Server-validated option ID |
| \`outfit text\` | Server-validated option ID |
| \`created_at / updated_at timestamptz\` | Server timestamps |

Use an indexed owner primary key. RLS enabled; no direct client \`SELECT/INSERT/UPDATE/DELETE\` grants.

**New RPC:** \`public.gry_passport_avatar_save(p_mouth text,p_eyes text,p_hat text,p_outfit text)\`, \`SECURITY DEFINER SET search_path=''\` with **explicit** \`auth.uid()\` + real Discord identity check, fixed server-side *exact* allowlists, one-row upsert under concurrency, server-side cooldown / accepted save budget if implemented. Grant \`EXECUTE\` only to authenticated; revoke from \`PUBLIC\` and \`anon\`. No \`user_id\` argument, no badge ID argument, no image bytes.

The first successful save inserts \`games.passport_badges(user_id,badge_id='first_avatar') ON CONFLICT DO NOTHING\` within the **same transaction**. Subsequent edits cannot mint again. Return confirmed selections, whether it was the first save, and the existing badge timestamp. It is okay for the server to return an error when saving too often; do not confuse an error with success.

**Read path:** add \`avatar:{schema_version,mouth,eyes,hat,outfit}|null\` to the existing \`public.gry_passport_state()\` JSON. This saves requests. The Passport identity block should render this avatar, or show the official site logo as fallback with \`Create your Fren avatar\` call to action.

**Rendering the badge:** ensure \`first_avatar\` comes from a real record in \`games.passport_badges\`. The catalog should map the badge ID to **Fresh Fren** in the UI and mark it earned only when the RPC returns an actual \`earned_at\`, never because the client displays a hat. Keep \`certified_fren\` reserved for future PepeGochi care days. Never grant Moon Rock from client-submitted YEET data.

**No fake profile data:** do not display invented ID \`#000854\`, levels, XP, care days or rarity. Use actual Discord nickname, member since, YEET record, achievements, secrets and item counts from the existing secure state.

## User flow

1. Open Fren Passport from Start; it loads current server profile. If no avatar, show logo plus \`Create your Fren\`.
2. If not signed in with Discord, allow preview if desired; explain \`Log on with Discord to save\` and use existing login.
3. In creator, 4 categories with 4/6/5/5 choices; show live preview; display \`Unsaved changes\`.
4. \`Randomize\` is entirely local; never hits Supabase.
5. \`Save Look\`: disable button while pending, call one save RPC, use returned confirmed options. First save awards **Fresh Fren** server-side, and show standard PondOS small success notification.
6. \`Use in Passport\`: closes creator or returns to passport; avatar portrait and achievement list refresh once if needed.
7. Revisit from a second device: same persisted option IDs and earned achievement. Failed network saves never show a false success.

## Testing and release criteria

- Asset manifest refers only to files that exist; all 22 SVGs have the same 64×64 grid, 600 combinations possible.
- No API traffic when cycling options or randomizing. One read at Passport open, one write for Save Look, no immediate redundant read after complete response.
- Test real PostgreSQL/staging RPC, not only regexes: anonymous rejects, Discord-unlinked rejects, ID injection rejects, second user isolation, duplicate / concurrent save idempotence, achievement once, error rollback, cooldown and daily limit if present.
- Device test: desktop, phone portrait; light/dark theme, keyboard and screen reader; no new wallpaper or custom operating system.
- Art must be original or separately licensed. This pack's included SVGs are newly authored technical starter assets; **do not copy private \`mlewis412/pepegachi\` art without permission**.
- Keep SQL migration separate and draft; **do not run production migration or merge without review**.
- Provide screenshots within the actual existing PondOS frame and a PR with performance, security and visual notes.

## Development handoff sequence

1. Read this brief plus actual PondOS code, Passport PR #184 and \`FREN_AVATAR_CLAUDE_PACKAGE.zip\`.
2. Start on a **separate feature branch**, not on \`main\` or an unreviewed accidental merge.
3. Use the already committed 22 sprite layers and \`avatar-options.json\`. Do not duplicate, rename or redraw them without an explicit visual review.
4. Implement UI using native PondOS \`openApp\` and existing CSS. Show working preview to user.
5. Build guarded Supabase migration, save RPC and Passport-avatar property. Keep draft until staging verification.
6. Integrate badge \`first_avatar\`, keep \`planned\` until completion, then mark \`live\` on release.
7. Submit PR and await user visual approval and test results.

**Definition of done:** user can build a distinct 64×64 pixel avatar from the supplied individual art layers, save it under Discord login, see it in their existing Passport on return visits, and earn **exactly one Fresh Fren achievement** only on first valid save. Everything feels like *their existing PepecoinHub*, not a new site.

## What is explicitly not being built

PepeGochi pet mechanics, purchases, XP, rarities, public Discord identities, an avatar social feed, premium accessories, and crypto rewards.

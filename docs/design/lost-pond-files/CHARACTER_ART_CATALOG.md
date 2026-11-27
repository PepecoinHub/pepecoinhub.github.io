# Pepe character illustrations — suggested roles & exclusivity

**Status: design proposal / documentation only, 2026-11-07. No game code or media files added.**

## Purpose
The user uploaded many existing Pepe illustrations across three conversation messages as inspiration and potential assets for Fren Passport, the Avatar Maker, The Lost Pond Files (see README in this directory), events and PepeGochi. This document records the approved **direction** and the user's explicit reservation requirement. The actual image bytes remain in the chat; they are **not** included in this GitHub commit and must not be assumed to exist in the repo.

## Non-negotiable: exclusive Bat-Pepe
- The specific illustration of **Pepe in a bat-themed costume with outstretched black wings and a bat emblem** (the third image in the first uploaded batch, upload filename apparently \`1000050121.jpg\`) is the owner's personal Discord-style avatar.
- **RESERVED FOR OWNER ONLY.** Do not offer it through the public Avatar Maker, achievements, seasonal unlocks, default avatar pools, randomizer, giveaways, a gallery that distributes original images, or as an NPC.
- Do not treat a visually similar alternative as an acceptable workaround; ask the owner before reusing or modifying it.
- If owner-only display is implemented, gate selection **server-side** on the exact linked Discord identity/auth user, configured by the owner privately; do **not** hard-code names, disclose account IDs in public JSON, or rely on a hidden CSS/UI option. Do not guess their Discord ID.
- Public GitHub Pages files can be downloaded or screenshotted even if usage inside the app is restricted. For stricter storage control, the asset needs a private, authenticated delivery route or must stay out of a public repo. This is a functional exclusivity rule, not an assertion of copyright ownership.

## Suggested taxonomy

| Type | Examples from uploaded images | How to use |
|---|---|---|
| **Special avatars / unlockable whole illustrations** | silly face, nerd with glasses, cowboy, pirate, some distinctive costumes | Full illustration replaces the composite avatar, as Explorer Pepe already does; a different background may still be allowed if the original is transparent. Real achievements may unlock them. |
| **Narrative NPCs** | wizard/fortune teller, knights, the imprisoned Pepe, historical or mysterious figures, older adventurer/pirate, messenger | Characters in Lost Pond Files, clues and dialogues in faux Windows 98 application windows. NPCs must not be treated as real selectable avatars unless explicitly approved. |
| **Seasonal appearances** | winter holiday outfits, party hat, festive knitwear, costume party/Halloween, New Year | Available during events or permanently retained after a fair one-time unlock; no pressure to log in on a single exact day. |
| **Small comedy easter eggs** | duck-inspired Pepe, playful or strange expressions | Quack.EXE / rubber duck: ten taps produce a funny local pop-up and may introduce a cosmetic Special. Never treat click count alone as bot-resistant proof of a valuable award. |
| **Personal, reserved artwork** | Bat-themed flying Pepe | Owner-only, never distributed as default, random or regular unlock. |

## Existing art integration contract

1. **Special** is a separate avatar mode: uses a complete character image. Do not chop a full-body illustration into mouth/eyes/hat/clothing layers; the normal creator uses coordinated 512×512 hand-drawn SVG layers, with shared geometry. Fully drawn characters have different poses, so must be cropped and centered deliberately on a transparent 512×512 canvas (or fit a clear contain frame with no clipping).
2. Separate the **NPC** use from **avatar** use in metadata; one illustration can have only specifically approved roles. Include image ID, suggested display name, source, status, visible region/crop, relevant unlock ID, allowed uses, ownership/permission and review status.
3. Keep unlock IDs and proof of achievement **server-authoritative** in Supabase / Passport system. Whole-character assets should not be unlockable by editing frontend JS or localStorage. Use the existing secure passport save/allowlist pattern after the main avatar PRs are stable; don't add cosmetic choices as unguarded strings.
4. No reason to create more ordinary achievement badges solely to justify the illustrations. They should serve story events, social moments, humor or seasonal celebrations.
5. Keep the late 1990s / early 2000s UI style. Illustrations can retain a rough hand-drawn MS Paint feel even if not all are pixel art.
6. Preview on desktop and mobile and check if full-body art remains readable in small chat avatar thumbnails. When it doesn't, prepare a separate head-and-shoulders crop, keeping the full image for passport/NPC screens.
7. **Rights review before publication.** Some references strongly evoke recognizable pop-culture characters or reuse photos/watermarked material. Confirm usage rights and, where needed, make original non-infringing interpretations instead of presenting third-party characters or photos as owned project art.

## Example: Quack.EXE

- Clicking a rubber duck ten times causes a retro error dialog:  
  \`QUACK.EXE has stopped responding. You've annoyed the duck. Congratulations.\`
- Treat as a gentle hidden joke. It can unlock a purely cosmetic Quack Fren if a reliable unlock system exists, but ten clicks are trivially scriptable and should not be equated with a rare/valuable proof of skill.
- If the duck/Donald-themed character is based on another brand's protected character design, do not publish the recognizable borrowed version without appropriate permission. Instead draw an original duck-themed Pepe.
- The encounter can later tie into the \`rubber_duck\` item of the Passport/PepeGochi catalog, but inventory grants require server-side verification.

## Implementation later, not now

- Step 1: make a contact sheet of all source images with owner review to assign names/roles and flag exclusive/permission concerns.
- Step 2: request the owner’s explicit approval before uploading original full-resolution files into the GitHub repo, especially the reserved Bat-themed illustration.
- Step 3: normalized asset manifest with type \`special_avatar\` / \`npc\` / \`seasonal\` / \`reserved_owner\`, release state and optional unlock reference. Include actual paths only after files exist in repository.
- Step 4: one small draft PR for front-end image previews, a separate PR for secure unlock wiring only after the passport and Avatar Maker are ready; no production DB mutations without approval.

**Explicit instruction for Claude:** The bat-themed black-winged Pepe is reserved for the owner. Never show it to regular users as a pickable avatar, award or NPC. The images in this discussion are not yet checked in to the repo; don't invent image paths or claim they're deployed.

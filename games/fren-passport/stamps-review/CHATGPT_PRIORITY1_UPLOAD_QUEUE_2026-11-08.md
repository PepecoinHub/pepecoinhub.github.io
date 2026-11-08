# Priority 1 stamp art handoff, 2026-11-08

Four new stamp artworks have been produced in ChatGPT, but **their PNG binaries are not yet attached to this PR**. This file records exactly which assets are pending transfer, to avoid confusion with previously committed stamp art.

| ID | Label | Source dimensions | Visual status | SHA-256 prefix (local PNG) |
|---|---|---|---|---|
| `first_fren` | First Fren | 1173×1341 | candidate | `6c946e5bc785a96d` |
| `first_avatar` | Fresh Fren | 1344×1536 | owner accepted illustration in chat; final QA pending | `62bb25cda308f572` |
| `sharp_eye` | Sharp Eye | 1173×1341 | candidate | `2f20ade8fc738a4c` |
| `community_fren` | Community Fren | 1173×1341 | candidate | `3ca1afc187730cfd` |

Expected destination, once the actual PNG files are available:
`games/fren-passport/source/stamps-new/<id>.png`

All four local files are PNG with a transparent exterior. Fresh Fren's approved CRT avatar-editor scene supersedes the optional v3 easel reference by owner choice; it should be assessed as a visual exception to §14. All files must pass frame/label checks and 34/52/64/78 px legibility review before sprite integration.

Do not integrate or mark production-ready from this note alone. Do not touch Lily originals, special avatars, SQL, Passport UI, or the main catalog. Keep this PR in Draft status.

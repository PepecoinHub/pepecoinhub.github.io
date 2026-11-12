# Priority 1 stamp art handoff, 2026-11-08

Four PNGs are **now uploaded to Draft PR #233** under `games/fren-passport/source/stamps-new/`. All four GitHub blob SHA-1 values were checked against the local source bytes.

| ID | Exact label | Committed PNG dimensions | Visual status |
|---|---|---:|---|
| `first_fren` | First Fren | 1173×1341 | candidate |
| `first_avatar` | Fresh Fren | 1100×1257 | **owner-approved** visually on 2026-11-08 |
| `sharp_eye` | Sharp Eye | 1100×1258 | candidate |
| `community_fren` | Community Fren | 1173×1341 | candidate |

The owner-approved Fresh Fren art is the original CRT avatar-editor composition supplied in chat, **not** the optional §14 easel scene. The exterior checkerboard is masked to alpha. For transport-size reasons Fresh Fren was downsampled from native 1344×1536 and Sharp Eye from native 1173×1341; both stay above 900 pixels wide. Original full-size copies remain in the ChatGPT handoff package. First Fren and Community Fren preserve their full 1173×1341 sources.

Manifest: `games/fren-passport/stamps-review/CHATGPT_PRIORITY1_MANIFEST_2026-11-08.json`.

**Do not merge or integrate this art from the PR alone.** Claude should perform the final visual/frame/label QA and browser size checks at 34, 52, 64 and 78 px before sprite construction. Owner approval is visual, not a production green light.

Do not touch Lily's original stamps, the special avatars, SQL, catalog or UI. Keep PR #233 Draft.

# One-off scripts — NOT migrations. Do NOT run on production without thinking.

These are **manual, one-time** SQL scripts, kept out of the migration set on
purpose. Nothing in `games/supabase/*.sql` ever `\i`-includes this folder, and
`SETUP.md` does not tell you to run these in order. They are here only so the
history of past fixes/cleanups is not lost.

**Each file here can delete data. Read it before you run it.**

| File | What it does | When it is (rarely) used |
|---|---|---|
| `cleanup_test_data.sql` | **Wipes ALL game data** (rooms, tables, matches, scores, events, profiles, host sessions) and every anonymous `auth.users` row. Keeps schema, words, badwords, host code, host_discord list. | Only to reset a **staging / test** project to a clean slate. Never on the live project. |
| `cleanup_since.sql` | Deletes only data created at/after a `__SINCE__` timestamp you fill in (an e2e-test window). | After a test run, to remove just that run's rows. Edit `__SINCE__` first. |
| `fix_profile_nick.sql` | Renames one profile's nickname (hard-coded example values). | A past, specific fix. Kept for reference; edit the names before any reuse. |

If you ever need one of these:
1. Copy it, change the placeholders, and run it against the **intended** project.
2. Double-check the Supabase project selector in the SQL editor first.
3. Prefer running inside a transaction and reviewing the trailing `select`
   counts before you `commit`.

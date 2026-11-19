-- Haze tips for EVERYONE (owner, 2026-11-19: "Zdejmij betę, otwórz tipy dla wszystkich").
-- Paste into the Supabase SQL editor and Run. Repeatable. Changes only switches: no tables, no functions, no money.
-- After it, also set the Edge Function secret HAZE_ACCESS = all  (Edge Functions -> Secrets), otherwise
-- the server still lets only the two testers link wallets and confirm tips.
-- Still required for every action: a Discord sign-in. Every tip is still confirmed on chain by the server.
update games.haze_settings set enabled = true, beta_only = false, groups_enabled = true where id;

-- Check: one row, enabled = true, beta_only = false, groups_enabled = true.
select enabled, beta_only, groups_enabled from games.haze_settings;

-- Undo (back to testers only):  update games.haze_settings set beta_only = true where id;
-- Emergency stop for everyone:   update games.haze_settings set enabled = false, groups_enabled = false where id;

-- Haze closed beta, step 3: turn the beta OFF after the test.
-- First run the SELECTs: Haze asks us to finish pending receipts before switching off. Every row below is a
-- payment that was submitted but not confirmed yet; wait until the chat shows it confirmed (or its check
-- window of 2 hours after expiry has passed) before running the UPDATE.
select id, sender_nick, recipient_nick, amount_atomic, submitted_txid, expires_at
  from games.haze_tips where submitted_txid is not null and confirmed_at is null and expires_at + interval '2 hours' > clock_timestamp();
select id, creator, mode, total_atomic, submitted_txid, expires_at
  from games.haze_groups where state = 'ready' and submitted_txid is not null and expires_at + interval '2 hours' > clock_timestamp();

-- When both lists are empty:
-- update games.haze_settings set enabled=false, groups_enabled=false where id;
-- Links, receipts and Passport stamps stay in the database; turning it on again restores them.

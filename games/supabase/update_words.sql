-- PEP Games: a few extra Draw & Guess words (fun and crypto ones). Run once in Supabase → SQL Editor (New query → paste → Run).
-- Safe to run again; it only adds words. 'lemon' was already on the list.
insert into games.words(word, category) values
  ('zord feet','fun'),
  ('kraken','fun'),
  ('donald trump','fun'),
  ('pepe','fun'),
  ('diamond hands','crypto'),
  ('paper hands','crypto'),
  ('to the moon','crypto'),
  ('rug pull','crypto'),
  ('satoshi','crypto'),
  ('bitcoin','crypto'),
  ('dogecoin','crypto'),
  ('litecoin','crypto')
on conflict (word) do update set category = excluded.category;

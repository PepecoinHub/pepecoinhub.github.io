-- PEPaint (Draw & Guess): the artist picks one of three words. Run once in Supabase → SQL Editor (New query → paste → Run).
-- Safe to run again. Needs schema.sql, update_picture_plan.sql, update_pepaint_first_wins.sql and
-- update_pepaint_volunteers.sql (all live).
--  • Every word has a difficulty: 1 easy, 2 medium, 3 hard. Existing words: easy, except Pepe/crypto/PondOS/fun phrases (medium).
--    This file adds medium and hard words (phrases and ideas) and moves some existing ones up.
--  • A turn starts with 12 seconds to pick: the artist sees one easy, one medium and one hard word.
--    Easy: normal points. Medium: points ×1.5. Hard: points ×2 (for the guesser and for the artist).
--    The drawing clock starts when the word is picked. Nobody picked in time: the easy word.
--  • While the artist picks, nobody can guess yet (gry_guess already refuses guesses before turn_started_at).
--  • gry_guess is NOT changed: the bonus for medium/hard words is added in games.end_turn, right after the first
--    correct guess (same transaction, same time left, same formula as the normal points).
alter table games.words add column if not exists difficulty smallint not null default 1;
alter table games.words drop constraint if exists words_difficulty_check;
alter table games.words add constraint words_difficulty_check check (difficulty between 1 and 3);
alter table games.secrets add column if not exists choices jsonb;
alter table games.rooms add column if not exists word_mult numeric(3,1) not null default 1;

-- existing words: Pepe / crypto / PondOS / fun phrases are medium ("hot dog", "teddy bear" and other everyday
-- compound nouns stay easy). Only words still at the default are touched, so a re-run keeps manual changes.
update games.words set difficulty = 2 where difficulty = 1 and word like '% %' and category in ('pepe', 'crypto', 'pondos', 'fun');

-- new words; an existing word in this list moves to the listed difficulty
insert into games.words(word, category, difficulty) values
  ('frog astronaut','pepe',2), ('frog chef','pepe',2), ('frog pirate','pepe',2), ('frog wedding','pepe',2),
  ('frog dentist','pepe',2), ('frog zombie','pepe',2), ('frog on vacation','pepe',2), ('frog superhero','pepe',2),
  ('frog in the rain','pepe',2), ('frog dj','pepe',2), ('mining rig','crypto',2), ('green candle','crypto',2),
  ('red candle','crypto',2), ('gas fee','crypto',2), ('block explorer','crypto',2), ('blockchain','crypto',2),
  ('night owl','fun',2), ('early bird','fun',2), ('couch potato','fun',2), ('brain freeze','fun',2),
  ('power nap','fun',2), ('road rage','fun',2), ('jet lag','fun',2), ('bad hair day','fun',2),
  ('first date','fun',2), ('group chat','fun',2), ('low battery','fun',2), ('wifi password','fun',2),
  ('stage fright','fun',2), ('selfie stick','things',2), ('treasure map','things',2), ('traffic jam','places',2),
  ('haunted house','places',2), ('magic trick','actions',2), ('sleepwalking','actions',2), ('photobomb','actions',2),
  ('blue screen','pondos',2), ('bear market','crypto',3), ('bull market','crypto',3), ('rug pull','crypto',3),
  ('diamond hands','crypto',3), ('paper hands','crypto',3), ('to the moon','crypto',3), ('buy the dip','crypto',3),
  ('pump and dump','crypto',3), ('whale alert','crypto',3), ('seed phrase','crypto',3), ('private key','crypto',3),
  ('halving','crypto',3), ('hash rate','crypto',3), ('block reward','crypto',3), ('proof of work','crypto',3),
  ('double spend','crypto',3), ('exit scam','crypto',3), ('all time high','crypto',3), ('crypto winter','crypto',3),
  ('market crash','crypto',3), ('dead cat bounce','crypto',3), ('bag holder','crypto',3), ('liquidation','crypto',3),
  ('stop loss','crypto',3), ('fomo','crypto',3), ('hodl','crypto',3), ('fud','crypto',3),
  ('wen lambo','crypto',3), ('airdrop','crypto',3), ('faucet','crypto',3), ('whitepaper','crypto',3),
  ('smart contract','crypto',3), ('merge mining','crypto',3), ('fear and greed','crypto',3), ('degen','crypto',3),
  ('hash','crypto',3), ('node','crypto',3), ('satoshi','crypto',3), ('ticker','crypto',3),
  ('feels good man','pepe',3), ('pond party','pepe',3), ('frog in disguise','pepe',3), ('frog influencer','pepe',3),
  ('time travel','fun',3), ('deja vu','fun',3), ('plot twist','fun',3), ('spoiler alert','fun',3),
  ('midlife crisis','fun',3), ('peer pressure','fun',3), ('comfort zone','fun',3), ('inside joke','fun',3),
  ('awkward silence','fun',3), ('cold feet','fun',3), ('piece of cake','fun',3), ('break the ice','fun',3),
  ('elephant in the room','fun',3), ('cloud nine','fun',3), ('under the weather','fun',3), ('hot potato','fun',3),
  ('head in the clouds','fun',3), ('black friday','fun',3), ('monday morning','fun',3), ('out of office','fun',3),
  ('dream','fun',3), ('nightmare','fun',3), ('freedom','fun',3), ('luck','fun',3),
  ('karma','fun',3), ('parallel universe','fun',3), ('lost in translation','fun',3), ('butterfly effect','fun',3),
  ('global warming','nature',3), ('gravity','nature',3), ('echo','nature',3), ('shadow','nature',3),
  ('invisible man','people',3), ('internet','things',3), ('password','things',3), ('autocorrect','things',3),
  ('captcha','things',3), ('lag','things',3), ('buffering','things',3)
on conflict (word) do update set difficulty = excluded.difficulty;

-- ---------- a turn starts with three words to pick from ----------
create or replace function games.start_turn(p_code text, p_drawer uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare r games.rooms; w record; dn text; t int; picked int[] := '{}'; ch jsonb := '[]'::jsonb; pick_s int := 12;
begin
  select * into r from games.rooms where code = p_code for update;
  for t in 1..3 loop
    w := null;
    -- one word per difficulty, not used in this game yet; then any unused word; then any word
    select id, word into w from games.words where difficulty = t and id <> all(picked)
       and id not in (select word_id from games.used_words where match_id = r.match_id) order by random() limit 1;
    if w.id is null then
      select id, word into w from games.words where id <> all(picked)
         and id not in (select word_id from games.used_words where match_id = r.match_id) order by random() limit 1;
    end if;
    if w.id is null then select id, word into w from games.words where id <> all(picked) order by random() limit 1; end if;
    if w.id is not null then
      picked := picked || w.id;
      ch := ch || jsonb_build_array(jsonb_build_object('tier', t, 'id', w.id, 'word', w.word));
    end if;
  end loop;
  -- no answer yet: guesses match nothing and the mask is empty until the artist picks (gry_pick_word)
  insert into games.secrets(room_code, answer, keys, choices) values (p_code, '', '{}', ch)
    on conflict (room_code) do update set answer = '', keys = '{}', choices = excluded.choices;
  update games.rooms set phase = 'turn', drawer_id = p_drawer, turn_id = gen_random_uuid(), turn_no = turn_no + 1,
         turn_started_at = now() + make_interval(secs => pick_s),
         turn_ends_at = now() + make_interval(secs => pick_s + turn_seconds),
         next_at = null, last_answer = null, word_mult = 1, hint_seed = floor(random() * 1000000)::int
   where code = p_code;
  select nick into dn from games.players where room_code = p_code and user_id = p_drawer;
  perform games.sys(p_code, dn || ' is picking a word…');
  perform games.notify(p_code, 'state');
end $$;

-- ---------- the artist's three words (only the artist, only while picking) ----------
create or replace function public.gry_word_choices(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; s games.secrets;
begin
  select * into r from games.rooms where code = upper(p_code);
  if not found or r.mode <> 'kalambury' or r.phase <> 'turn' or r.drawer_id is distinct from u then return null; end if;
  select * into s from games.secrets where room_code = r.code;
  if s.room_code is null or s.answer <> '' or s.choices is null then return null; end if;
  return jsonb_build_object('until', r.turn_started_at,
    'choices', (select jsonb_agg(jsonb_build_object('tier', (e->>'tier')::int, 'word', e->>'word',
                        'mult', case (e->>'tier')::int when 3 then 2 when 2 then 1.5 else 1 end) order by (e->>'tier')::int)
                from jsonb_array_elements(s.choices) e));
end $$;

-- ---------- pick: the artist picks a difficulty; after the 12 s anybody in the room can settle it (the easy word) ----------
create or replace function public.gry_pick_word(p_code text, p_tier int default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); r games.rooms; s games.secrets; c jsonb; t int; dn text; m numeric(3,1); auto boolean := false;
begin
  select * into r from games.rooms where code = upper(p_code) for update;
  if not found then raise exception 'Room not found'; end if;
  if r.mode <> 'kalambury' or r.phase <> 'turn' then return jsonb_build_object('ok', false, 'error', 'closed'); end if;
  if not exists (select 1 from games.players p where p.room_code = r.code and p.user_id = u and not p.kicked and p.left_at is null) then
    raise exception 'You are not in this room'; end if;
  select * into s from games.secrets where room_code = r.code for update;
  if s.room_code is null or s.answer <> '' or s.choices is null or jsonb_array_length(s.choices) = 0 then
    return jsonb_build_object('ok', false, 'error', 'picked'); end if;
  if u = r.drawer_id and p_tier between 1 and 3 then t := p_tier;
  elsif now() >= r.turn_started_at then t := 1; auto := true;
  else return jsonb_build_object('ok', false, 'error', 'wait'); end if;
  select e into c from jsonb_array_elements(s.choices) e where (e->>'tier')::int = t limit 1;
  if c is null then select e into c from jsonb_array_elements(s.choices) e order by (e->>'tier')::int limit 1; end if;
  t := (c->>'tier')::int;
  m := case t when 3 then 2 when 2 then 1.5 else 1 end;
  update games.secrets set answer = c->>'word', keys = array[games.norm(c->>'word')], choices = null where room_code = r.code;
  insert into games.used_words values (r.match_id, (c->>'id')::int) on conflict do nothing;
  update games.rooms set word_mult = m, turn_started_at = now(), turn_ends_at = now() + make_interval(secs => turn_seconds),
         hint_seed = floor(random() * 1000000)::int
   where code = r.code;
  select nick into dn from games.players where room_code = r.code and user_id = r.drawer_id;
  perform games.sys(r.code, case when auto then 'Time to pick is up: an easy word it is. ' || coalesce(dn, 'The artist') || ' is drawing now!'
                                 when t = 3 then coalesce(dn, 'The artist') || ' picked a HARD word: points ×2! Drawing now…'
                                 when t = 2 then coalesce(dn, 'The artist') || ' picked a medium word: points ×1.5. Drawing now…'
                                 else coalesce(dn, 'The artist') || ' picked an easy word. Drawing now…' end);
  perform games.notify(r.code, 'state');
  return jsonb_build_object('ok', true, 'tier', t, 'mult', m, 'auto', auto);
end $$;

-- ---------- end of a turn: + bonus for a medium/hard word that was guessed ----------
-- Same as update_pepaint_volunteers.sql, plus the bonus and "nobody picked a word". In PEPaint the first correct guess
-- ends the turn (gry_guess sets players.guessed_turn and calls this right away, in the same transaction), so the time
-- left is the same as for the normal points: guesser 50..100 and artist 25..50, times (word_mult - 1).
create or replace function games.end_turn(p_code text, p_reason text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare a text; r games.rooms; g uuid; rem float; b1 int; b2 int;
begin
  select * into r from games.rooms where code = p_code;
  select nullif(answer, '') into a from games.secrets where room_code = p_code;
  if r.mode = 'kalambury' and r.phase = 'turn' and coalesce(r.word_mult, 1) > 1 and a is not null then
    select p.user_id into g from games.players p where p.room_code = p_code and p.guessed_turn = r.turn_id and p.user_id is distinct from r.drawer_id limit 1;
    if g is not null then
      rem := least(r.turn_seconds, greatest(0, extract(epoch from r.turn_ends_at - now())));
      b1 := round((50 + ceil(50 * rem / greatest(1, r.turn_seconds))) * (r.word_mult - 1));
      b2 := round((25 + ceil(25 * rem / greatest(1, r.turn_seconds))) * (r.word_mult - 1));
      update games.players set score = score + b1 where room_code = p_code and user_id = g;
      update games.players set score = score + b2 where room_code = p_code and user_id = r.drawer_id;
      perform games.sys(p_code, case when r.word_mult >= 2 then 'Hard word bonus' else 'Medium word bonus' end
                                || ' (×' || case when r.word_mult = trunc(r.word_mult) then trunc(r.word_mult)::int::text else r.word_mult::text end || '): +' || b1 || ' guesser, +' || b2 || ' artist', 'correct');
    end if;
  end if;
  -- kalambury: 2,5 s odsłonięcia hasła + 4 s przerywnika „Next round”; obrazek: 5 s pełnego obrazka
  update games.rooms set phase = 'reveal', last_answer = a, volunteer_id = null, word_mult = 1,
         next_at = now() + case when mode = 'kalambury' and draw_mode = 'volunteers' then interval '10 seconds'
                                when mode = 'kalambury' then interval '6.5 seconds'
                                when games.final_turn(last_turn_no, question_total) is not null and turn_no >= games.final_turn(last_turn_no, question_total) then interval '9 seconds'
                                else interval '5 seconds' end
   where code = p_code;
  delete from games.secrets where room_code = p_code;
  perform games.sys(p_code, coalesce(p_reason || ' ', '') || case when a is null then 'No word was picked.' else 'The word was: ' || a end);
  perform games.notify(p_code, 'state');
end $$;

revoke all on function public.gry_word_choices(text), public.gry_pick_word(text, int) from public, anon;
grant execute on function public.gry_word_choices(text), public.gry_pick_word(text, int) to authenticated;

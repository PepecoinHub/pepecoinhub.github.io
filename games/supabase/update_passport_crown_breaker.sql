-- Crown Breaker: 13 defended duels before a winning challenge, one server-issued stamp,
-- and a special knight avatar saveable only by its holder.
-- Apply AFTER update_passport_awards.sql, update_pond_king.sql, and update_avatar_crown.sql.
-- Reviewable migration: do not run on production before the owner's release decision.
-- No historical backfill: only a winning duel after this migration qualifies.
begin;

create or replace function games.passport_award(u uuid, b text, at timestamptz default null)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if b is null or b not in ('pond_pioneer', 'moonwalker', 'nasa_is_hiring', 'pepe_guesser', 'sharp_eye',
      'detective_fren', 'week_scout', 'scout_fren', 'welcome_back', 'streak_14', 'like_it_here', 'first_words',
      'community_fren', 'hey_fren', 'dear_editor', 'rookie_miner', 'good_game', 'checkmate',
      'i_voted', 'yeet_adept', 'fud_buster', 'long_snake', 'secret_starter', 'treasure_hunter', 'podium', 'game_night',
      'quiz_master', 'certified_fren', 'old_frog', 'arcade_hopper', 'frogmas', 'season_champion', 'frog_of_the_week',
      'junior_editor', 'senior_editor', 'vox_populi', 'bali', 'pep_birthday', 'thanksgiving_fren', 'valentine_fren',
      'first_hatch', 'little_fren', 'grown_fren', 'good_parent', 'super_parent', 'interior_designer', 'picasso_fren',
      'pond_dominator', 'long_live_the_king', 'crown_breaker', 'lord_of_the_lilies', 'master_tactician', 'quiz_first', 'quiz_10', 'quiz_25', 'quiz_50', 'quiz_99') then
    raise exception 'Unknown passport stamp %', b;
  end if;
  if u is null or games.discord_identity(u) is null then return false; end if;
  -- Season start: in the beta only Pond Pioneer, and Pond Pioneer only in the beta.
  -- From the start on, nothing dated before it counts (no head starts from old records).
  if b = 'pond_pioneer' then
    if games.passport_open() then return false; end if;
  elsif not games.passport_open() or (at is not null and at < games.passport_start()) then
    return false;
  end if;
  insert into games.passport_badges (user_id, badge_id, earned_at)
  values (u, b, coalesce(at, clock_timestamp()))
  on conflict (user_id, badge_id) do nothing;
  return found;
end
$$;

create or replace function public.gry_pk_challenge(p_token text, p_king_id bigint, p_nick text, p_moves text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  th text := games.pk_token_hash(p_token);
  u uuid := auth.uid();
  ip text := games.client_ip_hash();
  nm jsonb;
  v_nick text;
  v_moves text := lower(coalesce(p_moves, ''));
  k games.pk_kings;
  ord text; me int := 0; them int := 0; r int; won boolean; new_id bigint;
  rounds jsonb := '[]'::jsonb;
  crown_breaker_new boolean := false;
begin
  if th is null then return jsonb_build_object('ok', false, 'error', 'token'); end if;
  if v_moves !~ '^[rps]{3}$' then return jsonb_build_object('ok', false, 'error', 'moves'); end if;
  nm := games.pond_name(u, p_nick);
  if nm ? 'error' then return jsonb_build_object('ok', false, 'error', 'nick', 'message', nm->>'message'); end if;
  v_nick := nm->>'nick';

  -- the throne row lock makes duels happen one after another
  select * into k from games.pk_kings where ended_at is null for update;
  if k.id is null or k.id is distinct from p_king_id then return jsonb_build_object('ok', false, 'error', 'changed'); end if;
  if games.pk_is(k.token_hash, k.user_id, th, u) then return jsonb_build_object('ok', false, 'error', 'self'); end if;
  -- one duel every 4 hours per player and per network
  if (games.pk_last(th, u, ip)).id is not null then
    return jsonb_build_object('ok', false, 'error', 'wait', 'next_at', (games.pk_last(th, u, ip)).created_at + games.pk_cooldown()); end if;

  -- and a ceiling for the whole pond: 300 duels an hour
  if (select count(*) from games.pk_duels where created_at > now() - interval '1 hour') >= 300 then
    return jsonb_build_object('ok', false, 'error', 'busy'); end if;

  -- the king's three moves in the order the king set them
  ord := k.moves;
  for i in 1..3 loop
    r := games.pk_beats(substr(v_moves, i, 1), substr(ord, i, 1));
    if r > 0 then me := me + 1; elsif r < 0 then them := them + 1; end if;
    rounds := rounds || jsonb_build_object('you', substr(v_moves, i, 1), 'king', substr(ord, i, 1), 'result', r);
  end loop;
  won := me > them;

  insert into games.pk_duels (king_id, token_hash, user_id, ip_hash, nick, moves, king_order, won)
  values (k.id, th, u, ip, v_nick, v_moves, ord, won);

  perform games.pk_stat_add(games.pk_player(th, u), v_nick, 1, won::int, (not won)::int, 0, 0);
  if won then
    update games.pk_kings set ended_at = now(), ended_by = v_nick where id = k.id;
    perform games.pk_stat_add(games.pk_player(k.token_hash, k.user_id), k.nick, 0, 0, 0, k.defenses, extract(epoch from now() - k.crowned_at)::bigint);
    insert into games.pk_kings (token_hash, user_id, ip_hash, nick, moves) values (th, u, ip, v_nick, v_moves) returning id into new_id;
    -- An idempotent server award in the same transaction as the crown change.
    -- Its badge unlocks special_crown_breaker through the Avatar Maker's save RPC.
    if k.defenses >= 13 and u is not null and to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is not null then
      crown_breaker_new := games.passport_award(u, 'crown_breaker');
    end if;
    perform games.bulletin_post('pk:crown:' || new_id, 'pond_king', 'king_crowned', v_nick, u, k.nick, k.user_id, null,
                                jsonb_build_object('old_reign', k.defenses));
  else
    update games.pk_kings set defenses = defenses + 1 where id = k.id;
    perform games.pk_stat_add(games.pk_player(k.token_hash, k.user_id), k.nick, 0, 0, 0, k.defenses + 1, 0);
    -- 10 duels won in a row as king: the "Long Live the King" stamp (a Passport without this stamp yet only warns)
    if k.defenses + 1 >= 10 and k.user_id is not null and to_regprocedure('games.passport_award(uuid, text, timestamp with time zone)') is not null then
      begin perform games.passport_award(k.user_id, 'long_live_the_king');
      exception when others then raise warning 'pond king: long_live_the_king: %', sqlerrm; end;
    end if;
    -- long reigns make the news
    if k.defenses + 1 in (5, 10, 25, 50, 100, 250, 500, 1000) then
      perform games.bulletin_post('pk:def:' || k.id || ':' || (k.defenses + 1), 'pond_king', 'king_defended', k.nick, k.user_id, v_nick, u, null,
                                  jsonb_build_object('defenses', k.defenses + 1));
    end if;
  end if;

  -- tidy up at most once an hour: duels older than 60 days, and old reigns outside the all-time top 50
  update games.pk_meta set cleanup_at = now() where id = 1 and (cleanup_at is null or cleanup_at < now() - interval '1 hour');
  if found then
    delete from games.pk_duels where created_at < now() - interval '60 days';
    delete from games.pk_kings x where x.ended_at < now() - interval '60 days'
      and x.id not in (select id from games.pk_kings order by defenses desc, crowned_at limit 50)
      and x.id not in (select id from games.pk_kings order by coalesce(ended_at, crowned_at) - crowned_at desc limit 50);
  end if;

  return jsonb_build_object('ok', true, 'won', won, 'score', jsonb_build_array(me, them), 'rounds', rounds,
                            'king', jsonb_build_object('nick', k.nick, 'defenses', k.defenses + case when won then 0 else 1 end),
                            'crown_breaker_new', crown_breaker_new,
                            'new_king_id', new_id);
end $$;

create or replace function public.gry_passport_avatar_save(
  p_bg text, p_clothing text, p_mouth text, p_eyes text, p_hat text, p_accessory text, p_special text default 'special_none')
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  u uuid := auth.uid();
  cooldown constant interval := interval '3 seconds';
  daily_budget constant integer := 40;
  today date := (now() at time zone 'utc')::date;
  saved games.passport_avatars%rowtype;
  first_save boolean := false;
  changed boolean := true;
  badge_new timestamptz;
  badge_at timestamptz;
begin
  if u is null or games.discord_identity(u) is null then
    raise exception 'Log on with Discord to save your Fren' using errcode = '42501';
  end if;
  -- Exact per-slot allowlists, in manifest order: every part of the manifest,
  -- the free ones first, then the reward parts (the ones with an 'unlock' key).
  if p_bg is null or p_bg not in ('bg_sky', 'bg_night', 'bg_city', 'bg_snow', 'bg_forest', 'bg_sunset')
     or p_clothing is null or p_clothing not in ('clothing_none', 'clothing_blue', 'clothing_purple_hoodie', 'clothing_black_hoodie', 'clothing_shirt_tie', 'clothing_camo', 'clothing_suit')
     or p_mouth is null or p_mouth not in ('mouth_flat', 'mouth_smile', 'mouth_open', 'mouth_tongue', 'mouth_teeth', 'mouth_smirk', 'mouth_shout', 'mouth_wide_tongue', 'mouth_laugh')
     or p_eyes is null or p_eyes not in ('eyes_classic', 'eyes_sleepy', 'eyes_angry', 'eyes_bloodshot', 'eyes_3d', 'eyes_hypno', 'eyes_side', 'eyes_happy', 'eyes_hearts')
     or p_hat is null or p_hat not in ('hat_none', 'hat_pep_cap', 'hat_beanie', 'hat_bucket', 'hat_crown', 'hat_hardhat', 'hat_detective', 'hat_explorer')
     or p_accessory is null or p_accessory not in ('accessory_none', 'accessory_shades', 'accessory_round', 'accessory_orange', 'accessory_cigarette', 'accessory_pipe', 'accessory_headphones')
     or p_special is null or p_special not in ('special_none', 'special_explorer', 'special_batman', 'special_vampire', 'special_smile', 'special_nerd', 'special_soldier', 'special_straw', 'special_knight',
                                                   'special_seeker', 'special_looking', 'special_sherlock', 'special_scribe', 'special_editor',
                                                   'special_birthday', 'special_santa', 'special_turkey',
                                                   'special_gamer', 'special_gigachad', 'special_party', 'special_cupid', 'special_juice', 'special_beanie', 'special_chill', 'special_bigfren', 'special_dolphin', 'special_retro', 'special_king', 'special_crown_breaker') then
    raise exception 'Unknown avatar option' using errcode = '22023';
  end if;
  -- Reward parts: saveable only by a player who holds the stamp that unlocks them
  -- (the manifest's 'unlock' keys; stamps are awarded by the server only).
  if exists (
    select 1 from (values ('bg_sunset', 'yeet_adept'), ('clothing_suit', 'detective_fren'), ('hat_hardhat', 'rookie_miner'),
                          ('hat_detective', 'detective_fren'), ('accessory_headphones', 'arcade_hopper'),
                          ('hat_explorer', 'scout_fren'), ('special_explorer', 'scout_fren'),
                          ('special_knight', 'good_game'),
                          ('special_batman', 'why_tho'), ('special_vampire', 'midnight_fren'), ('special_smile', 'happy_fren'),
                          ('special_nerd', 'nerd_alert'), ('special_soldier', 'born_to_fren'), ('special_straw', 'bali_dreamer'),
                          ('special_seeker', 'secret_starter'), ('special_looking', 'find_fren'), ('special_sherlock', 'address_check'),
                          ('special_scribe', 'dear_editor'), ('special_editor', 'senior_editor'), ('special_birthday', 'pep_birthday'),
                          ('special_santa', 'frogmas'), ('special_turkey', 'thanksgiving_fren'),
                          ('special_gamer', 'arcade_hopper'), ('special_gigachad', 'share_fren'), ('special_party', 'old_frog'), ('special_cupid', 'valentine_fren'), ('special_juice', 'welcome_back'), ('special_beanie', 'streak_14'), ('special_chill', 'like_it_here'), ('special_bigfren', 'certified_fren'), ('special_dolphin', 'nasa_is_hiring'), ('special_retro', 'fud_buster'), ('special_king', 'long_live_the_king'), ('special_crown_breaker', 'crown_breaker')) r(part, stamp)
     where r.part in (p_bg, p_clothing, p_hat, p_accessory, p_special)
       -- the unlock is a stamp, or (for most special avatars) a secret
       and not exists (select 1 from games.passport_badges b where b.user_id = u and b.badge_id = r.stamp)
       and not exists (select 1 from games.passport_secrets s where s.user_id = u and s.secret_id = r.stamp)
       -- a part already on the player's saved look stays allowed (a reward part never locks a saved look)
       and not exists (select 1 from games.passport_avatars a where a.user_id = u
                          and r.part in (a.bg, a.clothing, a.hat, a.accessory, a.special))) then
    raise exception 'That part is locked: earn its stamp first' using errcode = '42501';
  end if;

  -- First save. A concurrent first save of the same player waits on the
  -- primary key here, then takes the update path below.
  insert into games.passport_avatars (user_id, bg, clothing, mouth, eyes, hat, accessory, special)
  values (u, p_bg, p_clothing, p_mouth, p_eyes, p_hat, p_accessory, p_special)
  on conflict (user_id) do nothing
  returning * into saved;
  first_save := found;

  if not first_save then
    -- One save at a time per player.
    select * into saved from games.passport_avatars a where a.user_id = u for update;
    changed := (saved.bg, saved.clothing, saved.mouth, saved.eyes, saved.hat, saved.accessory, saved.special)
               is distinct from (p_bg, p_clothing, p_mouth, p_eyes, p_hat, p_accessory, p_special);
    -- Saving the same look again (a double click, a retry) is a no-op success.
    if changed then
      if saved.updated_at > now() - cooldown then
        raise exception 'Saving too fast. Wait a few seconds and try again.' using errcode = 'P0001';
      end if;
      if saved.budget_day = today and saved.budget_used >= daily_budget then
        raise exception 'Daily save limit reached. Your Fren can change again tomorrow (UTC).' using errcode = 'P0001';
      end if;
      update games.passport_avatars a
         set bg = p_bg, clothing = p_clothing, mouth = p_mouth, eyes = p_eyes, hat = p_hat, accessory = p_accessory, special = p_special,
             updated_at = now(),
             budget_used = case when a.budget_day = today then a.budget_used + 1 else 1 end,
             budget_day = today
       where a.user_id = u
      returning * into saved;
    end if;
  end if;
  -- Fresh Fren: the first save from the season start on (a look saved in the beta does not count), once per player.
  if games.passport_open() then
    insert into games.passport_badges (user_id, badge_id)
    values (u, 'first_avatar')
    on conflict (user_id, badge_id) do nothing
    returning earned_at into badge_new;
  end if;

  select b.earned_at into badge_at
    from games.passport_badges b
   where b.user_id = u and b.badge_id = 'first_avatar';

  return jsonb_build_object(
    'avatar', jsonb_build_object(
      'schema_version', saved.schema_version,
      'bg', saved.bg, 'clothing', saved.clothing,
      'mouth', saved.mouth, 'eyes', saved.eyes, 'hat', saved.hat, 'accessory', saved.accessory, 'special', saved.special),
    'updated_at', saved.updated_at,
    'first_save', first_save,
    'changed', changed,
    'badge', case when badge_at is null then null else jsonb_build_object(
      'id', 'first_avatar', 'earned_at', badge_at, 'new', badge_new is not null) end
  );
end
$$;

revoke all on function games.passport_award(uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.gry_pk_challenge(text, bigint, text, text) from public;
grant execute on function public.gry_pk_challenge(text, bigint, text, text) to anon, authenticated;
revoke all on function public.gry_passport_avatar_save(text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.gry_passport_avatar_save(text, text, text, text, text, text, text) to authenticated;

commit;

-- update_passport_awards.sql, part 4 of 4 (run after 5c): Pond Pioneer snapshot
begin;
-- ---------- one-time work on the first run ----------
do $$
declare launch timestamptz; r record;
begin
  -- Pond Pioneer: every account with Discord linked right now. Never again after this run.
  insert into games.passport_meta (k) values ('pioneer_snapshot') on conflict (k) do nothing returning at into launch;
  if launch is not null and not games.passport_open() then
    insert into games.passport_badges (user_id, badge_id, earned_at)
    select distinct i.user_id, 'pond_pioneer', launch
      from auth.identities i join auth.users au on au.id = i.user_id
     where i.provider = 'discord'
    on conflict (user_id, badge_id) do nothing;
  end if;
end $$;

-- No backfills (owner decision 2026-11-11, "version A"): everyone starts from zero at the season start,
-- so old YEET records, letters, Guesser days, arcade scores and secrets do not give stamps.
-- If an earlier draft of these files already ran (test data), clear what it stored. Runs only before the
-- season start, so running this file again later never takes anything away.
do $$ begin
  if not games.passport_open() then
    delete from games.passport_badges where badge_id <> 'pond_pioneer';
    delete from games.passport_secrets;
    delete from games.passport_items;
    delete from games.passport_days;
    delete from games.passport_chat_days;
    delete from games.passport_progress;
    delete from games.passport_yeet_5k;
    delete from games.passport_printed;
    delete from games.passport_weeks;
    delete from games.passport_seasons;
  end if;
end $$;
-- Stamps retired or re-ruled by the v3 list (2026-11-08). The Passport is not public yet, so nothing
-- anyone has seen is removed; this only matters if an earlier draft of this file already ran.
-- Junior and Senior Editor once counted letters sent; now only "Printed" marks count.
delete from games.passport_badges b
 where b.badge_id = 'miner_fren'
    or (b.badge_id in ('junior_editor', 'senior_editor', 'vox_populi')
        and (select count(*) from games.passport_printed p where p.user_id = b.user_id)
            < case b.badge_id when 'junior_editor' then 1 when 'senior_editor' then 5 else 10 end);

commit;

-- Apply after update_push.sql, update_haze_tips.sql and update_haze_groups.sql.
-- A tip push is queued only after the server has verified and confirmed payment.
-- Existing devices get this choice ON; each device can turn it off independently in Notifications.
alter table games.push_outbox drop constraint if exists push_outbox_kind_check;
alter table games.push_outbox add constraint push_outbox_kind_check
  check (kind in ('mention','everyone','gazette','challenge_new','challenge_mine','tip'));

create or replace function games.push_clean_prefs(p jsonb) returns jsonb
language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'mention',        coalesce((p ->> 'mention')::boolean, true),
    'everyone',       coalesce((p ->> 'everyone')::boolean, true),
    'gazette',        coalesce((p ->> 'gazette')::boolean, true),
    'challenge_mine', coalesce((p ->> 'challenge_mine')::boolean, true),
    'challenge_new',  coalesce((p ->> 'challenge_new')::boolean, false),
    'tip',            coalesce((p ->> 'tip')::boolean, true))
$$;
revoke all on function games.push_clean_prefs(jsonb) from public, anon, authenticated;
update games.push_subs set prefs = jsonb_set(prefs, '{tip}', 'true'::jsonb, true)
 where not (prefs ? 'tip');

create or replace function games.push_on_haze_tip() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.confirmed_at is null and new.confirmed_at is not null and new.txid is not null then
    perform games.push_enqueue('tip', new.recipient, new.sender,
      'PEP tip received', new.sender_nick || ' sent you PEP.', '/meme/#lan', 'tip-' || new.id);
  end if;
  return new;
end $$;
revoke all on function games.push_on_haze_tip() from public, anon, authenticated;
drop trigger if exists push_haze_tip_au on games.haze_tips;
create trigger push_haze_tip_au after update of confirmed_at on games.haze_tips
  for each row execute function games.push_on_haze_tip();

create or replace function games.push_on_haze_group() returns trigger
language plpgsql security definer set search_path = '' as $$
declare r record;
begin
  if old.state = 'confirmed' or new.state <> 'confirmed' or new.confirmed_at is null or new.txid is null then
    return new;
  end if;
  -- A group can have 200 recipients. Insert the other notes first, then ring
  -- the sender once per 100 notes (the Edge Function drains at most 100 per call).
  insert into games.push_outbox (kind,to_user,not_user,title,body,url,tag)
  select 'tip', x.user_id, new.owner, 'PEP tip received',
         left(new.creator || ' sent you PEP.',160), '/meme/#lan', 'tip-' || new.id
    from (select user_id, row_number() over (order by ordinal) as rn
            from games.haze_group_recipients where group_id = new.id) x
   where x.rn not in (1,101);
  for r in
    select user_id from (select user_id, row_number() over (order by ordinal) as rn
                          from games.haze_group_recipients where group_id = new.id) x
     where rn in (1,101) order by rn
  loop
    perform games.push_enqueue('tip', r.user_id, new.owner,
      'PEP tip received', new.creator || ' sent you PEP.', '/meme/#lan', 'tip-' || new.id);
  end loop;
  return new;
end $$;
revoke all on function games.push_on_haze_group() from public, anon, authenticated;
drop trigger if exists push_haze_group_au on games.haze_groups;
create trigger push_haze_group_au after update of state on games.haze_groups
  for each row execute function games.push_on_haze_group();

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const base = read('games/supabase/update_pepegochi_v1.sql');
const bridge = read('games/supabase/update_pepegochi_passport_bridge.sql');
const contract = read('games/PEPEGOCHI_API.md');

test('pet table is private, indexed by authenticated owner and RLS protected', () => {
  assert.match(base, /user_id uuid primary key references auth\.users\(id\) on delete cascade/i);
  assert.match(base, /alter table games\.pepegochi_pets enable row level security/i);
  assert.match(base, /revoke all on games\.pepegochi_pets from public, anon, authenticated/i);
  assert.match(base, /check \(actions_today between 0 and 12\)/);
});

test('the only browser actions do not accept scores, time, user IDs or inventory', () => {
  assert.match(base, /function public\.gry_pepegochi_state\(\)/i);
  assert.match(base, /function public\.gry_pepegochi_adopt\(p_name text\)/i);
  assert.match(base, /function public\.gry_pepegochi_action\(p_action text\)/i);
  assert.match(base, /p_action not in \('feed', 'clean', 'play', 'rest'\)/i);
  assert.doesNotMatch(base, /function public\.gry_pepegochi_\w+\([^)]*p_(user_id|age|stat|energy|hunger|care_days|item|badge)/i);
  assert.doesNotMatch(base, /grant (insert|update|delete) on games\.pepegochi_pets/i);
});

test('all three exposed RPCs require a Discord-linked server identity', () => {
  const funcs = [
    /function public\.gry_pepegochi_state\(\)([\s\S]*?)revoke all on function public\.gry_pepegochi_state\(\)/,
    /function public\.gry_pepegochi_adopt\(p_name text\)([\s\S]*?)revoke all on function public\.gry_pepegochi_adopt\(text\)/,
    /function public\.gry_pepegochi_action\(p_action text\)([\s\S]*?)revoke all on function public\.gry_pepegochi_action\(text\)/,
  ];
  for (const re of funcs) {
    const source = base.match(re)?.[1];
    assert.ok(source, 'missing RPC body');
    assert.match(source, /auth\.uid\(\)/);
    assert.match(source, /games\.discord_identity\(u\)/);
    assert.match(source, /security definer set search_path = ''/i);
  }
  assert.match(base, /grant execute on function public\.gry_pepegochi_action\(text\) to authenticated/);
  assert.match(base, /grant execute on function public\.gry_pepegochi_state\(\) to authenticated/);
  assert.match(base, /grant execute on function public\.gry_pepegochi_adopt\(text\) to authenticated/);
});

test('server action serialization, post-lock time, 12 writes/day and one care day', () => {
  const action = base.split('function public.gry_pepegochi_action(p_action text)')[1];
  assert.ok(action);
  const posLock = action.indexOf('for update;');
  const posTime = action.indexOf('t := clock_timestamp();');
  assert.ok(posLock >= 0 && posTime > posLock, 'server time must follow the row lock');
  assert.match(action, /today_count >= 12/);
  assert.match(action, /p\.last_care_day_utc is distinct from day_utc/);
  assert.match(action, /case when new_care_day then 1 else 0 end/);
  assert.match(action, /if new_care_day and next_care_days = 100 then/);
  assert.match(action, /perform games\.pepegochi_milestone_hook\(u, next_care_days\)/);
});

test('read-only state uses derived needs and does not write', () => {
  const source = base.split('function public.gry_pepegochi_state()')[1]?.split('revoke all on function public.gry_pepegochi_state()')[0];
  assert.ok(source);
  assert.doesNotMatch(source, /\b(insert|update|delete)\s+(into|games\.|from)\b/i);
  assert.match(source, /games\.pepegochi_snapshot\(p, t\)/);
  assert.match(base, /elapsed_hours := greatest\(0::numeric/);
  assert.match(base, /else 'tadpole' end/);
});

test('100-day award is conditional and validated against saved pet state', () => {
  assert.match(bridge, /from games\.pepegochi_pets p/);
  assert.match(bridge, /p\.care_days >= 100/);
  assert.match(bridge, /on conflict \(user_id, badge_id\) do nothing/);
  assert.match(bridge, /'certified_fren'/);
  assert.doesNotMatch(bridge, /moon_rock|moonwalker|p_client|p_score/);
  assert.match(bridge, /revoke all on function games\.pepegochi_milestone_hook\(uuid, integer\)/);
});

test('handoff explains server-owned data and migration order', () => {
  assert.match(contract, /gry_pepegochi_state/);
  assert.match(contract, /gry_pepegochi_action/);
  assert.match(contract, /getBackend/);
  assert.match(contract, /Passport bridge/);
  assert.match(contract, /No cron, realtime/i);
});

test('fractional need decay is persisted and rounded only for the UI', () => {
  for (const col of ['hunger', 'hygiene', 'mood', 'energy']) {
    assert.match(base, new RegExp(col + String.raw` numeric\\(7,4\\) not null default`));
    assert.match(base, new RegExp(String.raw`alter column ` + col + String.raw` type numeric\\(7,4\\)`));
  }
  assert.match(base, /h := greatest\(0::numeric, p\.hunger - elapsed_hours \* 20 \/ 24\)/);
  assert.match(base, /e := greatest\(0::numeric, p\.energy - elapsed_hours \* 10 \/ 24\)/);
  assert.match(base, /h := floor\(greatest\(0::numeric, p\.hunger - elapsed_hours \* 20 \/ 24\)\)::integer/);
  assert.doesNotMatch(base, /h := \(fresh #>>/);
  const energyAfter2h = 75 - 2 * 10 / 24;
  const energyAfter4h = energyAfter2h - 2 * 10 / 24;
  assert.ok(energyAfter2h > 74 && energyAfter2h < 75);
  assert.ok(energyAfter4h > 73 && energyAfter4h < 74);
  assert.equal(Math.floor(energyAfter4h), 73);
});

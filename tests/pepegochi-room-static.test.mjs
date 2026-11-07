import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../games/supabase/update_pepegochi_room_v1.sql', import.meta.url), 'utf8');
const rpcNames = [
  'gry_pepegochi_room_state',
  'gry_pepegochi_room_initialize',
  'gry_pepegochi_room_place',
  'gry_pepegochi_room_unplace'
];

// Static policy checks complement, and never replace, tests against real PostgreSQL.
test('migration is additive and explicitly depends on A1/A2', () => {
  assert.match(sql, /games\.pepegochi_owners/);
  assert.match(sql, /games\.pepegochi_lives/);
  assert.match(sql, /games\.pepegochi_eval/);
  assert.doesNotMatch(sql, /(?:drop|truncate)\s+table/gi);
  assert.doesNotMatch(sql, /update\s+games\.pepegochi_lives\s+set/gi);
});

test('private inventory, no open table grants and RLS on all tables', () => {
  for (const name of ['catalog','slots','revisions','inventory','placements']) {
    assert.match(sql,new RegExp('create table if not exists games\\.pepegochi_room_'+name));
    assert.match(sql,new RegExp('alter table games\\.pepegochi_room_'+name+' enable row level security;'));
  }
  assert.match(sql,/revoke all on games\.pepegochi_room_catalog[\s\S]+?from public, anon, authenticated;/);
  assert.doesNotMatch(sql,/grant\s+(?:select|insert|update|delete)\s+on/gi);
});

test('browser API is only 4 guarded auth-only RPCs', () => {
  for(const n of rpcNames) {
    const pattern = new RegExp(`create or replace function public\\.${n}\\(`);
    assert.match(sql,pattern);
    const block=sql.slice(sql.indexOf(`create or replace function public.${n}(`));
    assert.match(block.slice(0,450),/security definer set search_path = ''/);
    assert.match(block.slice(0,600),/auth\.uid\(\)/);
    assert.match(block.slice(0,700),/games\.discord_identity\(u\)/);
    assert.match(sql,new RegExp('revoke all on function public\\.'+n+'\\([\\s\\S]*?\\) from public, anon, authenticated;'));
    assert.match(sql,new RegExp('grant execute on function public\\.'+n+'\\([\\s\\S]*?\\) to authenticated;'));
  }
  assert.doesNotMatch(sql,/create or replace function public\.gry_pepegochi_room_grant/);
});

test('ownership is bound to account, slots are fixed, rewards are server-only', () => {
  assert.match(sql,/foreign key \(user_id, item_instance_id\)[\s\S]*?references games\.pepegochi_room_inventory\(user_id, item_instance_id\)/);
  assert.match(sql,/unique \(user_id, source_key\)/);
  assert.match(sql,/primary key \(user_id, slot_id\)/);
  assert.match(sql,/unique \(item_instance_id\)/);
  assert.match(sql,/category=any\(permitted\)/);
  assert.match(sql,/rev <> p_expected_revision/);
  assert.match(sql,/ROOM_REVISION_CONFLICT/);
  assert.match(sql,/source_key.*not accepted from the user/i);
});

test('read RPC is non-mutating; edits never delete inventory', () => {
  const readPart=sql.split('create or replace function public.gry_pepegochi_room_state()')[1].split('revoke all on function public.gry_pepegochi_room_state()')[0];
  assert.doesNotMatch(readPart,/\b(insert|update|delete)\s+(?:into|from|games)/i);
  const editPart=sql.split('create or replace function public.gry_pepegochi_room_place(')[1];
  assert.doesNotMatch(editPart,/delete from games\.pepegochi_room_inventory/);
  assert.match(editPart,/delete from games\.pepegochi_room_placements/);
  assert.match(editPart,/games\.pepegochi_room_can_edit\(u\)/);
});

test('future reward item IDs are not starter grants', () => {
  for(const id of ['floppy_disk','paper_crown','moon_rock','lost_pond_artifact']) {
    const row = sql.match(new RegExp(`\\('${id}'[^\\n]+`));
    assert.ok(row,`catalog row ${id}`);
    assert.match(row[0],/false,false,null\)/);
  }
});
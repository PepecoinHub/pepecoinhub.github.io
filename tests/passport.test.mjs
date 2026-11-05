import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const file = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const catalog = JSON.parse(file('docs/meme/passport-catalog.json'));
const sql = file('games/supabase/update_fren_passport.sql');
const pond = file('docs/meme/meme.js');

test('Fren Passport has unique and well-formed public catalog IDs', () => {
  const kinds = ['achievements', 'secrets', 'items', 'titles'];
  const entries = kinds.flatMap(key => catalog[key]);
  assert.equal(catalog.version, 1);
  assert.deepEqual(kinds.map(key => catalog[key].length), [25, 12, 8, 4]);
  const ids = entries.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of entries) {
    assert.match(item.id, /^[a-z0-9_]{3,48}$/);
    assert.ok(item.title);
    assert.ok(['live', 'planned'].includes(item.status));
  }
});

test('every live casual secret is server allowlisted and discoverable', () => {
  const live = catalog.secrets.filter(x => x.status === 'live').map(x => x.id).sort();
  const block = sql.match(/p_secret\s+not\s+in\s*\(([^)]*)\)/i);
  assert.ok(block, 'SQL casual-secret whitelist missing');
  const allowed = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]).sort();
  assert.deepEqual(live, allowed);
  for (const id of live) assert.ok(pond.includes("discoverSecret('" + id + "')"), id);
});

test('secret RPC requires Discord and cannot issue premium or gameplay rewards', () => {
  const fn = sql.split('create or replace function public.gry_passport_discover')[1];
  assert.ok(fn, 'discovery RPC absent');
  assert.match(fn, /games\.discord_identity\(u\)/);
  assert.match(fn, /on conflict\s*\(user_id, secret_id\) do nothing/);
  assert.doesNotMatch(fn, /insert into games\.passport_items/i);
  assert.doesNotMatch(fn, /insert into games\.passport_badges/i);
  assert.match(sql, /revoke all on function public\.gry_passport_discover\(text\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.gry_passport_discover\(text\) to authenticated/);
});

test('all badge and secret catalog items use distinct statuses', () => {
  const reserved = new Set(['moon_rock','certified_fren','pond_pioneer']);
  for (const item of [...catalog.achievements,...catalog.items]) {
    if (reserved.has(item.id)) assert.equal(item.status, 'planned');
  }
  assert.match(pond, /passport-catalog\.json/);
});

test('both Passport RPCs have balanced dollar-quoted SQL bodies', () => {
  const starts = [...sql.matchAll(/\bas \$\$/g)];
  const ends = [...sql.matchAll(/^\$\$;/gm)];
  assert.equal(starts.length, 2, 'expected two properly delimited RPC definitions');
  assert.equal(ends.length, 2, 'expected two closing $$ delimiters');
  assert.doesNotMatch(sql, /\bas \$\n/);
  assert.doesNotMatch(sql, /^\$;/m);
});

test('Certified Fren earned record appears once instead of a locked duplicate', () => {
  assert.match(sql, /b\.badge_id <> 'certified_fren'/);
  assert.match(sql, /where b\.user_id = u and b\.badge_id = 'certified_fren'/);
  assert.doesNotMatch(sql, /'certified_fren'[\s\S]{0,200}'earned_at', null/);
});

// ---------- Fren Avatar Maker (static checks; tests/passport-avatar-sql.test.mjs runs the SQL for real) ----------
const avatarSql = file('games/supabase/update_fren_avatar.sql');
const manifest = JSON.parse(file('docs/meme/avatar-options.json'));
const SLOTS = ['mouth', 'eyes', 'hat', 'outfit'];

test('Fresh Fren is live only together with its server award path', () => {
  const avatar = catalog.achievements.find(x => x.id === 'first_avatar');
  assert.ok(avatar, 'Fresh Fren catalog entry missing');
  assert.equal(avatar.title, 'Fresh Fren');
  assert.equal(avatar.status, 'live');
  assert.match(avatar.description, /create and save your first custom fren avatar/i);
  assert.ok(existsSync(new URL('../docs/meme/' + avatar.icon, import.meta.url)), 'badge icon');
  // the older Passport migration never awards it; the avatar migration does, only on the first save
  assert.doesNotMatch(sql, /insert into games\.passport_badges[^;]*first_avatar/i);
  const awards = [...avatarSql.matchAll(/insert into games\.passport_badges[^;]*;/gi)];
  assert.equal(awards.length, 1);
  assert.match(awards[0][0], /'first_avatar'[\s\S]*on conflict \(user_id, badge_id\) do nothing/);
  const firstBranch = avatarSql.split('first_save := found;')[1].split('select b.earned_at into badge_at')[0];
  assert.match(firstBranch.split(/\n  else\n/)[1], /insert into games\.passport_badges/, 'award sits in the first-save branch');
});

test('avatar manifest: 22 aligned 64x64 layers, 600 looks, valid defaults', () => {
  const ids = SLOTS.flatMap(k => manifest.options[k].map(o => o.id));
  assert.deepEqual(SLOTS.map(k => manifest.options[k].length), [4, 6, 5, 5]);
  assert.equal(SLOTS.reduce((n, k) => n * manifest.options[k].length, 1), 600);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(manifest.layers_order, ['bg', 'base', 'outfit', 'mouth', 'eyes', 'hat']);
  for (const k of SLOTS) {
    assert.ok(manifest.options[k].some(o => o.id === manifest.defaults[k]), 'default ' + k);
    for (const o of manifest.options[k]) { assert.match(o.id, new RegExp('^' + k + '_[a-z0-9_]+$')); assert.ok(o.label); }
  }
  const files = [manifest.paths.bg, manifest.paths.base, ...ids.map(id => manifest.paths.layer_template.replace('{id}', id))];
  assert.equal(files.length, 22);
  assert.deepEqual(readdirSync(new URL('../docs/meme/avatar-assets/layers/', import.meta.url)).filter(f => f.endsWith('.svg')).sort(),
    files.map(f => f.split('/').pop()).sort(), 'no unused or missing layer files');
  for (const f of files) {
    const svg = file('docs/meme/' + f);
    assert.match(svg, /<svg[^>]*viewBox="0 0 64 64"/, f);
    assert.match(svg, /width="64" height="64"/, f);
    assert.doesNotMatch(svg, /<script|<image|href=|on[a-z]+=/i, f + ' is plain vector art');
  }
});

test('avatar save RPC: Discord identity, exact allowlists, no user or badge argument, locked-down grants', () => {
  const fn = avatarSql.split('create or replace function public.gry_passport_avatar_save')[1].split('$$;')[0];
  assert.match(fn, /^\(\s*p_mouth text, p_eyes text, p_hat text, p_outfit text\)/);
  assert.match(fn, /security definer set search_path = ''/);
  assert.match(fn, /u uuid := auth\.uid\(\)/);
  assert.match(fn, /games\.discord_identity\(u\) is null/);
  for (const k of SLOTS) {
    const list = fn.match(new RegExp('p_' + k + ' is null or p_' + k + ' not in \\(([^)]*)\\)'));
    assert.ok(list, k + ' allowlist');
    assert.deepEqual([...list[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]), manifest.options[k].map(o => o.id), k);
  }
  assert.match(avatarSql, /revoke all on games\.passport_avatars from public, anon, authenticated/);
  assert.match(avatarSql, /alter table games\.passport_avatars enable row level security/);
  assert.match(avatarSql, /revoke all on function public\.gry_passport_avatar_save\(text, text, text, text\) from public, anon, authenticated/);
  assert.match(avatarSql, /grant execute on function public\.gry_passport_avatar_save\(text, text, text, text\) to authenticated;/);
  assert.equal([...avatarSql.matchAll(/\bas \$\$/g)].length, [...avatarSql.matchAll(/^\$\$;/gm)].length);
  // the Passport read path carries the saved look
  assert.match(avatarSql, /'avatar', look,/);
});

test('Avatar Maker client: one save RPC with four IDs, nothing kept in localStorage', () => {
  const maker = pond.split('// ---------- Create Your Fren: the Avatar Maker')[1].split('// Only cosmetic, low-stakes discoveries')[0];
  assert.ok(maker, 'Avatar Maker block missing');
  const calls = [...maker.matchAll(/rpc\('([a-z_]+)'/g)].map(x => x[1]);
  assert.deepEqual(calls, ['gry_passport_avatar_save']);
  assert.match(maker, /rpc\('gry_passport_avatar_save', \{ p_mouth: sent\.mouth, p_eyes: sent\.eyes, p_hat: sent\.hat, p_outfit: sent\.outfit \}\)/);
  assert.doesNotMatch(maker, /localStorage|sessionStorage/);
  assert.match(maker, /openApp\('avatar', 'Create Your Fren - Avatar Maker'/);
  // the balloon only follows a server answer that minted the badge
  assert.match(maker, /if \(r\.badge && r\.badge\.new\) balloon\('Fresh Fren unlocked!'/);
  assert.match(pond, /avatar-options\.json\?v=/);
});

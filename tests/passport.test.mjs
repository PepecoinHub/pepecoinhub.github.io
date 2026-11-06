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
  assert.deepEqual(kinds.map(key => catalog[key].length), [37, 12, 8, 4]);
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

// ---------- Fren Avatar Maker v2 (static checks; tests/passport-avatar-sql.test.mjs runs the SQL for real) ----------
const avatarSql = file('games/supabase/update_fren_avatar.sql');
const manifest = JSON.parse(file('docs/meme/avatar-options.json'));
// v2 saveable slots (columns), in save-RPC order. 'base' is a constant implied layer, not a slot.
const SLOTS = ['bg', 'clothing', 'mouth', 'eyes', 'hat', 'accessory'];
// Only options without an 'unlock' key are offered and saveable this stage.
const baseIds = k => manifest.options[k].filter(o => !o.unlock).map(o => o.id);

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

test('avatar manifest v2: 512 canvas layers, 15120 offered looks, valid defaults', () => {
  const ids = SLOTS.flatMap(k => manifest.options[k].map(o => o.id));
  assert.equal(manifest.schema_version, 2);
  // every catalogued option (unlock-gated ones included); the hat/accessory slots carry reserved ids
  assert.deepEqual(SLOTS.map(k => manifest.options[k].length), [5, 6, 6, 6, 9, 5]);
  // the only looks a player can actually compose and save are built from the non-unlock (base) ids
  assert.deepEqual(SLOTS.map(k => baseIds(k).length), [4, 5, 6, 6, 7, 3]);
  assert.equal(SLOTS.reduce((n, k) => n * baseIds(k).length, 1), 15120, 'offered looks');
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(manifest.layers_order, ['bg', 'base', 'clothing', 'mouth', 'eyes', 'hat', 'accessory']);
  assert.equal(manifest.defaults.base, 'base_frog');
  for (const k of SLOTS) {
    // the default must be a non-unlock option so a fresh Fren is always valid
    assert.ok(baseIds(k).includes(manifest.defaults[k]), 'default ' + k);
    for (const o of manifest.options[k]) { assert.match(o.id, new RegExp('^' + k + '_[a-z0-9_]+$')); assert.ok(o.label); }
  }
  // one 512x512 WebP per option id, plus the implied base layer; bg_none doubles as manifest.paths.bg
  const files = [...new Set([manifest.paths.base, ...ids.map(id => manifest.paths.layer_template.replace('{id}', id))])];
  assert.equal(files.length, 38, '37 option layers + base_frog');
  assert.equal(manifest.paths.bg.split('/').pop(), 'bg_none.webp');
  assert.deepEqual(readdirSync(new URL('../docs/meme/avatar-assets/layers/', import.meta.url)).sort(),
    files.map(f => f.split('/').pop()).sort(), 'no unused, stray or missing layer files');
  for (const f of files) {
    const b = readFileSync(new URL('../docs/meme/' + f, import.meta.url));
    assert.equal(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12), 'RIFFWEBP', f + ' is a WebP');
    // VP8X (layers with alpha): canvas size minus one, 24-bit LE at bytes 24..29.
    // VP8 (opaque backgrounds): 14-bit width/height at bytes 26..29. VP8L (lossless): packed at byte 21.
    const kind = b.toString('latin1', 12, 16);
    let w, h;
    if (kind === 'VP8X') { w = 1 + b.readUIntLE(24, 3); h = 1 + b.readUIntLE(27, 3); }
    else if (kind === 'VP8 ') { w = b.readUInt16LE(26) & 0x3fff; h = b.readUInt16LE(28) & 0x3fff; }
    else if (kind === 'VP8L') { const v = b.readUInt32LE(21); w = 1 + (v & 0x3fff); h = 1 + ((v >> 14) & 0x3fff); }
    assert.deepEqual([w, h], [512, 512], f + ' is 512x512');
    // only backgrounds may be opaque; every other layer must carry alpha
    if (!/\/bg_/.test(f)) assert.notEqual(kind, 'VP8 ', f + ' must be transparent outside its part');
  }
});

test('avatar save RPC v2: Discord identity, non-unlock allowlists, no user or badge argument, locked-down grants', () => {
  const fn = avatarSql.split('create or replace function public.gry_passport_avatar_save')[1].split('$$;')[0];
  assert.match(fn, /^\(\s*\n?\s*p_bg text, p_clothing text, p_mouth text, p_eyes text, p_hat text, p_accessory text\)/);
  assert.match(fn, /security definer set search_path = ''/);
  assert.match(fn, /u uuid := auth\.uid\(\)/);
  assert.match(fn, /games\.discord_identity\(u\) is null/);
  // the server allowlist equals the manifest NON-UNLOCK ids per slot, in manifest order
  for (const k of SLOTS) {
    const list = fn.match(new RegExp('p_' + k + ' is null or p_' + k + ' not in \\(([^)]*)\\)'));
    assert.ok(list, k + ' allowlist');
    assert.deepEqual([...list[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]), baseIds(k), k);
  }
  // reserved/unlock ids must NOT appear in any allowlist (they stay unsaveable this stage)
  const reserved = SLOTS.flatMap(k => manifest.options[k].filter(o => o.unlock).map(o => o.id));
  assert.ok(reserved.length >= 6, 'manifest should still carry reserved ids');
  for (const id of reserved) assert.doesNotMatch(fn, new RegExp("'" + id + "'"), id + ' is reserved and must not be allowlisted');
  const sixText = /\(text, text, text, text, text, text\)/;
  assert.match(avatarSql, /revoke all on games\.passport_avatars from public, anon, authenticated/);
  assert.match(avatarSql, /alter table games\.passport_avatars enable row level security/);
  assert.match(avatarSql, new RegExp('revoke all on function public\\.gry_passport_avatar_save' + sixText.source + ' from public, anon, authenticated'));
  assert.match(avatarSql, new RegExp('grant execute on function public\\.gry_passport_avatar_save' + sixText.source + ' to authenticated;'));
  assert.equal([...avatarSql.matchAll(/\bas \$\$/g)].length, [...avatarSql.matchAll(/^\$\$;/gm)].length);
  // the Passport read path carries the saved look
  assert.match(avatarSql, /'avatar', look,/);
});

test('Avatar Maker client: one save RPC with six v2 IDs, nothing kept in localStorage', () => {
  const maker = pond.split('// ---------- Create Your Fren: the Avatar Maker')[1].split('// Only cosmetic, low-stakes discoveries')[0];
  assert.ok(maker, 'Avatar Maker block missing');
  const calls = [...maker.matchAll(/rpc\('([a-z_]+)'/g)].map(x => x[1]);
  assert.deepEqual(calls, ['gry_passport_avatar_save']);
  assert.match(maker, /rpc\('gry_passport_avatar_save', \{ p_bg: sent\.bg, p_clothing: sent\.clothing, p_mouth: sent\.mouth, p_eyes: sent\.eyes, p_hat: sent\.hat, p_accessory: sent\.accessory \}\)/);
  assert.doesNotMatch(maker, /localStorage|sessionStorage/);
  assert.match(maker, /openApp\('avatar', 'Create Your Fren - Avatar Maker'/);
  // the balloon only follows a server answer that minted the badge
  assert.match(maker, /if \(r\.badge && r\.badge\.new\) balloon\('Fresh Fren unlocked!'/);
  assert.match(pond, /avatar-options\.json\?v=/);
});

test('Passport booklet art: four small transparent WebPs with the sizes the page layout assumes', () => {
  const dir = new URL('../docs/meme/passport-assets/', import.meta.url);
  const want = { 'page-left.webp': [360, 528], 'page-right.webp': [360, 528], 'stamps.webp': [16 * 69, 75], 'icons.webp': [12 * 48, 48] };
  assert.deepEqual(readdirSync(dir).sort(), Object.keys(want).sort(), 'no stray or missing passport art');
  let total = 0;
  for (const [f, size] of Object.entries(want)) {
    const b = readFileSync(new URL(f, dir));
    total += b.length;
    assert.equal(b.toString('latin1', 0, 4) + b.toString('latin1', 8, 12), 'RIFFWEBP', f + ' is a WebP');
    // VP8X is the extended header used for images with alpha (the photo window and sprite edges are transparent)
    assert.equal(b.toString('latin1', 12, 16), 'VP8X', f + ' carries alpha');
    assert.deepEqual([1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)], size, f + ' size');
  }
  assert.ok(total < 260 * 1024, 'passport art stays small: ' + total + ' bytes');
  // the client must use the sprite with the same cell counts
  const js = readFileSync(new URL('../docs/meme/meme.js', import.meta.url), 'utf8');
  const count = name => (js.match(new RegExp('var ' + name + ' = \\[([^\\]]*)\\]')) || [, ''])[1].split(',').filter(s => s.trim()).length;
  assert.equal(count('PP_STAMPS'), 16);
  assert.equal(count('PP_ICONS'), 12);
  assert.ok(existsSync(new URL('../games/fren-passport/source/passport-mockup.webp', import.meta.url)), 'lossless source art is kept');
});

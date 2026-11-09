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
  assert.deepEqual(kinds.map(key => catalog[key].length), [49, 20, 8, 4]);
  const ids = entries.map(x => x.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of entries) {
    assert.match(item.id, /^[a-z0-9_]{3,48}$/);
    assert.ok(item.title);
    assert.ok(['live', 'planned'].includes(item.status));
  }
});

test('every live casual secret is server allowlisted and discoverable', () => {
  // chat secrets (source: chat) are given by the server's chat trigger only, so they must NOT be claimable
  // event secrets (source: event) are given by the check-in on their day only, so they are not claimable either
  const live = catalog.secrets.filter(x => x.status === 'live' && !x.source).map(x => x.id).sort();
  const chat = catalog.secrets.filter(x => x.status === 'live' && (x.source === 'chat' || x.source === 'event')).map(x => x.id);
  const block = sql.match(/p_secret\s+not\s+in\s*\(([^)]*)\)/i);
  assert.ok(block, 'SQL casual-secret whitelist missing');
  const allowed = [...block[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]).sort();
  assert.deepEqual(live, allowed);
  for (const id of live) assert.ok(pond.includes("discoverSecret('" + id + "')"), id);
  const awards = readFileSync(new URL('../games/supabase/update_passport_awards.sql', import.meta.url), 'utf8');
  for (const id of chat) { assert.ok(!allowed.includes(id), id + ' must not be claimable'); assert.ok(awards.includes("'" + id + "'"), id + ' given by the server'); }
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
  // Certified Fren went live with its daily rule (2026-11-08); Moon Rock is still reserved
  const reserved = new Set(['moon_rock']);
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
const SLOTS = ['bg', 'clothing', 'mouth', 'eyes', 'hat', 'accessory', 'special'];
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

test('avatar manifest v2: 512 canvas layers, part thumbnails, 72900 offered looks, valid defaults', () => {
  const ids = SLOTS.flatMap(k => manifest.options[k].map(o => o.id));
  assert.equal(manifest.schema_version, 2);
  // every catalogued option (unlock-gated ones included); the hat/accessory slots carry reserved ids
  assert.deepEqual(SLOTS.map(k => manifest.options[k].length), [6, 7, 9, 9, 8, 7, 17]);
  // the only looks a player can actually compose and save are built from the non-unlock (base) ids
  assert.deepEqual(SLOTS.map(k => baseIds(k).length), [5, 6, 9, 9, 5, 6, 1]);
  assert.equal(SLOTS.reduce((n, k) => n * baseIds(k).length, 1), 72900, 'offered looks');
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(manifest.layers_order, ['bg', 'base', 'clothing', 'mouth', 'eyes', 'hat', 'accessory', 'special']);
  assert.equal(manifest.defaults.base, 'base_frog');
  for (const k of SLOTS) {
    // the default must be a non-unlock option so a fresh Fren is always valid
    assert.ok(baseIds(k).includes(manifest.defaults[k]), 'default ' + k);
    for (const o of manifest.options[k]) { assert.match(o.id, new RegExp('^' + k + '_[a-z0-9_]+$')); assert.ok(o.label); }
  }
  // one 512x512 WebP per option id, plus the implied base layer
  const noQ = f => f.split('?')[0];   // the templates carry a ?v= cache key
  const files = [...new Set([manifest.paths.base, ...ids.map(id => noQ(manifest.paths.layer_template.replace('{id}', id)))])];
  assert.equal(files.length, 64, '63 option layers + base_frog');
  // one small picture of each part for the maker rows, nothing else in the folder
  assert.deepEqual(readdirSync(new URL('../docs/meme/avatar-assets/thumbs/', import.meta.url)).sort(),
    ids.map(id => noQ(manifest.paths.thumb_template.replace('{id}', id)).split('/').pop()).sort(), 'no unused, stray or missing thumbnails');
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
  assert.match(fn, /^\(\s*\n?\s*p_bg text, p_clothing text, p_mouth text, p_eyes text, p_hat text, p_accessory text, p_special text default 'special_none'\)/);
  assert.match(avatarSql, /drop function if exists public\.gry_passport_avatar_save\(text, text, text, text, text, text\);/);
  assert.match(fn, /security definer set search_path = ''/);
  assert.match(fn, /u uuid := auth\.uid\(\)/);
  assert.match(fn, /games\.discord_identity\(u\) is null/);
  // the server allowlist equals the manifest ids per slot, in manifest order (free parts first)
  for (const k of SLOTS) {
    const list = fn.match(new RegExp('p_' + k + ' is null or p_' + k + ' not in \\(([^)]*)\\)'));
    assert.ok(list, k + ' allowlist');
    assert.deepEqual([...list[1].matchAll(/'([a-z0-9_]+)'/g)].map(x => x[1]), manifest.options[k].map(o => o.id), k);
  }
  // every reward part is checked against exactly the stamp its manifest 'unlock' key names
  const rewards = [...fn.split('from (values')[1].split('r(part, stamp)')[0].matchAll(/\('([a-z0-9_]+)', '([a-z0-9_]+)'\)/g)].map(x => x[1] + '>' + x[2]).sort();
  const wanted = SLOTS.flatMap(k => manifest.options[k].filter(o => o.unlock).map(o => o.id + '>' + o.unlock)).sort();
  assert.ok(wanted.length >= 6, 'manifest should still carry reward parts');
  assert.deepEqual(rewards, wanted);
  assert.match(fn, /raise exception 'That part is locked: earn its stamp first'/);
  const sixText = /\(text, text, text, text, text, text, text\)/;
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
  const calls = [...maker.matchAll(/(?:frenRpc|rpc)\('([a-z_]+)'/g)].map(x => x[1]);
  assert.deepEqual(calls, ['gry_passport_avatar_save']);
  assert.match(maker, /frenRpc\('gry_passport_avatar_save', \{ p_bg: sent\.bg, p_clothing: sent\.clothing, p_mouth: sent\.mouth, p_eyes: sent\.eyes, p_hat: sent\.hat, p_accessory: sent\.accessory, p_special: sent\.special \}\)/);
  assert.doesNotMatch(maker, /localStorage|sessionStorage/);
  assert.match(maker, /openApp\('avatar', 'Create Your Fren - Avatar Maker'/);
  // the balloon only follows a server answer that minted the badge
  assert.match(maker, /if \(r\.badge && r\.badge\.new\) balloon\('Fresh Fren unlocked!'/);
  assert.match(pond, /avatar-options\.json\?v=/);
});

test('Passport booklet art: four small transparent WebPs with the sizes the page layout assumes', () => {
  const dir = new URL('../docs/meme/passport-assets/', import.meta.url);
  const want = { 'page-left.webp': [360, 528], 'page-right.webp': [360, 528], 'stamps.webp': [16 * 69, 75], 'icons.webp': [12 * 48, 48],
    // Lily's stamps (15 tiles at 2x) and the New stamp notice icon, from scripts/build_lily_stamps.mjs
    'stamps-lily.webp': [15 * 138, 150], 'stamp-new.webp': [80, 80],
    // the owner-approved v3 stamps (scripts/build_v3_stamps.py)
    'stamps-v3.webp': [24 * 138, 150],
    // the Stamps tab: a seamless paper tile and the BALI ticket, both cut from page-right.webp
    'paper.webp': [320, 320], 'bali-ticket.webp': [310, 114] };
  assert.deepEqual(readdirSync(dir).sort(), Object.keys(want).sort(), 'no stray or missing passport art');
  let total = 0;
  for (const [f, size] of Object.entries(want)) {
    const b = readFileSync(new URL(f, dir));
    if (f !== 'stamps-lily.webp' && f !== 'stamps-v3.webp') total += b.length;
    // the sprites load only when the Passport opens; the v3 one holds 24 tiles now (about 9-10 KB each)
    else assert.ok(b.length < (f === 'stamps-v3.webp' ? 256 : 200) * 1024, 'stamp sprite stays small: ' + f + ' ' + b.length);
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
  assert.equal(count('PP_V3'), 24, 'PP_V3 matches the 24 tiles of stamps-v3.webp');
  const v3 = readFileSync(new URL('../scripts/build_v3_stamps.py', import.meta.url), 'utf8').match(/V3 = \[([^\]]*)\]/)[1].match(/'([a-z_0-9]+)'/g).join();
  assert.equal(v3, js.match(/var PP_V3 = \[([^\]]*)\]/)[1].match(/'([a-z_0-9]+)'/g).join(), 'same order as the build script');
  assert.equal(count('PP_ICONS'), 12);
  // the Lily sprite order in the client equals the build script order
  const lily = js.match(/var PP_LILY = \[([^\]]*)\]/)[1].match(/'([a-z0-9_]+)'/g).map(x => x.slice(1, -1));
  const built = [...readFileSync(new URL('../scripts/build_lily_stamps.mjs', import.meta.url), 'utf8').matchAll(/\['([a-z0-9_]+)', S[123],/g)].map(x => x[1]);
  assert.equal(lily.length, 15); assert.deepEqual(lily, built);
  assert.ok(existsSync(new URL('../games/fren-passport/source/passport-mockup.webp', import.meta.url)), 'lossless source art is kept');
});

test('Fren Passport and Avatar Maker stay hidden unless the browser opened ?beta=fren', () => {
  assert.match(pond, /if \(q === 'fren'\) localStorage\.setItem\('pondos-fren-beta', '1'\)/);
  assert.match(pond, /if \(FREN\) smMain\.appendChild\(passportItem\)/);
  assert.match(pond, /\]\.concat\(FREN \? \[\s*\['Fren Passport'/);
  assert.match(pond, /&& \(FREN \|\| !ad\.fren\)/);
  for (const f of ['whose_passport.mpg', 'pond_stamps.mpg', 'fren_passport.mpg', 'create_your_fren.mpg']) assert.match(pond, new RegExp("file: '" + f.replace('.', '\\.') + "', fren: true"));
  assert.match(pond, /function discoverSecret\(id\) \{\s*if \(!FREN\) return;/);
  assert.match(pond, /if \(!FREN \|\| !s \|\| !s\.discord \|\| !s\.userId\) return;/);
  // the local preview is used only in the beta, and only when the server functions are missing or there is no Discord log-on
  assert.match(pond, /function frenRpc\(name, args\) \{\s*var s = sbSession\(\);\s*if \(!FREN\) return rpc\(name, args\);/);
});

// ---------- another fren's passport (static checks; tests/passport-public-sql.test.mjs runs the SQL for real) ----------
test('public passport RPC: Discord frens only, read only, no private counters, no table access', () => {
  const pub = file('games/supabase/update_passport_public.sql');
  const fn = pub.split('create or replace function public.gry_passport_public(p_user uuid)')[1].split('\n$$;')[0];
  assert.ok(fn, 'gry_passport_public missing');
  assert.match(fn, /^\s*returns jsonb language plpgsql stable security definer set search_path = '' as \$\$/);
  assert.match(fn, /if u is null or games\.discord_identity\(u\) is null then\s*return jsonb_build_object\('signed_in', false\);/);
  assert.match(fn, /d := games\.discord_identity\(p_user\);/);
  assert.doesNotMatch(fn, /\b(insert|update|delete)\b/i, 'it writes nothing');
  // the owner's counters (Next Milestone) and the Discord account id stay private
  assert.doesNotMatch(fn, /passport_progress|passport_days|passport_chat_days|passport_yeet_5k|wp_plays|letters|lobby_chat|'progress'|d->>'id'|provider_id/);
  assert.match(pub, /revoke all on function public\.gry_passport_public\(uuid\) from public, anon, authenticated;/);
  assert.match(pub, /grant execute on function public\.gry_passport_public\(uuid\) to authenticated;/);
  assert.doesNotMatch(pub, /\bgrant\b[^;]*\bto\b[^;]*\b(anon|public)\b/i);
  assert.equal([...pub.matchAll(/\bas \$\$/g)].length, [...pub.matchAll(/^\$\$;/gm)].length);
});

test('other frens\' passports stay behind ?beta=fren and come from the server only', () => {
  // LAN Party: every name opens the fren card; its Fren Passport button exists only in the beta,
  // only for a verified fren with a real user id
  assert.match(pond, /var passOk = FREN && ver && FREN_ID\.test\(u\);/);
  assert.match(pond, /\(passOk \? '<button type="button" class="app-btn lan-c-pass">/);
  assert.match(pond, /var pb = card\.querySelector\('\.lan-c-pass'\); if \(pb\) pb\.addEventListener\('click', function \(\) \{ closeCard\(\); frenPassport\(false, \{ id: u, nick: nick \}\); \}\);/);
  assert.match(pond, /if \(mainEl && FREN\) \(function \(\) \{\s*var id = ''; try \{ id = new URLSearchParams\(location\.search\)\.get\('fren'\)/);
  // read only: the public RPC (never the local preview), no Avatar Maker, no Next Milestone for somebody else
  const of = pond.split('function passportOf(id) {')[1].split('\n  }')[0];
  assert.match(of, /rpc\('gry_passport_public', \{ p_user: id \}\)/);
  assert.doesNotMatch(of, /frenRpc|frenPreview|localStorage/);
  const win = pond.split('function frenPassport(fromCache, other) {')[1].split('// ---------- Create Your Fren')[0];
  assert.match(win, /var d = other \? A\.view : passportMine\(\)/);
  assert.match(win, /if \(d\.opts && !other\) photo\.addEventListener\('click', openMaker\); else photo\.disabled = true;/);
  assert.match(win, /if \(!other\) side\.appendChild\(mile\);/);
  assert.match(win, /if \(d\.opts && !other\) \{\s*var make/);
  assert.match(win, /if \(other\) \{\s*if \(!session \|\| !session\.discord\) \{ notice\('Log on with Discord/);
  // the PEP Games lobby links a verified name to PondOS only in the beta
  const lobby = file('docs/games/js/lobbychat.js');
  assert.match(lobby, /const FREN_BETA = \(\(\) => \{ try \{ return localStorage\.getItem\('pondos-fren-beta'\) === '1'; \}/);
  assert.match(lobby, /FREN_BETA && m\.verified && FREN_ID\.test\(m\.user_id \|\| ''\)\s*\? h\('a', \{ class: 'cn', href: '\.\.\/meme\/\?fren=' \+ m\.user_id/);
  assert.match(lobby, /: h\('b', \{ class: 'cn' \}, m\.nick\)\);/);
});

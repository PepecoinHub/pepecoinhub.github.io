// Optional PostgreSQL integration test for games/supabase/update_gazette_newsroom.sql (the Gazette Newsroom).
//   PASSPORT_PG_URL=postgres://postgres:pw@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/gazette-newsroom-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SKIP, pondDb, caller, addUser, uid } from './pond-sql-setup.mjs';

const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');

test('Newsroom: only the owner writes, everyone reads published issues and ads, drafts stay hidden',
  { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('newsroom_test', []);
  try {
    // the parts of Supabase and of earlier files this one needs: storage, owners, polls
    await db.query(`
      create schema storage;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant usage on schema storage to anon, authenticated;
      grant select, insert, delete on storage.objects to anon, authenticated;`);
    const stats = await read('games/supabase/update_page_stats.sql');
    await db.query(stats.match(/create table if not exists games\.owners[\s\S]*?;/)[0]);
    await db.query(stats.match(/create or replace function games\.is_owner\(u uuid\)[\s\S]*?\n\$\$;/)[0]);
    const polls = await read('games/supabase/update_polls.sql');
    await db.query(polls.match(/create table if not exists games\.polls[\s\S]*?\n\);/)[0]);
    await db.query(polls.match(/create table if not exists games\.poll_votes[\s\S]*?\n\);/)[0]);
    const sql = await read('games/supabase/update_gazette_newsroom.sql');
    await db.query(sql);
    await db.query(sql);   // safe to run twice

    const owner = await addUser(db, 1, 'Byl'), fren = await addUser(db, 2, 'Fren');
    await db.query("insert into games.owners values ('d1', 'owner')");
    const call = caller(db);
    const O = { user: owner }, F = { user: fren }, ANON = {};
    const blocks = [{ style: 'breaking', kicker: 'Breaking', heading: 'Hello', body: '**hi** <script>x</script>' },
      { style: 'poll', heading: 'Vote', poll: { id: 'gz11_abc123', question: 'Do you like the Newsroom?', options: ['Yes', ' ', 'No'], days: 3 } }];
    const save = (who, num, pub, b = blocks) => call(who, 'select public.gry_newsroom_save_issue($1, $2, $3, $4, $5::jsonb, $6) as v', [num, 'Hello issue', 'Weekly', '', JSON.stringify(b), pub]);

    // not the owner: nothing
    await assert.rejects(save(F, 11, null), /Only the site owner/);
    await assert.rejects(save(ANON, 11, null), /permission denied/);
    assert.equal(await call(F, 'select public.gry_newsroom() as v'), null);
    await assert.rejects(save(O, 10, null), /start at 11/);

    // a draft: the owner sees it, nobody else does
    const r = await save(O, 11, null);
    assert.equal(r.num, 11); assert.equal(r.at, null);
    assert.equal(await call(F, 'select public.gry_gazette_issue(11) as v'), null);
    assert.equal(await call(ANON, 'select public.gry_gazette_issue(11) as v'), null);
    assert.equal((await call(O, 'select public.gry_gazette_issue(11) as v')).draft, true);
    assert.deepEqual((await call(ANON, 'select public.gry_gazette_list() as v')).issues, []);
    // the poll block made its poll (empty answers dropped, ids o1, o3)
    const p = (await db.query("select question, options from games.polls where id = 'gz11_abc123'")).rows[0];
    assert.equal(p.question, 'Do you like the Newsroom?');
    assert.deepEqual(p.options.map(o => o.label), ['Yes', 'No']);

    // publish: everyone sees it, the first publish date stays on later saves
    const pub = await save(O, 11, true);
    assert.ok(pub.at);
    const list = await call(ANON, 'select public.gry_gazette_list() as v');
    assert.deepEqual(list.issues.map(i => [i.num, i.title]), [[11, 'Hello issue']]);
    const is = await call(ANON, 'select public.gry_gazette_issue(11) as v');
    assert.equal(is.draft, false); assert.equal(is.blocks[0].heading, 'Hello');
    await new Promise(res => setTimeout(res, 20));
    const again = await save(O, 11, null);
    assert.equal(again.at, pub.at, 'a save keeps the publish date');
    // back to draft hides it again
    await save(O, 11, false);
    assert.equal(await call(ANON, 'select public.gry_gazette_issue(11) as v'), null);

    // after the first vote the poll answers are locked
    await db.query("insert into games.poll_votes (poll_id, user_id, choice) values ('gz11_abc123', $1, 'o1')", [fren]);
    const changed = JSON.parse(JSON.stringify(blocks)); changed[1].poll.options = ['A', 'B', 'C'];
    await save(O, 11, null, changed);
    assert.deepEqual((await db.query("select options from games.polls where id = 'gz11_abc123'")).rows[0].options.map(o => o.label), ['Yes', 'No']);
    // a broken poll is refused
    const badPoll = [{ style: 'poll', poll: { id: 'gz11_zzz999', question: 'One?', options: ['Only one'] } }];
    await assert.rejects(save(O, 11, null, badPoll), /2 to 8 answers/);
    await assert.rejects(save(O, 11, null, [{ style: 'poll', poll: { id: 'like_polls', question: 'Hijack?', options: ['a', 'b'] } }]), /Broken poll id/);
    // size limits
    await assert.rejects(save(O, 12, null, Array.from({ length: 21 }, () => ({ style: 'story', body: 'x' }))), /at most 20/);
    await assert.rejects(save(O, 12, null, [{ style: 'story', body: 'x'.repeat(70000) }]), /Too much text/);
    await assert.rejects(save(O, 12, null, ['not an object']), /Broken stories/);

    // ads
    const scenes = JSON.stringify([{ kick: 'Tired?', big: 'Meet the *frog*' }]);
    const saveAd = (who, id, pub) => call(who, 'select public.gry_newsroom_save_ad($1, $2, $3, $4, $5, $6, $7::jsonb, $8) as v', [id, 'Frog Gym', 'CH 7', 'news', true, 'happy.webp', scenes, pub]);
    await assert.rejects(saveAd(F, 'frog_gym.mpg', true), /Only the site owner/);
    await assert.rejects(saveAd(O, 'Frog Gym.mpg', true), /File name/);
    await saveAd(O, 'frog_gym.mpg', null);
    assert.deepEqual((await call(ANON, 'select public.gry_gazette_list() as v')).ads, []);
    await saveAd(O, 'frog_gym.mpg', true);
    const ads = (await call(ANON, 'select public.gry_gazette_list() as v')).ads;
    assert.equal(ads.length, 1); assert.equal(ads[0].id, 'frog_gym.mpg'); assert.equal(ads[0].scenes[0].big, 'Meet the *frog*');
    await assert.rejects(call(O, "select public.gry_newsroom_save_ad('x_y.mpg', 't', '', 'disco', false, '', '[{}]'::jsonb, null) as v"), /gazette_ads_look_check/);
    await call(F, "select public.gry_newsroom_delete_ad('frog_gym.mpg') as v").catch(() => {});
    assert.equal((await call(ANON, 'select public.gry_gazette_list() as v')).ads.length, 1, 'a fren cannot delete');
    await call(O, "select public.gry_newsroom_delete_ad('frog_gym.mpg') as v");
    assert.equal((await call(ANON, 'select public.gry_gazette_list() as v')).ads.length, 0);
    await call(O, 'select public.gry_newsroom_delete_issue(11) as v');
    assert.equal((await call(O, 'select public.gry_newsroom() as v')).issues.length, 0);

    // pictures: the bucket exists, only the owner may add one
    assert.equal((await db.query("select public from storage.buckets where id = 'gazette'")).rows[0].public, true);
    await call(O, "insert into storage.objects (bucket_id, name) values ('gazette', 'a.webp') returning 1 as v");
    await assert.rejects(call(F, "insert into storage.objects (bucket_id, name) values ('gazette', 'b.webp') returning 1 as v"), /row-level security/);
    assert.equal(await call(F, "select count(*)::int as v from storage.objects where bucket_id = 'gazette'"), 0, 'others cannot list uploads');
    assert.equal(await call(O, "select count(*)::int as v from storage.objects where bucket_id = 'gazette'"), 1);
    assert.equal(uid(1), owner);
  } finally { await drop(); }
});

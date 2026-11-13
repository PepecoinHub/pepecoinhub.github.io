// Optional PostgreSQL integration test for games/supabase/update_pond_king.sql (POND KING on PondOS 98).
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pond-king-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const BEATS = { r: 's', s: 'p', p: 'r' };   // what each move beats
const counter = m => ({ r: 'p', p: 's', s: 'r' })[m];

test('Pond King: hidden moves, one duel per king per player and network, the throne changes hands safely',
  { skip: !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE', timeout: 120000 }, async () => {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const dbName = 'pond_king_test_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const db = new pg.Client({ connectionString: url.toString() }); await db.connect();
  try {
    await db.query(`
      do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
      do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
      create schema games;
      grant usage on schema public, games to anon, authenticated;
      create table games.config (id int primary key, host_code_salt text not null); insert into games.config values (1, 'test-salt');
      create function games.is_profane(t text) returns boolean language sql immutable as $$ select t ilike '%badword%' $$;`);
    const schema = await read('games/supabase/schema.sql');
    await db.query(schema.match(/create or replace function games\.client_ip_hash\(\)[\s\S]*?\nend \$\$;/)[0]);
    const sql = await read('games/supabase/update_pond_king.sql');
    await db.query(sql);
    await db.query(sql);   // safe to run again: still one house frog
    assert.equal((await db.query('select count(*)::int n from games.pk_kings')).rows[0].n, 1);

    const tok = i => 'player-token-' + String(i).padStart(10, '0');
    const call = async (ip, q, args = []) => {
      await db.query('begin');
      try {
        await db.query('set local role anon');
        await db.query("select set_config('request.headers', $1, true)", [ip ? JSON.stringify({ 'cf-connecting-ip': ip }) : '{}']);
        const r = await db.query(q, args); await db.query('commit'); return r.rows[0].v;
      } catch (e) { await db.query('rollback'); throw e; }
    };
    const state = (t, ip) => call(ip, 'select public.gry_pk_state($1) as v', [t]);
    const duel = (t, ip, king, nick, moves) => call(ip, 'select public.gry_pk_challenge($1, $2, $3, $4) as v', [t, king, nick, moves]);
    const setMoves = (t, ip, moves) => call(ip, 'select public.gry_pk_set_moves($1, $2) as v', [t, moves]);

    // anon cannot read the tables directly
    await assert.rejects(call('1.1.1.1', 'select moves as v from games.pk_kings'), /permission denied/);

    // a visitor sees the house frog, but not its moves
    const s0 = await state(tok(1), '1.1.1.1');
    assert.equal(s0.king.nick, 'Pepe'); assert.equal(s0.king.house, true); assert.equal(s0.king.moves, null);
    assert.equal(s0.can_challenge, true);
    const k0 = s0.king.id;

    // input checks
    assert.equal((await duel('short', '1.1.1.1', k0, 'Fren', 'rps')).error, 'token');
    assert.equal((await duel(tok(1), '1.1.1.1', k0, 'Fren', 'rpx')).error, 'moves');
    assert.equal((await duel(tok(1), '1.1.1.1', k0, 'x', 'rps')).error, 'nick');
    assert.equal((await duel(tok(1), '1.1.1.1', k0, 'badword99', 'rps')).error, 'nick_bad');
    assert.equal((await duel(tok(1), '1.1.1.1', k0 + 99, 'Fren', 'rps')).error, 'changed');

    // make the house frog predictable: three rocks, so any order is the same
    await db.query("update games.pk_kings set moves = 'rrr' where id = $1", [k0]);

    // a lost duel: scissors x3 loses every round; the king gains a defence
    const lost = await duel(tok(1), '1.1.1.1', k0, 'Loser', 'sss');
    assert.equal(lost.ok, true); assert.equal(lost.won, false); assert.deepEqual(lost.score, [0, 3]);
    assert.deepEqual(lost.rounds.map(r => r.king), ['r', 'r', 'r']);
    assert.equal(lost.king.defenses, 1);
    // once per king per player, and per network
    assert.equal((await duel(tok(1), '1.1.1.1', k0, 'Loser', 'ppp')).error, 'tried');
    assert.equal((await duel(tok(2), '1.1.1.1', k0, 'Sneaky', 'ppp')).error, 'network');
    const s1 = await state(tok(2), '1.1.1.1');
    assert.equal(s1.can_challenge, false); assert.equal(s1.tried.network, true);
    assert.equal((await state(tok(1), '1.1.1.1')).tried.won, false);

    // a tie keeps the king: rock, paper, scissors against rrr = 0 : 1 : 0 -> 1 win, 1 loss
    const tie = await duel(tok(3), '3.3.3.3', k0, 'Tie', 'rps');
    assert.equal(tie.won, false); assert.deepEqual(tie.score, [1, 1]);

    // a winner takes the throne with their moves
    const win = await duel(tok(4), '4.4.4.4', k0, 'Winner', 'ppr');
    assert.equal(win.won, true); assert.deepEqual(win.score, [2, 0]);
    const s2 = await state(tok(4), '4.4.4.4');
    assert.equal(s2.king.nick, 'Winner'); assert.equal(s2.king.you, true); assert.equal(s2.king.moves, 'ppr');
    assert.equal(s2.can_challenge, false); assert.equal(s2.king.defenses, 0);
    // the old king's reign stays in the top list
    assert.ok(s2.top.some(t => t.nick === 'Pepe' && t.defenses === 2 && !t.reigning));
    // nobody else sees the moves
    assert.equal((await state(tok(5), '5.5.5.5')).king.moves, null);
    // the king cannot challenge themselves
    assert.equal((await duel(tok(4), '4.4.4.4', win.new_king_id, 'Winner', 'rrr')).error, 'self');
    // a stale challenge (against the house frog) is not played
    assert.equal((await duel(tok(5), '5.5.5.5', k0, 'Late', 'ppp')).error, 'changed');

    // the king changes the defence; nobody else may
    assert.equal((await setMoves(tok(5), '5.5.5.5', 'sss')).error, 'not_king');
    assert.equal((await setMoves(tok(4), '4.4.4.4', 'sss')).ok, true);
    // with a new king the earlier loser may try again; scissors x3 is beaten by rock x3
    const back = await duel(tok(1), '1.1.1.1', win.new_king_id, 'Loser', 'rrr');
    assert.equal(back.won, true);
    // the shuffled order is always a permutation of the king's moves
    await db.query("update games.pk_kings set moves = 'rps' where ended_at is null");
    const kNow = (await state(tok(9), '9.9.9.9')).king.id;
    for (let i = 10; i < 16; i++) {
      const d = await duel(tok(i), '10.0.0.' + i, kNow, 'Probe' + i, 'rrr');
      assert.deepEqual(d.rounds.map(r => r.king).sort(), ['p', 'r', 's']);
      for (const r of d.rounds) assert.equal(r.result, r.you === r.king ? 0 : (BEATS[r.you] === r.king ? 1 : -1));
      assert.equal(d.won, false);   // rrr vs {r,p,s}: one win, one loss, one draw
    }
    // the king sees who came, the others see only names and results
    const ks = await state(tok(1), '1.1.1.1');
    assert.equal(ks.king.you, true); assert.equal(ks.challengers.length, 6);
    const os = await state(tok(20), '20.0.0.1');
    assert.equal(os.challengers, null); assert.ok(os.recent.every(r => !('moves' in r)));

    // network limit: 12 duels per network in 10 minutes (each against a new king)
    await db.query('delete from games.pk_duels');
    for (let i = 0; i < 12; i++) {
      const k = (await state(tok(100 + i), '7.7.7.7')).king;
      await db.query("update games.pk_kings set moves = 'sss' where id = $1", [k.id]);
      const d = await duel(tok(100 + i), '7.7.7.7', k.id, 'Busy' + i, counter('s').repeat(3));
      assert.equal(d.won, true, 'duel ' + i);
    }
    const k = (await state(tok(200), '7.7.7.7')).king;
    assert.equal((await duel(tok(200), '7.7.7.7', k.id, 'TooMany', 'rrr')).error, 'slow');
  } finally {
    await db.end(); await admin.query('drop database ' + dbName); await admin.end();
  }
});

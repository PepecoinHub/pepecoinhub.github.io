// Optional PostgreSQL integration test for the records of the pond duels: BATTLE OF THREE LILIES wins, losses,
// draws and win streaks (games.lily_stats, gry_lily_leaders) and the POND KING player records and longest
// reigns (games.pk_stats, gry_pk_state 'stats' and 'longest').
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/pond-stats-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';

test('Pond records: Lilies streaks and Pond King reigns', { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('pond_stats_test');
  const call = caller(db);
  try {
    // ---------- BATTLE OF THREE LILIES ----------
    const A = { user: await addUser(db, 1, 'FrogKing'), ip: '1.1.1.1' };
    const B = { user: await addUser(db, 2), ip: '2.2.2.2' };
    const create = (who, a, b, c, nick) => call(who, 'select public.gry_lily_create($1, $2, $3, $4, null) as v', [a, b, c, nick]);
    const accept = (who, id, a, b, c, nick) => call(who, 'select public.gry_lily_accept($1, $2, $3, $4, $5) as v', [id, a, b, c, nick]);
    const my = who => call(who, 'select public.gry_lily_my() as v');
    const leaders = who => call(who, 'select public.gry_lily_leaders() as v');
    // A wins (2/4/4 beats 4/3/3 2:1) three times, then a draw (same spread) ends the streak, then A wins again
    const duel = async (aSpread, bSpread) => {
      const c = await create(A, ...aSpread, 'FrogKing'); assert.equal(c.ok, true);
      const r = await accept(B, c.challenge.id, ...bSpread, 'Brave'); assert.equal(r.ok, true);
      await db.query("update games.lily_challenges set created_at = created_at - interval '1 day'");   // the daily limit
    };
    for (let i = 0; i < 3; i++) await duel([2, 4, 4], [4, 3, 3]);
    let sa = (await my(A)).stats, sb = (await my(B)).stats;
    assert.deepEqual(sa, { wins: 3, losses: 0, draws: 0, streak: 3, best_streak: 3 });
    assert.deepEqual(sb, { wins: 0, losses: 3, draws: 0, streak: 0, best_streak: 0 });
    await duel([4, 3, 3], [4, 3, 3]);
    await duel([2, 4, 4], [4, 3, 3]);
    sa = (await my(A)).stats; sb = (await my(B)).stats;
    assert.deepEqual(sa, { wins: 4, losses: 0, draws: 1, streak: 1, best_streak: 3 });
    assert.deepEqual(sb, { wins: 0, losses: 4, draws: 1, streak: 0, best_streak: 0 });
    // the hall of flies: for anybody, names only
    const lb = await leaders(null);
    assert.equal(lb.streaks.length, 1); assert.equal(lb.streaks[0].nick, 'FrogKing'); assert.equal(lb.streaks[0].best_streak, 3);
    assert.equal(lb.wins[0].wins, 4); assert.equal(lb.wins[0].passport, A.user);
    assert.ok(!/"user_id"|"a"|"you":true/.test(JSON.stringify(lb)));
    assert.equal((await leaders(A)).streaks[0].you, true);
    // the records are closed to the browser roles
    await assert.rejects(call(A, 'select wins as v from games.lily_stats'), /permission denied/);
    await assert.rejects(call(A, "select games.lily_stat_add($1, 'x', 'win') as v", [A.user]), /permission denied/);
    // records outlive the challenges, and the backfill does not run twice
    await db.query('delete from games.lily_challenges');
    await db.query(await readFile(new URL('../games/supabase/update_lilies.sql', import.meta.url), 'utf8'));
    assert.equal((await my(A)).stats.wins, 4);

    // ---------- POND KING ----------
    const tok = i => 'player-token-' + String(i).padStart(10, '0');
    const anon = ip => ({ ip });
    const state = (t, who) => call(who, 'select public.gry_pk_state($1) as v', [t]);
    const challenge = (t, who, king, nick, moves) => call(who, 'select public.gry_pk_challenge($1, $2, $3, $4) as v', [t, king, nick, moves]);
    let k = (await state(tok(1), anon('5.0.0.1'))).king;
    await db.query("update games.pk_kings set moves = 'rrr' where id = $1", [k.id]);
    // Rex takes the house throne, then holds it against two frogs
    assert.equal((await challenge(tok(1), anon('5.0.0.1'), k.id, 'Rex', 'ppp')).won, true);
    k = (await state(tok(1), anon('5.0.0.1'))).king;
    await db.query("update games.pk_kings set moves = 'ppp', crowned_at = now() - interval '3 hours' where id = $1", [k.id]);
    assert.equal((await challenge(tok(2), anon('5.0.0.2'), k.id, 'Tad', 'rrr')).won, false);
    assert.equal((await challenge(tok(3), anon('5.0.0.3'), k.id, 'Pole', 'rrr')).won, false);
    let rex = await state(tok(1), anon('5.0.0.1'));
    assert.equal(rex.stats.duels, 1); assert.equal(rex.stats.thrones, 1); assert.equal(rex.stats.best_defenses, 2);
    assert.ok(rex.stats.longest_reign_s >= 3 * 3600, 'a reign still going counts');
    assert.equal(rex.longest[0].nick, 'Rex'); assert.equal(rex.longest[0].reigning, true); assert.equal(rex.longest[0].you, true);
    assert.ok(!rex.longest.some(x => x.nick === 'Pepe'), 'the house frog is not on the list');
    const tad = (await state(tok(2), anon('5.0.0.2'))).stats;
    assert.deepEqual(tad, { duels: 1, thrones: 0, losses: 1, best_defenses: 0, longest_reign_s: 0 });
    // Pole comes back later and takes the throne: Rex's reign is over, its length and defences are kept
    await db.query("update games.pk_duels set created_at = created_at - interval '5 hours'");
    const p = await challenge(tok(4), anon('5.0.0.4'), k.id, 'Pole', 'sss');
    assert.equal(p.won, true);
    rex = await state(tok(1), anon('5.0.0.1'));
    assert.equal(rex.stats.best_defenses, 2); assert.ok(rex.stats.longest_reign_s >= 3 * 3600 && rex.stats.longest_reign_s < 4 * 3600);
    assert.equal(rex.longest[0].nick, 'Rex'); assert.equal(rex.longest[0].reigning, false);
    assert.equal(rex.longest[1].nick, 'Pole'); assert.equal(rex.longest[1].reigning, true);
    // the records are closed to the browser roles and survive a rerun of the SQL
    await assert.rejects(call(anon('5.0.0.9'), 'select duels as v from games.pk_stats'), /permission denied/);
    await db.query(await readFile(new URL('../games/supabase/update_pond_king.sql', import.meta.url), 'utf8'));
    assert.equal((await state(tok(1), anon('5.0.0.1'))).stats.duels, 1);
    // a logged-on player's record follows the account
    const C = { user: await addUser(db, 3, 'MinerFren'), ip: '6.0.0.1' };
    const king = (await state(tok(50), C)).king;
    await db.query("update games.pk_kings set moves = 'rrr' where id = $1", [king.id]);
    await challenge(tok(50), C, king.id, 'MinerFren', 'ppp');
    const other = await state(tok(51), { user: C.user, ip: '6.0.0.2' });
    assert.equal(other.stats.thrones, 1); assert.equal(other.king.you, true);
  } finally {
    await drop();
  }
});

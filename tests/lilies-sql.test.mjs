// Optional PostgreSQL integration test for BATTLE OF THREE LILIES (games/supabase/update_lilies.sql) and the
// POND BULLETIN (update_pond_bulletin.sql). Every call runs as the browser roles (anon / authenticated),
// never as the table owner.
//   PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres \
//   PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js \
//   node --test tests/lilies-sql.test.mjs
// It creates and drops its own database. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';

test('Three Lilies: secret allocations, fair settlement, limits, Bulletin', { skip: SKIP, timeout: 120000 }, async () => {
  const { db, connect, drop } = await pondDb('lilies_test');
  const call = caller(db);
  try {
    const A = { user: await addUser(db, 1, 'FrogKing'), ip: '1.1.1.1' };   // Discord player
    const B = { user: await addUser(db, 2), ip: '2.2.2.2' };               // guest
    const C = { user: await addUser(db, 3), ip: '3.3.3.3' };               // guest
    const D = { user: await addUser(db, 4, 'MinerFren'), ip: '4.4.4.4' };
    const create = (who, a, b, c, nick, rematch = null) =>
      call(who, 'select public.gry_lily_create($1, $2, $3, $4, $5) as v', [a, b, c, nick, rematch]);
    const accept = (who, id, a, b, c, nick) => call(who, 'select public.gry_lily_accept($1, $2, $3, $4, $5) as v', [id, a, b, c, nick]);
    const result = (who, id) => call(who, 'select public.gry_lily_result($1) as v', [id]);
    const my = who => call(who, 'select public.gry_lily_my() as v');
    const board = who => call(who, 'select public.gry_bulletin(20) as v');
    const reset = () => db.query("delete from games.lily_challenges; delete from games.bulletin_events where game = 'lilies'");

    // 0. no sign-in, no game: anon may not even call the functions; the tables are closed to both roles
    await assert.rejects(call(null, 'select public.gry_lily_create(2, 4, 4) as v'), /permission denied/);
    for (const who of [null, A]) {
      await assert.rejects(call(who, 'select a as v from games.lily_moves'), /permission denied/);
      await assert.rejects(call(who, 'select status as v from games.lily_challenges'), /permission denied/);
      await assert.rejects(call(who, "select games.bulletin_post('x','lilies','lily_win','a',null,null,null,null,'{}') as v"), /permission denied/);
    }

    // 1. a valid 2/4/4; only safe metadata comes back
    const c1 = await create(A, 2, 4, 4, 'FrogKing');
    assert.equal(c1.ok, true); assert.equal(c1.challenge.status, 'open'); assert.equal(c1.challenge.creator, 'FrogKing');
    assert.ok(!JSON.stringify(c1).includes('"you"'));
    const left = new Date(c1.challenge.expires_at) - new Date(c1.challenge.created_at);
    assert.equal(left, 48 * 3600e3, 'open for 48 hours');

    // 2. sums 9 and 11
    assert.equal((await create(A, 2, 4, 3, 'FrogKing')).error, 'sum');
    assert.equal((await create(A, 2, 4, 5, 'FrogKing')).error, 'sum');
    // 3. negative values, fractions, wrong types, missing values
    assert.equal((await create(A, -1, 6, 5, 'FrogKing')).error, 'flies');
    assert.equal((await create(A, 11, 0, -1, 'FrogKing')).error, 'flies');
    assert.equal((await create(A, null, 5, 5, 'FrogKing')).error, 'flies');
    await assert.rejects(create(A, '2.5', '3.5', 4, 'FrogKing'), /invalid input syntax for type integer/);
    await assert.rejects(create(A, 'two', 4, 4, 'FrogKing'), /invalid input syntax for type integer/);

    // 11. before it is settled nobody else learns the allocation: not B, not anon, not the Bulletin
    const pubB = await result(B, c1.challenge.id);
    assert.equal(pubB.match.you, undefined); assert.equal(pubB.match.them, undefined);
    const b0 = await board(null);
    assert.equal(b0.open.length, 1); assert.equal(b0.open[0].creator, 'FrogKing'); assert.equal(b0.open[0].creator_passport, A.user);
    assert.ok(!/"(you|them|a|b|c)"/.test(JSON.stringify(b0)), 'no allocation in the Bulletin');
    const mineA = await my(A);
    assert.deepEqual(mineA.matches[0].you, [2, 4, 4]); assert.equal(mineA.matches[0].them, null);
    assert.equal((await my(B)).matches.length, 0);

    // 7. not your own challenge
    assert.equal((await accept(A, c1.challenge.id, 4, 3, 3, 'FrogKing')).error, 'self');

    // 4. a 2:1 win for A (2/4/4 vs 4/3/3)
    const r1 = await accept(B, c1.challenge.id, 4, 3, 3, 'Brave');
    assert.equal(r1.ok, true);
    assert.equal(r1.match.outcome, 'lose'); assert.deepEqual(r1.match.you, [4, 3, 3]); assert.deepEqual(r1.match.them, [2, 4, 4]);
    assert.equal(r1.match.result, 'creator_win'); assert.deepEqual(r1.match.pads, [2, 1]);
    // 10. no second move, no second accept
    assert.equal((await accept(B, c1.challenge.id, 5, 5, 0, 'Brave')).error, 'taken');
    assert.equal((await accept(C, c1.challenge.id, 5, 5, 0, 'Late')).error, 'taken');
    await assert.rejects(db.query('update games.lily_moves set a = 9, b = 1, c = 0'), /cannot be changed/);
    // 12. after the duel: both players see both allocations; others see only the result
    const resA = await result(A, c1.challenge.id);
    assert.equal(resA.match.outcome, 'win'); assert.deepEqual(resA.match.you, [2, 4, 4]); assert.deepEqual(resA.match.them, [4, 3, 3]);
    const resC = await result(C, c1.challenge.id);
    assert.equal(resC.match.result, 'creator_win'); assert.equal(resC.match.you, undefined); assert.equal(resC.match.them, undefined);
    // 14. coming back later (a new page load, the same account) shows the result
    const back = (await my(B)).matches[0];
    assert.equal(back.status, 'completed'); assert.equal(back.outcome, 'lose'); assert.deepEqual(back.them, [2, 4, 4]);
    // 13. the Bulletin has the result exactly once, and the challenge left the open list
    const b1 = await board(null);
    assert.equal(b1.open.length, 0);
    const ev1 = b1.events.filter(e => e.ref === c1.challenge.id);
    assert.equal(ev1.length, 1); assert.equal(ev1[0].kind, 'lily_win'); assert.equal(ev1[0].actor, 'FrogKing'); assert.equal(ev1[0].other, 'Brave');
    assert.equal(ev1[0].actor_passport, A.user); assert.equal(ev1[0].other_passport, null, 'guests have no passport');
    assert.equal((await db.query("select games.bulletin_post('lily:' || $1, 'lilies', 'lily_win', 'X', null, 'Y', null, $1, '{}') as v", [c1.challenge.id])).rows[0].v, false);
    assert.equal((await db.query('select count(*)::int n from games.bulletin_events where ref = $1', [c1.challenge.id])).rows[0].n, 1);

    // 5. a 1:1 draw with one undecided pad (2/4/4 vs 1/5/4), and 6. a 0:0 draw (2/4/4 vs 2/4/4)
    const c2 = await create(A, 2, 4, 4, 'FrogKing');
    const r2 = await accept(C, c2.challenge.id, 1, 5, 4, 'Cee');
    assert.equal(r2.match.outcome, 'draw'); assert.deepEqual(r2.match.pads, [1, 1]); assert.equal(r2.match.result, 'draw');
    const c3 = await create(A, 2, 4, 4, 'FrogKing');
    const r3 = await accept(D, c3.challenge.id, 2, 4, 4, 'MinerFren');
    assert.equal(r3.match.outcome, 'draw'); assert.deepEqual(r3.match.pads, [0, 0]);
    // the other examples from the brief: 5/2/3 loses to 2/4/4, 0/5/5 beats it
    const c4 = await create(A, 2, 4, 4, 'FrogKing');
    assert.equal((await accept(B, c4.challenge.id, 5, 2, 3, 'Brave')).match.outcome, 'lose');
    const c5 = await create(A, 2, 4, 4, 'FrogKing');
    const r5 = await accept(D, c5.challenge.id, 0, 5, 5, 'MinerFren');
    assert.equal(r5.match.outcome, 'win'); assert.equal(r5.match.result, 'opponent_win');
    const evs = (await board(null)).events;
    const winEv = evs.find(e => e.ref === c5.challenge.id);
    assert.equal(winEv.actor, 'MinerFren'); assert.equal(winEv.other, 'FrogKing'); assert.deepEqual(winEv.data.pads, [2, 1]);
    assert.equal(evs.find(e => e.ref === c3.challenge.id).kind, 'lily_draw');

    // 15. limits: 3 open at once, 5 new per UTC day (A has created 5 today already)
    assert.equal((await create(A, 4, 3, 3, 'FrogKing')).error, 'day_limit');
    await reset();
    for (let i = 0; i < 3; i++) assert.equal((await create(C, 4, 3, 3, 'Cee')).ok, true);
    assert.equal((await create(C, 4, 3, 3, 'Cee')).error, 'open_limit');
    const open = (await my(C)).matches;
    assert.equal((await call(C, 'select public.gry_lily_cancel($1) as v', [open[0].id])).ok, true);
    assert.equal((await call(B, 'select public.gry_lily_cancel($1) as v', [open[1].id])).error, 'missing', 'only the author cancels');
    assert.equal((await create(C, 4, 3, 3, 'Cee')).ok, true);   // a free slot again (4 today)
    assert.equal((await accept(B, open[0].id, 4, 3, 3, 'Brave')).error, 'taken', 'cancelled cannot be accepted');
    // per network: 15 new challenges a day, whoever signs in
    await reset();
    for (let i = 0; i < 15; i++) {
      const g = { user: await addUser(db, 100 + i), ip: '9.9.9.9' };
      assert.equal((await create(g, 1, 1, 8, 'Spam' + i)).ok, true);
    }
    assert.equal((await create({ user: await addUser(db, 200), ip: '9.9.9.9' }, 1, 1, 8, 'Spam15')).error, 'day_limit');

    // 8. an expired challenge cannot be accepted, even from a stale screen; it gives no win and no loss
    await reset();
    const c6 = await create(D, 3, 3, 4, 'MinerFren');
    await db.query("update games.lily_challenges set expires_at = now() - interval '1 minute' where id = $1", [c6.challenge.id]);
    assert.equal((await board(null)).open.length, 0);
    assert.equal((await accept(B, c6.challenge.id, 4, 3, 3, 'Brave')).error, 'expired');
    const exp = (await my(D)).matches[0];
    assert.equal(exp.status, 'expired'); assert.equal(exp.outcome, null);
    assert.equal((await db.query("select count(*)::int n from games.bulletin_events where ref = $1", [c6.challenge.id])).rows[0].n, 0);

    // 9. two frens accept the same challenge at the same moment: exactly one plays
    const c7 = await create(D, 3, 3, 4, 'MinerFren');
    const [x, y] = [await connect(), await connect()];
    try {
      const go = async (conn, who, nick) => {
        await conn.query('begin'); await conn.query('set local role authenticated');
        await conn.query("select set_config('request.jwt.claim.sub', $1, true)", [who.user]);
        await conn.query("select set_config('request.headers', $1, true)", [JSON.stringify({ 'cf-connecting-ip': who.ip })]);
        const r = await conn.query('select public.gry_lily_accept($1, 5, 5, 0, $2) as v', [c7.challenge.id, nick]);
        await new Promise(res => setTimeout(res, 150));   // hold the lock a moment, so the other one has to wait
        await conn.query('commit'); return r.rows[0].v;
      };
      const both = await Promise.all([go(x, B, 'Brave'), go(y, C, 'Cee')]);
      assert.deepEqual(both.map(r => r.ok).sort(), [false, true]);
      assert.equal(both.find(r => !r.ok).error, 'taken');
      assert.equal((await db.query('select count(*)::int n from games.lily_moves where challenge_id = $1', [c7.challenge.id])).rows[0].n, 2);
      assert.equal((await db.query("select count(*)::int n from games.bulletin_events where ref = $1", [c7.challenge.id])).rows[0].n, 1);
    } finally { await x.end(); await y.end(); }

    // rematch: a new secret allocation, offered only to the other player of a finished duel
    const fin = (await my(D)).matches.find(m => m.status === 'completed');
    const otherSide = fin.played ? { nick: fin.creator } : { nick: fin.opponent };
    const rm = await create(D, 1, 1, 8, 'MinerFren', fin.id);
    assert.equal(rm.ok, true); assert.equal(rm.challenge.invitee, otherSide.nick);
    const stranger = { user: await addUser(db, 300), ip: '30.0.0.1' };
    assert.equal((await accept(stranger, rm.challenge.id, 4, 3, 3, 'Stranger')).error, 'invite');
    assert.equal((await create(stranger, 4, 3, 3, 'Stranger', fin.id)).error, 'rematch');
    // a guest may not take a name a Discord player has reserved
    assert.equal((await create(stranger, 4, 3, 3, 'FrogKing')).error, 'nick');
  } finally {
    await drop();
  }
});

// Optional PostgreSQL test: POND KING's network rules apply to players without an account and to guest
// accounts, while Discord accounts are told apart by the account (frens on one shared address do not block
// each other). See tests/pond-sql-setup.mjs for how to run it. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { SKIP, pondDb, caller, addUser } from './pond-sql-setup.mjs';

test('Pond King: Discord accounts on one network do not block each other; guests still do', { skip: SKIP, timeout: 120000 }, async () => {
  const { db, drop } = await pondDb('pond_net_test', ['update_pond_bulletin.sql', 'update_pond_king.sql']);
  const call = caller(db);
  try {
    const NET = '7.7.7.7', tok = i => 'player-token-' + String(i).padStart(10, '0');
    const state = (who, t) => call(who, 'select public.gry_pk_state($1) as v', [t]);
    const duel = (who, t, king, nick) => call(who, 'select public.gry_pk_challenge($1, $2, $3, $4) as v', [t, king, nick, 'sss']);
    await db.query("update games.pk_kings set moves = 'rrr'");   // every duel below loses: the king stays
    const king = (await state({ ip: NET }, tok(1))).king.id;
    // two Discord frens behind the same address: both may duel the king, no 4-hour wait from each other
    const A = { user: await addUser(db, 1, 'Alpha'), ip: NET }, B = { user: await addUser(db, 2, 'Bravo'), ip: NET };
    assert.equal((await duel(A, tok(1), king, 'Alpha')).ok, true);
    const sb = await state(B, tok(2));
    assert.equal(sb.can_challenge, true); assert.equal(sb.cooldown, null); assert.equal(sb.tried, null);
    assert.equal((await duel(B, tok(2), king, 'Bravo')).ok, true);
    // the account itself still waits 4 hours and gets one duel per king, from any address or browser
    assert.equal((await duel({ user: A.user, ip: '8.8.8.8' }, tok(3), king, 'Alpha')).error, 'wait');
    // guest accounts and players without an account on that address: the network rules still apply
    const G = { user: await addUser(db, 3), ip: NET };
    assert.equal((await duel(G, tok(4), king, 'Guesty')).error, 'wait');
    assert.equal((await duel({ ip: NET }, tok(5), king, 'Nobody')).error, 'wait');
    await db.query("update games.pk_duels set created_at = created_at - interval '5 hours'");
    assert.equal((await duel(G, tok(4), king, 'Guesty')).error, 'network');
    assert.equal((await state(G, tok(4))).tried.network, true);
    // a fresh address works for the guest
    assert.equal((await duel({ user: G.user, ip: '9.9.9.9' }, tok(4), king, 'Guesty')).ok, true);
  } finally {
    await drop();
  }
});

// games.adopt_my_guest_rows(): one linked guest's Pepe Guesser rows, nobody else's.
// Uses local Postgres when `psql` can connect. Never point it at Supabase.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const SQL = new URL('../games/supabase/update_adopt_guest_rows.sql', import.meta.url);

function psqlOk() {
  try {
    execFileSync('psql', ['-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', 'select 1'], { stdio: 'ignore' });
    return true;
  } catch { return false; }
}

const GUEST = '00000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000002';
const ANON = '00000000-0000-4000-8000-000000000003';

const STUB = `
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
create schema auth;
create schema games;
create table auth.users(id uuid primary key, is_anonymous boolean not null default false);
create table auth.identities(user_id uuid not null, provider text not null, provider_id text not null, identity_data jsonb not null default '{}'::jsonb);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function games.norm(t text) returns text language sql immutable as $$
  select regexp_replace(translate(lower(coalesce(t, '')), 'ąćęłńóśźżäöüéèáàíìúù', 'acelnoszzaoueeaaiiuu'), '[^a-z0-9]', '', 'g') $$;
create function games.nick_key(t text) returns text language sql immutable as $$
  select translate(games.norm(t), '013457l', 'oieasti') $$;
create function games.is_profane(t text) returns boolean language sql stable as $$
  select games.norm(t) like '%badword%' $$;
create function games.discord_identity(u uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
           'id', i.provider_id,
           'name', coalesce(i.identity_data->'custom_claims'->>'global_name', i.identity_data->>'full_name',
                            i.identity_data->>'name', i.identity_data->>'user_name', 'player'))
  from auth.identities i where i.user_id = u and i.provider = 'discord' limit 1
$$;
create table games.profiles (
  user_id uuid primary key, nick text not null, nick_key text not null unique,
  discord_id text, discord_name text, created_at timestamptz not null default now());
create table games.wp_plays (
  puzzle_id bigint not null, user_id uuid not null, nick text not null, verified boolean not null default false,
  primary key (puzzle_id, user_id));
create table games.wp_claims (
  id bigint generated always as identity primary key,
  puzzle_id bigint not null, user_id uuid not null, nick text not null,
  address text not null, pep numeric not null, status text not null default 'open', verified boolean not null default false);
`;

function run(db, sql) {
  return execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1', '-q', '-t', '-A', '-c', sql], { encoding: 'utf8' });
}

test('adopt_my_guest_rows marks only this linked guest verified under the Discord nick', { skip: !psqlOk() && 'psql cannot connect' }, () => {
  const db = 'adopt_guest_' + process.pid;
  execFileSync('psql', ['-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `drop database if exists ${db}`], { stdio: 'ignore' });
  execFileSync('psql', ['-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `create database ${db}`], { stdio: 'ignore' });
  try {
    execFileSync('psql', ['-d', db, '-v', 'ON_ERROR_STOP=1'], { input: STUB + '\n' + readFileSync(SQL, 'utf8'), stdio: ['pipe', 'ignore', 'inherit'] });
    const addr = 'P' + '1'.repeat(33);
    run(db, `
      insert into auth.users(id, is_anonymous) values ('${GUEST}', false), ('${OTHER}', false), ('${ANON}', true);
      insert into auth.identities(user_id, provider, provider_id, identity_data) values
        ('${GUEST}', 'discord', '111', '{"full_name":"Pepe Chad!","avatar_url":"https://cdn.example/a.png"}'),
        ('${OTHER}', 'discord', '222', '{"full_name":"Other"}'),
        ('${ANON}', 'discord', '333', '{"full_name":"Still Guest"}');
      insert into games.wp_plays(puzzle_id, user_id, nick, verified) values
        (1, '${GUEST}', 'Frog8415', false),
        (2, '${GUEST}', 'Frog8415', false),
        (1, '${OTHER}', 'Other', true);
      insert into games.wp_claims(puzzle_id, user_id, nick, address, pep, status, verified) values
        (1, '${GUEST}', 'Frog8415', '${addr}', 12.50, 'paid', false),
        (1, '${OTHER}', 'Other', '${addr}', 3, 'open', true);
    `);

    const asUser = (id, sql) => {
      const out = run(db, `begin; set local role authenticated; select set_config('request.jwt.claim.sub', '${id}', true); select (${sql})::text; commit;`);
      const json = out.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('{')).pop();
      if (!json) throw new Error('no json from ' + sql + ': ' + out);
      return json;
    };

    const adopted = JSON.parse(asUser(GUEST, 'public.gry_adopt_guest_rows()'));
    assert.equal(adopted.nick, 'Pepe Chad');
    assert.equal(adopted.plays, 2);
    assert.equal(adopted.claims, 1);
    assert.equal(adopted.profile, 'created');

    const mine = run(db, `select nick || ' ' || verified::text from games.wp_plays where user_id = '${GUEST}' order by puzzle_id`).trim().split('\n');
    assert.deepEqual(mine, ['Pepe Chad true', 'Pepe Chad true']);
    const claim = run(db, `select nick, verified::text, address, pep::text, status from games.wp_claims where user_id = '${GUEST}'`).trim();
    assert.equal(claim, `Pepe Chad|true|${addr}|12.50|paid`);
    const other = run(db, `select nick || ' ' || verified::text from games.wp_plays where user_id = '${OTHER}'`).trim();
    assert.equal(other, 'Other true');
    const otherClaim = run(db, `select nick || ' ' || pep::text || ' ' || status from games.wp_claims where user_id = '${OTHER}'`).trim();
    assert.equal(otherClaim, 'Other 3 open');

    const again = JSON.parse(asUser(GUEST, 'public.gry_adopt_guest_rows()'));
    assert.equal(again.profile, 'kept');
    assert.equal(again.nick, 'Pepe Chad');

    assert.throws(() => asUser(ANON, 'public.gry_adopt_guest_rows()'), /Connect Discord/);
    run(db, `delete from auth.identities where user_id = '${OTHER}'`);
    assert.throws(() => asUser(OTHER, 'public.gry_adopt_guest_rows()'), /not linked/);

    // A second linked guest whose Discord name collapses to the same nick key gets a different nick.
    const third = '00000000-0000-4000-8000-000000000004';
    run(db, `
      insert into auth.users(id, is_anonymous) values ('${third}', false);
      insert into auth.identities(user_id, provider, provider_id, identity_data) values
        ('${third}', 'discord', '444', '{"name":"PepeChad"}');
      insert into games.wp_plays(puzzle_id, user_id, nick, verified) values (3, '${third}', 'Frog9999', false);
    `);
    const thirdOut = JSON.parse(asUser(third, 'public.gry_adopt_guest_rows()'));
    assert.notEqual(thirdOut.nick, 'Pepe Chad');
    assert.match(thirdOut.nick, /^Pepe/);
    const thirdNick = run(db, `select nick from games.wp_plays where user_id = '${third}'`).trim();
    assert.equal(thirdNick, thirdOut.nick);
    const firstStill = run(db, `select nick from games.profiles where user_id = '${GUEST}'`).trim();
    assert.equal(firstStill, 'Pepe Chad');
  } finally {
    execFileSync('psql', ['-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c', `drop database if exists ${db}`], { stdio: 'ignore' });
  }
});

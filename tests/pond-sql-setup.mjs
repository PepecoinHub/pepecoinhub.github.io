// Shared setup for the optional PostgreSQL tests of the pond duels (POND BULLETIN, POND KING, THREE LILIES).
// Builds the small part of schema.sql they need (auth, profiles, nick rules, IP hash) in a fresh database,
// then runs the update files in the documented order. Never point these tests at Supabase.
import { readFile } from 'node:fs/promises';

export const URL_ENV = process.env.PASSPORT_PG_URL, MOD_ENV = process.env.PASSPORT_PG_MODULE;
export const SKIP = !(URL_ENV && MOD_ENV) && 'set PASSPORT_PG_URL and PASSPORT_PG_MODULE';
const read = p => readFile(new URL('../' + p, import.meta.url), 'utf8');
const fn = (sql, name) => {
  const m = sql.match(new RegExp('create or replace function ' + name.replace('.', '\\.') + '\\([\\s\\S]*?\\n(?:end )?\\$\\$;'));
  if (!m) throw new Error('not found in schema.sql: ' + name);
  return m[0];
};

export const uid = i => '00000000-0000-4000-8000-' + String(i).padStart(12, '0');

// a fresh database with the pond SQL; returns { pg, admin, db, dbName, connect, drop }
export async function pondDb(prefix, files = ['update_pond_bulletin.sql', 'update_pond_king.sql', 'update_lilies.sql']) {
  const pg = (await import(MOD_ENV)).default;
  const admin = new pg.Client({ connectionString: URL_ENV }); await admin.connect();
  const dbName = prefix + '_' + process.pid + '_' + Date.now();
  await admin.query('create database ' + dbName);
  const url = new URL(URL_ENV); url.pathname = '/' + dbName;
  const connect = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); return c; };
  const db = await connect();
  await db.query(`
    do $$ begin create role anon nologin; exception when duplicate_object or unique_violation then null; end $$;
    do $$ begin create role authenticated nologin; exception when duplicate_object or unique_violation then null; end $$;
    create schema auth; create schema games;
    create table auth.users(id uuid primary key);
    create table auth.identities(user_id uuid references auth.users(id) on delete cascade, provider text not null, provider_id text not null, identity_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, games to anon, authenticated;
    create table games.config (id int primary key, host_code_salt text not null); insert into games.config values (1, 'test-salt');
    create table games.profiles (user_id uuid primary key, nick text not null, nick_key text not null unique, discord_id text, discord_name text, created_at timestamptz not null default now());
    create function games.is_profane(t text) returns boolean language sql immutable as $$ select t ilike '%badword%' $$;`);
  const schema = await read('games/supabase/schema.sql');
  for (const name of ['games.norm', 'games.nick_key', 'games.discord_identity', 'games.client_ip_hash', 'games.valid_nick']) await db.query(fn(schema, name));
  for (const f of files) await db.query(await read('games/supabase/' + f));
  const drop = async () => { await db.end(); await admin.query('drop database ' + dbName + ' with (force)'); await admin.end(); };
  return { pg, admin, db, dbName, connect, drop };
}

// call SQL as a browser would through PostgREST: role, signed-in user (or none) and the client network
export function caller(db) {
  return async (who, q, args = []) => {
    const { user = null, ip = null, role = user ? 'authenticated' : 'anon' } = who || {};
    await db.query('begin');
    try {
      await db.query('set local role ' + role);
      await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user || '']);
      await db.query("select set_config('request.headers', $1, true)", [ip ? JSON.stringify({ 'cf-connecting-ip': ip }) : '{}']);
      const r = await db.query(q, args); await db.query('commit'); return r.rows[0] && r.rows[0].v;
    } catch (e) { await db.query('rollback'); throw e; }
  };
}

export async function addUser(db, i, discordName) {
  await db.query('insert into auth.users values ($1) on conflict do nothing', [uid(i)]);
  if (discordName) await db.query("insert into auth.identities values ($1, 'discord', $2, $3)", [uid(i), 'd' + i, JSON.stringify({ full_name: discordName })]);
  return uid(i);
}

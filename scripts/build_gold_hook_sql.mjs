// Writes the Pepe Gold Hook level tables into games/supabase/update_gold_hook_campaign.sql (between the
// GENERATED markers) from the game code, so the server checks runs against exactly the same levels.
// Run after changing levels, points or hook speeds:  node scripts/build_gold_hook_sql.mjs
// tests/gold-hook.test.mjs fails if the SQL and the game drift apart.
import { readFileSync, writeFileSync } from 'node:fs';
import { MAX_LEVEL, levelDef } from '../docs/games/js/gold-hook-campaign.mjs';
import { levelTable } from '../docs/games/js/gold-hook-validation.mjs';

const file = new URL('../games/supabase/update_gold_hook_campaign.sql', import.meta.url);
const BEGIN = '-- BEGIN GENERATED LEVELS (scripts/build_gold_hook_sql.mjs)';
const END = '-- END GENERATED LEVELS';

const levels = [], objects = [];
for (let L = 1; L <= MAX_LEVEL; L++) {
  const d = levelDef(L);
  levels.push(`(${L}, ${d.durationSec}, ${d.weight}, ${d.target})`);
  for (const r of levelTable(L)) objects.push(`(${L}, ${r.id}, ${r.points}, ${r.speedMul}, ${r.travel})`);
}
const block = [BEGIN,
  'insert into games.goldhook_levels (level, duration, weight, target) values',
  levels.join(',\n') + ';',
  'insert into games.goldhook_objects (level, id, points, speed_mul, travel) values',
  objects.join(',\n') + ';',
  END].join('\n');

const sql = readFileSync(file, 'utf8');
const a = sql.indexOf(BEGIN), b = sql.indexOf(END);
if (a < 0 || b < a) throw new Error('GENERATED markers not found');
const next = sql.slice(0, a) + block + sql.slice(b + END.length);
if (process.argv.includes('--check')) {
  if (next !== sql) { console.error('update_gold_hook_campaign.sql is out of date: run node scripts/build_gold_hook_sql.mjs'); process.exit(1); }
  console.log('up to date');
} else {
  writeFileSync(file, next);
  console.log(`wrote ${levels.length} levels, ${objects.length} objects`);
}

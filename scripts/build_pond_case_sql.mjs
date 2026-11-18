// Generate PRIVATE seed SQL from a private curator JSON. Never commit the output or inputs.
// The public migration contains zero real campaign content; a seed is always disabled.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative, isAbsolute } from 'node:path';

export const normalizeAnswer = s => String(s ?? '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
const bounded = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
export function validateCase(c) {
  const errors = [];
  if (!bounded(c?.title, 120) || !bounded(c?.intro, 2000)) errors.push('Missing campaign title or intro');
  if (!Array.isArray(c?.steps) || c.steps.length < 3 || c.steps.length > 12) errors.push('Need 3–12 ordered steps');
  else c.steps.forEach((s, i) => {
    if (!bounded(s?.title, 120) || !bounded(s?.clue, 4000) || !bounded(s?.hint, 2000)) errors.push(`Step ${i + 1}: missing text`);
    if (typeof s?.answer !== 'string' || !/^[A-Za-z0-9\s.,:;!?_\-/'()+]+$/.test(s.answer) || s.answer.length > 80 || normalizeAnswer(s.answer).length < 3) errors.push(`Step ${i + 1}: invalid answer format`);
  });
  if (c?.final_message != null && !bounded(c.final_message, 16000)) errors.push('Invalid final message');
  if (c?.final_credit != null && !bounded(c.final_credit, 120)) errors.push('Invalid final credit');
  if ((c?.final_message == null) !== (c?.final_credit == null)) errors.push('Message and attribution must both be supplied, or both omitted');
  return errors;
}
const lit = v => v == null ? 'null' : "E'" + String(v).replace(/\\/g, '\\\\').replace(/'/g, "''") + "'";
export function buildCaseSql(c, saltFor = () => randomBytes(32).toString('hex')) {
  const errors = validateCase(c);
  if (errors.length) throw Error(errors.join('; '));
  const rows = c.steps.map((s,i) => {
    const salt = saltFor(i);
    if (!/^[a-f0-9]{64}$/.test(salt)) throw Error('Invalid salt');
    const hash = createHash('sha256').update(salt + ':' + normalizeAnswer(s.answer), 'utf8').digest('hex');
    return `  (1,${i+1},${lit(s.title)},${lit(s.clue)},${lit(s.hint)},${lit(salt)},${lit(hash)})`;
  });
  return `-- PRIVATE, disabled seed. Import only after update_pond_case_files.sql. Never commit or serve this file.
-- It refuses to overwrite an enabled or played campaign. Founder consent and manual activation are separate.
begin;
lock table pond_case_private.campaign in access exclusive mode;
do $$ begin
  if exists (select 1 from pond_case_private.campaign where enabled) or exists (select 1 from pond_case_private.progress) then
    raise exception 'Case already enabled or played; do not overwrite';
  end if;
end $$;
insert into pond_case_private.campaign(id,enabled,title,intro,stage_count,final_message,final_credit)
values (1,false,${lit(c.title)},${lit(c.intro)},${c.steps.length},${lit(c.final_message)},${lit(c.final_credit)})
on conflict (id) do update set enabled=false,title=excluded.title,intro=excluded.intro,stage_count=excluded.stage_count,
  final_message=excluded.final_message,final_credit=excluded.final_credit;
insert into pond_case_private.steps(campaign_id,step_no,title,clue,hint,salt,answer_hash) values
${rows.join(',\n')}
on conflict (campaign_id,step_no) do update set title=excluded.title,clue=excluded.clue,hint=excluded.hint,salt=excluded.salt,answer_hash=excluded.answer_hash;
delete from pond_case_private.steps where campaign_id=1 and step_no>${c.steps.length};
commit;
`;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const src = process.argv[2];
  if (!src) { console.error('usage: node scripts/build_pond_case_sql.mjs /path/to/case.private.json'); process.exit(2); }
  const privateDir = fileURLToPath(new URL('../games/supabase/private/', import.meta.url));
  const out = resolve(privateDir, 'pond-case-seed.private.sql');
  const rel = relative(privateDir, out);
  if (rel.startsWith('..') || isAbsolute(rel)) throw Error('Private output only');
  const c = JSON.parse(readFileSync(src, 'utf8'));
  const sql = buildCaseSql(c);
  mkdirSync(dirname(out), { recursive:true, mode:0o700 });
  writeFileSync(out, sql, { mode:0o600 });
  console.log('Disabled private seed generated; no database connection was made.');
}

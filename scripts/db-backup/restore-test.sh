#!/usr/bin/env bash
# Restores a backup folder made by dump.sh into a fresh LOCAL Supabase (supabase start, Docker) and checks
# that every table came back with (about) the same number of rows. Never touches the live database.
#   scripts/db-backup/restore-test.sh BACKUP_DIR
# Exit code 0 = the backup can be restored. Prints only table names and counts, no data.
set -euo pipefail
dir="$(cd "${1:?usage: restore-test.sh BACKUP_DIR}" && pwd)"
here="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"
trap 'cd "$work" && supabase stop --no-backup >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
cd "$work"
supabase init --force >/dev/null
sed -i 's/^project_id = .*/project_id = "pep-restore-test"/' supabase/config.toml
supabase start -x studio,imgproxy,edge-runtime,logflare,vector,mailpit,postgres-meta,supavisor >/dev/null
local_url='postgresql://postgres:postgres@127.0.0.1:54322/postgres'

# A local stack logs in as "postgres", not as Supabase's internal admin: drop the few lines only that admin may run
# (the fixes listed in the Supabase docs, Backup and restore using the CLI > Troubleshooting).
sed -E '/^GRANT SET ON PARAMETER /d; /^GRANT "postgres" TO "cli_login_postgres"/d' "$dir/roles.sql" > roles.sql
sed -E '/^ALTER .* OWNER TO "?supabase_admin"?;/d' "$dir/schema.sql" > schema.sql

# The order from the Supabase docs (Backup and restore using the CLI); triggers off while data goes in.
psql "$local_url" -X -q --single-transaction -v ON_ERROR_STOP=1 \
  -f roles.sql -f schema.sql \
  -c 'SET session_replication_role = replica' \
  -f "$dir/data.sql" > restore.log 2>&1 || { echo "RESTORE FAILED:"; grep -E 'ERROR|FATAL' restore.log | head -20; exit 1; }

psql "$local_url" -X -q -At -v ON_ERROR_STOP=1 -f "$here/counts.sql" > restored.txt
# Rows written on the live site between the dump and the count are fine: allow max(5, 2 %) difference.
python3 - "$dir/counts.txt" restored.txt <<'PY'
import sys
def load(p):
    d = {}
    for line in open(p):
        if line.strip():
            t, n = line.rsplit(' ', 1); d[t] = int(n)
    return d
src, got = load(sys.argv[1]), load(sys.argv[2])
bad = []
for t, n in sorted(src.items()):
    m = got.get(t)
    if m is None: bad.append(f'{t}: missing after restore (live had {n})')
    elif abs(m - n) > max(5, n * 0.02): bad.append(f'{t}: live {n}, restored {m}')
total = sum(src.values())
print(f'restore test: {len(src)} tables, {total} rows on the live database at dump time, {sum(got.get(t, 0) for t in src)} restored')
if bad:
    print('PROBLEMS:'); print('\n'.join('  ' + b for b in bad)); sys.exit(1)
print('restore test OK')
PY

#!/usr/bin/env bash
# Makes a full backup of the Supabase database into a folder: roles.sql, schema.sql, data.sql, counts.txt.
#   DB_URL='postgresql://postgres.<ref>:<password>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres' \
#     scripts/db-backup/dump.sh OUT_DIR
# Needs the Supabase CLI and Docker (the CLI runs pg_dump in a container), and psql.
# Never prints data: only file sizes and the number of tables.
set -euo pipefail
: "${DB_URL:?set DB_URL}"
out="${1:?usage: dump.sh OUT_DIR}"
here="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$out"
supabase db dump --db-url "$DB_URL" -f "$out/roles.sql" --role-only
supabase db dump --db-url "$DB_URL" -f "$out/schema.sql"
supabase db dump --db-url "$DB_URL" -f "$out/data.sql" --use-copy --data-only -x storage.buckets_vectors -x storage.vector_indexes
psql "$DB_URL" -X -q -At -v ON_ERROR_STOP=1 -f "$here/counts.sql" > "$out/counts.txt"
date -u +%Y-%m-%dT%H:%M:%SZ > "$out/made_at.txt"
echo "dump ok: $(wc -l < "$out/counts.txt") tables counted"
ls -l "$out" | awk 'NR>1 {print "  " $9 ": " $5 " bytes"}'

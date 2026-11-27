-- Row count of every table we care about: games.*, public.*, auth.users, auth.identities.
-- Output: one line "schema.table count". Used by the backup to check the restore. Read only.
select format('%s.%s %s', table_schema, table_name,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text)
from information_schema.tables
where table_type = 'BASE TABLE'
  and (table_schema in ('games', 'public') or (table_schema = 'auth' and table_name in ('users', 'identities')))
order by table_schema, table_name;

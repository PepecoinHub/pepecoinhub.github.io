-- Polityki Supabase Realtime (kanały prywatne). Uruchom PO schema.sql.
-- Uwaga: NIE dodawaj "alter table realtime.messages enable row level security" — RLS jest już włączone.
drop policy if exists "gry: odczyt kanałów pokoju" on realtime.messages;
create policy "gry: odczyt kanałów pokoju" on realtime.messages
  for select to authenticated
  using ( public.gry_can_access((select realtime.topic()), false) );

drop policy if exists "gry: zapis rysujący/host" on realtime.messages;
create policy "gry: zapis rysujący/host" on realtime.messages
  for insert to authenticated
  with check ( realtime.messages.extension = 'broadcast'
               and public.gry_can_access((select realtime.topic()), true) );

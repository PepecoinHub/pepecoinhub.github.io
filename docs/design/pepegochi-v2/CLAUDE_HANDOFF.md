# Claude Code — plan implementacji PepeGochi 2.0 (po akceptacji zakresu)
**Typ:** handoff techniczny / zadania, NIE pozwolenie na merge, publikację lub uruchomienie SQL.
**Dokument nadrzędny:** docs/design/pepegochi-v2/README.md.
**Właściciel zachowuje decyzje o mechanice, terminach i wdrożeniu. Wygląd finalny opracowany później w oddzielnym etapie z ChatGPT.**

## 1. Najpierw przeczytaj te źródła
1. docs/design/pepegochi-v2/README.md — zasady, zaakceptowane kierunki, rzeczy jeszcze otwarte.
2. games/PEPEGOCHI_API.md oraz games/supabase/update_pepegochi_v1.sql w PR #186 (gałąź codex/pepegochi-secure-backend-v1).
3. games/supabase/update_pepegochi_passport_bridge.sql — **NIE STOSOWAĆ BEZ POPRAWKI**: konflikt z certified_fren.
4. games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md na main — decyzje o stampach są ważniejsze od starych opisów.
5. docs/meme/passport-catalog.json; docs/meme/meme.js; docs/meme/passport.css; docs/games/js/backend.js; games/SETUP.md.
6. PR #212 (Fren beta na main), #213 (nowe oczy/usta), #215 (w toku w dniu zapisu).
7. PR #201 (The Pond Messenger) i #214 (The Lost Pond Files), ale nie mieszaj ich kodu w pierwsze PepeGochi PR-y.

## 2. Czego teraz NIE wolno robić
- Nie implementuj zaprojektowanego przez siebie nowoczesnego UI, nowych awatarów ani wizerunku żaby. Brak finalnych assetów to powód do placeholdera, NIE do wymyślania nowej stylistyki.
- Nie uruchamiaj SQL na produkcji, nie publikuj, nie merge'uj i nie przepisuj dotychczasowych gier bez akceptacji właściciela.
- Nie dodawaj automatycznych portfeli, transferów PEP, wypłat, nagród real-money, mnożnika 1,5× w Pepe Guesser, losowych dropów, NFT.
- Nie zmieniaj znaczenia certified_fren ani dotychczasowych stampów; usuń konflikt z PR #186.
- Nie używaj client-only localStorage jako źródła prawdziwego stanu, przedmiotów, pet_id, czy care_days.
- Nie kopiuj grafik z prywatnego upstream repo bez potwierdzenia zgody/autorskich praw.
- Nie używaj wolumetrycznych danych (1000 rekordów per kliknięcie), cron joba co minutę, osobnego Realtime kanału na żabę czy pollingu 1 s.

## 3. Wykonaj najpierw DESIGN REVIEW bez implementacji
W osobnym krótkim raporcie zaproponuj:
- Docelowy model danych: single active pet + immutable past pet lives + owner identity + per-life care counters, history, departure notice.
- Dokładne stany: egg/tadpole/froglet/adult oraz healthy/neglected/packing/departed/recovering.
- Definicję aktywnej, sensownej opieki i progi ewentualnej wyprowadzki (kandydat: 168 h bez skutecznej akcji). Czy wystarczy nieobecność, czy także skrajnie złe potrzeby? Pokaż konsekwencje obydwu modeli.
- W jaki sposób zachowasz dorobek obecnych petów w razie późniejszej migracji.
- Dwa warianty 30-dniowego wyzwania (prosty i z trzema dniami ochronnymi) i rekomendację, tak aby nie premiować bota karmiącego raz w tygodniu.
- Zależności między SQL #186, Passport i obecnymi migracjami stampów. Przygotuj diagram sekwencji i kolejność migracji.
- Test plan z co najmniej 20 przypadkami i budżet zapytań na jedną minutę/aktywny gracz.
- Listę spraw wymagających decyzji właściciela (zwięźle; nie blokuj przygotowania specyfikacji i prototypów).
**Nie modyfikuj wtedy produkcji.** Po zatwierdzeniu raportu oddziel PR-y.

## 4. Proponowane małe PR-y i definicja DONE

### PR A — kontrakty i testy backendu cyklu życia
Cel: rozbudowa PR #186 albo jego świadomy successor na bazie main; w żadnym wypadku dwa konkurencyjne, aktywne backendy.
- Zweryfikuj i przetestuj v1 w prawdziwym staging PostgreSQL/Supabase, nie wyłącznie statycznie.
- Zaproponuj tabele/rpc dla jednego aktywnego pet life + history; brak user_id jako argumentu RPC, właściciel wyłącznie z auth.uid() i linked Discord.
- Przedstaw i przetestuj sposób oceny nieobecności oparty o server timestamps, dopiero po osiągnięciu minimum 168h oraz nienaruszający aktywnego life.
- Depart once (idempotent); history row once; adopt new only after previous is departed; no resurrection via client.
- Inwarianty: exactly one active pet per account, distinct care-day caps, never pet resurrection due to retry, never duplicate stamps.
- W bridge nie mintuj certified_fren na 100 pet care days; ten stamp oznacza dni aktywności w PondOS. Ewentualną nową nazwę dedykowanej nagrody pokaż właścicielowi do wyboru.
- Dołącz migrację kompatybilności; nie retroaktywnie wyprowadzaj starszych petów przy wejściu po update.
- DONE: testy integracyjne równoległości, anon/non-Discord, row ownership, at 167:59:59/168h, resumption, double-open, racing adopt, reset request, timezone, state snapshot, DB grants and no regressions.

### PR B — minimalny frontend logiki w PondOS, bez grafiki końcowej
Cel: możliwy do przetestowania cykl od adopcji po wyprowadzkę w istniejącym retro oknie.
- Minimalnie wyświetl imię, etap, 4 potrzeby, cztery akcje, ostrzeżenie, recovery, historię, list, przycisk nowej adopcji.
- Prosta, neutralna grafika zastępcza, bez nowej stylistyki, tylko istniejące komponenty PondOS.
- Czytelne zasady ("Your fren may leave after too many days without care"); żadnych niespodziewanych strat.
- Mobilne sterowanie i dostępność. Bez popupów blokujących całą stronę; bez automatycznego publikowania stanu w czacie.
- Otwarcie: 1 call po stan, 1 call po zaakceptowanej akcji, zero polling co sekundę. Reużywaj zwróconego pełnego stanu.
- DONE: demo na telefonie/desktopie, bez błędów w istniejących grach i Passport.

### PR C — Fren Passport bridge i historia
Cel: jedno źródło osiągnięć i user-wide inventory.
- first_hatch, little_fren, grown_fren po serwerowo potwierdzonym etapie; ich status w katalogu zmienić dopiero gdy naprawdę działają.
- Opis Good Parent i Perfect Parent uzgodnić, by nie były dwiema identycznymi nagrodami.
- Overview: mały widok aktualnego PepeGochi lub "Former Fren"; Stats: historia życia (tylko dla właściciela).
- Brak używania gry do zdobywania odznak za fałszywe stany (localStorage/pet age, klientowy care_days).
- DONE: gracz A nie odczytuje prywatnej historii B, nagrody idempotentne i nie giną po departure, przerwanie procesu nie niszczy profilu.

### PR D — Good Parent / Fren Guardian challenge
Cel: dopiero po doświadczeniach z podstawowej pętli opieki.
- Wybierz zaakceptowaną regułę 30 dni i dni ochronnych.
- Challenge bound to pet life_id; po depart przegrany; gracz zachowuje inne stampy.
- Osobny serwerowy stan wyzwania z eventami tylko przy rzeczywistym przejściu; zero generowania sztucznych dziennych zapisów w nocy.
- DONE: testy 30/33 dni, pominięć, 7 dni nieobecności, różnych stref czasowych, leap/time rollover, dubli, farming attempts, bounds on active attempts.

### PR E — dekoracje i pokój (osobna specyfikacja po projektach wizualnych)
Cel: realny serwerowy inventory z item ownership, miejscami ustawienia, przechowywaniem po departure.
- Nie aktywować Interior Designer, Collector, Moon Rock zanim nie będzie backend verified inventory.
- Integracja z The Lost Pond Files dopiero po stabilizacji; nie tworzyć trzech magazynów award.
- DONE: można bezpiecznie urządzić pokój, obejrzeć go po zmianie urządzenia, odzyskać item po odejściu, nowa żaba nie uszkadza inventory.

### PR F — osobowość, więcej etapów, rodzinne żarty
Cel: rozszerzenia po udanym MVP.
- Rebirth tylko dobrowolny, osobny mechanizm. Nie resetować przypadkiem obecnego życia.
- Kilka gotowych wariantów listu z historią opieki, bez AI.
- Nowe etapy 30/60/100 dni, kosmetyczne zachowania, bez obowiązkowych mikrotransakcji.

## 5. Precyzyjny zestaw prób dla QA
1. Adopcja Discord auth -> jeden pet, poprawne imię.
2. Repeated adopt while active -> existing pet, not new pet.
3. Two simultaneous adopts -> one life row.
4. Anonymous and unlinked accounts blocked from saving.
5. Allowed action updates only own pet, unknown action rejected.
6. Concurrent same action no double credit of day.
7. Cross midnight UTC: exactly one care day per UTC day.
8. Needs decay fractional correctness after 2h, 24h, 3 days.
9. 47h, 48h, 119h, 120h, 167h, 168h on server clock.
10. At threshold one departure, one letter, one history row.
11. Repeated opening after departure does not re-award, duplicate, or inflate logs.
12. Retry/network lost during departure safe and idempotent.
13. Player saves pet before threshold -> not departed.
14. Recovering requires more than one Feed for full recovery, if that policy approved.
15. Player can adopt next egg only after previous departure / confirmed transition.
16. All previous stamp IDs, existing inventory, special avatar flags retained.
17. The empty room is a scene: no removal of actual furniture.
18. Guardian challenge cannot complete with calendar rollover exploit.
19. User A cannot read/write pet B or pass user id as argument.
20. Mobile, keyboard, screen-reader, reduced-motion and lost connection flows.
21. Migration on already-existing dormant pet grants grace rather than instant disappearance.
22. Strong regression tests for Passport/Avatar, existing lobby, Pepe Guesser and YEET.
23. Scenario: leave on travel, come back, understand reason, adopt again.
24. Load: no continuous polling when windows minimized / tab background.
25. Full production deployment guard: no SQL/data changes without explicit owner approval.

## 6. Formaty i warunki dostarczenia dla każdego PR
W opisie PR zawsze podaj:
- Jakie pliki zmieniono, jakie istniejące zachowanie zachowano.
- Które decyzje są potwierdzone, które pozostały kandydatami do playtestu.
- Co faktycznie przetestowano (wyniki), co tylko symulowano, a co pominięto.
- Czy SQL migracja została uruchomiona tylko w staging, dokładna kolejność i rollback.
- Zmiany bezpieczeństwa, prywatności i wydajności, liczba RPC na 1 otwarcie / 1 akcję.
- Link do draft PR i zestaw dowodów (screenshot mobile/desktop dla funkcjonalności, jeśli są).
- Dlaczego nie zwiększyliśmy kosztów Supabase Realtime.
- Czy przyznano jakiekolwiek nagrody na produkcji? Oczekiwana odpowiedź przed release: NIE.

## 7. Gotowe polecenie do rozpoczęcia w Claude

Przeczytaj docs/design/pepegochi-v2/README.md, docs/design/pepegochi-v2/CLAUDE_HANDOFF.md i docs/design/pepegochi-v2/STORY_CONTENT.md. Porównaj je z PR #186 oraz z aktualną main (ukryty Fren Passport z PR #212 i #213), raportem games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md i katalogiem achievementów. Zacznij od raportu design review: model danych kolejnych żyć, konsekwencje zaniedbania, jak obsłużyć "żaba się wyprowadza i zostawia list", zachowanie historii/stampów i skorygowanie konfliktu certified_fren. Zrób plan małych PR-ów, testy i szacunek odpytywania Supabase. **Nie projektuj końcowych grafik, nie implementuj realnych wypłat PEP, nie uruchamiaj SQL produkcyjnego, nie merguj i nie publikuj bez zgody.** Odrębne finalne projekty wizualne powstaną później.

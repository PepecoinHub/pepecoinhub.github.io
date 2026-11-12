# The Pond Messenger — projekt rozbudowy LAN Party
Status: **KONCEPCJA / dokumentacja, bez wdrożenia**. Wersja 0.1, 2026-11-06.

## Cel
Zbudować serce społeczności PepecoinHub poprzez ewolucję istniejącego **LAN Party**, nie przez nowy świat 3D, drugą platformę społecznościową ani nowy login. Komunikator ma łączyć **chat + znajomych + publiczny fragment Fren Passport + tablicę wydarzeń**. Personalizacja awatara pochodzi z aktualnie rozwijanego Avatar Makera, a widok PepeGochi zostanie włączony dopiero po wdrożeniu jego backendu.

**Podstawowa zasada:** powód powrotu to znajomi i wspólne wydarzenia, a nie nagrody za samo logowanie.

## Nienaruszalne wymagania
1. Styl PondOS 98: obecny pasek okna, grafitowe panele, zielone tytuły, klasyczne bevel buttons, Tahoma/Verdana, brak gradientów typu glassmorphism, brak współczesnego social-dashboardu.
2. Zachować działający publiczny czat, moderację, bot-check, @mentions, limity, obsługę gości, profilowanie czasu zdarzeń i istniejące wejścia do LAN Party oraz PEP Games.
3. Jeden Supabase, jedna autoryzacja Discord OAuth, jeden model paszportu i awatara; **bez osobnej bazy tożsamości**.
4. Żadnych nowych nagród w PEP, losowych dropów, NFT, kursów XP ani obowiązkowych daily streaków.
5. Żadnych prywatnych wiadomości, wirtualnego spacerowania postaciami, listy światowych pokojów czy kanałów w pierwszym MVP.
6. Nie publikować i nie uruchamiać migracji przed staging, testami negatywnymi i zgodą właściciela.

## Podstawy zweryfikowane w repo
- Czat: docs/games/js/lobbychat.js; backend: games/supabase/update_open_chat.sql.
- Powiadomienia o wpisach: games/supabase/update_lobby_realtime.sql (Realtime jako lekki "dzwonek", treść przez RPC).
- Wzmianki: docs/games/js/mentions.js i games/supabase/update_lobby_mentions.sql.
- PondOS: docs/meme/meme.js i docs/meme/meme.css; menu już zawiera LAN Party chat.
- PR #184 (draft): Fren Passport, katalog, własna tożsamość.
- PR #189 i #191 (draft): Avatar Maker v2 / Passport książeczkowy.
- PR #186 (draft): backend PepeGochi. **Frontend i serwerowy ekwipunek nie są gotowe**.
- PR #176 (draft): Meme Lab. PR #187 (merged): Pond Gazette #4.

## Użytkownik i ekrany
**A. Główne okno: "LAN PARTY — THE POND"**
- Desktop >= 1000 px: pasek tytułu / menu + 3 kolumny: Frens ~190 px, Chat elastyczny, Noticeboard ~220 px.
- Tablet / telefon: jedna widoczna kolumna, 3 zakładki Frens | Chat | Board; czat wypełnia wysokość; nie skalować trzech kolumn do 360 px.
- Frens: awatar + nick + dobrowolny status "online"/"away"/"offline"; własna lista; przycisk wysłania prośby. Fallback zwykłą ikoną, jeśli Avatar Maker niegotowy.
- Chat: istniejące wiadomości, nicki, emotes, czas, potwierdzona tożsamość i @mentions; mała ikona awatara przy wpisie; kliknięcie w awatar/nick wyświetla paszport.
- Board: Game Night, dzienne Pepe Guesser, Pond Gazette; w MVP treść z małego statycznego JSON i linków do istniejących funkcji; nie wymaga serwera.
- Pasek statusu: "Connected to the pond", liczba obecnych na podstawie już liczonego liczników lobby.

**B. Kliknięcie nicku: "Fren Passport — [nickname]"**
- Osobne okno PondOS, bez przekierowania: awatar, pseudonim, publiczny Fren ID (nie UUID/Auth/Discord ID), data dołączenia (opcjonalnie tylko miesiąc/rok), maksymalnie 3 wybrane stemple, publiczny etap PepeGochi (opcjonalnie), Przyjaciel: Add/Request sent/Fren/Blocked.
- Nigdy nie pokazywać PII, Discord UID, e-maila, portfela, prywatnych danych zwierzaka, szczegółowych statystyk logowań. Publiczne osiągnięcia wyłącznie w whitelist.
- Jeżeli użytkownik nie ma paszportu: "This fren hasn't set up a passport yet" z fallbackiem; prywatne profile pozostają prywatne.
- Gość może czytać jawny profil, ale do prośby o znajomość wymagany Discord; inne działania bez loginu zachowują dotychczasowe zachowanie czatu.

**C. Później: "PepeGochi — public snapshot"**
- Tylko przy wyrażonej zgodzie: imię, etap i nieruchoma miniatura żabki; nie odpytywać bazy co kilka sekund. "Visit room" dopiero, gdy istnieje server-verified room state. Żadnych fikcyjnych przedmiotów.

## Przepływ znajomych
- Posiadacz paszportu klika Add Fren -> druga osoba otrzymuje prośbę -> Accept/Decline; dopiero Accept tworzy dwustronną relację.
- Request limit, cooldown i maksymalna liczba aktywnych zaproszeń. Block działa w obie strony dla wyszukania, zaproszeń, oglądania danych o aktywności, ale moderacja czatu pozostaje niezależna.
- Nie zgadywać obecności na podstawie stanu Auth; presence opt-in lub "active recently". Nie tworzyć połączenia Realtime na każdą osobę.

## Architektura i granica zaufania
- Istniejące gry i paszport pozostają jedynym źródłem prawdy o nicku i awatarze.
- Nowe dane minimalne: server-generated public_fren_id; avatar preferences z PR #191; passport_visibility i show_pet (opt-in); friends_requests (from/to/state/timestamp); friends (kanoniczna para); blocks; opcjonalny minimalny last_active_bucket.
- Nie wystawiać surowych tabel do przeglądarki. W ramach istniejącego wzorca prywatnego schematu games: autoryzowane, wąskie RPC; jawny profil zwraca wyłącznie allowlist fields. Każdy zapis przypisuje użytkownika przez auth.uid() + weryfikację Discord po stronie serwera. Weryfikować EXPLICIT role/grants, RLS, wycieki nieistniejących ID i enumeration.
- Dopuszczać odczyt jedynie z konta w zakresie dozwolonym przez ustawienia prywatności; prośba i akceptacja muszą być transakcyjne/idempotentne, blokada i limit wykonywane atomowo.
- Dla listy czatu: masowy odczyt danych awatarów dla *unikalnych aktywnych autorów*; nigdy jedna osobna prośba na każdą wiadomość.
- Wykorzystać obecny mechanizm "doorbell" Realtime + istniejący RPC; 60 s fallback po subskrypcji; ograniczyć odpytywanie, gdy LAN Party okno jest zamknięte i karta w tle.
- Assety SVG, CSS, obrazy i JSON w GitHub Pages. Supabase przechowuje jedynie małe referencje i rekordy; żadnych plików PNG awatarów w DB.

## Realtime i koszty (model orientacyjny, do zweryfikowania przed wdrożeniem)
- Plan Free wg audytu repo: 2 mln wiadomości Realtime/mies., 200 jednoczesnych połączeń Realtime, ok. 500 MB DB, 5 GB transferu niecacheowanego (limity mogą się zmieniać).
- Około liczba wiadomości do czatu × (1 wysłanie + liczba odbiorców).
- Scenariusz 10 obecnych, 100 wpisów/dzień: ~33 tys./mies., ~1.7% limitu.
- 30 obecnych, 300 wpisów/dzień: ~279 tys./mies., ~14% limitu.
- 70 obecnych, 1000 wpisów/dzień: ~2.13 mln/mies.; przekroczony limit, bez innych gier.
- Dodatkowe 1000 osób/dzień × 5 publicznych profili × 2 KB × 30 dni = ~300 MB samych JSON odpowiedzi, bez protokołu, innych RPC, cache ani gier.
- Obecne odświeżanie czatu 60 s nawet przy subskrypcji: nie usuwać bez testowania licznika online i mechanizmu zastępczego.
- Nowe znajomości i paszporty to niskie obciążenie przy odczytach na żądanie. Największy koszt pozostaje w czacie, Guess the Picture i ewentualnym real-time multiplayer.
- W każdej fazie monitorować Auth MAU, Requests, Egress, Realtime messages/connections, CPU DB, p95 RPC latency.

## Etapy PR / kryteria akceptacji
**PR 0 — fundament (ten PR):** dokumentacja, wersja demonstracyjna bez API, ikony SVG. Bez zmian działającej strony, SQL i routingu.
**PR 1 — UI only:** odświeżone okno LAN Party, desktop/mobile, zachowany cały oryginalny czat, brak nowych RPC. Testy istniejących wejść, mobilne 360/412/768/1280, klawiatura i focus.
**PR 2 — public profile:** dopiero po ustabilizowaniu #184/#189/#191; jeden RPC allowlist, generowane public_fren_id, fallback awatara, ukrywanie profilu. Testy cross-user, guest, block, nadużycia, nikogo nie da się odczytać przez UUID.
**PR 3 — frens:** prośby, akceptacja, odrzucanie, block, limity. Testy jednoczesnych Accept/Cancel, duplicate, IDOR, RLS i stanu anonimowego.
**PR 4 — Noticeboard:** statyczny manifest wydarzeń + bezpieczne linki do gier, Gazette i kalendarza, bez dynamicznego spamu.
**PR 5 — PepeGochi integration:** wyłącznie po publicznym snapshot API i realnym frontendzie; opt-in, cache; żadnych przedmiotów bez inwentarza na serwerze.

**Do każdego PR:** check_site.py, check_i18n.py, node --test tests/*.test.mjs, test mobile + desktop, test z zablokowanym CSP/bez sieci, prywatność i limit odpytywania. Backend dodatkowo lokalny Postgres, staging JWT/RLS, testy wyścigów, advisors. Żadnych migracji w produkcji bez ręcznej akceptacji.

## Ocena sukcesu (nie gamification)
- W pierwszych tygodniach zbierać: odsetek używających LAN Party, kliknięć publicznego paszportu, wysłanych i przyjętych zaproszeń, osób wracających w 7 dni; rozdzielić zalogowanych/niezalogowanych.
- Nie kolekcjonować prywatnych historii czy profilować wszystkich zdarzeń "na zapas".
- Po 4 tygodniach bez trwałych interakcji ograniczyć dalsze funkcje zamiast dokładać badge'e.

## Grafiki
Osiem **oryginalnych, edytowalnych SVG** w assets/ (48x48 viewBox, ostrzejsze piksele, bez osadzonych fontów). Wersja UI: preview.html. To starter pack, **nie zastępuje** zatwierdzonej grafiki awatarów z #191.

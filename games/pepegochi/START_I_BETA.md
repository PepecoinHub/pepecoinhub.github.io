# PepeGochi + Pond Quiz: stan, test bety, start i wycofanie

Stan na 2026-11-22 (A12: wycieczki, pocztówki, pamiętnik na serwerze, złota cytryna, sygnał o 3:00; wcześniej 2026-11-15). Kod jest na `main` (PR #334), **ukryty**: gra i żaba na pasku działają tylko z `?beta=gochi`,
a w Supabase nie ma jeszcze żadnej funkcji PepeGochi ani quizu. „Działa” poniżej znaczy: sprawdzone testami na
lokalnym PostgreSQL 16 i w przeglądarce Chromium z tym samym SQL. Na prawdziwym Supabase nic jeszcze nie działało.

## 1. Zrobione / zostało / blokery

| Obszar | Stan | Jak sprawdzone |
|---|---|---|
| Gra: jajo → kijanka (1. opieka) → młoda żaba (2 dni) → dorosła (7 dni) | zrobione | testy SQL + parzystość JS/SQL, przeglądarka |
| Reguła jajka (nie wyprowadza się, zegary od wyklucia) | zrobione | testy SQL, parzystość |
| Zaniedbanie 48 h / pakowanie 120 h / wyprowadzka 168 h, ratunek, rekonwalescencja | bez zmian w zasadach | testy SQL, przeglądarka |
| Wyprowadzka: list, losowy zabrany przedmiot (własność zostaje), nowa adopcja | zrobione | testy SQL, przeglądarka |
| Grafiki A1–A7, animacje opieki, wyklucia, chód | w grze | testy grafik, przeglądarka |
| Pomocnik na pasku: 16 póz, 9 animacji, lot z okna | zrobione | testy, przeglądarka 1280 i 360 px |
| Pond Quiz: 99 pytań, 1 dziennie, +1, pula na gracza, ranking | zrobione | testy SQL (dwie karty, północ UTC, strefy czasowe, zmiana konta) |
| 5 stempli quizu (1/10/25/50/99) + grafiki | zrobione, `planned` | testy SQL, atlas Paszportu |
| Próba na prawdziwym Supabase z logowaniem Discord | **zostało** | wymaga Twojej zgody (punkt 3) |
| A12: wycieczki 4 h / 12 h, pocztówki (10), pamiątki (9), album | zrobione, w becie | testy SQL, przeglądarka na prawdziwym SQL |
| A12: pamiętnik na serwerze (ten sam na telefonie i komputerze) | zrobione, w becie | testy SQL, przeglądarka |
| A12: złota cytryna (14 dni podlewania z rzędu) i sygnał 0098 o 3:00 | zrobione, w becie | testy SQL |
| A12: 6 stempli (Tourist, Globetrotter, Moon Frog, Golden Harvest, Dear Diary, Snoop) + sekret Night Signal | zrobione, `planned` | testy SQL, atlas Paszportu |
| Quiz po 99. pytaniu: gwiazdka i gratulacje od żaby, ★ przy 99 w rankingu | zrobione | przeglądarka |
| Wielka wyprawa 48 h | **wyłączona** | czeka na decyzję właściciela (potrzeby spadają w czasie wyprawy) |
| Start: zdjęcie bramki, 17 stempli `live` + sekret | **zostało** | dzień startu |

Brak brakujących grafik (A12a–c w grze; karta pamiętnika i pocztówka „???” już poprawione). Opcjonalnie: A9 (stara żaba), nie blokuje startu.

## 2. Ile wywołań serwera robi gracz (darmowy Supabase)

Policzone w przeglądarce na tym samym SQL. Żadnego odpytywania w tle, Realtime, crona ani timerów sieciowych.

| Chwila | Wywołania |
|---|---|
| Otwarcie PondOS (zalogowany Discord) | 1 × `gry_pepegochi_state` + 1 × `gry_quiz_today` (po wykluciu) |
| Otwarcie okna PEPEGOCHI.EXE | `gry_pepegochi_state` + `gry_pepegochi_room_state` (pierwszy raz także `room_initialize`) |
| Każda akcja opieki | 1 × `gry_pepegochi_action` (odpowiedź = pełny stan) |
| Odpowiedź w quizie / ranking | 1 × `gry_quiz_answer` / 1 × `gry_quiz_board` |
| Powrót do karty, fokus | najwyżej 1 odczyt stanu i 1 quizu na 5 minut |
| Wyprowadzka | 1 × `gry_pepegochi_settle` (raz), 1 × `gry_pepegochi_letter_read` |
| A12 przy otwarciu PondOS / pokoju | 1 × `gry_pepegochi_life` (wycieczka, pamiętnik, cytryna) |
| A12 akcje | wycieczka: 1 start + 1 pocztówka; podlewanie: 1 dziennie; pamiętnik: 1 otwarcie + 1 zapis po nowych stronach |

Typowy dzień gracza: około 8–14 wywołań. 100 graczy dziennie to około 1 000 wywołań.

## 3. Test bety (przed startem, za Twoją zgodą)

Wybrany wariant B (właściciel, 2026-11-15): SQL na produkcji, gra nadal tylko z `?beta=gochi`.

1. Supabase > SQL Editor > New query: wkleić CAŁY `games/supabase/deploy/PEPEGOCHI_BETA.sql` > Run.
   Jedna transakcja: przy błędzie nic się nie zmienia. Gra, pokój, wyprowadzka (Room-4) i quiz.
   **Żadnych stempli w becie**: pliki, które je przyznają, czekają na start, a w dniu startu dostarczą wszystko,
   co testerzy osiągnęli, z datą, kiedy to się stało.
2. Drugie zapytanie: prywatny `update_pond_quiz_questions.sql` (99 pytań, z zipa) > Run.
3. Sprawdzenie: zapytanie z komentarza na końcu `PEPEGOCHI_BETA.sql` (wszystkie kolumny `true`).
4. Wycofanie bety: punkt 5.

Scenariusz dla 2–3 testerów z Discordem (`pepecoinhub.com/meme/?beta=gochi`):
1. Żaba na pasku: przed adopcją jajo; klik otwiera PEPEGOCHI.EXE.
2. Adopcja, pierwsza opieka: wyklucie (animacja), stempel First Hatch w Paszporcie dopiero po starcie (teraz `planned`).
3. Po wykluciu na pasku „?”: pytanie dnia, odpowiedź, wynik, ranking. Drugie otwarcie tego samego dnia: to samo pytanie.
4. Druga karta przeglądarki: ta sama żaba i to samo pytanie; jedna odpowiedź liczy się raz.
5. Wylogowanie / inne konto: żaba i pytanie poprzedniego konta znikają od razu.
6. Kilka dni opieki: młoda żaba (2. dzień opieki), dorosła (7.).
7. Telefon (360 px): okno gry, przyciski, żaba na pasku nie zasłania Start.
8. Konto testowe bez opieki przez tydzień: ostrzeżenia, pakowanie, wyprowadzka, list, zabrany przedmiot, nowa adopcja.
9. A12: dorosła żaba z potrzebami ≥ 75: „Send on a trip” (4 h). Na pasku pocztówka, w pokoju liścik na łóżku.
   Po powrocie „Open the postcard”: pocztówka, czasem pamiątka, strona w pamiętniku, album „Trips”.
10. Pamiętnik: ta sama treść na telefonie i komputerze. „Save” przy stronie zapisuje obrazek.
11. Roślina w pokoju: podlewanie raz dziennie (UTC). Po 14 dniach z rzędu złota cytryna (na zawsze).
12. Telewizor o 3:00 czasu lokalnego: szum i liczby 0098 (sekret Night Signal po starcie).

## 4. Lista kroków startu

0. Beta A12: jeszcze raz cały `PEPEGOCHI_BETA.sql` (teraz zawiera też `update_pepegochi_life.sql`; bezpieczny do
   ponownego uruchomienia). Żadnych stempli: `passport_award()` na produkcji ich jeszcze nie zna.
1. Po becie (B) zostają pliki stempli: `update_pepegochi_passport.sql`, `update_pepegochi_rewards.sql`, funkcja
   `games.passport_award` z `update_passport_awards.sql` (zna stemple quizu i A12), jeszcze raz `update_pond_quiz.sql`
   i `update_pepegochi_life.sql` (dostarczają zaległe stemple z datami). Claude przygotuje je jako jeden plik do wklejenia.
2. Sprawdzenie: `select count(*) from games.quiz_questions where active;` = 99.
3. Test bety (punkt 3) na produkcji z `?beta=gochi`.
4. Release PR (Claude przygotuje): 17 stempli (6 PepeGochi, 6 A12, 5 quizu) i sekret Night Signal `live` w
   `passport-catalog.json`, bramka `GOCHI` włączona dla wszystkich, bez „PEPEGOCHI (local test)”. Scalenie = start.
5. Po starcie: pierwsze 24 h obserwować Supabase (zużycie, błędy w logach).

## 5. Wycofanie

- Frontend: przywrócić bramkę (revert release PR). Gra znika z PondOS, dane zostają.
- Serwer, natychmiast i bez utraty danych (zatrzymuje grę i quiz, nic nie kasuje):

```sql
revoke execute on function public.gry_pepegochi_state(), public.gry_pepegochi_adopt(text),
  public.gry_pepegochi_action(text), public.gry_pepegochi_letter_read(), public.gry_pepegochi_settle(),
  public.gry_pepegochi_room_state(), public.gry_pepegochi_room_initialize(),
  public.gry_pepegochi_room_place(uuid, text, bigint), public.gry_pepegochi_room_unplace(text, bigint),
  public.gry_quiz_today(), public.gry_quiz_answer(integer), public.gry_quiz_board(),
  public.gry_pepegochi_life(), public.gry_pepegochi_trip_start(text, text), public.gry_pepegochi_trip_claim(),
  public.gry_pepegochi_water(), public.gry_pepegochi_tv_signal(integer), public.gry_pepegochi_diary_open(integer),
  public.gry_pepegochi_diary_save(jsonb) from authenticated, anon;
```

- Przywrócenie: uruchomić te same pliki jeszcze raz (wszystkie są bezpieczne do ponownego uruchomienia).
- Stempli nie cofamy: przyznany stempel zostaje (tak działa cały Paszport).

## 6. Po 99. pytaniu (Keeper of the Pond)

- Serwer daje stempel Keeper of the Pond (`quiz_99`). Następnego dnia żaba pokazuje raz gwiazdkę ★ z gratulacjami,
  potem quiz odpoczywa. W rankingu przy 99 punktach jest ★.
- Ranga na Discordzie Pepecoin: na stronie nie ma bota Discorda, więc rangę nadaje admin ręcznie. Lista Keeperów
  (Supabase > SQL Editor):

```sql
select b.earned_at, games.discord_identity(b.user_id)->>'name' as discord_name,
       games.discord_identity(b.user_id)->>'id' as discord_id
from games.passport_badges b where b.badge_id = 'quiz_99' order by b.earned_at;
```

- Później można to zautomatyzować botem (osobny projekt, wymaga tokenu bota na serwerze, nie na stronie).

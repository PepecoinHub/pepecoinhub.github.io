# PepeGochi + Pond Quiz: stan, test bety, start i wycofanie

Stan na 2026-11-15. Kod jest na `main` (PR #334), **ukryty**: gra i żaba na pasku działają tylko z `?beta=gochi`,
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
| Start: zdjęcie bramki, 10 stempli `live` | **zostało** | dzień startu |

Brak brakujących grafik. Opcjonalnie: A9 (stara żaba), nie blokuje startu.

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

Typowy dzień gracza: około 6–10 wywołań. 100 graczy dziennie to około 1 000 wywołań.

## 3. Test bety (przed startem, za Twoją zgodą)

Wariant A, bezpieczniejszy: osobny, darmowy projekt Supabase do testów (ten sam `schema.sql` + pliki z punktu 4),
a strona testowa wskazuje na niego. Wariant B: pliki SQL na produkcji, gra nadal tylko z `?beta=gochi`
(nikt bez linku nie trafi do gry, ale funkcje istnieją na serwerze).

Scenariusz dla 2–3 testerów z Discordem (`pepecoinhub.com/meme/?beta=gochi`):
1. Żaba na pasku: przed adopcją jajo; klik otwiera PEPEGOCHI.EXE.
2. Adopcja, pierwsza opieka: wyklucie (animacja), stempel First Hatch w Paszporcie dopiero po starcie (teraz `planned`).
3. Po wykluciu na pasku „?”: pytanie dnia, odpowiedź, wynik, ranking. Drugie otwarcie tego samego dnia: to samo pytanie.
4. Druga karta przeglądarki: ta sama żaba i to samo pytanie; jedna odpowiedź liczy się raz.
5. Wylogowanie / inne konto: żaba i pytanie poprzedniego konta znikają od razu.
6. Kilka dni opieki: młoda żaba (2. dzień opieki), dorosła (7.).
7. Telefon (360 px): okno gry, przyciski, żaba na pasku nie zasłania Start.
8. Konto testowe bez opieki przez tydzień: ostrzeżenia, pakowanie, wyprowadzka, list, zabrany przedmiot, nowa adopcja.

## 4. Lista kroków startu

1. Supabase > SQL Editor, w tej kolejności (`games/supabase/deploy/RUN_ORDER.md`):
   `update_pepegochi_v2.sql`, `update_pepegochi_passport.sql`, `update_pepegochi_room_v1.sql`,
   `update_pepegochi_rewards.sql`, `update_pepegochi_room_departure.sql`, `update_passport_awards.sql` (jeszcze raz),
   `update_pond_quiz.sql`, prywatny `update_pond_quiz_questions.sql` (z zipa właściciela).
2. Sprawdzenie: `select count(*) from games.quiz_questions where active;` = 99.
3. Test bety (punkt 3) na produkcji z `?beta=gochi`.
4. Release PR (Claude przygotuje): 10 stempli (5 PepeGochi + 5 quizu) `live` w `passport-catalog.json`, bramka `GOCHI`
   włączona dla wszystkich, nowe wersje plików. Scalenie = start.
5. Po starcie: pierwsze 24 h obserwować Supabase (zużycie, błędy w logach).

## 5. Wycofanie

- Frontend: przywrócić bramkę (revert release PR). Gra znika z PondOS, dane zostają.
- Serwer, natychmiast i bez utraty danych (zatrzymuje grę i quiz, nic nie kasuje):

```sql
revoke execute on function public.gry_pepegochi_state(), public.gry_pepegochi_adopt(text),
  public.gry_pepegochi_action(text), public.gry_pepegochi_letter_read(), public.gry_pepegochi_settle(),
  public.gry_pepegochi_room_state(), public.gry_pepegochi_room_initialize(),
  public.gry_pepegochi_room_place(uuid, text, bigint), public.gry_pepegochi_room_unplace(text, bigint),
  public.gry_quiz_today(), public.gry_quiz_answer(integer), public.gry_quiz_board() from authenticated, anon;
```

- Przywrócenie: uruchomić te same pliki jeszcze raz (wszystkie są bezpieczne do ponownego uruchomienia).
- Stempli nie cofamy: przyznany stempel zostaje (tak działa cały Paszport).

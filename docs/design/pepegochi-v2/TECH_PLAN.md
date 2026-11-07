# PepeGochi 2.0 — przegląd backendu i plan techniczny

**Status:** raport design review (CLAUDE_HANDOFF.md, sekcja 3). Tylko dokument. Bez zmian w aplikacji, bez SQL na produkcji, bez publikacji.
**Data:** 2026-11-07.
**Podstawa:** `README.md`, `CLAUDE_HANDOFF.md`, `STORY_CONTENT.md` z PR #216; backend z PR #186 (`codex/pepegochi-secure-backend-v1`, commit `c26f2f7d`); `main` z Passportem z PR #212.
**Poza zakresem:** wygląd gry, postać, pokój, animacje (osobny etap z ChatGPT), realne wypłaty PEP, mnożnik 1,5×.

Wartości liczbowe w tym dokumencie (godziny, progi potrzeb, liczba dni) to **kandydaci do playtestu**, nie decyzje. Lista decyzji dla właściciela jest w sekcji 14.

---

## 0. Najważniejsze wnioski

1. **Fundament bezpieczeństwa v1 jest dobry i warto go zachować**: tożsamość tylko z `auth.uid()` + Discord, brak grantów do tabel, blokada wiersza, czas serwera po blokadzie, limity akcji, ułamkowy spadek potrzeb. Potwierdziłem to na prawdziwym PostgreSQL 17, także przy 12 równoległych połączeniach (sekcja 1).
2. **Model danych v1 nie pozwala na wyprowadzkę.** `games.pepegochi_pets` ma klucz `user_id`, więc jeden zwierzak na zawsze, bez historii, bez statusu i bez konsekwencji. Po 30 dniach nieobecności żaba ma wszystkie potrzeby 0 i dalej przyjmuje karmienie. Potrzebny jest nowy model: wiele kolejnych żyć, najwyżej jedno aktywne.
3. **v1 nie jest wdrożone, Passport też nie.** Właściciel potwierdził to 2026-11-07, sprawdzając PH-games bez zmian. v2 to czysty schemat, bez migracji danych.
4. **Bridge z #186 trzeba wyrzucić, a nie poprawiać.** Przyznaje `certified_fren` za 100 dni opieki, z pominięciem `games.passport_award()`. Test pokazał też, że błąd zapisu stempla cofa całą akcję opieki, a ponowne uruchomienie bazowego SQL po cichu wyłącza bridge.
5. **„Dzień opieki” w v1 nie mierzy opieki.** Kliknięcie Rest przy energii 100 zmienia tylko nastrój o +5, a i tak daje dzień opieki. Proponuję dwa liczniki: dzień opieki (wzrost żaby) i dobry dzień opieki (prestiżowe stemple).
6. **Wyprowadzkę da się zrobić bez crona i bez zapisu przy odczycie.** Moment odejścia wynika z zapisanych znaczników czasu (najstarszy zegar potrzeby + 168 h, sekcja 5.2a), więc każde wywołanie liczy ten sam wynik. Zapis odejścia następuje raz, przy pierwszym wywołaniu zapisującym.
7. **Plan to 7 małych PR-ów przed wydaniem** (A1, A2, B1, B2, C, D, R). Pierwsze dwa to sam backend i testy na prawdziwym PostgreSQL.

---

## 1. Co sprawdziłem i jak

Wszystko lokalnie, w piaskownicy: jednorazowy PostgreSQL 17.11 (`embedded-postgres`) i PGlite. Żadne polecenie nie łączyło się z Supabase.

| Sprawdzenie | Wynik |
|---|---|
| `main`: `node --test tests/*.test.mjs` z prawdziwym PostgreSQL (`PASSPORT_PG_URL`) i PGlite (`YEET_PGLITE_MODULE`) | **92/92 pass**, 0 skip (w tym testy SQL Passportu, Avatar Makera, ankiet i YEET) |
| PR #186: `tests/pepegochi_backend.test.mjs` + `tests/pepegochi_postgres.integration.mjs` | **9/9 pass**. Test PGlite w opisie #186 był oznaczony jako niewykonany; tu przeszedł |
| PR #186 zainstalowany na `main` (schema + Passport + awards) i sprawdzony skryptem próbnym, 12 równoległych połączeń | wyniki niżej |

Wyniki skryptu próbnego dla v1 (skrypt jest tylko w piaskownicy; jego przypadki wchodzą do testów PR A1):

| Scenariusz | Wynik | Ocena |
|---|---|---|
| rola `anon` wywołuje `gry_pepegochi_state` | `permission denied` | OK |
| konto bez tożsamości / tylko e-mail → adopt | `Discord sign-in required` | OK |
| `authenticated`: UPDATE na tabeli, EXECUTE na `pepegochi_snapshot` i hooku | brak uprawnień | OK |
| 12 równoległych `adopt` jednego konta | 1 wiersz | OK |
| 12 równoległych `feed` | 1 przyjęty, `actions_today = 1` | OK |
| `gry_pepegochi_state()` w transakcji READ ONLY | działa (odczyt naprawdę nic nie zapisuje) | OK |
| `rest` przy energii 100 | przyjęty, **daje dzień opieki** | problem dla v2 |
| 30 dni nieobecności | potrzeby 0/0/0/0, brak pola statusu, `feed` przyjęty normalnie | brak konsekwencji |
| 100. dzień opieki z bridge | `certified_fren` przyznany z opisem „100 distinct days of signed-in PondOS activity” przy **0** dni w `passport_days` | konflikt |
| `games.passport_award(u, 'certified_fren')` | `Unknown passport stamp` (bridge omija jedyną ścieżkę przyznawania) | konflikt |
| błąd zapisu stempla w 100. dniu (wymuszony triggerem) | **cała akcja odrzucona**, `care_days` zostaje 99 | błąd |
| ponowne uruchomienie `update_pepegochi_v1.sql` po bridge | hook wraca do no-op, 100. dzień nie daje stempla | kruche |
| imiona `Żabka`, `Frеn` (cyrylickie „е”) | przyjęte | OK dla prywatnego imienia, do moderacji jeśli imię będzie publiczne |
| `a`, 19 znaków, znak zerowej szerokości, `<b>x</b>` | odrzucone | OK |

---

## 2. Obecny backend v1 (PR #186): co zostaje, co się zmienia

### Zachowuję bez zmian
- Wzorzec `public.gry_*` + `security definer` + `set search_path = ''` + `revoke all` / `grant execute to authenticated`.
- Tożsamość wyłącznie z `auth.uid()` i `games.discord_identity()`. Żadne RPC nie przyjmuje `user_id`, statystyk, czasu, liczników ani ID stempla.
- Tabele w prywatnym schemacie `games`, RLS włączone, zero grantów dla klienta.
- Blokada `for update`, a czas `clock_timestamp()` dopiero po blokadzie.
- Cztery akcje (`feed`, `clean`, `play`, `rest`), ich efekty, cooldowny 30/20/45/60 min, odstęp 2 s, limit 12 przyjętych akcji na dzień UTC.
- Potrzeby jako `numeric(7,4)`, spadek 20/15/18/10 na dobę, zaokrąglenie tylko w odpowiedzi dla UI.
- Etapy: tadpole 0–1 dni opieki, froglet 2–6, adult 7+ (zgodne ze stemplami `little_fren` i `grown_fren`).
- Brak crona, Realtime, heartbeatu i logu kliknięć.

### Zmieniam
| v1 | v2 | Powód |
|---|---|---|
| `pepegochi_pets`, PK `user_id` | `pepegochi_owners` (1 wiersz na konto) + `pepegochi_lives` (1 wiersz na życie, najwyżej 1 aktywne) | kolejne życia, historia |
| brak statusu | status pochodny od czasu: healthy / neglected / packing / departed, plus recovering | konsekwencje zaniedbania |
| każda przyjęta akcja = dzień opieki | liczy się tylko **sensowna** akcja (potrzeba docelowa < 90 przed akcją); akcja przy potrzebie ≥ 90 jest odrzucana bez zapisu | „Rest przy 100” nie jest opieką |
| jeden licznik `care_days` | `care_days` (wzrost) + `good_days` i seria dobrych dni (prestiż) | stemple 30/100 dni nie mogą być za samo kliknięcie |
| hook no-op nadpisywany przez bridge | hook tworzony tylko jeśli nie istnieje; wywołanie w `begin … exception when others then raise warning` | błąd stempla nie psuje gry; ponowne uruchomienie nie kasuje integracji |
| bridge `certified_fren` | usunięty; stemple PepeGochi tylko przez `games.passport_award()` | zasady Passportu |
| test PGlite | testy na prawdziwym PostgreSQL przez istniejący harness `PASSPORT_PG_URL` / `PASSPORT_PG_MODULE`, z wieloma połączeniami | spójność z resztą repo, test równoległości |

Uwaga o nazwach: w `schema.sql` istnieje już tabela `games.owners` (inna funkcja). Wszystkie nowe obiekty mają prefiks `pepegochi_`.

---

## 3. Konflikty z osiągnięciami

| # | Konflikt | Gdzie | Propozycja |
|---|---|---|---|
| K1 | Bridge #186 przyznaje `certified_fren` za 100 dni PepeGochi. Katalog i decyzje z 2026-11-06 mówią: 100 różnych dni aktywności w PondOS. | `update_pepegochi_passport_bridge.sql` | Nie przenosić bridge do v2. `certified_fren` zostaje `planned` i zarezerwowany. Jeśli kiedyś powstanie, to z `games.passport_days` w osobnym PR spoza PepeGochi. |
| K2 | Bridge wpisuje do `passport_badges` bezpośrednio, z pominięciem `games.passport_award()` (lista dozwolonych ID + kontrola Discord). | jw. | Każdy stempel PepeGochi przez `passport_award()`. |
| K3 | `passport_award()` ma zaszytą listę 19 ID. Stemple PepeGochi wymagają jej rozszerzenia. | `update_passport_awards.sql` | **Wariant 1** (jeśli plik nie jest jeszcze na produkcji): dopisać ID stempli PepeGochi w tym pliku i rozszerzyć test „każde dozwolone ID jest gdzieś przyznawane” na plik PepeGochi. **Wariant 2**: plik PepeGochi nadpisuje `passport_award()` pełną listą; wtedy ponowne uruchomienie pliku Passportu wyłącza stemple PepeGochi (ta sama pułapka co w #186), więc potrzebny test i adnotacja o kolejności. Rekomenduję wariant 1. |
| K4 | `good_parent`: w katalogu „Provide care on 30 distinct days”. README chce 30 dni **dobrej** opieki w jednym życiu. | `passport-catalog.json` | Jawna zmiana opisu w PR D, razem z wpisem w pliku decyzji. Bez cichej zmiany reguły. |
| K5 | `perfect_parent` („Complete a full month of good care”) nie różni się od nowego `good_parent`. | jw. | Zostaje `???`, dopóki nie zapadnie decyzja o wyzwaniu Fren Guardian (sekcja 10). Jeśli Guardian powstanie, to on jest `perfect_parent`. |
| K6 | Nagroda za 100 dni z jednym zwierzakiem nie ma ID. | — | Nowy stempel PepeGochi, roboczo `best_fren_forever` „Best Fren Forever”: 100 dobrych dni opieki w jednym życiu. Nazwa i reguła do decyzji. |
| K7 | „It's Not Me, It's You” nie może nagradzać zaniedbania ani przechodzić przez `gry_passport_discover(text)` (to API klient może wywołać sam). | — | Zapis w historii zwierzaka (`summary.first_departed_at` w stanie, liczony z żyć), nie stempel. Pokazywany w Pet History. |
| K8 | Katalog i lista dozwolonych ID muszą się zgadzać (test w `tests/passport-awards.test.mjs`). Jeśli PepeGochi stemple będą `live`, a gra ukryta, Passport pokaże stemple nie do zdobycia. | katalog | Zmiana statusu `first_hatch`, `little_fren`, `grown_fren` na `live` dopiero w PR wydania (R), razem z rozszerzeniem listy. |
| K9 | `gry_passport_state()` ma pole `'care_days', null`, a wcześniejsza wersja #186 chciała zmieniać tę funkcję. | `update_passport_awards.sql` | Nie ruszać `gry_passport_state()`. Karta PepeGochi w Passporcie wywołuje osobno `gry_pepegochi_state()` (1 dodatkowe RPC przy otwarciu Passportu, tylko przy włączonej becie PepeGochi). Zgodne z zasadą „if it works, don't touch it”. |
| K10 | YEET zapisuje „Moon Rock” w localStorage pod kluczem `pepegachi-moon-rock-v1`. | `docs/games/js/yeet.mjs` | Nie importować tego do inwentarza PepeGochi. Moon Rock zostaje `planned` do czasu serwerowego inwentarza (PR E). |
| K11 | Przyszłe stemple wymagają backfillu z istniejących danych (zasada Passportu). | decyzje 2026-11-06 | PR C zawiera backfill `first_hatch` / `little_fren` / `grown_fren` z `pepegochi_lives` przez `passport_award()`. Na pustej bazie to no-op, ale jest i jest testowany. |

---

## 4. Docelowy model danych

Szkic z etapu przeglądu. **Zaimplementowana wersja jest w `games/supabase/update_pepegochi_v2.sql` (PR #218).** Różnice względem szkicu:
- `pepegochi_owners` ma tylko `user_id` i `created_at`, bo podsumowanie jest liczone z żyć przy odczycie;
- zamiast `last_care_at` / `protected_until` są zegary potrzeb (`hunger_due_at` …) oraz `rescue_pending` i `recovery_days_left`;
- doszła tabela `pepegochi_milestones`;
- kolumny dobrych dni dojdą w A2.

Wszystko w schemacie `games`, RLS włączone, `revoke all … from public, anon, authenticated`.

```sql
-- 1 wiersz na konto: cel blokady przy adopcji/odejściu + podsumowanie, które nigdy nie znika przy odejściu
create table games.pepegochi_owners (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  lives_count        integer not null default 0,     -- ile razy adoptowano
  departures         integer not null default 0,
  longest_life_days  integer not null default 0,     -- "Longest Friendship" (zakończone życia)
  first_departed_at  timestamptz,                    -- wspomnienie "It's Not Me, It's You" (raz)
  created_at         timestamptz not null default clock_timestamp()
);

-- 1 wiersz na życie; po odejściu wiersz jest historią (nie kopiujemy go nigdzie)
create table games.pepegochi_lives (
  life_id        uuid primary key default gen_random_uuid(),
  user_id        uuid not null references games.pepegochi_owners(user_id) on delete cascade,
  generation     integer not null check (generation >= 1),
  pet_name       text not null check (/* jak w v1: 2-18 znaków [[:alnum:] _.-] */),
  rules_version  smallint not null default 2,
  adopted_at     timestamptz not null default clock_timestamp(),
  -- potrzeby jak w v1 (numeric(7,4)) + needs_at (= v1 updated_at)
  -- wzrost: care_days, last_care_day_utc
  -- jakość: good_days, last_good_day_utc, good_streak, best_good_streak, day_utc, day_kinds (bitmask akcji dnia)
  -- czas odejścia: last_care_at (ostatnia SENSOWNA akcja), protected_until (ochrona po migracji)
  -- rekonwalescencja: recovery_days_left smallint
  -- limity jak w v1: actions_today, last_action_at, last_feed_at, last_clean_at, last_play_at, last_rest_at
  -- podsumowanie pod przyszłe warianty listu: feeds, cleans, plays, rests (int; nie da się ich odtworzyć później)
  status         text not null default 'active' check (status in ('active', 'departed')),
  departed_at    timestamptz,       -- = obliczony moment odejścia, NIE czas zapisu
  letter_variant text,              -- MVP: 'classic'
  letter_seen_at timestamptz,
  unique (user_id, generation),
  check ((status = 'departed') = (departed_at is not null))
);
-- dokładnie jedno aktywne życie na konto, wymuszone przez bazę
create unique index pepegochi_one_active on games.pepegochi_lives(user_id) where status = 'active';
```

**Dlaczego tak, a nie tabela aktywna + tabela historii:** odejście to jeden `UPDATE` jednego wiersza, a `life_id` się nie zmienia. Przy dwóch tabelach odejście to `INSERT` + `DELETE` (dwa zapisy, ryzyko niespójności przy błędzie). Koszt wybranego wariantu: martwe kolumny limitów w zakończonych życiach (kilkadziesiąt bajtów).

**Kolejność blokad:** zawsze najpierw wiersz `pepegochi_owners`, potem aktywne życie. Ta sama kolejność w każdym RPC zapobiega zakleszczeniom między adopcją, akcją i odejściem.

**Przechowywanie:** wszystkie życia zostają w bazie (mały wiersz). Stan zwraca ostatnie 10 w historii. Usunięcie konta kasuje wszystko kaskadowo.

---

## 5. Stany i reguły

### 5.1 Parametry (wartości robocze do playtestu)

Właściciel zatwierdził je 2026-11-07 jako **wartości robocze, nie ostateczne zasady**. Wersja zaimplementowana w PR A1 (#218).

| Parametr | Wartość robocza | Skąd |
|---|---|---|
| Sensowna akcja | potrzeba docelowa < 90 przed akcją | nowe |
| Zegar potrzeby | rusza, gdy potrzeba spadnie poniżej 90; staje, gdy gracz się nią zajmie lub potrzeba wróci do ≥ 90 | A1, zamiast jednego zegara |
| Dzień opieki (wzrost) | ≥ 1 przyjęta akcja w dniu UTC | v1, z poprawką wyżej |
| Dobry dzień opieki | w dniu UTC ≥ 2 różne sensowne akcje i po tej, która spełnia warunek, wszystkie potrzeby ≥ **40** (decyzja właściciela 2026-11-07) | nowe, PR A2 |
| neglected | najbardziej zaniedbana potrzeba czeka ≥ 48 h | README 2.4 |
| packing („Your Fren is thinking of leaving”) | ≥ 120 h | README 2.4 |
| departed | ≥ 168 h | README 2.4 |
| Ratunek | po `packing`: zająć się każdą zaległą potrzebą | A1 |
| Rekonwalescencja | po ratunku: opieka w **1** późniejszy dzień UTC, w ciągu 72 h (decyzja właściciela) | README 2.3, A1 |
| Minimalna przerwa przed wizytą „następnego dnia” | **8 h** od ratunku (decyzja właściciela); wcześniejsza wizyta pomaga, ale nie kończy rekonwalescencji; gra pokazuje najwcześniejszy moment (`counts_from`) | A1 |
| Good Parent | 30 dobrych dni w jednym życiu, niekoniecznie z rzędu (decyzja robocza) | A2 |
| Etapy | tadpole 0–1, froglet 2–6, adult 7+ dni opieki | v1 |
| Cooldowny / limity | 30/20/45/60 min, 2 s, 12 na dzień UTC | v1 |

Wartości trafiają do jednej funkcji SQL (`games.pepegochi_rules()`), a stan zwraca je w polu `rules`. UI pokazuje graczowi dokładnie te liczby, których używa serwer, więc zmiana po playteście to jedna linijka.

Czy da się zrobić dobry dzień w 2–3 minuty: tak. Przy wizycie raz dziennie każda potrzeba przed sesją wynosi mniej więcej 70–85. Feed, Clean, Play i Rest są wtedy sensowne i można je kliknąć jedną po drugiej (każda akcja ma osobny cooldown), co daje dobry dzień. 12 kliknięć dziennie nie jest potrzebne.

Ryzyko do playtestu: gracz, który gra o 23:30 i 00:30 UTC, w drugiej sesji może nie mieć żadnej sensownej akcji (wszystko > 90). Dostanie dzień opieki dopiero, gdy potrzeby spadną. Jeśli to będzie przeszkadzać, podniesiemy próg do 95.

### 5.2 Statusy

`hungry`, `moody`, `dirty`, `tired` to etykiety potrzeb (np. potrzeba < 30), a nie etapy cyklu życia. Cykl życia:

```mermaid
stateDiagram-v2
  [*] --> healthy: adopcja
  healthy --> neglected: potrzeba czeka 48 h
  neglected --> healthy: zajęcie się zaległymi potrzebami
  neglected --> packing: 120 h
  packing --> recovering: ratunek, wszystkie zaległe potrzeby
  packing --> departed: 168 h
  recovering --> healthy: opieka w późniejszy dzień UTC
  recovering --> departed: 72 h bez opieki
  departed --> [*]: list przeczytany, nowa adopcja = nowe życie
```

Pierwszeństwo przy wyświetlaniu: departed > packing > neglected > recovering > etykiety potrzeb > healthy. Status zależy od najbardziej zaniedbanej potrzeby. W trakcie rekonwalescencji `packing` oznacza 48 h bez opieki.

### 5.2a System ratowania (decyzje właściciela 2026-11-07)

Właściciel ustalił:
- jedno karmienie co 6 dni nie może utrzymywać żaby;
- **rekonwalescencja trwa 1 dzień**, żeby gracze grający tylko w sobotę i niedzielę mogli zachować żabę;
- ratunku nie wolno upraszczać: trzeba zająć się wszystkimi zaległymi potrzebami i wrócić innego dnia, samo karmienie nie wystarcza;
- utrzymanie żaby i prestiżowe stemple za dobrą opiekę to dwa różne wyzwania.

Jeden zegar od ostatniej akcji tego nie zapewniał: każde kliknięcie odnawiało 7 dni. W A1 każda potrzeba ma własny zegar. Wyniki symulatora na prawdziwym SQL (PR #218, testy R i W):

| Wizyty | Wynik (1 dzień) |
|---|---|
| codziennie / co 4 dni / pt + sob + nd | zostaje |
| sob + nd: 18:00, 08:00/21:00, 21:00/08:00, przez północ UTC, losowe godziny | zostaje, co tydzień ratunek i rekonwalescencja |
| weekendy, tylko karmienie | 7. dnia |
| opuszczona sobota, niedziela 12:00, bez wizyty w tygodniu | środa (22. dzień, `recovery`) |
| to samo + poniedziałek | zostaje |
| opuszczona sobota, niedziela 19:00 (ponad 7 dni) | już po wyprowadzce |
| jedno karmienie co 6 dni / tylko karmienie codziennie | 7. dnia |
| pełna wizyta co 6 dni | 9. dnia |

**`recovery_min_gap_h` = 8 (decyzja 2026-11-07).** Rekonwalescencję kończy opieka w późniejszym dniu UTC, co najmniej 8 h po ratunku, więc sesja sob 23:30 + nd 00:30 jest jedną wizytą. Wcześniejsza wizyta jest przyjęta i poprawia potrzeby, ale nie kończy rekonwalescencji. Sob 21:00 + nd 08:00 (11 h) dalej zachowuje żabę.

Rekonwalescencja zaczyna się dopiero po `packing` (120 h), a nie od 48 h. Przy 48 h gracz wracający co 4 dni traciłby żabę mimo regularnych wizyt.

### 5.3 Odejście bez crona

- `departs_at = najstarszy zegar potrzeby + 168 h`; w trakcie rekonwalescencji wcześniejsze z tego i `ostatnia opieka + 72 h`.
- `gry_pepegochi_state()` zostaje tylko do odczytu. Jeśli `teraz >= departs_at`, zwraca `status: 'departed'` i `departure_saved: false`.
- Pierwsze wywołanie zapisujące (akcja, przeczytanie listu, adopcja) wykonuje pod blokadą:
  `update … set status = 'departed', departed_at = departs_at … where life_id = … and status = 'active'`.
  Warunek `status = 'active'` sprawia, że drugi zapis nic nie zmienia. `departed_at` to obliczony moment, więc nie zależy od tego, czy gracz wróci po 8 dniach czy po roku.
- Liczba odejść, najdłuższa przyjaźń i data pierwszego odejścia są liczone z wierszy żyć przy odczycie, więc nie ma osobnych liczników do zsynchronizowania.
- Akcja po progu nie jest stosowana. Odpowiedź to stan „departed”. Retry daje ten sam wynik. Nie ma RPC, które przywraca `active`.
- Przedmioty, stemple, awatary i sekrety nie są dotykane w ogóle. Kod odejścia nie ma żadnego `delete`. „P.S. I took the TV” to tylko scena w UI.

### 5.4 List, historia, ponowna adopcja

- Stan „departed” + `letter_seen_at is null` → UI pokazuje pusty pokój i GOODBYE.TXT (kanoniczny tekst ze STORY_CONTENT.md).
- `gry_pepegochi_letter_read()` (bez argumentów) zapisuje odejście, jeśli jeszcze nie jest zapisane, i ustawia `letter_seen_at`. Działa idempotentnie. Scena odejścia pokazuje się raz, list można potem otworzyć ponownie z historii.
- `gry_pepegochi_adopt(p_name)`:
  - aktywne życie istnieje → zwraca je (jak w v1, nic nowego nie powstaje);
  - poprzednie życie odeszło, ale list nieprzeczytany → błąd „Read the letter first”;
  - w przeciwnym razie nowe życie `generation + 1` i nowy `life_id`.
- Historia w stanie: imię, `adopted_at`, `departed_at`, dni razem, dni opieki, dobre dni, najdłuższa seria, „Left for a different pond”. Tylko dla właściciela.

---

## 6. Sama nieobecność czy nieobecność + potrzeby (model odejścia)

| | Model 1: czas od ostatniej sensownej opieki | Model 2: czas + skrajnie złe potrzeby |
|---|---|---|
| Reguła dla gracza | „Wróć przynajmniej raz na 7 dni” | „Wróć i dbaj, bo żaba odejdzie też przy złych potrzebach” |
| Przewidywalność | wysoka, jedna liczba, odliczanie można pokazać | niższa: gracz, który karmi, ale nie myje, może stracić żabę mimo wizyt |
| Złożoność SQL i testów | mała | duża (całkowanie potrzeb w czasie bez crona) |
| Bot klikający raz na 6 dni | żaba zostaje, ale bez dobrych dni, stale neglected/recovering, bez prestiżowych stempli | odejście możliwe |
| Wartość dodana | — | niewielka: po 5 dniach głód i tak spada do 0, więc potrzeby pokrywają się z czasem |

**Wybrane w A1: Model 1 z osobnym zegarem dla każdej potrzeby** (sekcja 5.2a). Zostaje przewidywalny („zajmij się każdą potrzebą przynajmniej raz w tygodniu”), a jedno karmienie co 6 dni już nie wystarcza. Prestiżowe stemple dalej wymagają dobrych dni (PR A2/D).

---

## 7. Kontrakt RPC v2

Wszystkie bez `user_id`, tylko Discord, `security definer`, `search_path = ''`, EXECUTE tylko dla `authenticated`.

| RPC | Argumenty | Zapis | Zwraca |
|---|---|---|---|
| `gry_pepegochi_state()` | — | **nigdy** | `version: 2`, aktualne życie lub stan odejścia, `departs_at`, `rules`, historia (≤ 10), podsumowanie właściciela, następny kamień milowy |
| `gry_pepegochi_adopt(p_name text)` | imię | raz na życie | pełny stan |
| `gry_pepegochi_action(p_action text)` | `feed` / `clean` / `play` / `rest` | tylko przy przyjętej akcji (lub zapis odejścia) | pełny stan |
| `gry_pepegochi_letter_read()` | — | raz | pełny stan |

Nazwy i argumenty trzech pierwszych są takie same jak w v1. Zmienia się kształt odpowiedzi (`version: 2`). PR D doda `gry_pepegochi_guardian_start()` tylko przy wariancie 2 wyzwania.

Wewnętrzne (bez EXECUTE dla klientów): `games.pepegochi_rules()`, `games.pepegochi_snapshot(…)`, `games.pepegochi_settle(…)`, `games.pepegochi_passport_event(user, event, value)`.

---

## 8. Diagramy sekwencji i kolejność migracji

### 8.1 Otwarcie gry

```mermaid
sequenceDiagram
  participant UI as PondOS okno PepeGochi
  participant RPC as gry_pepegochi_state
  participant DB as games.pepegochi_*
  UI->>RPC: {}
  RPC->>RPC: auth.uid() + discord_identity
  RPC->>DB: SELECT owner, aktywne zycie, 10 ostatnich zyc
  RPC->>RPC: potrzeby, status, departs_at (wyliczone)
  RPC-->>UI: pelny stan (zero zapisow)
  Note over UI: UI animuje spadek potrzeb lokalnie, bez pollingu
```

### 8.2 Akcja opieki

```mermaid
sequenceDiagram
  participant UI as PondOS okno PepeGochi
  participant RPC as gry_pepegochi_action
  participant DB as games.pepegochi_*
  participant PP as games.passport_award
  UI->>RPC: {p_action: feed}
  RPC->>RPC: auth.uid() + discord_identity + allowlist akcji
  RPC->>DB: FOR UPDATE owner, potem aktywne zycie
  RPC->>RPC: t = clock_timestamp() po blokadzie
  alt t >= departs_at
    RPC->>DB: status departed, departed_at = departs_at (raz)
    RPC-->>UI: stan departed, akcja nie zapisana
  else przed progiem
    RPC->>RPC: 2 s, cooldown, limit 12, potrzeba < 90
    RPC->>DB: UPDATE zycia (potrzeby, zegary potrzeb, liczniki, ratunek)
    opt nowy dzien opieki lub kamien milowy
      RPC->>PP: pepegochi_passport_event, blad = tylko warning
    end
    RPC-->>UI: pelny stan
  end
```

### 8.3 Powrót po odejściu i nowa adopcja

```mermaid
sequenceDiagram
  participant UI as PondOS okno PepeGochi
  participant S as gry_pepegochi_state
  participant L as gry_pepegochi_letter_read
  participant A as gry_pepegochi_adopt
  UI->>S: {}
  S-->>UI: status departed, departure_saved false, list nieprzeczytany
  Note over UI: pusty pokoj + GOODBYE.TXT
  UI->>L: {} (klik w list)
  L-->>UI: odejscie zapisane raz, letter_seen_at
  UI->>A: {p_name: nowe imie}
  A-->>UI: nowe zycie, generation + 1
  Note over UI,A: druga karta lub retry dostaje to samo zycie, bez duplikatu
```

### 8.4 Kolejność migracji

```mermaid
flowchart LR
  S[schema.sql<br/>juz na produkcji] --> P1[update_fren_passport.sql]
  P1 --> P2[update_fren_avatar.sql]
  P2 --> P3[update_passport_awards.sql<br/>dzien startu Passportu]
  S --> G[update_pepegochi_v2.sql<br/>PR A1 + A2]
  P3 --> B[update_pepegochi_passport.sql<br/>PR C]
  G --> B
  B --> D[update_pepegochi_good_parent.sql<br/>PR D]
```

- `update_pepegochi_v2.sql` nie zależy od Passportu. Tworzy hook `pepegochi_passport_event` jako no-op **tylko wtedy, gdy nie istnieje** (`to_regprocedure`), więc ponowne uruchomienie nie wyłącza integracji.
- `update_pepegochi_passport.sql` wymaga obu poprzednich i kończy się błędem, jeśli ich brakuje.
- Każdy plik można uruchomić dwa razy (test).
- Na produkcji nic nie jest uruchamiane bez Twojej wyraźnej zgody, w kolejności z diagramu.

---

## 9. Migracja i zgodność

- **Potwierdzone przez właściciela 2026-11-07:** w PH-games nie ma tabel ani funkcji PepeGochi i Fren Passport. v2 to czysty schemat, bez konwersji danych.
- Zabezpieczenie: migracja odmawia działania, jeśli istnieje tabela v1 `games.pepegochi_pets` (test H2), żeby nikt przypadkiem nie zostawił starych żab bez opieki.
- Gdyby kiedyś trzeba było przenieść żaby z innej bazy, zasada z README 2.6 nadal obowiązuje: ochrona przez 7 dni i brak natychmiastowej wyprowadzki. Wymaga to osobnej, ręcznej migracji.

---

## 10. Wyzwanie 30 dni: dwa warianty

| | Wariant 1: Good Parent jako licznik | Wariant 2: Fren Guardian (opt-in, okno 33 dni) |
|---|---|---|
| Reguła | 30 dobrych dni opieki w jednym życiu, bez limitu czasu (życie i tak kończy się po 7 dniach nieobecności) | gracz klika „Start”; sukces = 30 dobrych dni w 33 kolejnych dniach UTC; porażka = 4. opuszczony dzień albo odejście |
| Stan w bazie | `good_days` z PR A2, nic więcej | 3 kolumny na życiu (`guardian_start`, `guardian_good`, `guardian_attempts`), okno stałe od startu, więc bez mapy dni |
| Nowe RPC | 0 | 1 (`gry_pepegochi_guardian_start`) |
| Porażka liczona | nie ma porażki | leniwie: `dni w oknie − dobre dni > 3`, zapis przy następnym wywołaniu zapisującym |
| Bot raz na tydzień | 0 dobrych dni | 0 dobrych dni |
| Irytacja | niska; długi cel | wyższa; jeden zły tydzień = porażka (nie traci się innych stempli) |
| Zgodność z odejściem po 7 dniach | tak | tak, 3 dni wolne < 7 dni |
| Dodatkowe testy | ~4 | ~12 (granice okna, dzień startu, 4. pominięcie, restart, dwie karty, odejście w trakcie) |

**Rekomendacja:** Wariant 1 jako `good_parent` w PR D. Wariant 2 dopiero po playteście, jako `perfect_parent`. Wtedy dwa stemple mają różne, czytelne reguły (cierpliwość kontra intensywny miesiąc) i nie są duplikatem.

---

## 11. Fren Passport

| Stempel | Reguła | Kiedy | PR |
|---|---|---|---|
| `first_hatch` | pierwsza adopcja na koncie | adopt, `generation = 1` | C |
| `little_fren` | 2. dzień opieki w dowolnym życiu | akcja | C |
| `grown_fren` | 7. dzień opieki w dowolnym życiu | akcja | C |
| `good_parent` | 30 dobrych dni w jednym życiu (wariant 1) | akcja | D |
| `best_fren_forever` (roboczo) | 100 dobrych dni w jednym życiu | akcja | D, po decyzji |
| `perfect_parent` | Fren Guardian, jeśli zatwierdzony | akcja | później |

- Każdy stempel raz na konto (klucz `user_id + badge_id`). Kolejne życia nie dają duplikatów.
- Przyznawanie tylko przez `games.passport_award()` (kontrola Discord + lista ID). Hook odizolowany.
- **Odzyskiwanie należnych stempli (decyzja właściciela 2026-11-07, zrobione w A1):**
  - Kamienie milowe (`first_adoption`, `froglet`, `adult`) zapisują się w `games.pepegochi_milestones` w tej samej transakcji co opieka.
  - Hook Passportu jest odizolowany. Jeśli zawiedzie, opieka zostaje, a wiersz czeka z `synced_at = null`. Każda kolejna przyjęta akcja próbuje ponownie. Migracja PR C może przyznać wszystkie zaległe naraz.
  - Hook no-op jest tworzony tylko wtedy, gdy nie istnieje, więc ponowne uruchomienie A1 nie wyłącza mostu z PR C.
- Karta w Passport Overview: imię, etap, status, dzień życia, następny kamień milowy. Po odejściu „Former Fren / Adopt a new egg”. Dane z `gry_pepegochi_state()`.
- Stats: „Former Frens”, „Longest Friendship”, dni opieki, liczba odejść. Tylko własne dane.
- Bez zmian w `gry_passport_state()` (K9).

---

## 12. Budżet zapytań

| Sytuacja | RPC | Zapisy |
|---|---|---|
| Otwarcie okna PepeGochi | 1 | 0 |
| Przyjęta akcja | 1 | 1–2 `UPDATE` (+ ≤ 1 `INSERT` stempla w dniu kamienia milowego) |
| Odrzucona akcja (cooldown, limit, „nie potrzebuje”, odeszła) | 1 | 0 |
| Przeczytanie listu / adopcja | 1 | 1–2, raz na życie |
| Okno zminimalizowane / karta w tle | 0 | 0 |
| Powrót do karty po > 15 min w tle | ≤ 1 | 0 |
| Otwarcie Passportu z włączoną betą PepeGochi | +1 | 0 |

- **Na aktywnego gracza na minutę:** najwyżej ~5 RPC w pierwszej minucie sesji (otwarcie + po jednej akcji każdego rodzaju), potem ~0, bo cooldowny wynoszą 20–60 min, a UI blokuje przyciski w trakcie cooldownu.
- **Na dobę:** typowo ~6 RPC, maksymalnie 12 przyjętych zapisów (limit z v1).
- Przykład skali: 1000 graczy dziennie × 6 RPC ≈ 6000 RPC/dobę ≈ 0,07 RPC/s średnio.
- Każde RPC: wyszukanie tożsamości Discord + odczyt po kluczu głównym / indeksie częściowym. Brak skanów.
- Miejsce: ~400 B na życie z indeksami; 1000 kont × 3 życia ≈ 1,2 MB. Bez tabeli logów.
- Bez zmian kosztów Realtime: nowy kanał nie powstaje.
- Zastrzeżenie z #186 nadal obowiązuje: limit 12 ogranicza przyjęte zapisy, a nie zalew odrzuconych żądań.

---

## 13. Plan testów

Testy SQL działają na prawdziwym PostgreSQL 15+ przez istniejący harness (`PASSPORT_PG_URL`, `PASSPORT_PG_MODULE`). Każdy przebieg ma własną, tymczasową bazę i wiele połączeń do testów równoległości.

Czas jest wirtualny: test i symulator podmieniają `games.pepegochi_clock()` we własnej bazie. W migracji ta funkcja to dokładnie `select clock_timestamp()`, co sprawdza test statyczny. Testy statyczne działają w CI bez zależności.

**Stan po A1 (#218):** A, B, C, D, E, F1, F5, R, M i H1–H3 zaimplementowane. Lokalnie 44/44 przypadki SQL i 11/11 statycznych.

**Do czasu osobnej zgody na wdrożenie:** testy tylko na lokalnej bazie lub w osobnym środowisku staging. Ukryta beta nie może wymagać zmian w produkcyjnym PH-games.

| ID | Przypadek | Oczekiwany wynik | PR |
|---|---|---|---|
| **Uwierzytelnianie i własność** ||||
| A1 | rola `anon` wywołuje każde `gry_pepegochi_*` | `permission denied` | A1 |
| A2 | anonimowy użytkownik Supabase / konto tylko e-mail | „Discord sign-in required”, zero zapisów | A1 |
| A3 | żadne publiczne RPC nie ma argumentu `user_id`, `life_id`, statystyk, czasu, ID stempla (statycznie + `pg_proc`) | brak | A1 |
| A4 | pełny scenariusz gracza A nie zmienia wierszy B (suma kontrolna), stan A nie zawiera historii B | izolacja | A1 |
| A5 | Discord odłączony po adopcji | wszystkie 4 RPC odrzucone, zero zapisów; zegar żaby biegnie dalej; po ponownym połączeniu ta sama żaba, a po tygodniu list | A1 |
| **Uprawnienia i higiena funkcji** ||||
| B1 | `has_table_privilege` dla `anon` / `authenticated` na wszystkich tabelach `pepegochi_*` | brak SELECT/INSERT/UPDATE/DELETE | A1 |
| B2 | wszystkie funkcje wewnętrzne `games.pepegochi_*` | brak EXECUTE dla klientów | A1 |
| B3 | publiczne RPC: `security definer` + `search_path=''` (`pg_proc.proconfig`) | tak | A1 |
| B4 | `gry_pepegochi_state()` w transakcji READ ONLY, także po progu odejścia | działa | A1 |
| B5 | imię: długość, znaki sterujące, zerowa szerokość, RTL override, 10 KB tekstu, NULL; akcja spoza listy | odrzucone bez zapisu | A1 |
| **Równoległość i idempotencja** ||||
| C1 | 12 równoległych `adopt` | 1 owner, 1 aktywne życie | A1 |
| C2 | 12 równoległych `feed` | 1 przyjęty, 1 dzień opieki | A1 |
| C3 | 12 równoległych `letter_read` po progu | 1 odejście z obliczonym `departed_at`, list przeczytany raz | A1 |
| C4 | `letter_read` i `adopt` z dwóch kart naraz | najwyżej 1 nowe życie | A1 |
| C5 | akcja tuż po progu równolegle ze `state` | akcja odrzucona jako departed, brak „wskrzeszenia” | A1 |
| C6 | retry `letter_read` / `adopt` po zerwanym połączeniu | ten sam wynik, bez duplikatów | A1 |
| **Czas i progi** ||||
| D1 | spadek potrzeb po 2 h, 24 h, 3 dniach (regresja v1) | ułamki zachowane | A1 |
| D2 | akcje 23:59:58 i 00:00:01 UTC / dwie akcje tego samego dnia | 2 dni / 1 dzień | A1 |
| D3 | 47:59 / 48:01 / 119:59 / 120:01 / 167:59 / 168:01 od najstarszego zegara potrzeby | healthy / neglected / neglected / packing / packing i wizyta ratuje / departed | A1 |
| D4 | odejście zapisane po 8 dniach i po 60 dniach | ten sam `departed_at` i powód w obu | A1 |
| D5 | strefa czasowa sesji `Pacific/Kiritimati` i `America/Adak` | wyniki identyczne jak w UTC | A1 |
| D6 | każde odrzucenie (cooldown, limit, 2 s, „nie potrzebuje”, departed) | wiersz bez zmian | A1 |
| **Cykl życia i historia** ||||
| E1 | stemple, przedmioty, awatar, sekrety przed i po odejściu | identyczne | A1 |
| E2 | po odejściu brak drogi do `status = 'active'`; nowa adopcja = nowy `life_id`, `generation + 1` | tak | A1 |
| E3 | adopcja przy aktywnej żabie / przy nieprzeczytanym liście | zwraca istniejącą / błąd „Read the letter first” | A1 |
| E4 | historia: 12 żyć w bazie, stan zwraca 10 najnowszych z poprawnymi liczbami | tak | A1 |
| E5 | drugie odejście | `former_frens = 2`, `first_departed_at` bez zmian | A1 |
| **Jakość opieki i farmienie** ||||
| F1 | akcja przy potrzebie ≥ 90 | odrzucona, nie przesuwa zegara odejścia ani dnia opieki | A1 |
| F2 → G8 | wizyty co 4 dni / pełna wizyta co 6 dni | ≤ 1 dobry dzień, brak `good_parent` | A2 (#221) |
| F3 → G1–G3 | reguła dobrego dnia; codziennie krótka wizyta | 2 rodzaje i potrzeby ≥ 40; 1 na dzień UTC; seria; 61 dni, Good Parent 29. dnia | A2 (#221) |
| G4 | sob + nd przez 20 tygodni: krótko / ok. godziny / dwie wizyty dziennie (przy ≥ 40) | 21 (32 tygodnie: 33, cel 202. dnia) / 41 (cel 103. dnia) / 41 | A2 (#221) |
| G5 | opieka rozdzielona północą UTC | najwyżej 1 dobry dzień na dzień UTC | A2 (#221) |
| G6 | ratunek i powrót < 8 h | wizyta pomaga, nie kończy rekonwalescencji | A2 (#221) |
| G7 | zaniedbanie, potem lepsza opieka | dobre dni wracają drugiego dnia opieki | A2 (#221) |
| G9 | dawne ≥ 50 / ≥ 30 / „opieka tego dnia” | 1 / 41 / 41 dla krótkich wizyt sob + nd; ≥ 30 i „opieka tego dnia” dają 16 przy wizytach co 4 dni (dlatego odrzucone) | A2 (#221) |
| G10 | Good Parent raz na konto, dobre dni w historii | tak | A2 (#221) |
| F5 | limit 12 i cooldowny (regresja v1) | bez zmian | A1 |
| **Ratowanie i rekonwalescencja (scenariusze symulatora)** ||||
| R1 | jedno karmienie co 6 dni | wyprowadzka 7. dnia | A1 |
| R2 | codziennie tylko karmienie | wyprowadzka 7. dnia | A1 |
| R3 | pełna wizyta co 6 dni | ratunek, potem pominięta rekonwalescencja, wyprowadzka 9. dnia | A1 |
| R4 | wizyta co 4 dni | zostaje, bywa neglected, nigdy packing | A1 |
| R5 | pt + sob + nd co tydzień | zostaje, co tydzień packing i recovering | A1 |
| R6 | tylko sob + nd | przy 1 dniu rekonwalescencji (decyzja): zostaje; przy 2 dniach: wyprowadzka | A1 |
| R7 | samo karmienie po `packing` / pełna wizyta | termin nie zaczyna nowego tygodnia / recovering, ten sam dzień UTC się nie liczy, następny dzień kończy | A1 |
| W1 | weekendy o różnych godzinach: 08:00/21:00, 21:00/08:00, 23:30/00:30, losowe przez 12 tygodni | zostaje, co tydzień ratunek | A1 |
| W2 | weekendy, tylko karmienie | wyprowadzka 7. dnia | A1 |
| W3 | opuszczona sobota: niedziela 12:00 bez wizyty w tygodniu / z poniedziałkiem / niedziela 19:00 | środa (`recovery`) / zostaje / już po wyprowadzce | A1 |
| W4 | ratunek przez północ UTC | 2 dni opieki; wizyta następnego dnia musi być w późniejszym dniu UTC | A1 |
| W5 | ratunek sob 23:30, powrót 00:30; potem 1 ms przed i po `counts_from` | 00:30 pomaga, ale nie kończy; kończy dopiero 8 h po ratunku | A1 |
| P | zgodność modelu JS z SQL: wszystkie scenariusze × 5 zestawów zasad, progi ±1 ms, przekroczenie 90, 300 losowych gier | 0 różnic w odpowiedziach, wierszach i kamieniach milowych (20 781 wywołań) | B1 |
| R8 | ratunek, potem 4 dni przerwy | wyprowadzka po 72 h (`recovery`) | A1 |
| R9 | codziennie przez 60 dni | zawsze healthy, 61 dni opieki, adult | A1 |
| R10 | 8 dni przerwy | wyprowadzka, list, nowe jajko, historia | A1 |
| **Kamienie milowe** ||||
| M1 | adopcja, 2. i 7. dzień opieki, potem drugie życie | `first_adoption`, `froglet`, `adult` raz na konto | A1 |
| M2 | hook Passportu rzuca błąd | opieka zapisana, warning, kamień milowy czeka, zapisy hooka cofnięte | A1 |
| M3 | hook naprawiony | następna przyjęta akcja doręcza wszystko; bez zaległości hook nie jest wołany | A1 |
| M4 | ponowne uruchomienie migracji A1 | hook zainstalowany później zostaje | A1 |
| **Passport** ||||
| G1 | pierwsza i druga adopcja | `first_hatch` raz | C |
| G2 | 2. i 7. dzień opieki w życiu 1, potem w życiu 2 | `little_fren`, `grown_fren` raz | C |
| G3 | kamień milowy czeka, a `passport_award()` dostaje konto bez Discorda (bezpośrednie wywołanie, bo RPC i tak odrzuca takie konto, A5) | brak stempla, kamień milowy dalej czeka; po ponownym połączeniu Discorda pierwsza przyjęta akcja doręcza stempel | C |
| G4 | wymuszony błąd zapisu stempla | akcja przyjęta, warning w logu (regresja z próby #186); zrobione w A1 jako M2 | A1, C |
| G5 | 100 dni opieki + statyczne wyszukanie | żadna ścieżka PepeGochi nie przyznaje `certified_fren` | C |
| G6 | ponowne uruchomienie migracji v2 po pliku Passportu | hook dalej działa (regresja z próby #186) | C |
| G7 | backfill uruchomiony dwa razy | te same wiersze | C |
| **Migracja i regresje** ||||
| H1 | każda migracja uruchomiona dwa razy | bez błędów, bez zmian danych | A1 |
| H2 | istnieje tabela v1 `games.pepegochi_pets` | migracja odmawia działania | A1 |
| H3 | usunięcie konta | brak osieroconych wierszy | A1 |
| H4 | cały `node --test tests/*.test.mjs` z PostgreSQL | dalej zielony (dziś 92/92) | każdy |
| H5 | statycznie: brak wypłat, portfeli, mnożnika w SQL i JS PepeGochi | brak | A1 |
| **Frontend** ||||
| I1 | licznik żądań w teście e2e | 1 RPC przy otwarciu, 1 na akcję, 0 w tle | okno na prawdziwych RPC (po B2) |
| I2 | telefon 360 px, klawiatura, czytnik ekranu, reduced motion | wszystkie akcje dostępne | B2 (#223) |
| I3 | dwie karty: akcja w A, stara akcja w B | B pokazuje świeży stan z serwera | okno na prawdziwych RPC (po B2) |
| I4 | brak sieci w trakcie akcji | UI wraca do ostatniego stanu z serwera, animacja nie udaje zapisu | okno na prawdziwych RPC (po B2) |
| I5 | wszystkie okna i gry PondOS po dodaniu nowej strony (zasada CSP) | działają | B2 (#223) |
| I6 | scenariusz „wyjazd”: 8 dni przerwy, powrót, list, nowa adopcja | zrozumiały przebieg | B2 (#223) |

Po wdrożeniu na produkcję (osobna zgoda): ponowne doradcy bezpieczeństwa i wydajności Supabase oraz test negatywny z prawdziwym JWT.

---

## 14. Decyzje dla właściciela

**Odpowiedzi właściciela z 2026-11-07** (punkty 1–6, 11 i 13):

1. ✅ PH-games nie ma tabel ani funkcji PepeGochi i Fren Passport (sprawdzone bez zmian). v2 to czysty schemat.
2. ✅ A1 zastępuje #186 (nowa gałąź od `main`, osobny Draft PR #218). #186 zostaje jako punkt odniesienia i nie jest scalany. `SECURITY_REVIEW_2026-11-05.md` zostaje w #186.
3. ✅ jako wartości robocze: 48 / 120 / 168 h (liczone od najstarszego zegara potrzeby, sekcja 5.2a).
4. ✅ jako wartość robocza: sensowna akcja = potrzeba < 90.
5. ✅ jako wartość robocza: dobry dzień = ≥ 2 różne akcje i potrzeby ≥ 40 (PR A2; próg zmieniony z 50 w punkcie 6a).
6. ✅ **1 dzień rekonwalescencji i co najmniej 8 h od ratunku** (decyzje 2026-11-07): gracze sob + nd zachowują żabę, a ratunek nie jest uproszczony. Rekonwalescencja zaczyna się od 120 h, nie od 48 h (powód w 5.2a). Bez ograniczenia nastroju.
6a. ✅ **Próg dobrego dnia: ≥ 40** (decyzja 2026-11-07, A2 #221). Zostają: co najmniej 2 różne sensowne akcje, wszystkie potrzeby ≥ 40, najwyżej 1 dobry dzień na dzień UTC, Good Parent = 30 dobrych dni w jednym życiu. Bez zmian w rekonwalescencji, odejściu i ratunku. Przy ≥ 50 krótkie wizyty weekendowe dawały 1 dobry dzień w 20 tygodni; przy ≥ 40 dają 21, a wizyty co 4 dni dalej najwyżej 2.
7. Wyzwanie 30 dni: wariant 1 teraz, wariant 2 później jako `perfect_parent`?
8. Stempel 100 dni: ID i nazwa (`best_fren_forever` / „Best Fren Forever”?) oraz reguła (100 dobrych dni w jednym życiu?).
9. „It's Not Me, It's You”: wpis w historii (rekomendacja) czy ukryty stempel?
10. Etap jajka przed pierwszą akcją: tak czy nie? (v1 zaczyna od kijanki.)
11. ✅ Do czasu osobnej zgody na wdrożenie: tylko lokalna baza albo osobny staging. Ukryta beta nie może wymagać zmian w PH-games.
12. ✅ Flaga bety: osobna `?beta=gochi` (`?beta=off` ukrywa), niezależna od `?beta=fren` (B2). Można to zmienić jednym miejscem w `meme.js`.
13. ✅ Symulator przyspieszonego czasu:
    - w A1 jako `scripts/pepegochi_sim.mjs` (ten sam SQL w PGlite), który zostaje źródłem referencyjnym;
    - w przeglądarce **wariant (b), lekki JS** (decyzja 2026-11-07), bez PGlite i bez rozszerzania CSP: Draft #220, z automatycznymi testami zgodności z SQL;
    - działa wyłącznie lokalnie, nie przyznaje osiągnięć i nie zmienia danych graczy.
14. Lista dozwolonych stempli: wariant 1 czy 2 z K3?

---

## 15. Podział na PR-y

Każdy PR jako Draft, z gałęzi od `main`, z opisem zgodnym z CLAUDE_HANDOFF.md sekcja 6. Żaden nie uruchamia SQL na produkcji i nie zmienia działającej strony poza ukrytą betą.

| PR | Zakres | Pliki | DONE | Rozmiar |
|---|---|---|---|---|
| **A1** cykl życia (backend) — **Draft #218** | owners + lives + milestones, 4 RPC, sensowna akcja, zegar każdej potrzeby, statusy, ratunek i rekonwalescencja, odejście, list, historia, ponowna adopcja, rejestr kamieni milowych z odizolowanym hookiem, liczniki akcji pod warianty listu, symulator czasu | `games/supabase/update_pepegochi_v2.sql`, `games/PEPEGOCHI_API.md`, `scripts/pepegochi_sim.mjs`, `tests/pepegochi.test.mjs` (CI), `tests/pepegochi-sql.test.mjs` (PostgreSQL) | A, B, C, D, E, F1, F5, R, M, H1–H3 zielone lokalnie | 561 linii SQL bez komentarzy + testy |
| **A2** jakość opieki — **Draft #221** (stacked na #220) | dobre dni, seria, kamień milowy `good_parent` (30 w jednym życiu), te same zasady w modelu JS, symulacje graczy | ten sam plik SQL, model, symulator, testy | G1–G10, H4, zgodność 0 różnic | mały–średni |
| **B1** lokalny symulator w przeglądarce — **Draft #220** (stacked na #218) | zasady w JS (te same RPC i JSON), strona testowa z przewijaniem czasu, tylko lokalnie (CSP `connect-src 'none'`, brak zapisu, brak stempli) | `docs/games/js/pepegochi-model.mjs`, `docs/games/pepegochi-sim.html`, `tests/pepegochi-parity.test.mjs`, `tests/pepegochi-model.test.mjs` | test P: 0 różnic z SQL | średni |
| **B2** tymczasowe UI — **Draft #223** (stacked na #221) | okno PondOS (iframe jak YEET) za flagą `?beta=gochi`, **na lokalnym modelu JS z B1** (decyzja 2026-11-07): imię, etap, 4 potrzeby, 4 akcje, ostrzeżenia, ratunek i rekonwalescencja z najwcześniejszym momentem zakończenia, pusty pokój, GOODBYE.TXT, Past Frens, nowa adopcja, dobre dni z potrzebą, która blokuje dzień, time machine z godzinami. CSP `connect-src 'none'`, żaba w `sessionStorage` karty, bez stempli. Tylko istniejące komponenty PondOS, bez nowej grafiki | `docs/games/pepegochi.html`, `docs/games/js/pepegochi-beta*.mjs`, wpis w `docs/meme/meme.js` za flagą, `tests/pepegochi-beta.test.mjs`, powtórka sesji okna w teście zgodności | I2, I5, I6, zgodność z SQL 0 różnic, wszystkie okna PondOS sprawdzone w przeglądarce; I1, I3, I4 przy podłączeniu okna do prawdziwych RPC | średni |
| **C** Passport | lista ID (K3), `first_hatch` / `little_fren` / `grown_fren`, backfill, karta Overview, Stats; katalog bez zmiany statusów do R | `games/supabase/update_pepegochi_passport.sql`, `docs/meme/meme.js` (Passport), testy, plik decyzji | G1–G7, istniejące testy Passportu zielone | mały |
| **D** Good Parent | wariant wyzwania z decyzji 7, `best_fren_forever` jeśli zatwierdzony, jawna zmiana opisów w katalogu | `update_pepegochi_good_parent.sql`, katalog, plik decyzji, testy | testy 30 dni, pominięcia, 7 dni nieobecności, strefy, duble | mały |
| **R** wydanie | Twoja grafika, reklama PEP-TV (zasada repo: większe funkcje dostają reklamę w `ADS`), katalog `live`, zdjęcie flagi bety, instrukcja SQL w kolejności z 8.4 | według potrzeb | Twoja zgoda na SQL i publikację | — |
| E, F | pokój i inwentarz; osobowości, warianty listu, rebirth | osobne specyfikacje po projekcie graficznym | — | — |

Kolejność: A1 → A2 → B1 → B2 (od tego momentu możesz grać w becie) → C → D → R. B1 może iść równolegle z A2.

Kolejność scalania stosu Draft PR-ów: #218 (A1) → #220 (B1) → #221 (A2) → #223 (B2). Okno z B2 działa na lokalnym modelu; podłączenie go do prawdziwych RPC (lokalny backend albo staging, testy I1, I3, I4) to osobny krok do ustalenia.

---

## 16. Czego ten plan nie robi

- Nie projektuje wyglądu gry, żaby, pokoju ani animacji. UI w B2 jest tymczasowe i zbudowane z istniejących elementów PondOS.
- Nie dodaje wypłat PEP, portfeli, mnożnika 1,5× ani losowych nagród. Test H5 pilnuje tego statycznie.
- Nie zmienia znaczenia `certified_fren` ani żadnego istniejącego stempla. `good_parent` zmienia opis tylko jawnie, w PR D, po Twojej decyzji.
- Nie uruchamia SQL na produkcji, nie scala i nie publikuje bez Twojej zgody.

# PepeGochi v2 — START HERE / project index

**Wersja:** 2026-11-07, visual + departure prototype v4
**Bezpieczny status:** wszystkie zmiany w **Draft PR**, bez SQL na produkcji i bez publikacji gry.

Ten plik jest stałym punktem wejścia. Nie trzeba odszukiwać pakietów ZIP i poprzednich wiadomości.

## Gdzie co jest

| Zakres | Dokument / plik | Status |
|---|---|---|
| Koncepcja rozgrywki i wyprowadzki | [PR #216](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/216): `README.md`, `CLAUDE_HANDOFF.md`, `STORY_CONTENT.md` | Draft |
| Przegląd backendu, SQL, testy, Passport | [PR #217](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/217): `TECH_PLAN.md` | Draft |
| Styl żaby, pokojów, zasady grafiki | [VISUAL_BIBLE.md](VISUAL_BIBLE.md) | Draft |
| Pierwsze 8 grafik, eksporty | [CONCEPT_PACK_V1.md](CONCEPT_PACK_V1.md) | Draft |
| Poprzednie QA art pack v2 i v3 | [ART_ASSET_STATUS_V2.md](ART_ASSET_STATUS_V2.md), [ART_ASSET_STATUS_V3.md](ART_ASSET_STATUS_V3.md) | Robocze |
| Losowy zabrany przedmiot, reguły, SQL integration contract | [RANDOM_MOVE_OUT_SPEC_V1.md](RANDOM_MOVE_OUT_SPEC_V1.md) | Mechanika do review |
| **Odtwarzalny podgląd wyprowadzki v4** | [demo/PepeGochi_v4_random_departure_playtest.html](demo/PepeGochi_v4_random_departure_playtest.html) | Interaktywne lokalne demo, wszystkie obrazy osadzone w pliku |
| Prototyp funkcji wyboru, listu i historii | [demo/departure_model.mjs](demo/departure_model.mjs) | Lokalny przykład, **nie** SQL |
| Testy prototypu | [demo/departure_model.test.mjs](demo/departure_model.test.mjs) | **15/15 PASS** w Node |
| QA Chromium | [demo/browser_qa_v4.json](demo/browser_qa_v4.json) | 1280, 390, 360 px PASS |

## Jak uruchomić demo

Pobierz `demo/PepeGochi_v4_random_departure_playtest.html` z tego PR i otwórz w przeglądarce. To jeden samodzielny plik, nie wymaga ZIP-a, internetu, Supabase ani Discorda. Najpierw użyj przycisku `+168 h`, potem otwórz `GOODBYE.TXT`, a następnie wybierz `Nowa adopcja`. W panelu pokoju będzie widoczny brak jednego z sześciu przedmiotów. Test jest w pełni lokalny i niczego nie zapisuje na serwerze.

## Gdzie są wcześniejsze pełne źródła graficzne

Wszystkie poprzednie wysokiej jakości źródła i archiwa v2/v3 znajdują się w **Bibliotece ChatGPT → PepeGochi v2**, a v4 dodatkowo w podfolderze `v4-departure`. Nowy podgląd v4 ma referencyjne grafiki wbudowane w HTML **bez konieczności szukania archiwum**. Do przyszłej produkcyjnej integracji będą jednak potrzebne osobne PNG i warstwowe tła w repo.

## Decyzje mechaniczne

- Żaba może się wyprowadzić po długiej nieobecności, a nie umrzeć.
- Z zabranego rekwizytu powstaje **jeden** zapis w historii życia i linia w `GOODBYE.TXT`.
- Przedmiot z pokoju znika wizualnie tylko w scenie odejścia; **własność nie jest usuwana z konta**, a następna adopcja przywraca widok.
- Nie tworzymy nagród za zaniedbywanie, prawdziwych wypłat PEP ani mnożnika 1,5×.
- Progi czasowe 48/120/168 h są robocze do playtestu.
- `certified_fren` pozostaje stemplem za 100 dni aktywności w PondOS, nie za PepeGochi.

## Techniczne zależności do sprawdzenia z Claude

1. Rozszerzyć A1 o `taken_prop_id` (jednorazowo wybierany po stronie serwera) i odczyt historii.
2. Zachować odczyt stanu bez zapisu; ewentualny **pojedynczy settle RPC** wykonać tylko przy pierwszym wejściu po upływie terminu. Wszelkie RPC sprawdzają Discord/Auth, wiersz owner + life pod blokadą i czas serwera po blokadzie.
3. Nie można wykorzystać losowania JS `demoIndex` w SQL produkcyjnym; to tylko mechanika wizualnego prototypu.
4. Przygotować czysty pokój jako bazowe tło oraz 6 niezależnych sprite'ów przedmiotów, w tym telewizor i lampę. Obecne tła są spłaszczonymi referencjami.
5. Po backendzie A1/A2 i QA można przygotować osobny mały Draft PR na integrację obrazu/UI. Bez merge'a, deploymentu i SQL na PH-games do zgody właściciela.


## Nowy etap: Room Architecture v1 (2026-11-07)

- **[ROOM_ARCHITECTURE_V1.md](ROOM_ARCHITECTURE_V1.md)** — warstwy, 11 slotów, kategorie przedmiotów, zasady właściciela, magazynu, nagród z innych gier, bezpieczna wyprowadzka i PR-y wdrożeniowe.
- **[room_manifest_v1.json](demo/room_manifest_v1.json)** — maszynowo czytelne 11 slotów w układzie 640×400 i katalog 10 przykładowych obiektów. Wszystkie assety nadal robocze.
- **[room_editor_v1.html](demo/room_editor_v1.html)** — samodzielny, interaktywny podgląd lokalny, otwierany po pobraniu z GitHuba, bez połączenia z Supabase. Kliknij przedmiot w kolekcji i pasujące miejsce w pokoju. Można testowo otrzymać dyskietkę, symulować wyprowadzkę, odczytać GOODBYE.TXT i adoptować kolejną żabę.
- [room_editor_browser_qa_v1.json](demo/room_editor_browser_qa_v1.json) — test Chromium 1280/390/360 px: przenoszenie, testowy upominek, wyprowadzka, list, adopcja, brak overflow i JS errors.

**Zasada:** własność konta ≠ umiejscowienie w pokoju ≠ chwilowo schowany rekwizyt po wyprowadzce. A1/A2 backend są rozwijane w draft PR #218/#221; nie zmieniać ich logiki opieki przy projektowaniu pokoju. Demo nie przyznaje realnych przedmiotów i nie zapisuje danych na serwerze. Księżycowa skała pozostaje planowaną nagrodą dopóki jej źródło nie będzie wiarygodnie weryfikowane po stronie serwera.

## Room v5 — osobny pakiet warstwowy / Draft PR #222 (2026-11-07)

**[PR #222: Warstwowy pokój v5, osobne PNG i interaktywny edytor](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/222)** — kolejny niezależny etap, oparty na zasadach Room Architecture v1.

- 10 plików PNG bezpośrednio na GitHubie w `docs/design/pepegochi-v2/room-v5/assets/`: czyste tło, 8 przedmiotów i sprite PepeGochi. Wiele wariantów przedmiotów nie wymaga już ponownego renderowania pokoju.
- [Podgląd offline](https://github.com/PepecoinHub/pepecoinhub.github.io/blob/design/pepegochi-room-v5-layered-prototype/docs/design/pepegochi-v2/room-v5/room_v5_standalone.html) — pobierz HTML i otwórz w przeglądarce; obrazy są również wbudowane w sam plik.
- [Model i testy](https://github.com/PepecoinHub/pepecoinhub.github.io/tree/design/pepegochi-room-v5-layered-prototype/docs/design/pepegochi-v2/room-v5) — 30/30 testów Node oraz Chromium 1280/390/360, także scena zabranego TV i odzyskania po nowej adopcji. Wszystko lokalnie i bez sieci.
- Na potrzeby tego wariantu `floor_left` ma poprawiony punkt (170,345) zamiast pierwotnego (95,331), żeby roślina stała na podłodze, nie na komodzie. Identyfikator i typ slotu nie ulegają zmianie.
- Grafiki to zatwierdzany osobno **funkcjonalny zestaw kandydatów**, nie finalny artbook. Łóżko/szafka/dywan w tle pozostają stałym wyposażeniem; kolejne przedmioty nagrodowe mają oddzielny system po stronie backendu.
- Bez produkcyjnego SQL, merge, deploy, realnych PEP czy 1,5×. Zaplecze inventory nadal wymaga osobnego PR i testów DB.

## Room-2 — Draft PR #224: private room inventory (2026-11-07)

**[PR #224: server-owned item collection and 11 room slots](https://github.com/PepecoinHub/pepecoinhub.github.io/pull/224)** is stacked on A2 (#221), not on this visual documentation branch. It contains:

- `games/supabase/update_pepegochi_room_v1.sql` — 5 private tables (catalog, inventory, placements, revisions and slots) plus four Discord-only room RPCs. No public item grant endpoint.
- `tests/pepegochi-room-static.test.mjs` — **6/6 passed** locally.
- `tests/pepegochi-room-sql.test.mjs` — PostgreSQL integration tests prepared but **not yet run**; use a disposable LOCAL PostgreSQL 17 to validate before considering merge.
- `games/PEPEGOCHI_ROOM_API.md` — integration contract and release gates.

This step deliberately **does not** enable gifts from other games, the Moon Rock, departure's durable random item choice, real PEP or 1.5×. Room artwork and the offline editor remain in #222. Nothing has been deployed or merged.

## Co dalej

- Warstwowa grafika pokoju + rekwizyty, w tym brak po zabranym obiekcie.
- Prawdziwe, spójne klatki animacji zamiast kadrowanych plansz.
- Stemple Fren Passport (bez konfliktów ID).
- Kolekcja i przedmioty The Lost Pond Files po autorytatywnym inventory.

**Nie scalać, nie publikować i nie uruchamiać SQL na produkcji bez wyraźnej zgody właściciela.**

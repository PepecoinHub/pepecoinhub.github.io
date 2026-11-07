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

## Co dalej

- Warstwowa grafika pokoju + rekwizyty, w tym brak po zabranym obiekcie.
- Prawdziwe, spójne klatki animacji zamiast kadrowanych plansz.
- Stemple Fren Passport (bez konfliktów ID).
- Kolekcja i przedmioty The Lost Pond Files po autorytatywnym inventory.

**Nie scalać, nie publikować i nie uruchamiać SQL na produkcji bez wyraźnej zgody właściciela.**

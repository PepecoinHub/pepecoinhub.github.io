# PepeGochi v2 — losowa wyprowadzka i pamiątka po żabie

**Status:** propozycja mechaniki + działający lokalnie prototyp. **Nie jest to kod produkcyjny ani SQL do uruchomienia.**
**Data:** 2026-11-07. **Powiązane:** PR #216 (fabuła), #217 (backend), #219 (grafika).

## Cel

Po długim zaniedbaniu PepeGochi nie umiera: pakuje walizkę i **zabiera jeden losowy przedmiot, który był widoczny w jego pokoju**. W pokoju zostaje puste miejsce oraz koperta `GOODBYE.TXT`. W liście znajduje się żart dopasowany do tego, co zabrał. Fren Passport pokazuje, którego frena stracono i z czym odszedł.

To nie jest mechanizm niszczenia własności. Zdobyte, kupione i odblokowane przedmioty, stemple, awatary i historie pozostają na koncie. **Znika jedynie wizualna instancja przedmiotu w scenie odejścia.** Nowa żaba odzyskuje normalny widok pokoju i pełną kolekcję. To nie jest nagroda, którą można farmić.

## Dostępne rekwizyty (pierwszy zakres)

| ID | Wyświetlana nazwa | Żart w liście |
|---|---|---|
| `crt_tv` | CRT television | I took the TV. I have shows to catch up on. |
| `lava_lamp` | lava lamp | I borrowed the lava lamp. Mood lighting matters. |
| `potted_plant` | potted plant | I took the plant. Someone has to water it. |
| `p_poster` | P poster | I took the poster. The wall looked lonely anyway. |
| `rubber_duck` | rubber duck | I took the duck. We have a lot in common. |
| `mug` | coffee mug | I took the mug. My tea deserves better. |

Zbiór jest **katalogiem graficznym**, nie listą rzadkich lootów. Oprócz tego nie wolno ruszać łóżka, listu, ważnych przedmiotów fabularnych (Moon Rock / Lost Pond Files), rzeczy z innych gier, stempli, awatarów ani środków PEP.

## Zasady losowania

1. Początkowo obowiązuje roboczy próg `168 h` od ostatniej zaakceptowanej sensownej opieki (zgodnie z PR #217). Po `48 h` stan neglected, po `120 h` packing.
2. Po nieodwracalnym odejściu serwer wybiera **dokładnie jeden** identyfikator rekwizytu spośród dopuszczonych i faktycznie ustawionych w pokoju. Nie używa danych przedmiotów ani losowania przesłanego przez przeglądarkę.
3. Wynik jest zapisywany na zakończonym życiu jako `taken_prop_id` (nullable). Jest stały przy odświeżaniu strony, nowej karcie, ponowionym RPC i wielokrotnym otwieraniu listu.
4. Jeśli brakuje dopuszczonych przedmiotów, `taken_prop_id = null` i żaba żartuje, że zabrała wspomnienie. Nie tworzymy fikcyjnego przedmiotu gracza.
5. UI po wyprowadzce ukrywa **tylko** wskazany obiekt sceny; widać jego obrys/kurz/ślad na ścianie. Nie usuwamy wpisu z `owner_inventory` ani z kolekcji Passportu.
6. Przeczytanie listu jest konieczne przed nową adopcją, ale można go później odtworzyć z historii życia. `letter_seen_at` powstaje raz.
7. Kolejne życie ma nowe `life_id`; odziedziczone na koncie przedmioty znów mogą być pokazane w pokoju. `taken_prop_id` poprzedniego życia zostaje jako historyczny fakt.
8. Wyprowadzka nie daje stempla ani dodatkowej nagrody, żeby nie zachęcać do zaniedbywania kolejnych żab.

## Kontrakt backendu: decyzja do uzgodnienia z Claude przy A1

Obecny plan #217 zakłada `gry_pepegochi_state()` wyłącznie do odczytu oraz jednorazowy zapis odejścia przy pierwszym RPC zapisującym. **Losowa, stale taka sama scena bez wcześniejszego zapisu wymaga doprecyzowania.** Rekomendacja:

- `gry_pepegochi_state()` pozostaje read-only. Jeżeli termin upłynął, zwraca stan `departure_pending_settlement = true`, bez wymyślania losowego `taken_prop_id` w JS.
- UI wykonuje w tym **jednym wyjątkowym przypadku** pojedynczy `gry_pepegochi_settle_departure()` bez argumentów. RPC pod blokadą owner → life odczytuje czas **po blokadzie**, weryfikuje uprawnienia Discord, wylicza zakończenie, wybiera ze zweryfikowanych i zapisanych przedmiotów i zapisuje `departed_at` oraz `taken_prop_id` w jednej transakcji.
- `gry_pepegochi_letter_read()` również bezpiecznie rozlicza odejście pod blokadą, gdy ktoś ominie UI i wywoła je bezpośrednio.
- Ponawianie `settle_departure` zwraca ten sam wynik, nie przyznaje drugiego żetonu, drugiego listu, nagrody ani historii.
- Koszt: 1 RPC przy normalnym otwarciu gry; **2 RPC tylko przy pierwszym otwarciu po wyprowadzce**. Nie włączamy cronów, pollingu, Realtime.

Po uruchomieniu prawdziwego systemu pokoju trzeba wybrać rekwizyt ze sprawdzonego stanu `placed_items`; do tego czasu testujemy na serwerowo zdefiniowanych domyślnych rekwizytach, a nie na localStorage. W przypadku zmiany układu pokoju przy nieodwracalnym odejściu RPC najpierw rozlicza odejście, dopiero potem przyjmuje jakiekolwiek edycje.

**Nie przenosić** demonstracyjnego `demoIndex()` ani symulowanego zegara z pliku JS do produkcji. Wybór produkcyjny należy do Postgresa/Supabase; wynik jest tylko kosmetyczny, lecz musi być autorytatywny i idempotentny.

## Projekt graficzny do następnej rundy

Wszystkie pokoje muszą powstawać z jednego czystego tła + niezależnych warstw (`crt_tv`, `lava_lamp`, `potted_plant`, `p_poster`, `rubber_duck`, `mug`, `letter`). Obecne plansze koncepcyjne mają część mebli wrysowaną w tło, dlatego **nie są ostatecznym źródłem do dynamicznego usuwania przedmiotów**. Tymczasowy prototyp pokazuje brak w siatce wyposażenia i opis sceny, nie udaje pełnego usunięcia pikseli telewizora. Ostateczna scena wymaga warstwowego pokoju.

Po wyprowadzce: koperta w pokoju; klik otwiera klasyczny Notatnik `GOODBYE.TXT` z linią dopasowaną do zabranego przedmiotu; historia zapisuje ID oraz tekst. W wersji mobilnej ta sama informacja musi być dostępna bez hovera.

## Testy do dodania w backendzie

- 167:59:59 pozostaje packing, 168:00:00 jest departed.
- Jedna wyprowadzka i jeden rekwizyt mimo 12 równoległych żądań settle/letter/adopt.
- Dwa równoległe konta nie wpływają na siebie.
- Zmiana danych klienta (`taken_prop_id`, `user_id`, `life_id`, zegar, lista przedmiotów) nie jest dopuszczalnym argumentem RPC.
- `anon` i brak powiązanego Discorda odrzucone; `SECURITY DEFINER`, `search_path`, RLS i granty sprawdzone.
- Pusty pokój => `null`; zduplikowane/nieznane ID wykluczone.
- Stan read-only nie zapisuje i nie wylosowuje innego rekwizytu na każdym otwarciu.
- Ponowny settle, zerwanie sieci lub dwie karty zawsze zwracają ten sam przedmiot i ten sam `departed_at`.
- List dokładnie pasuje do ID; odczyt można powtórzyć, a data pierwszego odczytu pozostaje bez zmian.
- Zdobyte dekoracje, avatary, stemple i właściciel inventory pozostają identyczne po odejściu; wracają wizualnie przy nowej adopcji.
- Nie powstają nowe nagrody, nie ma wypłat PEP, 1,5× ani zwiększania liczby stempli za wyprowadzkę.
- Testy mobilne, czytnik ekranu, brak poziomego przewijania, reduced motion.

## Co przetestowano teraz

Lokalny moduł `demo/departure_model.mjs` i `demo/departure_model.test.mjs`: **15/15** testów Node przeszło (semantyka granic czasu, jeden losowy przedmiot, idempotencja, list, historia, ponowna adopcja, pusty pokój). To wyłącznie **symulacja UI**, nie dowód gotowości produkcyjnego SQL.

Dodatkowy samodzielny prototyp HTML jest przechowywany w Bibliotece ChatGPT, folder `PepeGochi v2/v4-departure`, oraz na gałęzi dokumentacyjnej PR #219. W testach Chromium działał na ekranach 1280, 390 i 360 px bez błędów JS i poziomego przewijania.

**Bez zmian działającej strony, bez scalania i bez produkcyjnego SQL.**
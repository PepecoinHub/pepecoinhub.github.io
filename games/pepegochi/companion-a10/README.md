# PepeGochi A10 — małe gesty towarzysza

Gotowa paczka: **20 nowych klatek, 5 animacji**, podpiętych do interakcji w PR #353.

| Animacja | Reakcja | Czas |
|---|---|---|
| `nuzzle` | Głaskanie, znajomy gest, podziękowanie za opiekę | 900 ms |
| `welcome` | Powrót, zabawa, wzrost, udany quiz; w grze dodatkowo mały podskok | 910 ms |
| `curious` | Rozglądanie się, rozmowa i zainteresowanie kursorem | 1120 ms |
| `sulk` | Naburmuszenie przy nadmiernym zaczepianiu | 1120 ms |
| `yawn` | Ziewanie zmęczonego dorosłego zwierzaka | 1260 ms |

## Obejrzyj

Otwórz `preview.html` w przeglądarce. Plik zawiera wszystkie grafiki, działa bez internetu i odtwarza ruchy na przycisk. Pokazuje też klatki w skali 1:1. `preview.gif` to skrócony, zapętlony przegląd pięciu zestawów (w grze animacje nie zapętlają się). `preview.png` pokazuje panel podglądu. `contact-sheet.png`: każdy rząd to poza bazowa oraz cztery nowe klatki, powiększenie nearest-neighbour ×5.

`frames/` zawiera 20 nowych PNG i 2 oryginalne pozy referencyjne. Nowe pliki docelowo należą do `docs/games/img/pepegochi/taskbar/anim/`. Nie podmieniaj oryginalnych póz. `manifest.json` opisuje kolejność klatek i ich czas; powtórzone indeksy oznaczają przytrzymanie pozy.

## Grafika i pochodzenie

Ekspresje powstały za pomocą generatora obrazu z istniejącym Pepegachi jako referencją. Techniczny eksport wycina komórki, skaluje nearest-neighbour, sprowadza kolory do oryginalnej palety i przywraca oryginalne logo, rdzeń bluzy oraz całą dolną część postaci piksel w piksel. Źródło i raport eksportu są w repozytorium obok paczki (`source/generated-expressions.png`, `export.json`). To nowe ekspresje, nie ręcznie rysowane od zera klatki.

Każdy PNG: 48×48 RGBA, binarna przezroczystość, maksymalnie 26 kolorów, ostatni widoczny rząd y=46. Oryginalne zaakceptowane grafiki pozostają bez zmian. Kontrolę formatu i sumy SHA-256 zapisano w `QA.json`.

## Integracja

Animacje grają raz i wracają do rzeczywistej pozy. Nie zastępują głodu, brudu, zaniedbania, pakowania ani rekonwalescencji; młodsze etapy zachowują własne grafiki. Ziewanie jest dostępne tylko przy rzeczywistym zmęczeniu. Ustawienie ograniczonego ruchu wyłącza nowe sekwencje w grze. Zmiana konta, stanu, zamknięcie rozmowy i ukrycie karty anulują odtwarzanie. Spóźnione ładowanie obrazków nie przywraca anulowanej animacji. Brakujący obrazek pozostawia zwykłą pozę.

## Sprawdzone

- 20/20 PNG spełnia kontrolę formatu; wszystkie klatki różne; logo i dolna część zgodne z oryginałem.
- Zestaw Node: 342 zaliczone, 26 pominiętych z powodu środowiska, 0 błędów.
- Chromium: wszystkie 5 sekwencji, powrót do stanu, przerwanie przez głód, ograniczony ruch, klawiatura, dotyk, konta, quiz, wyciszenie i szerokości 320/390/1440 px.
- Kontrola strony/i18n oraz 2 testy Python; istniejące ostrzeżenia tłumaczeń.
- Podgląd HTML: odtwarzanie i zatrzymanie pięciu animacji sprawdzone w Chromium.

Odtworzenie eksportu: `node scripts/export_pepegochi_companion.cjs` (sharp, pngjs). Podgląd: `node scripts/package_pepegochi_companion.cjs` (sharp). Sama gra nie otrzymuje nowych zależności.

PR pozostaje draftem. Paczka i integracja nie zostały wdrożone na produkcję.

# PepeGochi v2: Visual Bible v1

**Status:** ART DIRECTION DRAFT, do oceny właściciela. Dokument projektowy, nie zgoda na publikację assetów.
**Projekt:** PepecoinHub / PondOS 98.
**Powiązania:** PR #216 (gameplay i opowieść), PR #217 (plan techniczny), PR #186 (backend v1, do zastąpienia).
**Odpowiedzialność:** ChatGPT + właściciel przygotowują i zatwierdzają oprawę. Claude integruje **wyłącznie zatwierdzone** grafiki z mechaniką. Brak podmiany istniejących elementów PondOS bez decyzji.

## 1. Teza kreatywna

PepeGochi to prywatny, memiczny desktop pet w świecie PondOS 98. Gracz ma polubić swojego frena, rozpoznać jego emocje w sekundę, widzieć rozwój na przestrzeni tygodni, a po zaniedbaniu przeżyć komiczną wyprowadzkę, nie śmierć.

Ton: Windows 98 / wczesny internet (1998–2003), nieco nieporadny, melancholijny, sympatyczny. Humor starego internetu bez zawstydzania użytkownika. Mniej nowoczesna gra mobilna, więcej programik żyjący we własnym oknie na pulpicie.

**Unikać:** połysku 3D, realistycznego płaza, neonowego cyberpunku, nowoczesnych gradientów, nadmiernie słodkiej kreskówki, mrocznej choroby/śmierci, agresywnych grymasów, gotowych generycznych mascotów.

## 2. Styl rysunku i spójność

- Kierunek do przetestowania: **ręcznie dopracowany, czytelny pixel art**, z ograniczoną paletą i ostrymi krawędziami, bez rozmycia ani antyaliasingu. Decyzja o ostatecznej technice dopiero po obejrzeniu pierwszej planszy.
- Ciemnozielony / ciemnobrązowozielony kontur zamiast czystej czerni; 1–3 poziomy światła i cienia na element.
- Głowa większa niż tułów, krótkie kończyny, duże oczy i szeroki kształt ust charakterystyczny dla Pepe. Nie zmieniać konstrukcji twarzy między stanami.
- Perspektywa postaci: front lub delikatne 3/4; spójna linia podłoża i wizualna skala.
- Każdy stan adulta ma to samo oblicze, rozmiar głowy, proporcje tułowia, kształt oczu i bazową paletę. Zmianie podlegają mimika, gest i rekwizyt.
- Sprite postaci oddzielony od wyposażenia i UI. Zero napisów w rastrze postaci.
- Tło postaci: transparentne PNG. Brak ramek, cieni rzucanych poza sprite ani dekoracyjnej planszy w assetach produkcyjnych.
- Dokładna siatka pikseli / rozmiar i paleta to parametry robocze, weryfikowane po obejrzeniu mockupu w oknie 360 px.

## 3. Paleta próbna (niezatwierdzona)

| Funkcja | HEX |
|---|---|
| Zielony bazowy | `#78AE57` |
| Światło, jaśniejsza zieleń | `#A4CD79` |
| Cień, oliwkowa zieleń | `#497747` |
| Kontur | `#29372B` |
| Krem dla białek oczu | `#EEE7CE` |
| Brąz akcesoriów | `#8C6248` |
| Windows 98 szary | `#C0C0C0` |

Nie farbować całej postaci na inny kolor w stanie neglected; sygnałem jest wyraz twarzy i poza, nie chorobliwa kolorystyka.

## 4. Etapy rozwoju

**Egg (propozycja, wymaga wsparcia logiki)**: małe, kremowo-zielone, lekko nieregularne jajko z plamkami, ewentualnie mikropęknięciem. Bez wielkiej twarzy namalowanej na skorupce.

**Tadpole**: duża, żabia główka + krótki ogonek, bez nóg. Oczy wywodzą się od adulta, ale są większe proporcjonalnie. Wyraźnie kijanka, nie ryba.

**Froglet**: cztery łapki, większa głowa, małe ciało, młodzieńcza postura. Nie zwykły adult pomniejszony w programie graficznym.

**Adult**: główny model do wszystkich zachowań. Rozpoznawalna, lekko melancholijna twarz Pepe, krótkie łapki, swobodne siedzenie; w zaniedbaniu i packing ten sam bohater.

Backend v1 ma `tadpole: 0–1 care days`, `froglet: 2–6`, `adult: 7+`. Egg wymaga osobnej decyzji o momencie i czasie wyklucia; nie sugerować, że ta faza działa już na serwerze. Dorosłość nie kończy rozwoju fabularnego (30/60/100 dni), ale nowe formy/Rebirth to późniejszy projekt.

## 5. Słownik stanów

| Stan | Odczyt w jednej sekundzie | Sygnały graficzne |
|---|---|---|
| Healthy/Idle | „Chilluję” | spokojne oczy, lekki uśmiech, luźna poza |
| Happy | zadowolony | szerszy uśmiech, bardziej otwarte oczy, delikatna energia |
| Hungry | chce jeść | wzrok ku misce, łapka przy brzuchu, proszące usta |
| Dirty | trzeba umyć | kilka plamek, lekki grymas, opcjonalny oddzielny efekt |
| Moody | „not impressed” | spojrzenie w bok, zaciśnięte usta, łapki blisko ciała |
| Tired | senny | ciężkie powieki, ziewnięcie, opuszczona postura |
| Neglected | zaniedbany | postawa niska, rozczarowana mina, umiarkowane zabrudzenie |
| Recovering | wraca do formy | łagodne spojrzenie, spokojne siedzenie, ewentualny osobny kocyk |
| Packing | zaraz odchodzi | żaba półbokiem, mała walizka, mina „mam dość” |
| Departed | nieobecność | **bez sprite'a postaci**; pusty pokój i koperta |

Stan `packing` ma być charakterystycznym memem. Stan `departed` ma nie pokazywać śmierci ani znęcania. Stan pokoju uzupełnia emocje i nie wymaga osobnego „chorego” koloru postaci.

## 6. Pokój i HUD

Pokój to niewielkie, przytulne retro wnętrze. Perspektywa prawie frontalna, delikatnie z góry; ciepła tapeta, jasnobrązowa podłoga, posłanie, miska, niewielki stolik i opcjonalny stary telewizor. Postać jest centralna; pokój ma być tłem, nie konkurencją.

Robocze stany pokoju: `room_normal`, `room_messy_light`, `room_neglected`, `room_packing`, `room_empty`.

W `room_empty` postaci nie ma, leży koperta. Napis `GOODBYE.TXT` wyświetla prawdziwe okno Notatnika w UI, nie jest trwale wyrenderowany na tle. „P.S. I took the TV” to żart, a nie usunięcie przedmiotu z konta.

Akcje: `feed` (miska), `clean` (mydło), `play` (piłeczka), `rest` (poduszka), także `warning`, `letter`, `adopt`, `past_frens`. Ikony mają być czytelne przy małym rozmiarze i nie udawać tekstu/systemowych przycisków w teksturze.

## 7. Animacja, późniejsza faza

Małe pętle: mruganie, kołysanie podczas idle, ziewnięcie, delikatny podskok, spojrzenie na miseczkę, chwyt walizki. Ograniczona liczba klatek i charakter starej gry. Bez hiper-płynnych efektów, dopiero po zatwierdzeniu statycznych sylwetek.

## 8. Specyfikacja techniczna assetów

- Koncepcyjna plansza porównawcza 4 stanów adulta może mieć jasne pola i podpisy **poza sprite'ami**.
- Produkcyjne sprite'y: proponowana baza `128 × 128` PNG RGBA, potem test czytelności przy 96, 80 i 64 px. Rozmiar wymaga dostrojenia do prawdziwego okna PondOS.
- Tła pokoju: roboczo `640 × 400` px PNG, oddzielne od postaci, rekwizytów i HUD.
- Preferować skalowanie `image-rendering: pixelated` / nearest-neighbor; nie tworzyć finalnych resize'ów przed weryfikacją pixel grid.
- Ten sam punkt oparcia stóp; rekwizyty oddzielne na przyszłość.
- Nie spłaszczać tekstu przycisków ani listu na obrazku. Źródła i eksporty przechowywać osobno.

## 9. Minimalne pierwsze aktywa

1. `pepegochi_adult_idle.png`
2. `pepegochi_adult_hungry.png`
3. `pepegochi_adult_neglected.png`
4. `pepegochi_adult_packing.png`
5. `pepegochi_egg_idle.png`
6. `pepegochi_tadpole_idle.png`
7. `pepegochi_froglet_idle.png`
8. `room_empty_goodbye.png`

Później: happy, moody, tired, dirty, recovering; pozostałe pokoje, UI i animacje; dopiero wtedy stemple, kolekcja, speciale, The Lost Pond Files.

## 10. Akceptacja i blokady

- Porównanie czterech adultów musi potwierdzić, że to ta sama postać.
- Minimum jedna próba wyświetlenia w oknie PondOS na desktopie i mobile.
- Żaden stan wizualny nie może sugerować, że elementy konta są usuwane podczas wyprowadzki.
- Bez finalnego UI, bez wypłat PEP, bez zmiany `certified_fren`, bez wpinania do produkcji.
- Claude może używać placeholderów, ale nie ma samodzielnie projektować nowej żaby ani stylu pokoju.
- Wszystkie grafiki oznaczone `CONCEPT` do chwili wyraźnej akceptacji.

## 11. Handoff

Następny dokument: [CONCEPT_PACK_V1.md](CONCEPT_PACK_V1.md). Pierwsza plansza to cztery stany dorosłej postaci (Healthy, Hungry, Neglected, Packing). Dopiero po jej ocenie przygotować produkcyjne eksporty i kolejne etapy rozwoju.

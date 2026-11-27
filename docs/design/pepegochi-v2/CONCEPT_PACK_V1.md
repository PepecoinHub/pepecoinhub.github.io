# PepeGochi Concept Pack v1

**Status:** scenariusze pierwszych 8 ilustracji, do generowania i oceny, nie gotowe assety.
**Źródło stylu:** [VISUAL_BIBLE.md](VISUAL_BIBLE.md). Uzgodnione z dokumentami koncepcji z PR #216.
**Cel:** spójny, memiczny pixel-art desktop pet do PondOS 98, najpierw wygląd i czytelność, potem pipeline produkcyjny.

## 1. Najpierw jedna plansza dorosłego, cztery emocje

Układ studyjny 2×2, wszystkie postacie w tej samej skali. Jasne, neutralne pola z etykietami **poza postacią** służą tylko do prezentacji. Zablokować identyczne proporcje głowy, oczu, pyska, kończyn i cienia. Brak oddzielnych projektów „nowej żaby” w każdym polu.

### 01. Healthy / Idle
- **Docelowy plik:** `pepegochi_adult_idle.png`.
- Dorosły, siedzący Pepe, duża szeroka głowa, mały tułów, krótkie łapki, odrobinę opadnięte powieki.
- Spojrzenie w stronę gracza, spokojne usta z subtelnym uśmiechem; swobodna, lekko niezgrabna postura.
- Emocja: „I'm just chilling”. To **master reference** dla reszty.

### 02. Hungry
- **Docelowy plik:** `pepegochi_adult_hungry.png`.
- Identyczny bohater i skala, oczy skierowane ku małej pustej misce, łapka przy brzuchu, bardziej wyczekujące usta.
- Miska jest osobnym przyszłym rekwizytem.
- Emocja: „You gonna feed me or what?” Bez łez, wychudzenia czy scen cierpienia.

### 03. Neglected
- **Docelowy plik:** `pepegochi_adult_neglected.png`.
- Ten sam bohater, siedzi niżej, opadają ramiona, oczy lekko przymknięte, niedowierzający wyraz twarzy.
- Delikatne zabrudzenia i sprana energia, nie chora zielona skóra, bez makabry.
- Emocja: „Seriously, fren?” Nadal można go uratować.

### 04. Packing
- **Docelowy plik:** `pepegochi_adult_packing.png`.
- Ten sam bohater stoi półbokiem, trzyma małą brązową walizkę, rzuca graczowi obrażone spojrzenie.
- Walizka dostatecznie czytelna, by później wyciąć ją jako oddzielny sprite.
- Emocja: „I've had enough of this place.” Kultowa komedia, nie agresja.

## 2. Etapy wzrostu po akceptacji adulta

### 05. Egg
- **Plik:** `pepegochi_egg_idle.png`.
- Małe nieregularne kremowo-zielone jajko z plamkami, pojedyncze mikropęknięcie, brak wielkiej narysowanej twarzy.
- Wygląda jak znalezisko ze stawu. Przed integracją ustalić z Claudem, czy i jak długo ma trwać faza egg.

### 06. Tadpole
- **Plik:** `pepegochi_tadpole_idle.png`.
- Duża żabia główka, krótki ogonek, bez nóg. Te same kształty oczu/pyska co u adulta, bardziej niewinne spojrzenie.
- Trochę nieporadna, ciekawska. Nie rybka.

### 07. Froglet
- **Plik:** `pepegochi_froglet_idle.png`.
- Cztery małe łapki, proporcjonalnie większa głowa, młodzieńcza energiczna pozycja.
- Rozpoznawalny krewny adulta, ale nie sprite dorosłego tylko zmniejszony.

## 3. Scena fabularna

### 08. Empty Room with GOODBYE.TXT
- **Plik:** `room_empty_goodbye.png`.
- Ciepły mały pokój, retro widok niemal z przodu, nie przesadnie izometryczny.
- Beżowa tapeta, drewnopodobna podłoga, puste posłanie, miseczka, niski stolik, trochę śladów przeprowadzki.
- **Brak żaby.** Jedna czytelna koperta na stoliku / podłodze, potem osobny klikalny hotspot.
- Okno Notatnika z tytułem `GOODBYE.TXT` buduje kod (nie rysować wielkiego tekstu na tle). Brak makabry.
- TV może chwilowo zniknąć na potrzeby wizualnego żartu, ale zostaje własnością gracza w inventory.

## 4. Wstępny manifest eksportu

| Asset | Wstępny wymiar | Warstwy | Przeznaczenie |
|---|---|---|---|
| Adult ×4 | 128×128 RGBA | żaba + opcjonalny oddzielny prop | postać |
| Egg | 128×128 RGBA (jajko mniejsze w kadrze) | jajko | adopcja |
| Tadpole | 128×128 RGBA (postać mniejsza w kadrze) | kijanka | rozwój |
| Froglet | 128×128 RGBA (postać mniejsza w kadrze) | froglet | rozwój |
| Empty room | 640×400 RGB/RGBA | pokój; koperta osobno, jeśli interaktywna | scena |

Uwaga: powyższe rozdzielczości są robocze. Najpierw concept sheet, później ręczny sprite cleanup/ekstrakcja, eksport i próba w docelowym UI. Render koncepcyjny nie jest automatycznie produkcyjnym PNG.

## 5. Review i checklista

- [ ] Przyjęty master Adult Healthy.
- [ ] Dorosła żaba zachowuje tę samą twarz w czterech stanach.
- [ ] Czytelność stanu z miniatury 96px.
- [ ] Packing jest memiczne, a neglected nie przesadnie smutne.
- [ ] Żaba nie jest generycznym frog emoji ani infantylną maskotką.
- [ ] Egg, tadpole, froglet są naturalnymi fazami tego samego designu.
- [ ] Pokój można wyświetlić bez postaci, a koperta wyróżnia się w scenie.
- [ ] Brak elementów HUD i napisów na produkcyjnych sprite'ach.
- [ ] Zachowanie stempli i ekwipunku po departure.
- [ ] Dopiero po akceptacji: eksport pojedynczych assetów, asset manifest, test mobilny i integracja Claude.

## 6. Ograniczenia i kolejny etap

To wyłącznie etap grafiki. Nie modyfikować SQL ani działającego PondOS; nie mergować ani publikować. Następne serie: dodatkowe nastroje i stany pokoju, ikony akcji, list/Notatnik, następnie Passport stamps, collection, special avatars, The Lost Pond Files.

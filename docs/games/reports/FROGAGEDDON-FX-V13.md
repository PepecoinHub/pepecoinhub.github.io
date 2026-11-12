# Frogageddon 2.0 — FX v1.3 nad #283

## Zakres

Osobna gałąź `feat/frogageddon-fx-v13` oparta na Draft PR #283 (`8cf0004ff50ba96dddc4f84e39398b0131d1b21d`). W trakcie kończenia pracy #283 został zamknięty bez scalenia (2026-11-12 12:35 UTC); jego gałąź i powyższy commit pozostały dostępne. Nowy Draft celuje w tę zachowaną gałąź, zgodnie ze zleceniem, i wymaga uwzględnienia tej zależności przy przeglądzie. Przeczytano `codex/README_PL.md`. Skopiowano sześć oryginalnych PNG do ścieżek v13 i zachowano instrukcje, patch, walidację oraz sumy SHA-256 w `v13/handoff/`. Obrazów nie generowano ponownie, nie skalowano ani nie retuszowano.

Manifest scalono per broń/per rola; wcześniejsze wpisy, w tym lot Donkey v12 z anchorem [52,64], pozostają niezmienione. Top-level version przyjmuje wartość „13” z paczki, a status opisuje aktualny prototyp QA. Starsze pliki i atlasy nadal są w repozytorium. Nowe efekty działają tylko z istniejącymi packami playtest, bez zmiany klasycznego arsenału.

| Rola | Klatki / FPS | Czas klipu | Prostokąt świata | Reduced frame |
|---|---:|---:|---:|---:|
| donkey.explosion | 8 / 14 | 0,571 s | 178×178 | 4 |
| doge.explosion | 8 / 14 | 0,571 s | 108×108 | 3 |
| moon.explosion | 8 / 14 | 0,571 s | 94×94 | 2 |
| pep.explosion | 6 / 12 | 0,500 s | 40×40 | 2 |
| donkey.activation | 6 / 8 | 0,750 s + ostatnia klatka do końca warning | 70×70 | 0 |
| ban.activation | 6 / 12 | 0,500 s | 65×65 | 2 |

Wszystkie anchory nowych klipów to [64,64], klatki 128×128 RGBA na siatce pikselowej 2×2. Rzeczywisty minimalny margines wynosi 12 px. Wielkość efektu nie oznacza promienia obrażeń ani zasięgu broni.

## Podłączenie

Eksplozje uruchamiają istniejące zdarzenia `boom` i ich fizyczne x/y. Każde uderzenie pojedynczego `pep` ma własny efekt, bez łączenia całego salwa w jedną animację. Instancje zachowują osobny czas startu; kolejka nie nadpisuje równoczesnych eksplozji. Klipy odtwarzają pełny czas frames/fps, bez dodatkowego zanikania, z nearest-neighbor. Rozpoznawanie authored FX nie jest już przywiązane do katalogu v11. Generyczny błysk Canvas jest pomijany tylko przy działającym PNG w tym miejscu, z zachowaniem fallbacku.

Ostrzeżenie Donkey działa w **istniejącej** fazie `warning`, która nadal trwa 1,15 s. PNG jest wyśrodkowany nad tym samym targetX/targetY, 120 jednostek nad znacznikiem terenu. Po sześciu klatkach ostatnia jest utrzymywana do startu nalotu. Nie zmienia celu, opóźnienia ani miejsca spawnu. Ostrzeżenie i wszystkie nowe FX rysowane są przed postaciami, flagami i etykietami HP, więc nie zasłaniają tych oznaczeń ani całej żaby. Lot Donkey i jego timing pozostają z #283.

Pauza zatrzymuje klipy i czas ich życia. Reduced motion wybiera postery z manifestu. Restart czyści kolejkę; restore/reconnect nie odtwarza starych wybuchów. Cache tagi UI/silnika/net/adaptera zaktualizowano spójnie, aby przeglądarka nie łączyła nowego renderera ze starymi metadanymi zdarzeń. Protokół, snapshoty i transport pozostają bez zmian.

## Ban Hammer: chwyt i kontakt

Dotychczasowy SVG młota pozostaje osobną warstwą. Zmierzono środek chwytu [34,46] w viewBox 64×64; mapuje się on dokładnie na dłoń z istniejącego animatora przy renderze 38×38. Korekta obrotu π/2 kieruje głowicę w stronę uderzenia. Dla Ban orientacja jest pozioma według faktycznej strony postaci, zgodnie z jego testem melee; nie zależy od pionowego celowania broni balistycznych.

W silniku dodano wyłącznie kosmetyczne zdarzenie `melee_contacts`, zbudowane **wewnątrz dotychczasowej pętli już zaakceptowanych kontaktów**. Zawiera actor/origin/face/range i współrzędne trafionych postaci. Nie dodano drugiego testu trafienia, nie zmieniono selekcji celów, HP, odrzutu ani amunicji. Zdarzenia są istniejącymi lokalnymi danymi niewchodzącymi do snapshotu.

Spark jest przy bliższej stronie faktycznie trafionego tułowia, maksymalnie 8 jednostek od jego środka w stronę dłoni; wysokość dłoni jest ograniczona do widocznego pasa tułowia celu. Nie jest przyklejony do ofiary po odrzucie. Środek efektu pozostaje w rzeczywistym obszarze kontaktu. Dekoracyjne promienie klipu mogą wykraczać poza niego — nie zadają obrażeń. Przy whiffie i na granicy **48 px** nowy PNG kontaktu się nie odtwarza. Stary generyczny błysk melee ukrywany jest wyłącznie w prezentacji; nie zmieniono serializowanych danych gry. Pełny koncepcyjny atlas młota v11 nadal nie jest rejestrowany jako pocisk ani duplikat postaci. To kalibracja do testu właściciela, nie automatyczne zatwierdzenie artystyczne.

## Materiały w rzeczywistej skali

[Zrzuty: warning, cztery eksplozje, sześć PEP oraz oba kierunki Ban](fx-v13/screenshots.jpg).

[Krótki film zbiorczy MP4 — 15,28 s](fx-v13/demo.mp4). Pięć osobnych nagrań ma 2,2–3,8 s: Doge, Donkey, Moon, PEP Rain i Ban. Nagrania pokazują normalny przebieg `requestAnimationFrame`, 1200×800/25 FPS, bez zoomu i bez skalowania eksportu; plansza ma logiczne 1200×600. Nie są to GIF-y z atlasów ani dostarczone makiety. Usunięto tylko początek z ładowaniem/menu. Dźwięk był wyłączony.

Pełne 24 zrzuty PNG: `/tmp/frogageddon-v13/screenshots.zip`. Pięć filmów i kompilacja: `/tmp/frogageddon-v13/videos.zip`. Surowe nagrania WebM i metadane zachowano w tym samym katalogu. `scripts/pondwars-v13-media.py` odtwarza eksport z zapisanych źródeł, używając systemowego ffmpeg bez instalacji dodatkowych pakietów.

Scenariusze używają prawdziwej mapy Doge Farm i normalnych akcji silnika. Bliski przeciwnik Ban jest kontrolowaną pozycją testową na istniejącym terenie. Naturalne PEP trafiają w parach; stress test synchronizuje sześć normalnych subpocisków tuż przed tą samą powierzchnią, by wymusić sześć wybuchów w jednym kroku. To test kolejki/renderera, nie zmiana produkcyjnej salwy ani pomiar balansu.

## Wyniki

- Pełny Node: **246 testów, 235 zaliczonych, 11 pominiętych, 0 błędów**. W tym 9 testów kontraktów v11/v12/v13, sześć oryginalnych hashy, 42 klatki FX, poprawne postery, zachowanie lotu v12 i punkty Ban. Starsze testy źródeł zachowują siedem oryginalnych PNG v11.
- `scripts/pondwars-v13-assets.py`: 6 atlasów / 42 klatki / margines ≥12 px / RGBA / 2×2 / zgodne źródła i nienaruszone pozostałe wpisy manifestu. [Audyt](fx-v13/asset-audit.json).
- `scripts/pondwars-v13-parity.mjs`: **180 scenariuszy** na dziewięciu mapach (pięć broni, dwa seedy, obie strony) oraz **10 przypadków Ban**: identyczny serializowany stan z #283 po strzale i po rozstrzygnięciu. Test obejmuje HP, ruch, teren, RNG, booms/texts i amunicję, bez lokalnych events/dirty. [Wynik](fx-v13/physics-parity.json).
- Chromium desktop 1440×900, emulowany touch 390×844/DPR2 i reduced motion 1000×750: po 42 klatki, faktyczne warning i trafienia czterech broni, sześć jednoczesnych PEP, pauza, postery i restart. Zmierzono kolejność rysowania: FX poprzedzają HP/flagę/postać. Ban: oba kierunki, odległości 35 / 47,99 / 48 / 55 px i chwyt we wszystkich ośmiu skinach. Zero błędów JS.
- Dodatkowy ogólny test `scripts/pondwars-v11-browser.py`: 70 wersjonowanych klatek lotu/FX w trzech profilach, obrót Doge/Moon, pauza, restart i faktyczne trafienia — OK.
- Dwie lokalne karty: 13 opóźnionych kroków Doge, reconnect w locie, zgodny hash i zachowana amunicja; dodatkowo reconnect przy aktywnym wybuchu v13 nie odtwarza starego FX. Bez Supabase.
- `check_site`, `check_i18n` (wcześniejsze ostrzeżenia) i `git diff --check`: OK. [Dane QA](fx-v13/qa-results.json).

Fizyka, hitboxy, obrażenia, balans, definicje broni, CPU, Supabase, SQL, rankingi, nagrody i produkcyjny Pond Wars pozostają bez zmian. Nie wykonywano nowej oceny balansu; 190 porównań dotyczy zgodności z #283. Fizyczny Android/iPhone nadal niezatwierdzony — touch jest emulacją. Grafiki i chwyt Ban wymagają wizualnej decyzji właściciela.

## Podgląd

`python -m http.server 8000 --directory docs`

`http://localhost:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=farm&qaSeed=123`

Pozostawić PR jako Draft. Niczego nie scalać ani nie wdrażać bez akceptacji właściciela.

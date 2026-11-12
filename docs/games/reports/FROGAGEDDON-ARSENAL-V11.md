# FROGAGEDDON 2.0 — oryginalne animacje v11 nad Draft PR #281

## Zakres i instalacja

Gałąź `feat/frogageddon-v11-art-handoff` bazuje na aktualnym otwartym PR #281 (`3b5296566b1cc99985c944e69836d95b76b41d99`). #281 i wcześniejszy stos pozostają bez zmian. Przeczytano `codex/README_PL.md`, sprawdzono kod instalatora, rozpakowano paczkę do `/tmp/frog-v11-handoff`, a następnie wykonano po kolei:

```
python /tmp/frog-v11-handoff/codex/apply_v11.py --repo . --assets /tmp/frog-v11-handoff
python /tmp/frog-v11-handoff/codex/apply_v11.py --repo . --assets /tmp/frog-v11-handoff --apply
```

Dry-run i apply potwierdziły 7 atlasów i 6 ról. Instalator, jego logi, oryginalne instrukcje, patch/review manifest i asset_validation zachowano w `art/arsenal-polish/v11/handoff/`. SHA-256 każdego PNG jest identyczne z dostarczonym oryginałem. Obrazy RGBA mają poziomy pas 6 lub 8 klatek 128×128; źródłowa siatka pikselowa ma rozmiar 2×2, co nie oznacza atlasu z czterema klatkami. Nie generowano, nie przeskalowano ani nie retuszowano PNG.

Zmiany obejmują wyłącznie manifesty, renderer, jego kontrakt i testy/dokumentację. `pondwars-beta-engine.mjs`, `pondwars-arsenal.mjs`, `pondwars-beta-net.mjs`, mapy, postać/animator/hełm i produkcyjny Pond Wars mają zerowy diff względem #281. Nie zmieniono fizyki, originów, hitboxów, balansu, amunicji, CPU, Supabase, rankingów ani nagród. Nie scalono ani nie wdrożono gry.

## Podgląd i zrzuty

`python -m http.server 8000 --directory docs`

`http://localhost:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123`

Tryby packów pozostają opt-in. V04, v06 i wcześniejsze skiny są zachowane. Bez packów nie uruchamia się nowych broni; v11 nie staje się zatwierdzonym domyślnym artem produkcyjnym.

[Desktop: lot i trafienie wszystkich czterech broni](arsenal-v11/desktop.jpg) · [Emulacja telefonu](arsenal-v11/touch.jpg). Pełne 27 PNG i ZIP: `/tmp/frogageddon-v11/`. Zrzuty pokazują faktyczne akcje UI na prawdziwej mapie, a następnie krokowanie tej samej symulacji do wybranej fazy. Próbki wszystkich klatek i czterech kątów są dodatkową sondą renderera, a nie udawanym torem pocisku. Doge jest detonowany ręcznie przez Enter/FIRE. Silver Donkey celuje w otwartą kolumnę x=1000: przy celu pod pływającą wyspą jego istniejący model może zderzyć się natychmiast po pojawieniu. Nie zmieniano terenu, by to ukryć.

## Klipy i skala

| Broń / rola | Klatki / FPS | Prostokąt w świecie | Maks. widoczna sylwetka w świecie |
|---|---:|---:|---:|
| Doge / lot | 8 / 10 | 44×44 | 40,56×26,81 |
| Doge / eksplozja | 8 / 14 | 108×108 | 101,25×92,81 |
| Silver Donkey / spadanie | 8 / 12 | 52×52 | 43,06×40,62 |
| Silver Donkey / impact | 8 / 14 | 178×178 | 175,22×114,03 |
| Moon Rocket / lot | 6 / 10 | 35×35 | 28,98×32,27 |
| PEP token / spadanie | 6 / 10 | 22×22 | 19,94×20,97 |

Wszystkie anchory źródłowe to [64,64]. Wymiary renderu pozostawiono zgodne z proponowanym manifestem; są niezależne od promienia obrażeń. Największe bounding boxy alfa są raportowane osobno, żeby przezroczysty margines nie udawał rozmiaru postaci. Nearest-neighbor pozostaje włączony, a PNG nie zastępują ikon HUD. Na telefonie obszar gry jest pomniejszony; PEP jest szczególnie drobny. Nie powiększano automatycznie pocisków pod ekran telefonu.

Doge obraca się zgodnie z rzeczywistą prędkością. Moon ma na źródłowej klatce nos ukośnie w górę/prawo; dodano wyłącznie `rotationOffset: π/4` przy rysowaniu, aby jego oś odpowiadała temu samemu torowi. Donkey zachowuje pionową postawę przy spadaniu i startuje od pierwszej klatki dopiero po istniejącym ostrzeżeniu 1,15 s. PEP pozostaje sześcioma fizycznymi pociskami: atlas pokazuje kilka monet na jedną klatkę, więc liczba monet wizualnych nie odpowiada liczbie hitboxów.

## Eksplozje, pauza i reduced motion

Doge i Donkey używają właściwych PNG wybuchu/impactu w miejscu rzeczywistej detonacji. Czas efektu wynosi pełne 8/14 s; usunięto dodatkowe zanikanie tych klipów i zasłanianie ich generycznym błyskiem Canvas. Generyczny błysk jest pomijany tylko wtedy, gdy w tym miejscu działa załadowany klip v11. Przy braku PNG dotychczasowy fallback pozostaje dostępny. Drobiny i dźwięk nie zmieniają się. Moon i PEP nadal mają poprzednie efekty trafienia — paczka nie zawiera dla nich osobnych eksplozji.

Wszystkie klipy wykorzystują istniejące czasy silnika/animatora. Pauza zatrzymuje klatki, pozycje i efekty. Reduced motion wybiera statyczną klatkę 0 lotu oraz widoczną klatkę 4 eksplozji, zamiast ledwie widocznej początkowej iskry. Są to opcjonalne metadane `reducedFrame`, bez zmian w PNG i fizyce. Nowy mecz i restore czyszczą efekty, bez odtwarzania starego wybuchu. Ban Hammer nie ma zarejestrowanego klipu i nie jest ładowany automatycznie; jego kalibracja do dłoni pozostaje osobnym zadaniem. Ostrzeżenie Silver Donkey nadal korzysta z istniejącego SVG, ponieważ paczka nie dostarcza warning PNG.

## Wyniki testów

- `node --test tests/pondwars*.test.mjs`: **102/102**, zero błędów. Cztery nowe testy: oryginalne hashe/RGBA/rozmiary, zachowanie sześciu descriptorów i blokada Ban, wszystkie 44 klatki przy różnych FPS, reduced motion oraz walidacja offsetów/posterów.
- Pełny Node: **241 testów, 230 zaliczonych, 11 pominiętych, 0 błędów**.
- `python scripts/pondwars-v11-assets.py`: siedem identycznych źródeł, zgodne alpha bounds i siatka pikselowa 2×2. [Pełny pomiar](arsenal-v11/asset-audit.json).
- `python scripts/pondwars-v11-browser.py`: Chromium desktop 1440×900, touch 390×844/DPR2 i reduced motion 1000×750. W każdym profilu 44 klatki, osiem próbek obrotu Doge/Moon, rzeczywiste loty i trafienia czterech broni, sześć PEP, cztery pauzy, restart i brak starych FX. Potwierdzono rozmiary drawImage, nearest-neighbor, klatkę startową Donkey i statyczny poster wybuchu. PNG Ban nie jest pobierany. Zero błędów JS.
- Regresja `scripts/pondwars-polish-network-browser.py`: dwie lokalne karty dotykowe, 13 opóźnionych kroków, identyczne hashe, ponowne otwarcie klienta podczas lotu i dalsza detonacja. Czas lotu 0,2167 s oraz amunicja 0 zachowane. Bez Supabase. Fizyczny telefon nadal niezatwierdzony.
- `check_site`, `check_i18n` (wcześniejsze ostrzeżenia tłumaczeń), `git diff --check`: OK.

[Dane QA](arsenal-v11/qa-results.json). Nie powtarzano symulacji balansu 24 300 tur: definicje i silnik są identyczne z #281, więc art nie ma zmieniać wyników tych symulacji.

## Pozostałe uwagi artystyczne

- Silver Donkey dotyka prawego brzegu we wszystkich ośmiu klatkach. W grze krawędź nosa jest ciasna/ucięta; potrzebny poprawiony atlas z marginesem. Nie dodawano paddingu ani nie rozciągano oryginału.
- PEP dotyka górnego brzegu w sześciu klatkach. Ostatnia klatka Doge blast i Donkey impact również dochodzi do brzegu. Warto uzupełnić margines przy kolejnej wersji artu.
- W dostarczonym `preview/actual_v11_atlases.png` podpisy PEP Rain i Ban Hammer są zamienione. Faktyczne PNG mają poprawną zawartość: pep_rain_atlas to monety, ban_hammer_atlas to młotek. Runtime korzysta z plików, nie z błędnych podpisów podglądu.
- Ban wymaga ręcznego powiązania swing/impact z dłonią Pepe, kierunkiem postaci i zdarzeniem animacji. Dotychczasowa oddzielna broń SVG pozostaje zachowana.
- Donkey warning, dedykowane eksplozje Moon/PEP oraz inne brakujące role pozostają poza zakresem dostarczonej paczki. Nie wykorzystano HUD jako zastępstwa.
- Testy dotyku są emulacją. Odbiór wielkości i czytelności wymaga fizycznego Androida/iPhone; nie oznaczono sterowania jako zatwierdzonego.

Kolejny przegląd: poprawka brzegów atlasów, Ban przy dłoni oraz rzeczywisty telefon. Kwestie Frog Mine, cienkich dachów i balansu pozostają w osobnym zadaniu. PR ma pozostać Draft, bez merge/deploy bez decyzji właściciela.

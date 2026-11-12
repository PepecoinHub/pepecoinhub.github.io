# Frogageddon 2.0 — oddzielny podgląd v06 do porównania z v04

## Zakres

Gałąź `feat/frogageddon-pixel-v06-qa` bazuje na #270 (`f4c4e4d7b81e20870fc54e9f4958bfd57780642f`). PR #270 ani jego gałąź nie zostały zmienione. V06 jest nowym kandydatem do przeglądu, nie zamianą zaakceptowanych sprite’ów. Wszystkie osiem skinów, `classic.webp`, v02 oraz pliki i kalibracja v04 pozostają zachowane.

W tej nowej gałęzi dostępne są oba podglądy:

- `games/pondwars-beta.html?art=pixel-v04&qaMap=twin&qaSeed=123`
- `games/pondwars-beta.html?art=pixel-v06&qaMap=twin&qaSeed=123`

Uruchom lokalnie `python -m http.server 8000 --directory docs`; otwórz adresy pod `http://localhost:8000/`. Menu QA ma linki „same map” do obu wariantów. Po zmianie mapy/seeda linki są aktualizowane. Otwierają niezależny podgląd bez parametrów sieciowych. `qaMap`/`qaSeed` są walidowane i działają tylko przy flagach pixel-v04/pixel-v06; nie zmieniają domyślnej gry.

Początkowo modele `classic` obu drużyn pokazują wybrany wariant QA. Inne skiny nadal można wybierać. Bez flagi działa dotychczasowa beta, a `?art=standard-v02` zachowuje swój wcześniejszy widok. Niczego nie scalono ani nie opublikowano.

## Paczka v06

Źródłowe PNG i manifest skopiowano bez edycji. Dokumenty autora `README_PL.md` i `QA.json` są w `../art/pixel-v06/`; status „no repository integration” opisuje paczkę w momencie przekazania.

- Dwa atlasy 1024×1024 RGBA: ciało bez hełmu/broni i równoległy hełm. 53 klatki, 11 stanów, wspólny canvas 128×128.
- Stopa `[64,122]` we wszystkich klatkach. Skala 0,5 daje canvas 64×64 jednostki świata, bez zmiany proporcji i fizycznego punktu stóp.
- Zmierzono 21 kolorów ciała i 6 hełmu (z transparentnym); zachowano pixel art i wyłączony smoothing.
- Manifest nadal nie ma `head`. Jawne `qa-anchors.json` zawiera zmierzony bbox/środek hełmu per frame. Zróżnicowane rozmiary cropów obejmują także ukośne i pionowe hełmy podczas obrotu.
- Źródłowe `hand` aim/charge/fire wskazują już skórę widocznej pięści i zostały zachowane. Punkty jump/backflip trafiały w rękaw; tylko dla tych 12 klatek metadane QA dopasowano do widocznej, obracającej się pięści. Oryginalny manifest pozostaje niezmieniony.

`python scripts/pondwars-v06-anchors.py --check` porównuje 53 rejestracje z pomiarem obrazu. Generator zmienia tylko metadane QA, nigdy grafikę ani źródłowy manifest.

## Cztery bronie w grze

Broń nadal jest osobną warstwą. Dłoń pochodzi z klatki postaci; zamiast przesuwać tę samą pięść inaczej dla każdej broni, dopasowano punkt chwytu w istniejącym SVG. Kalibracja działa wyłącznie dla v06:

| Broń | Punkt chwytu w źródłowym SVG 64×64 | Wymiary renderu |
|---|---|---|
| Bazooka | `[23,43]`, środek uchwytu | 32×32 |
| Łuk | `[41,33]`, drewniane łęczysko w okolicy strzały | 32×28 |
| Rewolwer | `[19,46]`, rękojeść | 30×24 |
| Granat | `[32,46]`, dolna część korpusu przy dłoni | 22×26 |

Obrót i odbicie broni zachowują reguły #266. Offsety obrazów są wyliczone tak, aby powyższy punkt dokładnie trafiał w kotwicę dłoni. Kalibracja v04 i statycznych skinów nie została zmieniona.

Pierwszy aim ma dłoń `[96,60]`, czyli `(16,−31)` world px względem stóp, a charge/fire mają własne punkty. Bazooka, łuk, rewolwer i granat zostały obejrzane na rzeczywistej planszy w obu orientacjach i sprawdzone na poziomie transformacji canvasa. To wstępne dopasowanie kosmetyczne; ostateczny kontakt palców/rękojeści nadal wymaga oceny właściciela.

`projectileOrigin()` nadal liczy origin na dotychczasowej wysokości i dystansie. Nie przesuwamy pocisków do końca narysowanej lufy ani nie dopasowujemy fizyki do prototypu. Przy niektórych kątach kosmetyczna końcówka broni i fizyczny origin mogą się różnić; ewentualna dalsza korekta powinna dotyczyć artu, nie balansu.

## Osiem klatek backflipu

Potwierdzono osiem różnych obrazów obrotu, 12 FPS. Odtwarzają się raz, w czasie 8/12 s. Po ostatniej klatce (315°) renderer wraca do klatki pionowej, domykając obrót. Nie zatrzymuje ukośnej pozy do lądowania i nie dodaje drugiego proceduralnego obrotu.

W v06 czas klipu backflip pochodzi z istniejącego `f.flipT`. Trafienie przerywające stan graficzny nie uruchamia tego samego obrotu od nowa po powrocie do backflipu. V04 zachowuje poprzednią semantykę klipów. `CharacterAnimator`, fizyka skoku/backflipu, prędkości i limity pozostały bez zmian.

Test w grze wywołuje Space, po 70 ms drugi Space i rejestruje osiem kolejnych rectów podczas rzeczywistego lotu. Źródłowy rysunek kończyn nadal wymaga retuszu; w kilku ukośnych ujęciach sylwetka dochodzi do krawędzi klatki. Nie retuszowano tego automatycznie. Przy krótkim locie/kolizji klip może zostać przerwany przez fizyczne lądowanie — nie przedłużamy lotu na potrzeby animacji.

## Hełm i zgodność

Użyto istniejącej klasy `HelmetCosmetics` i reguły pierwszego spadku HP ≥1 z #269. Klasa i snapshoty nie zostały zmienione. Deskryptor obrazu wybiera tylko atlas właściwej wersji. Hełm śledzi wszystkie klatki obrotu, a particle zaczyna w aktualnej orientacji wynikającej z pikseli danego cropu, bez podwójnej rotacji.

Pauza, reduced motion, reset i rekonstrukcja z HP <100 działają jak wcześniej. Reconnect nie odtwarza utraty ponownie. Nie zmieniono silnika fizyki, botów, obrażeń, hitboxów, protokołu sieciowego, Supabase, SQL, wyników ani nagród.

## Wyniki testów

- Testy gry: 69/69; siedem nowych testów v06 obejmuje 53 klatki, rejestrację, osiem kroków obrotu i powrót pionowo, przerwanie przez hit, cztery uchwyty, oba kierunki hełmu, 30/60/144 FPS, pauzę, reduced motion i walidację porównania plansz.
- Pełny Node: 208 testów, 197 zaliczonych, 11 pominiętych, 0 błędów.
- `check_site.py`: 179 HTML / 546 JSON / 46 JS — OK. `git diff --check` — OK.
- Chromium desktop 1440×900, dotyk 390×844/DPR2 i reduced motion 1000×750: wszystkie 53 sloty, osiem klatek prawdziwego backflipu (reduced motion pokazuje klatkę zero), cztery bronie w obu kierunkach, rzeczywiste Enter → fire, zamrożona pauza, pojedyncza utrata hełmu, reset i miks ze starym skinem. Zero błędów JavaScript.
- Porównanie v04/v06 dla twin/seed 123: identyczna maska terenu (hash 2786044850) i wszystkie sześć pozycji startowych, m.in. `[208,298]`, `[796,325]`, `[304,343]`, `[892,266]`, `[400,311]`, `[994,267]`.
- Sieć dwóch kart v06: 35 opóźnionych kroków, autorytatywny restore HP 99 i reconnect bez replay hełmu; lokalny BroadcastChannel, bez Supabase.
- Regresja v04: wszystkie 49 slotów, wcześniejsza kalibracja, trzy profile, utrata hełmu i mieszanie skinów przeszły bez zmian. Restore/reconnect po 33 opóźnionych krokach także przeszedł.

Skrypty: `scripts/pondwars-v06-browser.py`, `scripts/pondwars-pixel-browser.py`, `scripts/pondwars-v06-anchors.py`. Zrzuty v06 są lokalnie w `/tmp/pondwars-pixel-v06-artifacts`. Test telefonu jest emulacją Chromium. Fizycznego telefonu/Safari nie przetestowano — takie urządzenie nie jest dostępne w środowisku.

## Do przeglądu właściciela

Porównaj oba warianty na wskazanej wspólnej planszy. Oceń czytelność 3/4, cztery chwyty i układ kończyn podczas obrotu. Grafiki pozostają kandydatami; nie usuwaj flag QA ani nie zastępuj zatwierdzonych skinów bez osobnej decyzji. Ten PR nie jest zgodą na merge ani wdrożenie.

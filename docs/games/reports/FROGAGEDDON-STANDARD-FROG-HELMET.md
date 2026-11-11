# Frogageddon 2.0 — standardowa żaba i odłączany hełm (prototyp v02)

## Zakres i podgląd

Osobna gałąź `feat/frogageddon-standard-frog-helmet`, bazująca na Draft PR #267, commit `1817103d559bb9a2c63b07c90fc66b0135d6e1be`. PR #267 pozostaje osobnym fundamentem animacji, zależnym od #266. Ten PR dodaje integrację prototypu do przeglądu; nie oznacza zgody na produkcyjne grafiki, merge ani publikację.

Tryb 2.0: otwórz lokalnie `games/pondwars-beta.html?art=standard-v02`. W tym trybie obie drużyny używają jednego standardowego Pepe; menu pokazuje jeden model zamiast listy skinów i wyraźnie oznacza art prototype v02. Bez tej flagi beta zachowuje dotychczasowy wybór ośmiu skinów. Wszystkie stare grafiki i `pondwars-players.mjs` pozostają bez zmian. Klasyczny Pond Wars także nie został zmieniony. Przeniesienie nowej grafiki do domyślnego widoku bez flagi wymaga późniejszej akceptacji właściciela.

Lokalny podgląd: `python -m http.server 8000 --directory docs`, następnie `http://localhost:8000/games/pondwars-beta.html?art=standard-v02`. Dla dwóch kart użyj dodatkowo `&net=host&room=helmet-review` / `&net=join&room=helmet-review`; obie karty powinny samodzielnie włączyć flagę artystyczną. Jest to lokalny BroadcastChannel, bez Supabase.

## Co działa z #267, a co jest nowe

- Z #267: jedenaście stanów proceduralnych, zegar, transformacja ciała i dłoni, lustrzane odbicie, odtwarzanie manifestów oraz statyczne warianty reduced motion. Nie ma drugiego animatora postaci ani nowych stanów.
- Nowe: osobna warstwa hełmu, jednorazowy kosmetyczny particle oraz opt-in standardowego modelu. `CharacterAnimator.observe()` ma tylko opcjonalny callback spadku HP ≥1; jego poprzednia historia HP jest jedynym źródłem zdarzenia. Nowy moduł hełmu nie ma własnego zegara i korzysta z `animator.time`.
- Ciało używa `standard_frog_no_helmet.png`, hełm `helmet_overlay_on_512_canvas.png`, odłączony particle `helmet_cutout.png`. Nie używamy złożonego `standard_frog_with_helmet.png`, żeby nie dublować hełmu. Pliki z paczki są skopiowane bez edycji; nie generowano ilustracji.
- Broń pozostaje zewnętrzną warstwą z #266; `projectileOrigin()` i wszystkie wartości broni pozostają bez zmian.

## Reguła hełmu i odtwarzanie

Pierwszy obserwowany rzeczywisty spadek HP o co najmniej 1 punkt oznacza utratę hełmu. Callback działa dla każdego źródła obrażeń, w tym friendly fire, upadku i obrażeń śmiertelnych. Sam event wybuchu/strzału, brak zmiany HP oraz powtórny render nie uruchamiają efektu. W obrębie meczu zbiór ID utraconych hełmów zapobiega ponownemu wyrzutowi; tury nie resetują tego zbioru.

Particle trwa 1,5 s, obraca się, odlatuje w przestrzeni świata i zanika. Jego pozycja jest funkcją czasu, a nie liczby klatek. Nie korzysta z kolizji, maski terenu, losowości silnika ani tablic pocisków. Rysujemy go przed postaciami/etykietami/flagami, więc nie przesłania identyfikacji drużyny; pasek HUD znajduje się poza canvasem. Pauza zamraża istniejący zegar i canvas. Reduced motion pomija wyrzut, a włączenie preferencji w trakcie lotu usuwa particle bez wznowienia po jej wyłączeniu.

Nowy mecz przywraca hełmy. Przy uruchomieniu z zapisu, synchronizacji i reconnect widoczność jest rekonstruowana z HP: obecnie wszystkie żaby startują z 100 HP i nie istnieje leczenie, więc HP <100 oznacza utracony hełm. Przywrócenie usuwa lokalne particles i nie odtwarza historycznego trafienia. Podłączone są istniejące `net.onrestore` i `net.onstart`/`launch`; nie zmieniono protokołu ani formatu snapshotu. Dodanie leczenia w przyszłości wymaga jawnej trwałej flagi w stanie meczu — sama rekonstrukcja z HP wtedy nie wystarczy. Cofnięcie do autorytatywnego snapshotu sprzed obrażeń rekonstruuje hełm zgodnie z tym snapshotem.

## Weryfikacja geometrii

| Element | Wynik |
|---|---|
| Manifest | `version:1`, `facing:right`, wszystkie 11 stanów zgodne z adapterem #267 |
| Klatki | po jednej klatce 512×512 na stan; to ten sam idle, nie 43 gotowe klatki akcji |
| Warstwy ciała i hełmu | oba PNG RGBA 512×512; wspólne współrzędne, brak dodatkowego offsetu |
| Punkt stóp | `[256,486]` w każdym stanie; mapuje się dokładnie na `(f.x,f.y)` przed deformacją proceduralną |
| Skala | `64/512 = 0,125`; pełny canvas ma 64×64 world px, bez rozciągania proporcji |
| Widoczne ciało | alpha bbox `[107,30,404,488]`; około 37,125×57,25 world px; dolne 2 source px znajdują się do 0,25 world px poniżej punktu stóp |
| Hełm | alpha bbox `[112,20,432,140]`; cutout 320×120, czyli 40×15 world px |
| Środek particle | source `[272,80]` → lokalnie `[2,−50,75]` względem stóp; ta sama transformacja co overlay, także w lewo i podczas backflipu |
| Dłoń źródłowa | `[368,346]` → lokalnie `[14,−17,5]`; jest przy biodrze, **niezgodna z docelową wysokością broni z #266** |
| Tymczasowa kotwica broni | jawnie `(0,−32)` jak #266; współdzieli transformację ciała, nie przesuwa originu pocisku |

Nie zmieniono ani nie przedstawiono orientacyjnej dłoni z manifestu jako zaakceptowanego uchwytu. Przy jednej klatce idle nie da się uzyskać poprawnej anatomicznej dłoni dla wszystkich kierunków aim/fire. Ten PR utrzymuje wysokość broni z #266; docelowy uchwyt wymaga klatek z uniesioną ręką i kalibracji per klatka. Proporcje, finalne ilustracje i punkty dłoni pozostają przedmiotem przeglądu artystycznego.

Dokumentacja źródłowa z ZIP jest zachowana w `../art/standard-v02/`: `CODEX_HANDOFF_PL.md`, `README_PL.md`, `helmet_contract.json`. Ostatni plik opisuje warstwę hełmu, nie rozszerza schematu manifestu #267. Manifest źródłowy pozostaje niezmieniony.

SHA-256 skopiowanych PNG:

```text
9c401eba4fa6926291dbb7da3d899806ac25811429ccf685fb22739441fa0db3  standard_frog_no_helmet.png
58c819cb861448c851f431818eb34458bf0e8f277d398ebc1cfe78586efd42c5  helmet_overlay_on_512_canvas.png
5e3874e34d91c7aceef0c16258440fd550033340fc5b8c1a53e83dd5513569af  helmet_cutout.png
```

## Testy

- Testy gry: 55/55, w tym 10 nowych testów hełmu. Obejmują 1 HP, damage 0, wielokrotne trafienia, friendly fire, prawdziwy fall damage, śmiertelne obrażenia, nowy mecz, rzeczywiste snapshot/restoreInto, pauzę, reduced motion oraz 30/60/144 FPS.
- Stan gry i snapshot są identyczne z kosmetycznym obserwatorem i bez niego; brak zmian HP/obrażeń wskutek hełmu.
- Wszystkie 11 proceduralnych póz przetestowano dla obu kierunków; początkowy środek odłączonego cutoutu zgadza się z overlayem. Sprawdzono format PNG, wymiary, stałe stopy i źródłowe dłonie wszystkich klipów.
- Pełny Node: 194 testy, 183 zaliczone, 11 pominiętych, 0 błędów (poza sandboxowym ograniczeniem podprocesów).
- `python scripts/check_site.py`: OK, 179 HTML / 540 JSON / 46 JS. `git diff --check`: OK.
- Chromium: 1440×900 desktop, 390×844 touch/DPR2, 1000×750 reduced motion. Sprawdzone liczby warstw: 6 ciał i 6 hełmów, potem 5 hełmów i jeden particle; kolejne trafienie bez powtórki; po 1,5 s brak particle; nowy mecz znów 6 hełmów. Pauza daje identyczne bajty obrazu canvasa. Test obejmuje zmianę reduced motion w trakcie, rzut w lewo/backflip, brak błędów JS i zachowanie ośmiu skinów w zwykłej becie.
- Dwie karty Chromium: rzeczywiste callbacki `net.onrestore` i `net.onstart`/reconnect z HP 99 pokazują pięć hełmów, bez particle i bez historycznego wyrzutu. Test nie łączy się z Supabase.

Uruchom `node --test tests/pondwars*.test.mjs`; po uruchomieniu lokalnego serwera także `python scripts/pondwars-helmet-browser.py` (Playwright i Chromium). Zrzuty lokalne trafiają do `/tmp/pondwars-helmet-artifacts`. Testy mobilne są emulacją Chromium; rzeczywisty telefon/Safari pozostaje do QA właściciela.

## Kolejny krok

Przegląd stylistyki i proporcji przez właściciela, dostarczenie dedykowanych klatek aim/fire z poprawnymi dłońmi, następnie pozostałych planowanych klatek. Dopiero po zatwierdzeniu artu rozważyć domyślny tryb bez flagi. Osobno pozostaje wspólny model predykcji opisany w #267. W tej integracji nie zmieniono fizyki, botów, obrażeń, Supabase, SQL ani nagród. Nie wykonano merge ani wdrożenia.

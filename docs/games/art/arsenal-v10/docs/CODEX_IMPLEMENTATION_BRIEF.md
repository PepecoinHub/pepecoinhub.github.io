# CODEX – FROGAGEDDON 2.0 ARSENAL EXPANSION, STAGED DRAFT PRs

## Repo i aktualizacja

`PepecoinHub/pepecoinhub.github.io`.

Przed rozpoczęciem sprawdź `main`, aktualne otwarte PR-y i gałęzie. Znane zależności z ostatniego audytu: #266 (broń na wysokości dłoni), #267 (fundament animacji), #269 (hełm) i #270 (pixel-v04 QA). Jeżeli są nowe PR-y, również je uwzględnij. **Nie bazuj bezmyślnie na starej gałęzi ani nie duplikuj prac.** Używaj Draft PR-ów, nie merge/deploy. Nie modyfikuj Supabase/SQL/nagród/rankingów/produkcji.

Kod stanu początkowego: `docs/games/js/pondwars-beta-engine.mjs`, `docs/games/js/pondwars-beta.mjs`, `docs/games/pondwars-beta.html`, `docs/games/img/pondwars/`, `tests/pondwars-beta.test.mjs`; wersja classic jako regresyjny baseline. Silnik używa `W=1200`, `H=600`, `WATER=560`, `STEP=1/60`. `WEAPONS` obejmuje już `gold`, `toe`, `mine`, `cluster`, `shard`, `candles` i inne. Nie dodawaj ich pod inną nazwą bez rozróżnienia mechaniki.

## Wersja artystyczna i grafiki

Dołączony zip `Frogageddon_Arsenal_Phase1_v10.zip` ma źródła/PNG w `icons_128/`, `hud_64/` i `effects/`.
Nie ruszaj zatwierdzonych postaci, ich hełmów, animacji, chwytów. Nowe bronie w trybie QA można wyrenderować jako osobne ikony. Na etapie A zarejestruj je bez gameplayu. W etapie B dołącz VFX. Zatrzymaj oryginalne assety w repo. Nie rozciągaj z smoothingiem, nie zakładaj, że PNG są oficjalnie zaakceptowane.

## Kluczowa korekta: Mega Golden Foot

Aktualna `gold`: rzucona broń wybuchowa z 3 s fuse, 68 HP, promieniem 58, 5 dodatkowymi `toe` (36 HP, radius 34, 1.5 s fuse); tylko jedna sztuka. Wariant **Mega Golden Foot** jest ciągle rzuconą złotą stopą: szeroka fala uderzeniowa i wielki ślad pięciu palców, nie nowa broń wręcz. Testowe propozycje: `gold` damage 58/radius 66/children 5, fragment `toe` damage 12/radius 16; boost knockback ×1.2 tylko dla `gold`; ammo1 i fuse3 zachowane. Przed przyjęciem parametrów przetestuj maksymalne skumulowane obrażenia od fragmentów; nie zmieniaj innych broni automatycznie.

## PR A – Arsenal foundation

- Rozdziel definicje art/UI od logiki strzału w sposób minimalny i weryfikowalny, kompatybilny z istniejącym kodem.
- Zbuduj flagę QA (np. `?arsenal=exp-v1`) wyłączoną domyślnie; nie zmieniaj opublikowanej gry.
- Dodaj struktury/registry dla **NOWYCH** ID: `bell_bomb`, `frog_mine`, `moon_rocket`, `ban_hammer`, `pep_rain`, `doge_flyer`, `silver_donkey`. Zachowaj `gold` jako jedyny Golden Foot; w rejestrze graficznym może używać `golden_foot_v2`.
- Obsłuż amunicję, etykiety, fallback ilustracji, responsywny interfejs i paginację/kategorie arsenału zamiast wciskać wszystko w 4 kolumny na telefonie.
- Nie wprowadzaj aktywnych broni, które strzelają zanim logika istnieje. Zablokuj je w UI do PR B/C/D.
- Uwzględnij seed, snapshot, replay, BOT i deterministyczne `newGame`/`rng`.
- Testy: UI, rejestr, amunicja, brak wycieków zmian do classic/prod. Draft PR na osobnej gałęzi, w opisie uzasadnienie bazy gałęzi.

## PR B – Simple weapons: Golden Foot v2, Bell Bomb, Frog Mine

**Golden Foot v2**: aktualizacja `gold` tylko pod QA flagą (w miarę możliwości per-match loadout/config, nie globalnym mutowaniem WEAPONS podczas wielowątkowych symulacji). Zachowaj rodzaj wyrzutu i 5 palców, ale zmniejsz ich dotkliwość. Efekt uderzenia z `effects/golden_foot_impact_00..05.png`. Podstawowy strike radius66/dmg58, toes radius16/dmg12; knockback 1.2x (wartości STARTOWE).

**Bell Bomb**: nowy typ granatu z odliczaniem 3 s, odbiciem od rzeczywistego terenu, obrażeniami 44, promieniem 32, knockback 1.15×, 2 użycia/drużyna. Włóż przez obecną ścieżkę fuse/stepShot, nie kopiuj całego fizycznego modułu. Dźwięk dzwonka na odbiciu throttlowany, wyłączany razem z globalnym sound-off, nie emituj go ze środowiska bez zgody. Najpierw bez odłamków. Pierwszy kontakt ze skórą żaby nie powinien odpalać bomby przed fuse, zgodnie z zasadami granatów.

**Frog Mine**: nie podmieniaj `mine`. Oddzielny typ z uzbrojeniem 1 s, trigger dla żywego przeciwnika w 48 px, następnie jeden skok w kierunku celu i wybuch maks. po 0.35 s lub kolizji; dmg34/radius30, 2 użycia/drużyna. Sama żaba-mina nie jest nowym graczem. Friendly fire podczas detonacji tak, ale wyzwalanie tylko przez wroga (decyzja testowa). Jeśli bot lub ruch jest w pobliżu, unikaj triggerowania zbyt wcześnie po postawieniu. Po śmierci właściciela mina nadal istnieje jak zwykła mina, jeśli reguły gry tak przewidują.

Testy: bliskie trafienia, water/splash, cienkie przeszkody, odbicia, detonacje, amunicja, koniec tury, chain explosions, near-own-team, pauza, resync/reconnect, reduced motion (wizualne efekty), kilka podłożonych min. Nie wprowadzaj sound/video obciążających mobile.

## PR C – PEP pack

- `moon_rocket`: dmg52/radius35, ammo2, wind:true, power580, knockback1.1, mocniejsza od standardowej bazooki, wyraźnie rzadsza.
- `ban_hammer`: melee dmg42/range~60, ammo2, knockback1.8, bez krateru; ma być zróżnicowany względem `bat` (32 HP, unlimited).
- `pep_rain`: 6 spadających tokenów po 8 dmg, małe oddzielne kratery (radius~11), ammo1, targetX jak `candles`, ale inne rozrzuty i rytm; wynik deterministyczny z `g.rand()`. Nie rób 6-krotnego full-hit w jeden pixel jako domyślnego.
- Testy regresji oraz możliwość rozsądnego trafiania przez CPU. Bez zmiany całego AI w tym samym PR.

## PR D – controlled weapon + legendary strike

**Doge Flyer**: ammo1, maksymalnie 4.5 s sterowanego lotu, 46 HP/radius34, prędkość max ~260 px/s, sterowanie strzałkami (WASD jako alternatywa), łagodne przyspieszenie i opór. Enter/Space detonuje. Detonacja przy kolizji lub wyczerpaniu czasu. Ważne: po wystrzeleniu klawisze muszą kontrolować Doge, nie żabę i nie kamerę; nie wolno przełączać tury w połowie sterowania. Input przez istniejący `applyInput/NetMatch` w tickach fixed-step, bez zależności od lokalnego FPS. Ochrona przed różnymi wynikami host/guest.

**Silver Donkey**: ammo1, dmg78/radius72, knockback1.3. Wybór X na mapie jak `candles`; widoczny sygnał docelowego miejsca >=1.2 s, po czym ciężki srebrny osioł spada od góry, zderza się z terenem/frog i wybucha. Nie spawnuje się bez ostrzeżenia nad graczem. Zapewnij responsywne targetowanie na mobile i botom.

## PR E/F – mapy

E: Moon Base, Pond of Doom, Doge Farm. F: Lite Quarry, Bell Tower. Dodaj do `MAPS` i `makeTerrain` deterministyczne kształty w masce `Uint8Array(1200*600)`. Zachowaj WATER=560 i 2–4 żaby/drużyna zgodnie ze spawn safety. Tła i dekoracje osobno od maski kolizji. Nie zmieniaj globalnej grawitacji na Moon Base: to tylko temat wizualny do czasu osobnej decyzji. Dane startowe, mapSeed, równość stron, bot i FPS przetestować na wszystkich mapach. W paczce są tylko koncepty terenu Moon Base/Pond of Doom, nie działające maski. Każda mapa musi być możliwa do wygrania, bez automatycznych upadków po spawnie.

## Test strategy

1. `node --test tests/pondwars*.test.mjs` oraz pełny Node, `python scripts/check_site.py`, `python scripts/check_i18n.py`.
2. Długie deterministyczne symulacje: identyczny seed + input = identyczny stan hash; hostile/host/friendly hit; replays i reconnect, brak niedeterministycznych Math.random w engine.
3. Weryfikacja balansu: min. 300 symulowanych rund dla broni i mapy, obie strony, 2/3/4 frogs, 3 trudności CPU; śledź średnie obrażenia, zepchnięcia do wody, trafienia własnych żab, czas tury, użycia.
4. QA wizualne: game canvas na desktopie i emulacji mobile 390px, realne urządzenie dopiero osobnym zadaniem, kontrola HUD 24/36/48px, smoke/no sound/reduced motion/pauza.
5. Przerwij merge/deploy: każdy PR to Draft, właściciel musi sam zatwierdzić integrację.

## Definicja ukończenia

PR ma: diff ograniczony do swojego etapu, jasny opis, listę testów i ich faktyczne wyniki, ograniczenia oraz link do podglądu QA. Nie twierdź że fizyka działa, jeśli implementowano jedynie registry. Nie ustawiaj nowego arsenału jako domyślnego bez zgody.

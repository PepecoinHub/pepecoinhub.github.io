# FROGAGEDDON 2.0 – ARSENAL ART / PHASE 1

Status: **samodzielny pakiet grafik koncepcyjnych i dokumentacji**, bez integracji z grą, merge, zmian SQL ani publikacji.
Repo: `PepecoinHub/pepecoinhub.github.io`. Rozwój Frogageddon wykorzystuje `docs/games/js/pondwars-beta-engine.mjs`, `pondwars-beta.mjs`, `pondwars-beta.html`, a bazę animacji tworzą PR #266, #267, #269 i #270. Przed implementacją pobrać aktualny stan repozytorium oraz PR-y.

## Co zawiera archiwum

- `icons_128/*.png`: **osiem osobnych 128×128** przeźroczystych ikon w siatce 2×2. Narysowane na wspólnej pikselowej palecie i gotowe jako prototypy artystyczne, niezatwierdzone do produkcji.
- `hud_64/*.png`: ten sam art, 64×64 bez interpolacji (do oceny czytelności).
- `effects/*_00..05.png`: po 6 osobnych klatek próbnych dla Mega Golden Foot, Bell Bomb, Frog Mine.
- `effects/*_sheet.png`: odpowiadające atlasy efektów.
- `previews/arsenal_8_icons.png`: plansza ośmiu broni.
- `previews/hud_64px.png`: próba w siatce ekwipunku.
- `previews/moon_base_terrain_concept.png`, `pond_of_doom_terrain_concept.png`: wizualizacje koncepcyjne, **nie maski kolizji**.
- `docs/WEAPON_BALANCE.json`: proponowane wartości do pierwszych testów, nie zmienione w grze.
- `docs/CODEX_IMPLEMENTATION_BRIEF.md`: zakres i kolejność PR-ów, testy, zależności i wytyczne integracyjne.
- `docs/ASSET_VALIDATION.json`: zweryfikowane rozmiary, przezroczystość, liczbę kolorów i siatkę ikon.
- `sources/make_icons.py`: skrypt źródłowy odtwarzający pikselowe grafiki w Pythonie (Pillow).

## Decyzje artystyczne

**Golden Foot = wariant 2, czyli Mega Golden Foot**. Zachowaj czytelną stopę z pięcioma palcami i piętą. Efekt końcowy: duży złoty odcisk stopy, szeroka fala uderzeniowa i złoty błysk. Nie zamieniaj istniejącego `gold` na broń wręcz. W silniku obecny `gold` to rzucany pocisk o `damage:68, radius:58, fuse:3, children:5`. Wariant 2 to ewolucja tego zachowania.

**Bell Bomb**: niezależna od frag grenade i cluster; głośny/dający się wyciszyć dźwięk odbicia, jedna eksplozja i mocniejszy odrzut przy umiarkowanych obrażeniach. Nie tworzyć odłamków w pierwszej wersji.

**Frog Mine**: oddzielna od istniejącej `mine`, z oczywistą żabią sylwetką i fazą uzbrojenia (migająca lampka), po aktywacji jeden króciutki skok ku wrogowi. Nie dawać jej dodatkowych obrażeń za samo podejście.

**Pepecoin weapons**: Moon Rocket, Pep Rain, Ban Hammer. Każda ma unikalną mechanikę i czytelny związek z PEP.

**Doge Flyer**: sterowany lot, nie mechaniczna kopia chodzącej owcy. Własne przyspieszenie i bezwładność; sterowanie strzałkami, detonacja Enter/Space.

**Silver Donkey**: rzadki ciężki atak z nieba; czytelny srebrny osioł z `L`, inspirowany Litecoin. Wyraźne ostrzeżenie przed trafieniem, silny knockback, jeden strzał na drużynę.

## Rozsądne ograniczenia

Nie projektuj w tej iteracji wszystkich 8 efektów wybuchów na poziomie produkcyjnym. Priorytet to Golden Foot, Bell Bomb i Frog Mine; pozostałe ikony są szkicami do przyszłych etapów. Grafiki pokazują oryginalną stylizację memiczną. Brandowe motywy (Doge/Bells/Litecoin) to fanowskie nawiązania, nie oficjalna współpraca.

Wersja produkcyjna wymaga: QA w grze w skali 24/36/48 px, sprawdzenia na tle różnych map, dopasowania orientacji i animacji broni do fizyki, ręcznego zatwierdzenia. **Nie publikować / nie scalać bez zgody właściciela.**

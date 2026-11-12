# FROGAGEDDON – Flight v15

17 animacji w locie / na ziemi, do podmiany zasobów po sprawdzeniu ich zgodności z kodem gry.

## Format
- PNG RGBA, klatka 128 × 128, jeden poziomy pasek, przezroczyste tło.
- Ostra siatka 2 × 2 px, bez antyaliasingu, kontur #1a1410.
- Min. 8 px przezroczystego marginesu w każdej klatce.
- Nie obracać pikseli pojedynczych klatek lotu: kierunek / obrót realizuje silnik gry.
- FPS nieokreślone w prompcie dobrano jako 10 (8 klatek) lub 12 (6 klatek).
- Kotwica [64, 96] dla dynamitu, miny i żaby-miny na ziemi; pozostałe [64, 64].

## Pliki
1. `sprites/grenade_flight.png` – granat z iskrzącym lontem, 8 kl., 10 FPS, anchor [64, 64].
2. `sprites/bazooka_rocket_flight.png` – rakieta z płomieniem i dymem, 6 kl., 12 FPS, anchor [64, 64].
3. `sprites/cluster_grenade_flight.png` – granat kasetowy z pulsującymi lampkami, 8 kl., 10 FPS, anchor [64, 64].
4. `sprites/cluster_fragment_flight.png` – mały odłamek z płomykiem, 6 kl., 12 FPS, anchor [64, 64].
5. `sprites/golden_foot_flight.png` – złota stopa z połyskiem, 8 kl., 10 FPS, anchor [64, 64].
6. `sprites/golden_toe_flight.png` – pojedynczy złoty palec, 6 kl., 12 FPS, anchor [64, 64].
7. `sprites/revolver_bullet_flight.png` – pocisk rewolweru ze smugą, 6 kl., 12 FPS, anchor [64, 64].
8. `sprites/arrow_flight.png` – strzała z lotkami, 6 kl., 12 FPS, anchor [64, 64].
9. `sprites/drill_missile_flight.png` – pocisk-wiertło, obracająca się spirala, 8 kl., 12 FPS, anchor [64, 64].
10. `sprites/red_candles_fall.png` – jedna świeca giełdowa z górnym i dolnym knotem, 6 kl., 12 FPS, anchor [64, 64].
11. `sprites/dynamite_lit.png` – wiązka dynamitu z palącym się lontem, 8 kl., 10 FPS, anchor [64, 96].
12. `sprites/landmine_armed.png` – uzbrojona mina z migającą diodą, 6 kl., 12 FPS, anchor [64, 96].
13. `sprites/jetpack_flames.png` – plecak odrzutowy z płomieniami w dół, 6 kl., 12 FPS, anchor [64, 64].
14. `sprites/mega_golden_foot_flight.png` – wielka złota stopa, 8 kl., 10 FPS, anchor [64, 64].
15. `sprites/mega_toe_flight.png` – wielki złoty palec, 6 kl., 12 FPS, anchor [64, 64].
16. `sprites/bell_bomb_flight.png` – złoty dzwon z kołyszącym się sercem, 8 kl., 10 FPS, anchor [64, 64].
17. `sprites/frog_mine_arming.png` – żaba-mina z pulsującym czerwonym przyciskiem, 8 kl., 10 FPS, anchor [64, 96].

## Zawartość
- `sprites/` – 17 atlasów PNG.
- `codex/manifest_patch.json` – metadane każdej animacji (`src`, `frame`, `columns`, `rows`, `frames`, `fps`, `loop`, `anchor`, `size`).
- `codex/asset_validation.json` – wyniki automatycznej kontroli każdej klatki.
- `preview.png` – każda pierwsza klatka z żabą 1:1, powiększenie ×3 i wszystkie klatki.

## Integracja
Manifest jest łatką informacyjną, a nie kodem automatycznie wdrażającym. Animacje i zasoby można podpiąć do istniejącego silnika dopiero po kontroli mapowania nazw i offsetów; obrazki nie wdrażają logiki fizyki ani efektów trafienia.

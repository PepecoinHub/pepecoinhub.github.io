# FROGAGEDDON — Arsenal v13

Kompletna paczka grafik broni do FROGAGEDDON w estetyce żaby Pepe v06 / atlasu v11.

## Zawartość

- **46 plików PNG**: 31 atlasów i efektów (klatki po 128×128 px), 15 grafik held (64×64 px).
- `sprites/` — pociski i animacje broni.
- `effects/` — eksplozje, ostrzeżenia, rozpryski i odciski.
- `held/` — grafiki trzymanych przedmiotów; grip [20, 40] w px.
- `codex/manifest_patch.json` — src, frame, columns, frames, fps, loop, anchor, size, grip.
- `codex/asset_validation.json` — raport jakości każdego PNG.
- `preview.png` — wszystkie grafiki i wzór żaby w skali 1:1 oraz ×3.

## Lista pozycji

1. Grenade — sprites/grenade_flight.png, held/grenade.png
2. Bazooka — sprites/bazooka_rocket_flight.png, held/bazooka.png
3. Cluster grenade — sprites/cluster_grenade_flight.png, held/cluster_grenade.png, sprites/cluster_fragment_flight.png
4. Golden Foot — sprites/golden_foot_flight.png, sprites/golden_toe_flight.png, held/golden_foot.png
5. Baseball bat — sprites/baseball_swing.png, held/baseball.png
6. Revolver — sprites/revolver_bullet_flight.png, held/revolver.png
7. Bow — sprites/arrow_flight.png, held/bow.png
8. Landmine — sprites/landmine_armed.png, held/landmine.png
9. Dynamite — sprites/dynamite_lit.png, held/dynamite.png
10. Red Candles — sprites/red_candles_fall.png, held/red_candles.png
11. Drill missile — sprites/drill_missile_flight.png, held/drill_launcher.png
12. Grappling hook — sprites/grappling_hook_flight.png, held/grappling_launcher.png
13. Jetpack — sprites/jetpack_flames.png, held/jetpack_backpack.png
14. Teleport — effects/teleport_flash.png, held/teleport_device.png
15. Mega Golden Foot — sprites/mega_golden_foot_flight.png, sprites/mega_toe_flight.png, effects/mega_foot_imprint.png
16. Bell Bomb — sprites/bell_bomb_flight.png, effects/bell_bounce_wave.png
17. Frog Mine — sprites/frog_mine_arming.png
18. Ban Hammer — sprites/ban_hammer_swing.png, held/ban_hammer.png
19. Moon Rocket FX — effects/moon_rocket_explosion.png
20. PEP splash — effects/pep_coin_splash.png
21. Silver Donkey alert — effects/silver_donkey_warning.png
22. Medium / large blast — effects/explosion_medium.png, effects/explosion_large.png
23. v11 fixes — sprites/pep_rain_margin_fix.png, effects/doge_blast_margin_fix.png, effects/donkey_impact_margin_fix.png

## Zasady formatu

- RGBA; alpha=0 wszędzie poza obiektem, bez szachownicy i bez półprzezroczystości.
- Klatki poziome; 6/8 × 128×128; held 1 × 64×64.
- Każdy piksel rysunkowy to pełny blok 2×2; brak antyaliasingu.
- Marginesy atlasów minimum 8 px na każdej klatce. Held minimum 4 px.
- Sprites anchor [64,64]; held anchor [32,32], grip [20,40].
- `size` to propozycja wielkości świata gry (px, nie rozmiar PNG).
- Pociski i efekty nie zmieniają fizyki ani hitboxów w grze, dopóki nie są podłączone w kodzie.

## Źródła i adaptacje

- Styl i paleta: archiwum `Frogageddon_2_0_Art_v06.zip`, `Frogageddon_PR281_V11_Art_Handoff.zip`.
- `moon_rocket_explosion` i `silver_donkey_warning`: przyjęte z wcześniejszego archiwum `Frogageddon_FX_Art_v13.zip` po weryfikacji.
- Poprawki v11: PEP Rain, Doge Blast i Donkey Impact są przeskalowane/wycentrowane w granicach klatek z zachowaniem oryginalnego pixel-artu; przyjęto minimalną ingerencję w kształt.
- `teleport_flash`, `baseball_swing`, `ban_hammer_swing` itd. to samodzielne atlasy wizualne, integrator może podpiąć pod obecną logikę.
- Nowe klatki tworzone skryptowo (shapes na siatce 64×64, eksport nearest 2×), nie są kopiami ilustracji koncepcyjnych.

## Testowanie i uwagi

Sprawdź `codex/asset_validation.json` dla wyników każdego pliku. Kontrola liczy wymiary, ramki, margines, alpha, siatkę 2×2, niepuste klatki i skoki centroidów; subiektywne dopasowanie stylu jest pokazane tylko na `preview.png` i nie może być wykazane samą metryką. Dodatkowy przegląd wizualny w grze jest wskazany.

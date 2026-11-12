# Frogageddon 2.0 — Silver Donkey ART FIX v1.2

Ten pakiet koryguje **konkretny błąd graficzny** z Draft PR #282: pysk Silver Donkey jest ucięty przy prawej krawędzi wszystkich 8 klatek atlasu v11.

## Co zostało zmienione
- Osiem klatek pozostaje 128 × 128 px, cały atlas 1024 × 128 px, 2×2 pixel grid, RGBA.
- Cały rysunek w każdej klatce przesunięto **o 12 pikseli w lewo**.
- Odtworzono drobny zaokrąglony czubek pyska, który w v11 był ucięty przez granicę klatki. Dodano minimum 8 px bezpiecznego odstępu od prawej krawędzi.
- Punkt zaczepienia w manifest zmienia się z `[64,64]` na `[52,64]`. Pozwala to utrzymać tę samą pozycję obiektu w świecie (przesunięcie grafiki i anchora jest identyczne).
- Wymiary świata `[52,52]`, FPS, animacja, fizyka i hitboxy pozostają bez zmian.

## Integracja wyłącznie w Draft PR
1. Bazuj na `feat/frogageddon-v11-art-handoff` z PR #282 i utwórz oddzielny art Draft PR.
2. Skopiuj PNG do `docs/games/art/arsenal-polish/v12/sprites/silver_donkey_atlas.png`.
3. W `docs/games/art/arsenal-polish/manifest.json` ustaw **tylko** `weapons.donkey.flight` według `codex/manifest_patch.json`.
4. Nie zmieniaj `weapons.donkey.explosion`, bo wpływa na oddzielną sekwencję wybuchu.
5. Uruchom testy `tests/pondwars-v11-art.test.mjs` i walidator źródeł. Zaktualizuj te testy, które twardo wymagają starej ścieżki atlasu.
6. Sprawdź ekran: przejście wszystkich 8 klatek, kierunki i obrót podczas nalotu, brak przycięcia pyska, pauza, reduced motion, restart, odtworzenie stanu i wielkość postaci w świecie.

## Ryzyka i status
Wciąż osobnej pracy wymagają ostatnia klatka `donkey_impact_atlas.png` (dotyka prawego brzegu), brak warning PNG oraz styki ręki z Ban Hammer. Ten pakiet dotyczy **wyłącznie lotu Silver Donkey**. Grafika została zweryfikowana programowo, ale **nie została podłączona do gry i przetestowana w Chromium**.

Nie scalać i nie wdrażać bez decyzji właściciela.

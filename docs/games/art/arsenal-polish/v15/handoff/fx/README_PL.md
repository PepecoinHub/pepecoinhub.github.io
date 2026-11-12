# FROGAGEDDON – FX v15

Paczka C: efekty i wybuchy. 10 atlasów, 74 klatki. Nie zawiera zmian kodu ani fizyki.

## Parametry
- Pliki PNG RGBA z przezroczystym tłem, bez antyaliasingu.
- Piksel-art tworzony na 64×64, eksportowany do 128×128 metodą nearest-neighbor, siatka 2×2.
- Animacje są poziomymi paskami po 128×128 px na klatkę.
- Margines ≥8 px w każdej klatce; punkt zakotwiczenia [64,64], wszystkie animacje loop=false.
- Wartości FPS dla efektów nieokreślonych w poleceniu są propozycją do ustawienia w silniku.

## Pliki

| Plik | Klatki | FPS | Anchor | Opis |
|---|---:|---:|---|---|
| `effects/explosion_medium.png` | 8 | 16 | (64,64) | Średni wybuch: błysk, kula ognia, chmury dymu |
| `effects/explosion_large.png` | 8 | 14 | (64,64) | Duży wybuch z grzybem dymowym i grudkami ziemi |
| `effects/moon_rocket_explosion.png` | 8 | 16 | (64,64) | Księżycowa eksplozja, niebieski błysk, gwiazdy, pył |
| `effects/pep_coin_splash.png` | 8 | 16 | (64,64) | Rozprysk monet PEP i zielonych iskier |
| `effects/silver_donkey_warning.png` | 6 | 12 | (64,64) | Migający czerwony celownik, wykrzyknik, cień osła |
| `effects/bell_bounce_wave.png` | 6 | 12 | (64,64) | Złoty dzwon, łuki dźwięku i nutka |
| `effects/mega_foot_imprint.png` | 6 | 12 | (64,64) | Głęboki odcisk stopy, pęknięcia gleby, kurz |
| `effects/teleport_flash.png` | 8 | 16 | (64,64) | Zapadający się niebieski wir z białym rozbłyskiem |
| `effects/donkey_impact.png` | 8 | 16 | (64,64) | Uderzenie osła, fala, odpryski kamieni i kurz |
| `effects/doge_blast.png` | 8 | 16 | (64,64) | Pomarańczowy wybuch, kawałki gogli i iskry |

## Integracja
Wczytaj `codex/manifest_patch.json` do systemu assetów, bez zmiany ścieżek źródłowych.
Wyłącz zapętlanie (`loop=false`). Sprawdź odtwarzanie raz na każdą aktywację efektu.
Klatki są ustawione w stałym obszarze [64,64], a powiększanie eksplozji jest celowym ruchem.
W `codex/asset_validation.json` znajdziesz odrębne wyniki każdego pliku i klatki.
`preview.png` prezentuje wszystkie 74 klatki na ciemnym tle w skalach 1:1 i ×2,
z żabą v06 i porównaniem do referencyjnego kilofa v14 w nagłówku.

## Co sprawdzono
Wymiary atlasów, liczba klatek, przezroczystość, min. 8 px marginesu, siatka 2×2,
piksele bez wygładzania, kotwica animacji, porównanie estetyczne z materiałami referencyjnymi.
Testy w prawdziwej grze (hitbox, timing, pozycja na mapie) wymagają integracji przez Codex/Claude.

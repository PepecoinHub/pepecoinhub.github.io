# FROGAGEDDON – Held Weapons v15

Zestaw 22 nowych grafik broni trzymanych przez żabę. Jedna broń = jeden plik PNG RGBA 64×64. Grafiki powstały z osobno wygenerowanych projektów w stylu pikselowym i zostały znormalizowane do siatki 2×2, bez wygładzania na siatce gry.

## Integracja

Pliki w folderze `held/` zastępują zasoby o tych samych nazwach. Punkt chwytu to współrzędne w 64×64 od lewego górnego rogu; lista jest także w `codex/held_grips.json`. Gdy gra wykorzystuje inne pozycjonowanie broni, należy zastosować offset względem podanych punktów chwytu.

| # | Plik | Chwyt (x,y) |
|---|---|---|
| 1 | `held/grenade.png` | 20, 44 |
| 2 | `held/bazooka.png` | 20, 44 |
| 3 | `held/cluster_grenade.png` | 20, 44 |
| 4 | `held/golden_foot.png` | 30, 44 |
| 5 | `held/baseball.png` | 20, 46 |
| 6 | `held/revolver.png` | 20, 44 |
| 7 | `held/bow.png` | 46, 34 |
| 8 | `held/landmine.png` | 32, 44 |
| 9 | `held/dynamite.png` | 30, 40 |
| 10 | `held/red_candles.png` | 32, 44 |
| 11 | `held/drill_launcher.png` | 20, 44 |
| 12 | `held/grappling_launcher.png` | 20, 44 |
| 13 | `held/jetpack_backpack.png` | 32, 40 |
| 14 | `held/teleport_device.png` | 20, 44 |
| 15 | `held/ban_hammer.png` | 20, 46 |
| 16 | `held/pep_rain.png` | 32, 44 |
| 17 | `held/doge.png` | 30, 44 |
| 18 | `held/donkey.png` | 30, 44 |
| 19 | `held/moon_rocket.png` | 20, 44 |
| 20 | `held/bell_bomb.png` | 32, 44 |
| 21 | `held/frog_mine.png` | 32, 44 |
| 22 | `held/mega_golden_foot.png` | 30, 46 |

## Walidacja

Skrypt sprawdził rozmiar 64×64, RGBA, przezroczyste narożniki, pełną alfę obiektów, siatkę 2×2 oraz minimum 4 px przezroczystego marginesu. Każdy plik zawiera jedną klatkę. Raport w `codex/held_validation.json` podaje pomiary dla każdego pliku i wynik testów. Podgląd `preview.png` pokazuje wszystkie przedmioty przy żabie v06 w natywnych pikselach (1:1) oraz powiększone trzykrotnie bez interpolacji (×3).

Tekst `BAN` i litera `P` w monetach są częścią grafiki; należy je sprawdzić po faktycznym zmniejszeniu do rozmiaru używanego w UI.

**Zakres:** wyłącznie grafiki `held/`. Animacje lotu i efekty są osobnymi częściami v15 (PROMPT_B i PROMPT_C).

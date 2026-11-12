# Silver Donkey v1.2 — poprawka artu nad #282

Osobna gałąź `feat/frogageddon-donkey-v12-art-fix` bazuje na aktualnym Draft PR #282 (`b3f2d02087b59f5c7ec92e9463fda870fcce2843`). Przeczytano `codex/README_PL.md`; oryginalne instrukcje, patch i QA zachowano w `art/arsenal-polish/v12/handoff/`.

## Zmiana

Dodano dostarczony PNG `v12/sprites/silver_donkey_atlas.png` bez edycji. SHA-256: `064a962c04830aaf22417e6090f52bda4768f9b55a0af45167d1eef1b92bf51c`. Oryginał v11 pozostaje w repozytorium.

W manifeście zmienia się **wyłącznie `weapons.donkey.flight`**, dokładnie zgodnie z paczką: ścieżka v12 i anchor `[52,64]` zamiast `[64,64]`. Zachowano klatki 128×128, atlas 1024×128 RGBA, siatkę pikselową 2×2, 8 klatek, 12 FPS, loop i rozmiar świata `[52,52]`. Status manifestu, wszystkie inne role i `donkey.explosion` są identyczne z #282. Zmiany walidatorów/testów usuwają jedynie założenie o starej ścieżce i centralnym anchorze.

Cały korpus przesunięty w PNG o 12 px w lewo zachowuje tę samą pozycję dzięki identycznej zmianie anchora: `(x−64)×52/128 = ((x−12)−52)×52/128`. Naprawiony czubek pyska dodaje maksymalnie około 1,625 jednostki widocznej szerokości; to nowe piksele autora, a nie zmiana skali/hitboxa. Maksymalna widoczna szerokość wynosi 44,69 jednostki wobec 43,06 w v11. Wszystkie osiem klatek ma teraz dokładnie 8 px marginesu po prawej stronie. W obszarze wspólnym przesuniętych klatek zmieniono tylko piksele naprawianego końca pyska.

Renderer, fizyka, hitboxy, obrażenia, definicje broni, sieć, mapy, inne PNG, HUD, postać, hełm i produkcja mają zerowy diff. Nie zmieniono Supabase, rankingów ani nagród. Nie scalono ani nie wdrożono gry.

## Porównanie w grze

[Plansza: v11 obok v12](donkey-v12/in-game.jpg) · [Wszystkie 8 klatek — detal zrzutów ×4](donkey-v12/eight-frames.png). Powiększenie dotyczy dokumentacji zrzutu, nie grafiki w grze. Pełne 54 PNG i ZIP są lokalnie w `/tmp/frogageddon-v12/`.

Porównano oba warianty na rzeczywistej masce Moon Base, seed 123, trzy żaby/drużynę, cel x=1000/y=300. Wariant referencyjny w skrypcie otrzymuje stary descriptor przez test-only route, a wariant v12 używa nowego; pozostałe dane są identyczne. Nalot uruchamia się normalnym pakietem akcji `weapon`/`fire`, a następnie krokuje tę samą fizykę. Nie są to ręcznie ustawione pozycje pocisku ani plansza bez kolizji. Przejście do spadania, wszystkie osiem faz i trafienie następują w tych samych krokach symulacji.

W każdej fazie porównano hash całego stanu, fizyczne x/y/t oraz punkt korpusu po transformacji canvasu: identyczne. Prostokąt drawImage pozostaje 52×52 i nearest-neighbor. Silver Donkey zachowuje dotychczasową pionową postawę; nie obraca się jak Doge/Moon. Sprawdzono również sondy kierunku z vx −200/0/+200: orientacja jest identyczna z v11, bez modyfikacji rzeczywistego toru.

## Testy

- `node --test tests/pondwars-v11-art.test.mjs`: **5/5**, 0 błędów. Oryginalne v11 nadal zgodne bajtowo, aktywne klipy i wszystkie 44 klatki w granicach atlasów, prawidłowe reduced motion, nowy SHA oraz kompensacja anchora przy zachowanej skali/czasie.
- Pełny Node: **242 testy, 231 zaliczonych, 11 pominiętych, 0 błędów**.
- `python scripts/pondwars-v11-assets.py`: oryginalne siedem atlasów bez zmian; poprawiono rejestrację przez pełną ścieżkę, aby v12 o tej samej nazwie pliku nie był mylony z v11.
- `python scripts/pondwars-v12-assets.py`: nowy SHA, RGBA/2×2, osiem bboxów i marginesów zgodnych z paczką; manifest po zastąpieniu tylko donkey.flight jest dokładnie równy bazie #282. [Audyt](donkey-v12/asset-audit.json).
- `python scripts/pondwars-v12-browser.py`: Chromium desktop 1440×900, emulowany telefon 390×844/DPR2 i reduced motion 1000×750; po osiem faz nalotu w obu wariantach, identyczne pozycje/hashe/skala/orientacja. Pauza zachowuje identyczny canvas i hash. Reduced motion utrzymuje statyczną klatkę 0 mimo przechodzenia ośmiu fizycznych faz. Przywrócenie prawdziwego snapshotu w locie i kontynuacja dają ten sam hash końcowy. Restart usuwa stare efekty i pociski. Zero błędów JS.
- `check_site`, `check_i18n` (wcześniejsze ostrzeżenia), `git diff --check`: OK. [Dane QA](donkey-v12/qa-results.json).

Nie wykonywano nowej oceny balansu: fizyka/parametry nie uległy zmianie, a pary nalotów dają identyczne stany. Telefon jest emulowany; status fizycznego Androida/iPhone pozostaje niezatwierdzony.

## Podgląd i pozostałe tematy

`python -m http.server 8000 --directory docs`

`http://localhost:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123`

Atlas lotu v12 rozwiązuje przycięcie pyska. Ostatnia klatka osobnego `donkey_impact_atlas.png`, brak warning PNG i kalibracja Ban Hammer pozostają bez zmian i poza zakresem. Historyczny raport v11 opisuje poprzedni stan; ten dokument rejestruje wyłącznie poprawkę lotu.

Pozostawić PR jako Draft do decyzji właściciela. Bez merge/deploy.

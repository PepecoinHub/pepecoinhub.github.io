# PR A — Arsenal Foundation (QA)

Bazą jest #271 (`1b8a7edf096b0d64e4e8ded3a0a5a0e951c8db5f`), zawierający już #266 → #267 → #269 → #270 i osobny v06. Wszystkie wymienione PR-y nadal są otwarte. Sprawdzono najnowsze otwarte PR-y użytkownika; nie znaleziono nowszej równoległej implementacji arsenału. `main` odświeżono do `045bc057` (snapshot 2026-11-12); od bazy prac nie zmienił kodu Pond Wars. Nie przenoszono zmian SQL ani innych otwartych prac.

Podgląd: `games/pondwars-beta.html?art=pixel-v06&arsenal=exp-v1`, lokalnie po `python -m http.server 8000 --directory docs`. Bez flagi arsenał ma poprzednie 14 wyborów. V04, v06, v02 i osiem skinów pozostają dostępne jak wcześniej; warstwy postaci, hełmu i broni nie są łączone.

## Co jest gotowe

- Oddzielny moduł art/UI `pondwars-arsenal.mjs`: siedem nowych ID bell_bomb/frog_mine/moon_rocket/ban_hammer/pep_rain/doge_flyer/silver_donkey i alias artystyczny golden_foot_v2 dla istniejącego gold. Nie ma drugiego ID Golden Foot ani podmiany mine.
- W A nowe ID są tylko planami. Przycisk, wybór bezpośredni i replay nie mogą ich uruchomić. Gold może pokazywać nowy prototyp ikony, ale nadal ma stare parametry 68/radius58, 5 fragmentów toe po 36/radius34. Nowy balans należy do PR B.
- QA: kategorie All/Classic/Special/Traps/PEP/Legendary, strony 8/8/5 dla 21 pozycji, licznik strony i blokady. Zablokowane pozycje pokazują planowany etap i proponowaną amunicję, nie „unlimited”. Aktywna amunicja nadal pochodzi z dotychczasowego stanu osobno dla drużyn.
- HUD 64 px i osobne ikony 128 px, fallback do dotychczasowego SVG, nearest-neighbor w UI. Źródłowy ZIP zachowano bajt w bajt w `art/arsenal-v10/source-package.zip`, wraz z kompletem źródeł, pojedynczych VFX i konceptów map. Wyodrębniono dokumenty i ikony potrzebne w runtime; nie zmieniano grafiki.
- Minimalny accessor definicji broni i opcjonalna konfiguracja meczu. Domyślne WEAPONS nie są mutowane; brak nowych pól w meczu bez QA. Mecze QA zapisują arsenal/stage w snapshotach, bez zmiany HP, RNG lub fizyki.
- Stage-aware handshake dla QA: A nie może po cichu odtwarzać inputów przyszłego B. Zwykłe mecze zachowują dotychczasowy protocol 1. Restore odrzuca zmianę konfiguracji meczu przez niezgodny snapshot. To lokalna warstwa NetMatch; nie dotykano Supabase.

## Faktyczne testy etapu A

- 75/75 testów gry, w tym 6 nowych foundation: unikalne ID, blokady direct/replay/fire, izolacja konfiguracji, zgodność tych samych inputów/RNG z baseline, amunicja osobno dla drużyn, snapshot i negocjacja stage.
- Pełny Node: 214 testów, 203 zaliczone, 11 pominiętych, 0 błędów.
- check_site: 179 HTML / 548 JSON / 46 JS — OK. check_i18n — OK z istniejącymi ostrzeżeniami tłumaczeń. diff --check — OK.
- Chromium desktop, 390 px touch/DPR2 i reduced motion: 21 pozycji, strony 8/8/5, wszystkie przyszłe bronie zablokowane, fallback Bell do SVG po celowo przerwanym ładowaniu, brak błędów JS, pauza zamraża canvas. Ikony obejrzano w 24/36/48 px. Dźwięku nie włączano.
- Skrypt: `python scripts/pondwars-arsenal-browser.py` po uruchomieniu lokalnego serwera. Zrzuty: `/tmp/frog-arsenal-qa/A-*`. To emulacja mobilna, nie fizyczny telefon.

Nie ma tu nowej fizyki Bell/Frog Mine ani nowego balansu gold. Ocena balansu należy do B. Nie zmieniono classic, produkcji, botów, Supabase, SQL, wyników ani nagród. Ten PR ma pozostać Draft; bez merge/deploy bez decyzji właściciela.

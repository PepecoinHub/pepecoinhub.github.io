# FROGAGEDDON 2.0 – przekazanie assetów pixel-art v0.4 dla Codexa

## Status

Materiał do przeglądu właściciela, niezatwierdzony do publikacji. To **alternatywa** dla dużych grafik v0.3. Nie należy automatycznie zastępować 8 istniejących skinów.

Repo: `PepecoinHub/pepecoinhub.github.io`. Fundament animacji: Draft PR #267, bazujący na #266. Zmian nie scalać i nie publikować bez zgody właściciela.

## Dostarczone pliki

- `atlas/atlas.png` – 49 klatek animacji bez hełmu, atlas 1024×896.
- `atlas/manifest.json` – struktura `version: 1`, `facing: right`, 11 klipów, 128×128, `foot` i `hand` per frame.
- `atlas/helmet_overlay.png` – bazowy osobny hełm, bez wbudowywania do postaci.
- `atlas/helmet_pose_atlas.png` – osobny atlas hełmu do pokazów/wstępnej integracji, równoległe kadry. Istniejący adapter z #267 nie obsługuje go jeszcze bez dodatkowego kodu.
- `frames/*` – osobne PNG dla każdego stanu.
- `preview/*` – GIF-y i plansze kontroli wizualnej.

## Zalecana kolejność

1. Zarejestruj nowy manifest i atlas dla wybranego `playerId` tylko w **trybie QA**. Najłatwiejsze będzie `classic`, ale bez nadpisywania zatwierdzonego `classic.webp` na produkcji.
2. Utrzymaj broń jako **osobną warstwę** (#266). Skalibruj każdy `hand` wzrokowo, szczególnie przy Aim/Fire/Charge. Obecna pozycja dłoni w graficznych klatkach to punkt przy prawej pięści, nie certyfikacja chwytu dla każdej broni.
3. Dla dedykowanych klatek wyłącz albo stonuj dodatkową deformację proceduralną z `pondwars-animation.mjs`, aby nie sumować celowo narysowanego ruchu z istniejącym `rotation` / squash. Zmiana tylko w rendererze.
4. Dodaj hełm jako niezależny overlay o położeniu odpowiadającym `head` z danej klatki. Nie traktuj `helmet_pose_atlas` jak uniwersalnego arkusza obsługiwanego bezpośrednio przez stary manifest.
5. Przy pierwszym faktycznym spadku HP o co najmniej 1: usuń hełm bez zmiany HP i hitboxa, odtwórz krótką animację lotu hełmu. Brak powtórzeń, pauza freeze, reduced-motion = hełm znika bez lotu. Zachowaj stan po reconnect/reload; uważaj na wspólny model sieciowy.
6. Przetestuj w Chromium i na realnych urządzeniach mobilnych, rozmiar postaci 64 jednostki świata, obie orientacje, granat/bazooka/rewolwer, grunt, powietrze, hit/KO, reset, lag i pauza.

## Nie zmieniać

Silnika fizyki, AI, obrażeń, hitboxów, protokołu sieciowego bez konieczności, bazy Supabase, SQL, wyników i nagród.

## Dwa kierunki artystyczne

- **v0.3** – ilustracyjny Pepe o proporcjach z poprzednio zaakceptowanego konceptu; 512×512; 49 klatek wynikających głównie z przekształceń całego ciała.
- **v0.4** – nowy, uproszczony projekt pixel-native 128×128; siatka 2×2, 15 kolorów na atlasie, faktycznie zmienione kończyny i mimika; wymaga decyzji właściciela, czy poziom uproszczenia jest akceptowalny.

Nie traktuj v0.4 jako finalnej zamiany na siłę. Zachowaj pliki v0.3 i wszystkie poprzednie skiny do porównania.

# Frogageddon 2.0 – pixel-native animation study v0.4

**Status: testowy wariant artystyczny, do akceptacji. Nie instalowany w grze.**

### Co przygotowano
- 49 osobnych PNG 128×128 px w oryginalnej siatce 2×2; 11 stanów: idle, aim, charge, fire, jump, backflip, falling, landing, hit, victory, ko.
- Hełm jako osobny overlay, 49 klatek hełmu skoordynowanych z pozami i osobna demonstracja jego odpadania.
- Dwa transparentne atlasy 1024×896, manifest zgodny z `pondwars-animation.mjs` PR #267.
- Prawdziwa animacja kończyn i mimiki – to nie tylko transformacje całego zdjęcia jak w v0.3.
- Zero wbudowanych broni w klatki. Broń nadal rysuje PR #266.
- Wszystkie klatki mają `foot=[64,122]`, orientację w prawo i `hand` zależny od pozy.
- Kolory <=64 na atlas, alfa prawdziwa, bez rozmycia.

### Ograniczenia i konieczny QA
- Jest to **drugi, bardziej pikselowy projekt** postaci, świadomie różny od v0.2/v0.3. Właściciel musi wybrać kierunek artystyczny, zanim użyjemy go zamiast istniejącego `classic.webp`.
- Pozycje dłoni oraz ułożenie hełmu wymagają ręcznej korekty po oględzinach w silniku. Niewielkie 128×128 sprite'y mogą wyglądać na telefonie bardzo mało szczegółowo, ale większe są kosztowne.
- Nie animuj w CSS przez rozciąganie niewłaściwych canvasów, bo utracisz pixel-art; rysuj atlas w rozmiarze logicznym i `imageSmoothingEnabled=false`.
- PR #267 dodaje proceduralne przekształcenia. Przy podłączeniu tych autorskich klatek wyłącz lub zredukuj proceduralny squash/rotation, żeby nie dublować ruchu.
- Hełm spada po pierwszych faktycznych obrażeniach, nie daje ochrony; to nowa funkcja do osobnego Draft PR.
- Nie ruszaj `main`, SQL, Supabase, ani publikacji; te pliki nie są jeszcze wdrożone.

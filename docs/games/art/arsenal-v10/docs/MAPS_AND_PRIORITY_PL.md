# Frogageddon 2.0: mapy / priorytety

Aktualny silnik ma 4 mapy: Pond Island, Split Decision, Croak Canyon, Last Lily. Każda nowa mapa wymaga testów w deterministycznej masce kolizji 1200×600 (WATER 560). Mapy poniżej są **projektami**, nie nowymi poziomami w repo.

| Mapa | Rola gameplayowa | Kształt terenu | Dekoracje niekolizyjne | Priorytet |
|---|---|---|---|---|
| Moon Base | Otwarte strzały dalekiego zasięgu | Długie łagodne pagórki, dwa kratery, jeden płaskowyż | Flaga P, małe habitaty, pył, Ziemia w tle | E1 |
| Pond of Doom | Spychanie, zasadzki i ryzykowny ruch | Dwa mostki, nierówne zbocza, dwie strefy głębokiej wody | Lilie, zarośla, żabie tabliczki | E1 |
| Doge Farm | Mocny kontrast wysokości | Środkowa farma na wzgórzu, niskie pastwiska, możliwe rowy | Stodoła, wiatrak, Doge znaki | E2 |
| Lite Quarry | Strzelanie nad przepaściami | Kilka kamiennych półek, dwie głębokie szczeliny | Żuraw, bloki kamienia, znak L | F1 |
| Bell Tower | Pionowe odległości | Dwa wysokie tarasy, środek obniżony | Dzwonnica i dachy (jako tło) | F2 |

**Ograniczenia:** nie dopuść do automatycznej śmierci po spawnie; nie uzależniaj dozwolonych ścieżek ruchu od dekoracji, których silnik nie rozpoznaje jako maski. Zadbaj, by gracz miał kilka dróg ataku i możliwość użycia broni wręcz na części mapy. Moon Base nie zmienia grawitacji.

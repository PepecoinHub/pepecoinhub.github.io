# PepeGochi — paczka A1, wariant (a)

Data: 2026-11-13. Paczka graficzna do przeglądu i akceptacji, bez wdrożenia.

Źródło: https://github.com/PepecoinHub/pepecoinhub.github.io/tree/11bd172c16837874cf174449155a798d787d120a/docs/games/img/pepegochi

## Zawartość

Dokładnie sześć osobnych PNG w `docs/games/img/pepegochi/`, z nazwami docelowymi:

| Plik | Zmiana | Kolory RGBA, włącznie z przezroczystością |
|---|---|---:|
| pepegochi_adult_hungry.png | Czytelne dłonie na brzuchu, poprawione P, usunięte błędne niebieskie fragmenty w dolnej części postaci, mała pusta miska obok stóp. Oryginalna głowa bez zmian. | 40 |
| pepegochi_adult_dirty.png | Tylko obszar litery P. Błoto, mucha, twarz, spodenki i pozycja bez zmian. | 38 |
| pepegochi_adult_recovering.png | Tylko obszar litery P. Plaster i reszta grafiki bez zmian. | 34 |
| pepegochi_froglet_idle.png | Tylko obszar litery P. Oryginalny ogon, twarz i wysokość bez zmian. | 33 |
| pepegochi_hatch_03.png | Twarz przeniesiona z oryginalnego tadpole_idle i dopasowana do otworu skorupki. Zachowany oryginalny uniesiony czubek i dół skorupki z zielonymi plamkami. | 35 |
| pepegochi_hatch_04.png | Oryginalna kijanka w tej samej skali i pozycji, z normalizacją siatki/palety; dwie blisko położone skorupki. Całość x=2..125, mieści się w kadrze. | 33 |

## Parametry i rozstrzygnięcia sprzeczności w specyfikacji

- Wszystkie pliki: PNG RGBA, 128×128, alfa tylko 0/255, maksymalnie 64 kolory, jednolite bloki 2×2 od początku płótna, brak ukrytego koloru w przezroczystych pikselach.
- Kotwica dolnej krawędzi wynosi **124**, zgodnie z `FOOT_Y` i `SPRITES` w repo. Ostatni widoczny wiersz ma indeks **123**; wiersze 124–127 są przezroczyste. Nie przesuwać sprite'ów o jeden piksel.
- Dorosłe zachowują źródłowe y=8, młoda y=30. Wymienione w backlogu y=9/113 px dotyczy wygładzonego wzorca; nie wymuszano nieparzystego przesunięcia sprzecznego z siatką i podmianą 1:1.
- P ma czytelny, normalnie skierowany kształt (nie znak peso). Wersja na siatce ma 6×8 px, maskę `110 / 101 / 110 / 100`. **Nie jest dosłowną kopią piksel w piksel z adult_idle**: wzorzec ma wygładzone krawędzie i jednopi­kselowe detale niezgodne z siatką 2×2. Priorytetem są czysta siatka, kształt P i lokalny zakres poprawki. Nie zmieniono samego adult_idle.
- Tadpole_idle ma ponad 1200 kolorów i nie jest na czystej siatce. Do nowych klatek użyto jego oryginalnych pikseli z próbkowaniem najbliższego sąsiada i ograniczeniem palety. W hatch_04 nie zmieniano skali kijanki; w hatch_03 głowa jest dopasowana do istniejącej skorupki.

## QA

`QA.json` zawiera wyniki i SHA-256 każdego pliku. `verify_a1.py` ponownie sprawdza parametry i zgodność z sumami kontrolnymi (Python + Pillow). `PODGLAD.html` otwiera lokalnie porównanie oraz statyczne podglądy pokoju.

Potwierdzono zerową liczbę zmienionych pikseli poza lokalną maską P dla dirty/recovering/froglet. W hungry zachowano wszystkie piksele głowy powyżej y=66. Sprawdzono wizualnie porównanie przed/po oraz statyczne kompozycje pokoju 640×400 i 360×225, zgodnie z HOME=(320,372), szerokością sprite'a 128 i kotwicą 124.

To statyczne QA grafiki, nie test uruchomionej gry, animacji ani zachowania przeglądarki. Claude powinien sprawdzić podmianę w lokalnej scenie przed integracją. `hatch_04` jest nowym zasobem — obecny manifest i sekwencja kodu nie odwołują się do niego. Nie dodano go do odtwarzacza i nie zmieniono czasu klatek.

## Zakres przekazania

Nie zmieniono kodu gry, mechaniki, zasad opieki, czasu ewolucji, bazy danych ani repozytorium zdalnego. Nie utworzono PR ani wdrożenia. Pięć istniejących nazw przygotowano do podmiany; hatch_04 jest dodatkową klatką do późniejszej integracji po akceptacji.

## Sposób przygotowania

Wbudowany generator obrazów posłużył do przygotowania lokalnych poprawek i nowych elementów. Pełne wygenerowane obrazy nie zostały użyte jako podmiany. Zastosowano lokalne maski, wycięcie poprawionego P, zachowanie niezmienionych obszarów oryginałów i techniczny eksport na siatkę 2×2. Twarz w obu klatkach wyklucia pochodzi bezpośrednio z repozytoryjnego tadpole_idle. Zestaw promptów opisano w `PROMPTS.md`.

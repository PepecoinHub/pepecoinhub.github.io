# PepeGochi A16: Fine Sprites

PondOS 98 | Pakiet do przeglądu i integracji przez Claude'a.

**Nie scalać, nie publikować, nie wykonywać SQL bez zgody właściciela.**

## Co jest gotowe

11 pojedynczych PNG gotowych do podmiany pod oryginalnymi nazwami w `docs/games/img/pepegochi/`:

- Froglet: idle, hungry, dirty, moody, tired, neglected, packing, recovering.
- Adult: hungry, dirty, recovering. Pozostałe pięć grafik adult, w tym adult_idle (wzór), pozostawiono bez zmian.

Każdy plik ma format 128×128 RGBA, dwie wartości alfa (0 i 255), drobniejszy raster niż 2×2. W każdym przypadku górna krawędź jest zgodna z dotychczasową, a dolna wyłączna to y=124 (ostatni widoczny piksel y=123). Lewa kotwica stóp w dolnych ośmiu wierszach odpowiada oryginałowi. Zakres rysunku w poziomie może być węższy, np. miska i walizka znajdują się bliżej żaby. Nie należy ich ponownie skalować ani zwiększać rozmiarów sceny.

Grafika zachowuje twarz Pepe, niebieską bluzę P, brązowe spodenki i odmienną mimikę. Froglet zachowuje ogon. Referencją jest istniejący `pepegochi_adult_idle.png`, nie należy nadpisywać tego pliku.

## Instrukcja dla Claude'a

1. Sprawdź aktualny HEAD gałęzi roboczej PepeGochi i jej manifest oraz QA: nie nadpisuj nowszych zmian bez porównania. Pakiet oparto na obrazach dostarczanych przez main w chwili analizy (2026-11-18).
2. Utwórz osobną gałąź lub draft PR, skopiuj wyłącznie 11 plików PNG z `docs/games/img/pepegochi/`. Nie kopiuj preview ani audytu do katalogu runtime. Zachowaj backup poprzednich grafik w historii Git.
3. Nie przerabiaj ich na 64×64 i nie rozciągaj nearest-neighbor z 64×64. Stary profil QA 2×2/64 kolory nie nadaje się do tej grafiki, podobnie jak do istniejącego adult_idle. Dodaj osobny, jawnie ograniczony profil fine dla 11 plików, zamiast wyłączać testy lub zmieniać zasady dla całej gry. Profil: dokładnie 128×128 RGBA; binarne alfa; niepusta grafika; brak obcięcia na krawędzi; y=124 wyłącznie; top=30 dla froglet i top=8 dla trzech adult; maks. 4096 kolorów; zgodność z manifestem. Dotychczasowa kontrola 2×2/64 kolorów ma nadal obowiązywać pozostałe assety zgodnie z ich profilem.
4. W `docs/games/pepegochi.css` `.pgr img` obecnie stosuje `image-rendering: pixelated` dla całego pokoju. Porównaj A/B w przeglądarce: aktualną regułę i węższą regułę `image-rendering: auto` wyłącznie dla nowego art profile żaby. Ogranicz ją do sprite'ów (np. atrybut `data-art-profile="fine"` na `.pgr-pet`, aktualizowany również przy zmianie klatki). Nie zmieniaj globalnie tekstur, tła, rekwizytów ani desktopowego pomocnika. Nie stosuj CSS blur ani wygładzania filmu jako substytutu nowej grafiki. Przy skali 1:1 obie wersje powinny wyglądać identycznie; przy ułamkowej skali wybierz ostrzejszą, ale nie poszarpaną wersję. Użytkownik ma ocenić różnicę przed publikacją.
5. Zachowaj `FROG_PX=128`, HOME x=320/y=372, wpisy SPRITES, `FOOT_Y=124`, położenie dymku i istniejącą logikę stanów/opieki. Upewnij się, że cache i asset URL nie blokują nowych plików. Nie zmieniaj statystyk, nagród i stempla.
6. Przetestuj wszystkie osiem stanów froglet oraz trzy adult (widoki live i beta, szerokość okna 320/480/640 px, zoom 100/125/150%, reduced motion). Sprawdź zmianę stanu, odnowienie widoku po kliknięciu, wczytanie animacji, brak migotania/starego sprite'a i właściwą kotwicę stóp. Uruchom istniejące testy repo i dodaj przypadki profilowe. Dopiero potem udostępnij porównanie użytkownikowi.

## Następny etap: animacje i tadpole (audyt, nie podmiana)

Audyt `qa/animation_audit.csv` obejmuje 80 istniejących PNG:

- 8 stanów tadpole: idle jest drobnym rastrem, pozostałe 7 nadal dokładne 2×2.
- 48 klatek care: karmienie, czyszczenie, zabawa, odpoczynek dla 3 etapów, wszystkie dokładne 2×2.
- 20 klatek odejścia/obrotu/chodu, wszystkie dokładne 2×2.
- 4 klatki wykluwania, wszystkie dokładne 2×2.

Łącznie 79/80 dodatkowych plików pozostaje coarse. Nowe statyczne grafiki będą się więc odróżniać od obecnych animacji; to jest jawny follow-up, nie twierdzenie, że A16 wymienia wszystkie sprite'y w aplikacji. Kolejność: 16 klatek care froglet, 7 stanów tadpole, 16 klatek care tadpole, 16 klatek care adult, 20 klatek departure, 4 hatch. Zachować dokładnie pierwotne nazwy, czasy animacji oraz manifest poszczególnych klatek. Osobno zinwentaryzować dodatkowe klatki companion A10+ na aktualnym HEAD (nie wchodzą w 80 sprawdzonych plików).

## Podgląd i weryfikacja

- `preview/01_porownanie_spriteow.png`: wszystkie 11 przed/po na tym samym tle i w tej samej skali.
- `preview/02_pokoj_przed_po.png`: rekonstrukcja układu pokoju z istniejących assetów i nowym froglet (nie screenshot produkcji).
- `preview/room_adult.png`: niezmieniony wzorzec adult w tym samym pokoju.
- `qa/sprites.csv`: wymiary, geometria, kolory, alfa, raster nowych plików.
- `qa/animation_audit.csv`: lista plików wymagających następnego etapu wraz z rozdzielczością i wynikiem badania 2×2 (próba odtworzenia po downsample/upscale nearest).

Wyniki lokalne sprawdzają pliki graficzne, nie zastępują uruchomienia testów aplikacji na gałęzi integracyjnej.

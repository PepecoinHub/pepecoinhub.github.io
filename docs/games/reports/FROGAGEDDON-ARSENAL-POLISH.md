# FROGAGEDDON 2.0 — Arsenal Polish & Playtest

## Stan i baza

Osobna gałąź `feat/frogageddon-arsenal-polish-playtest`, oparta dokładnie na #278 (`3ac15dfe4121275eab073353a48a8eae8efb7ce8`). Audyt GitHub potwierdził otwarty stos: #272 `cc6f20cd` → #274 `4279724f` → #275 `e6cede87` → #276 `61f5d1fe` → #277 `e4e8a8f` → #278, zależny od #270 `f4c4e4d`. Uwzględniono osobny Draft #271 `1b8a7edf`: jego adapter v06, niezmienione atlasy, kalibracje dłoni i testy przeniesiono na tę gałąź, z zachowaniem obu map packów i sterowania Doge. Nie scalono żadnego PR. Starsze alternatywne Drafty #279/#280 nie są bazą tych prac i nie zostały zmodyfikowane.

Nie zmieniono produkcyjnego pondwars.html/pondwars.mjs/pondwars-engine.mjs, Supabase, SQL, rankingów, nagród ani shortlisty CPU. Klasyczne definicje, gold/toe, teren i spawny pozostają bez zmian. Nowe bronie są wyłącznie opt-in przez istniejące playtest packs.

## Działający podgląd

`python -m http.server 8000 --directory docs`

- V06: `http://localhost:8000/games/pondwars-beta.html?art=pixel-v06&packs=all&maps=all&qaMap=moon&qaSeed=123`
- V04: ten sam adres z `art=pixel-v04`.
- Bez `packs` gra zachowuje klasyczny arsenał; bez `maps` domyślnie dostępne są cztery klasyczne mapy.

[Zrzuty użycia wszystkich ośmiu nowych broni](arsenal-polish/use.jpg) · [Zrzuty trafienia/aktywacji](arsenal-polish/impact.jpg). Pełne 51 PNG z desktop/touch/reduced motion i ZIP są lokalnie w `/tmp/frogageddon-polish/`. Mina na zrzucie aktywacji korzysta z kontrolowanego ustawienia przeciwnika obok pułapki; Ban pokazuje użycie krótkiego zamachu. To dokumentacja prototypów, nie zatwierdzenie grafiki ani telefonu.

## Zaimplementowano

- Zmieniono tylko rozszerzenie `goldv2`: Mega Golden Foot jest wielkim rzucanym pociskiem (render 58 jednostek), z zapalnikiem 3 s, dużym wybuchem/promieniem/kraterem 66, obrażeniami 58, mocą 480 i dotychczasową skalą bardzo dużego odrzutu 2,4. Pięć odrębnych złotych palców `megatoe`: po 12 HP, promień/krater 16 i zapalnik 1,5 s. Jedna sztuka na drużynę. Odcisk istniejącej złotej stopy pozostaje przy wybuchu 1,8 s. Nie ma już kopniaka melee dla goldv2. Klasyczne `gold`/`toe` pozostają 68/36 i zachowują własny rzut oraz fragmenty.
- Bell Bomb: 2 użycia na drużynę zamiast Infinity. Pozostawiono istniejące odbicia, promień i zapalnik. PEP Rain pozostaje 6 × 8 HP. Doge ma nadal limit 4,5 s, automatyczny wybuch i zatrzymany zegar tury; nie zmieniano jego toru, bezwładności ani hitboxów. Silver Donkey i pozostałe bronie zachowują parametry stosu.
- Oddzielono HUD, flight, activation i explosion w kontrakcie `art/arsenal-polish/manifest.json`. Adapter obsługuje animowane PNG dowolnych wymiarów klatki: frames/columns/fps/anchor/world-size, statyczną klatkę dla reduced motion i skalowanie nearest-neighbor. Grafika nie zmienia fizycznego originu, kolizji ani balistyki. FX używają istniejącego zegara, czyszczą się przy nowym meczu/restore i nie trafiają do stanu fizyki.
- Usunięto Canvasowe prostokąty/owale zastępujące Doge i Donkey. Do czasu v11 są jawne, statyczne SVG z istniejącego repozytorium. PNG HUD v10 nie są używane jako pociski. Trzy oryginalne PNG FX v10 działają osobno; stary generic gold impact nie jest mylony z odciskiem stopy. Nie generowano ani nie edytowano zatwierdzonych ilustracji.
- Własność trzymanego przycisku jest liczona osobno dla każdego pointerId; zwolnienie jednego palca nie zeruje drugiego. Cancel/lost capture zerują zmianę wysokości. Pauza, blur, nowy mecz, tura i restore czyszczą sterowanie. Odrzucony pointer capture nie przerywa handlera.
- Snapshoty i handshake meczów z packami identyfikują `polish-1`; starszy build arsenału jest odrzucany zamiast odtwarzania starego kopniaka jako nowego rzutu. Zwykłe mecze pozostają przy protocol 1.
- Dekoracje map mają osobne sloty i warstwę przed zniszczalnym terenem: Moon habitat/antenna, Doom gate/tree, Farm barn/windmill, Quarry crane/conveyor, Tower belfry/ruins. Prototypowe, przygaszone sylwetki dalekiego tła są opisane NO COLLISION. Nie maskują przejść i nie zapisują nic w masce terenu. To punkty integracji, nie finalne mapy artystyczne.

## Testy faktycznie wykonane

- 98/98 testów gry, w tym 9 nowych testów polish i 7 testów adaptera v06. Pełny Node: 237 testów, 226 zaliczonych, 11 pominiętych, 0 błędów.
- Maksimum bezpośredniego goldv2 + 5 megatoe = 118; klasyczne gold + 5 toe = 248. Próba z HP 1000 unika obcięcia wyniku do 100. Test łańcucha potwierdza wtórny KO poza zasięgiem samej Mega, dokładnie jeden wybuch na KO i brak dodatkowych palców. Nie jest to globalny limit strat HP: upadki, woda i KO mogą zwiększyć sumę.
- Silver Donkey: maks. 78 HP na jedną żabę od pojedynczego wybuchu. Testy dachu: fizyczne uderzenie w jego górę, obrażenia przez cienki dach w promieniu wybuchu, brak obrażeń dla celu odległego o więcej niż zasięg. Bez dodawania nowej osłony balistycznej do modelu wybuchów.
- Doge: zegar tury nie maleje podczas lotu, lifetime kończy lot po najwyżej 271 krokach (około 4,52 s z zaokrągleniem fixed step), snapshot w trakcie lotu daje identyczny dalszy hash. Ręczna detonacja zachowuje limit jednej sztuki.
- Chromium desktop 1440×900, emulowany telefon 390×844/DPR2 oraz reduced motion: realne akcje UI wszystkich ośmiu broni, zużycie amunicji, zrzuty użycia i trafienia/aktywacji, pauza Doge oraz FIRE. Zero błędów JS. Dźwięku nie włączano.
- Chromium CDP touch: dwa rzeczywiste emulowane kontakty — trzymany skręt i jednoczesny drag zmiany wysokości, sprawdzone wejście ctl.x/ctl.y, puszczenie obu palców, detonacja przez dotyk FIRE. Dodatkowo syntetyczne pointercancel/ownership. To emulacja, nie fizyczny telefon.
- Dwie lokalne karty w profilu telefonu: 13 opóźnionych kroków Doge, zgodne hashe, zamknięcie i ponowne otwarcie klienta w trakcie lotu, odtworzony czas 0,2167 s i amunicja 0, dalsza zgodna detonacja. Bez Supabase i połączenia z produkcją. Online przycisk pauzy/blur zwalnia sterowanie, lecz nie zatrzymuje drugiego klienta — zgodnie z dotychczasowym modelem.
- Regresja v06: po 53 klatki w trzech profilach; cztery bronie w obu kierunkach, kalibracja dłoni, pierwszy spadek HP z utratą hełmu raz, reset i mieszane skiny. V04/v06: seed 123 i twin mają identyczną maskę (hash 2786044850) i osiem spawnów. Dwie karty: 33 opóźnione kroki, restore/reconnect bez ponownego wyrzutu hełmu.
- check_site, check_i18n (istniejące ostrzeżenia tłumaczeń) i diff --check: OK.

## Powtarzalne symulacje na dziewięciu mapach

[Dane szczegółowe](arsenal-polish-balance.json), skrypt `node scripts/pondwars-polish-balance.mjs --seeds=150`. 24 300 scenariuszy: 9 map × 9 broni (osiem nowych plus klasyczne gold) × 150 identycznych seedów dla obu stron. Każda komórka ma dodatkową powtórzoną sondę hasha. Trzy żaby/drużynę lub maksimum mapy, jeśli mniejsze. Brak timeoutów.

To porównanie pojedynczych tur ze skryptowaną polityką ze startowych pozycji: najbliższy wróg, rzut 45° z mocą wyliczaną z dystansu, bez chodzenia/odwrotu, Doge sterowany proporcjonalnie. Nie używa CPU, nie ocenia jego poziomów ani win-rate pełnych meczów. Nie stanowi dowodu nierówności mapy przy grze ludzi. Ban z pozycji startowych nie ma zasięgu — jego zera nie oznaczają, że melee jest bezużyteczne. Straty obejmują wiele żab, upadki, wodę i KO; mogą przekroczyć nominalne obrażenia pojedynczego wybuchu.

| Broń | Śr. HP przeciwników | Śr. własne HP | Śr. HP sojuszników | Maks. HP przeciwników łącznie |
|---|---:|---:|---:|---:|
| goldv2 | 44.51 | 6.38 | 6.61 | 300 |
| gold | 61.80 | 10.78 | 10.04 | 300 |
| bell | 6.62 | 1.51 | 2.05 | 100 |
| frogmine | 2.37 | 35.50 | 6.56 | 100 |
| moon | 35.89 | 2.84 | 3.37 | 200 |
| ban | 0.00 | 0.00 | 0.00 | 0 |
| rain | 29.36 | 2.16 | 1.15 | 108 |
| doge | 10.86 | 0.63 | 3.85 | 100 |
| donkey | 93.45 | 5.56 | 3.39 | 200 |

| Mapa | Strona 0: śr. HP przeciwników | Strona 1: śr. HP przeciwników |
|---|---:|---:|
| island | 22.10 | 22.78 |
| twin | 40.10 | 48.69 |
| peaks | 17.01 | 18.41 |
| small | 36.84 | 36.23 |
| moon | 22.78 | 24.07 |
| doom | 34.95 | 33.06 |
| farm | 54.88 | 43.71 |
| quarry | 25.51 | 26.07 |
| tower | 30.61 | 31.93 |

Wnioski do dalszych testów:

1. Mega jest słabsza obrażeniowo od klasycznej Golden Foot w tej próbie (44,51 vs 61,80 HP), ale nadal może powodować eliminacje przez odrzut i wodę. Nie zwiększano automatycznie fragmentów ani obrażeń.
2. Bell ma ograniczony zapas 2. Bez planowania odbić i ruchu osiąga niewiele trafień; nie należy zmieniać obrażeń na podstawie samego tego skryptu.
3. Frog Mine w obecnym stosie reaguje także na właściciela/sojusznika i nie skacze. Bez odwrotu średnie obrażenia własne to 35,50 HP, przy 2,37 HP przeciwników. To konkretna przeszkoda w playteście i temat osobnego PR-u; klasycznej Land Mine nie zmieniano ani nie zastępowano. Nie przenoszono alternatywnej mechaniki z #280.
4. Doge daje średnio 2,01 s zatrzymanego zegara w tej próbie, maksymalnie około 4,52 s lotu w teście pustej przestrzeni. Nie pozwala latać bez końca; po pauzie offline licznik lotu też jest zamrożony. Fizyczna ocena precyzji sterowania pozostaje otwarta.
5. Silver Donkey ma największy wynik sumaryczny (93,45 HP przeciwników). Powodem może być szeroki obszar, kilka ofiar i upadki. Cienki dach nie chroni przed radialnymi obrażeniami; głęboki schron może chronić przez dystans, bez specjalnego testu linii widzenia. Przed zmianą balansu potrzebne pełne mecze i osobne pomiary osłon.
6. Twin i Farm mają największą różnicę stron w tej polityce. Potrzebny następny test z chodzeniem, różnymi aktywnymi żabami i poziomami CPU/human playtest. Nie symetryzowano terenu ani spawnów bez decyzji właściciela.

## Lista problemów graficznych / blokery

Paczki **Frogageddon_Arsenal_Phase2_v11.zip nie było w środowisku**. W załącznikach sprawdzono v02/v04/v06 i Phase1 v10. Dlatego właściwe animowane PNG Doge/Silver Donkey pozostają niepodłączone — adapter jest gotowy, ale SVG placeholdery nie spełniają finalnego wymagania sprite'ów. Nie udajemy animacji przez generowanie brakujących klatek.

| Broń | Dostępne teraz | Potrzebne z v11 |
|---|---|---|
| Mega Golden Foot | v10 HUD i generic burst, istniejąca SVG stopa/palec/odcisk | duży flight PNG, osobny toe PNG, footprint/impact |
| Bell Bomb | v10 HUD, bounce PNG, istniejący SVG pocisk | osobny flight i explosion PNG, ewentualnie rzeczywisty dźwięk dzwonka |
| Frog Mine | v10 HUD i arm PNG, istniejąca mechanika pułapki | finalna activation/explosion i decyzja o skoku |
| Moon Rocket | v10 HUD, SVG pocisk | flight/trail/explosion |
| Ban Hammer | v10 HUD, osobna SVG broń w dłoni | swing/impact i kalibracja chwytu |
| PEP Rain | v10 HUD, mały SVG placeholder kropli | osobne drop/explosion; nie sześć kopii ikony HUD |
| Doge Flyer | v10 HUD, statyczny SVG placeholder | animowany flight PNG i explosion, kierunek nosa/anchor |
| Silver Donkey | v10 HUD, statyczny SVG warning/drop | osobne warning, animowany drop PNG i impact/explosion |

Wymiary, alpha bounds, anchors oraz kierunki należy zweryfikować z rzeczywistym manifestem v11; nie narzucono im wymiaru ikony HUD. Sylwetki dekoracji są tylko prototypem dalekiego tła. Potrzebne dedykowane obiekty dla pięciu nowych map. V06 nadal wymaga oceny kończyn backflipu i kontaktu dłoni z nowymi broniami; nie poprawiano ich przez przesuwanie fizycznego originu.

**Sterowanie mobilne pozostaje NIEZATWIERDZONE.** Brak dostępu do fizycznego telefonu/iOS Safari w tym środowisku. Właściciel/tester powinien sprawdzić skręt i wysokość dwoma palcami, FIRE, puszczenie/cancel gestu, lot do limitu, pauzę offline oraz utratę sieci/reconnect w trakcie lotu. Nie jest to warunek utworzenia Draft PR, ale blokuje oznaczenie mobilnego sterowania jako gotowego.

## Kolejny krok

Podłączyć rzeczywistą paczkę v11 w tym samym kontrakcie, uzupełnić brakujące stany i zrzuty; sprawdzić fizyczny telefon. Następnie osobno rozwiązać Frog Mine i porównać pełne mecze na Twin/Farm oraz Silver Donkey pod osłonami. Przed ewentualnym scaleniem uzgodnić kolejność całego stosu i #271 z właścicielem. Nie publikować bez jego akceptacji.

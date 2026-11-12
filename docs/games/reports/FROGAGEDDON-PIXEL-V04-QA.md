# Frogageddon 2.0 — integracja pixel v04 wyłącznie do QA

## Stan i podgląd

Osobny Draft PR oparty na #269 (`0dd763d3e8e1d16fb1802965c8bcd041051f33c4`), który wykorzystuje fundament #267 i warstwę broni #266. Żaden z tych PR-ów nie został scalony podczas tej pracy. Kod fizyki, botów, obrażeń, hitboxów, protokołu, Supabase, SQL, wyników i nagród pozostał bez zmian. Nie wykonano wdrożenia.

Podgląd lokalny: `python -m http.server 8000 --directory docs`, następnie `http://localhost:8000/games/pondwars-beta.html?art=pixel-v04`.

Tylko ta flaga rejestruje manifest/atlas w istniejącym adapterze dla `classic`. Menu oznacza opcję jako „Classic Pepe · pixel v04 QA” i pokazuje właściwą miniaturę. Początkowo obie drużyny wybierają ten wariant, ale nadal można wybrać każdy z ośmiu starych skinów i mieszać je na jednej planszy. `classic.webp` ani rejestr PLAYERS nie zostały zmienione. Bez flagi działa dotychczasowa beta; `?art=standard-v02` zachowuje wcześniejszy prototyp z #269. Klasyczny Pond Wars jest bez zmian.

v04 jest alternatywnym, uproszczonym kierunkiem artystycznym do decyzji właściciela. W tej gałęzi ani w dostarczonej paczce nie znaleziono assetów v03. Niczego z v03 nie kasowano ani nie zastępowano; zachowano dostępne v02 i wszystkie wcześniejsze skiny. Archiwalne dokumenty paczki są w `../art/pixel-v04/`; ich deklaracja `not_integrated` opisuje stan paczki u autora, nie bieżącą integrację QA.

## Assety i geometria

Skopiowano bez edycji `atlas.png`, `manifest.json`, `helmet_pose_atlas.png` i `helmet_overlay.png`. Runtime używa dwóch atlasów i jawnej metadanej QA; osobne PNG z `frames/` i GIF-y nie są potrzebne do odtwarzania. Nie generowano ani nie retuszowano ilustracji.

- Atlas ciała: 1024×896 RGBA, 15 kolorów łącznie z transparentnym; atlas hełmu: 1024×896 RGBA, 23 kolory. W obu przypadkach mniej niż 64 kolory.
- 49 slotów klatek 128×128, 11 klipów, źródło zwrócone w prawo. Pomiar daje 34 różne obrazy pikseli wśród 49 slotów; część klatek jest celowo powtarzana w pętlach.
- Wszystkie stopy to `[64,122]`, mapowane na pozycję żaby w świecie. Pełny canvas ma 64×64 jednostki świata; skala to 0,5. Nie rozciągano proporcji ani nie zmieniano hitboxa.
- `imageSmoothingEnabled=false` dla ciała i hełmu; canvas QA korzysta także z `image-rendering:pixelated`. Źródłowa siatka 2×2 odpowiada jednemu pikselowi świata przed skalowaniem widoku.
- Manifest źródłowy **nie zawiera pola `head`**. Nie przedstawiamy go jako dostarczonego. `qa-anchors.json` zapisuje zmierzony środek alfa-bbox hełmu oraz jego prostokąt dla każdego slotu; kompilator dodaje te pola tylko do runtime kopii manifestu.
- Hełm ma w każdej pozie bbox 88×36 source px, czyli 44×18 world px, z przesunięciami zależnymi od klatki. Nie jest traktowany jak uniwersalny sheet automatycznie obsługiwany przez adapter #267. Osobny helper waliduje położenie w równoległym atlasie i dopasowanie do stóp.

| Klip | Sloty / różne obrazy w klipie | FPS | Czas pełnego klipu (s) |
|---|---:|---:|---:|
| idle | 4 / 3 | 6 | 0,667 |
| aim | 4 / 2 | 8 | 0,500 |
| charge | 4 / 4 | 10 | 0,400 |
| fire | 6 / 6 | 15 | 0,400 |
| jump | 4 / 2 | 10 | 0,400 |
| backflip | 4 / 2 | 8 | 0,500 |
| falling | 3 / 2 | 7 | 0,429 |
| landing | 4 / 2 | 12 | 0,333 |
| hit | 5 / 5 | 12 | 0,417 |
| victory | 6 / 4 | 8 | 0,750 |
| ko | 5 / 5 | 12 | 0,417 |

## Jedna maszyna stanów, bez nakładania deformacji

Nadal działa `CharacterAnimator` z #267. W rendererze dedykowanych klatek zerujemy dodatkowy proceduralny offset/obrót oraz squash/stretch; zachowujemy tylko istniejący fade KO. Stare skiny i v02 zachowują proceduralny ruch. Nie dodano drugiej maszyny stanów ani osobnego zegara.

Opcjonalny `durationFor` w obserwatorze ustawia **wyłącznie czas stanów prezentacji** fire/landing/hit wybranego modelu na `frames/fps`; dzięki temu nie ucinamy końcowych klatek. Wcześniejsze czasy 0,28/0,22/0,32 s nadal obowiązują stare skiny. To nie zmienia czasu lotu pocisku, tur, ruchu, odrzutu fizycznego ani obrażeń.

Klatki `backflip` dostarczone w v04 przypominają warianty skoku i nie zawierają pełnej rotacji 360°. Nie ukrywamy tego dodatkowym proceduralnym obrotem. Fizyczny backflip silnika działa nadal; pełna czytelność wizualna wymaga oceny/dopracowania artu. Stany lotu są przerywane przez lądowanie zgodnie z rzeczywistym ruchem, zamiast przedłużać lot do końca klipu.

## Dłonie i broń — kalibracja QA, nie akceptacja produkcyjna

Źródłowe `hand` dla aim/charge/fire często wskazują obrys lub usta, a nie widoczną pięść. Przykład aim: `[98,70]` w źródle kontra widoczna uniesiona pięść około `[46,81]`. Nie nadpisano manifestu. Osobna metadana wybiera środkowy piksel skóry w odizolowanej pięści, z pominięciem dużego obszaru głowy; wynik obejrzano z granatem, bazooką i rewolwerem w obu kierunkach.

Dla klatek QA warstwa broni używa tego punktu jako bezpośredniej kotwicy, bez dawnych dodatkowych przesunięć o 8/12 jednostek używanych przy umownej dłoni statycznych grafik. Zachowano kalibrację obrazów broni i ich obrót z #266. Stare skiny oraz v02 zachowują stare przesunięcia.

To wstępna kalibracja graficzna, nie certyfikacja każdego uchwytu i kąta. W szczególności uniesiona pięść znajduje się po lewej stronie źródłowego kadru; grafika broni skierowana w prawo może przechodzić przed tułowiem. Dłoń dla pierwszego aim mapuje się na `(−9,−20,5)` względem stóp, podczas gdy środek fizycznego originu pozostaje na `(0,−32)`. **Nie przesuwamy `projectileOrigin()` ani nie korygujemy fizyki pod prototyp.** Lepsze pozy ręki i docelowe chwyty wymagają decyzji artystycznej właściciela. W KO część dłoni zlewa się z resztą sylwetki; metadane QA nie zastępują ręcznie opracowanych anchorów.

## Hełm, pauza i odtwarzanie

Używamy klasy `HelmetCosmetics` z #269. Została rozszerzona o deskryptor konkretnej klatki (prostokąt w atlasie, środek, rozmiar). Hełm v04 śledzi klatkę ciała i znika po pierwszym rzeczywistym spadku HP ≥1, bez wpływu na HP czy hitbox. Particle startuje dokładnie w miejscu aktualnego overlayu i jest rysowany w przestrzeni świata, bez kolizji. Tylko postacie `classic` zarejestrowane w QA dostają ten overlay.

Pauza zatrzymuje istniejący zegar i canvas. Reduced motion wybiera klatkę zero klipu i usuwa hełm bez wyrzutu. Kolejne trafienia nie wznawiają efektu; reset meczu przywraca hełmy. Restore/reconnect odtwarza brak hełmu z HP <100 i czyści lokalne particles, bez replay. Nadal obowiązuje założenie #269: początkowe HP to 100 i nie ma leczenia. Nie dodano pól do snapshotów ani zmian protokołu. Obie karty mogą samodzielnie włączyć flagę QA; wygląd nie jest elementem autorytatywnego stanu rozgrywki.

## Weryfikacja

- Testy gry: 62/62, w tym 7 nowych testów v04. Obejmują 49 klatek, niezmienność źródła, walidację metadanych, brak podwójnej deformacji, pełny czas transientów, 30/60/144 FPS, pauzę/reduced motion i wspólną pozycję odłączonego hełmu dla obu kierunków.
- Pełny Node: 201 testów, 190 zaliczonych, 11 pominiętych, 0 błędów. Pełny zestaw uruchomiono poza ograniczeniem sandboxa dotyczącym podprocesów.
- `check_site.py`: 179 HTML, 543 JSON, 46 JS — OK. `git diff --check` — OK.
- `python scripts/pondwars-pixel-anchors.py --check`: 49 metadanych zgodnych z pomiarem. Generator zmienia tylko plik metadanych, nigdy PNG/manifest.
- Chromium: desktop 1440×900, touch 390×844/DPR2, reduced motion 1000×750. Zarejestrowano wszystkie 49 slotów w każdym profilu (reduced motion pozostaje na pierwszej klatce danego klipu), bez dodatkowych transformacji proceduralnych i bez smoothingu.
- Zrzuty granatu/bazooki/rewolweru w obu kierunkach i kontrola macierzy transformacji potwierdzają dokładne przypięcie do kotwicy QA. Test obejmuje rzeczywiste wejście Enter → fire i ostatnią klatkę odrzutu, pierwsze obrażenia, brak powtórki, pauzę, reset i mieszanie ze starym skinem. Brak błędów JavaScript.
- Regresja v02: trzy profile oraz callbacki restore/reconnect w dwóch kartach przechodzą po rozszerzeniu wspólnego modułu hełmu.
- Test opóźnionej synchronizacji v04: 40 kroków replay oczekujących w kolejce, następnie autorytatywny snapshot HP 99 i reconnect. Po przywróceniu sześć ciał i pięć hełmów, bez powtórnego wyrzutu. Test używa lokalnego BroadcastChannel, bez Supabase.

Skrypty przeglądarkowe: `scripts/pondwars-pixel-browser.py` i `scripts/pondwars-helmet-browser.py`, po uruchomieniu lokalnego serwera. Zrzuty są w `/tmp/pondwars-pixel-v04-artifacts`. Testy na prawdziwym telefonie/Safari nie zostały wykonane — środowisko zapewnia Chromium i emulację, nie fizyczny telefon.

## Przegląd właściciela i dalsze kroki

Wybór między uproszczonym v04 a ilustracyjnym kierunkiem pozostaje otwarty. Do oceny: czytelność w małej skali, pozy ręki i chwyty broni, pełny backflip, końcowe KO i dopasowanie hełmu. Przed akceptacją nie usuwać flagi QA ani nie zastępować domyślnego artu. Osobno pozostaje model predykcji opisany w #267. Bez merge i publikacji bez zgody właściciela.

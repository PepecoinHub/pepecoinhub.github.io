# PR B — Mega Golden Foot, Bell Bomb i Frog Mine (tylko QA)

Baza: Draft PR A #279 (`e4963aff03d435b483c43d53461e817512653a71`), zależny od #271 i wcześniejszych #266 → #267 → #269 → #270. Nie scalać bez przeglądu właściciela. Nie wdrożono na produkcję; nie zmieniono Supabase, SQL, wyników ani nagród.

## Podgląd i zakres

Uruchom `python -m http.server 8000 --directory docs`, następnie otwórz `http://localhost:8000/games/pondwars-beta.html?art=pixel-v06&arsenal=exp-v1`. Bez `arsenal=exp-v1` pozostają dotychczasowe definicje, amunicja i wybór broni. V04 i v06 nadal są osobnymi wariantami. Nie zastąpiono zatwierdzonych ilustracji, animatora Pepe ani odłączanego hełmu. Broń i efekty są osobnymi warstwami; nowe grafiki pozostają prototypami.

- Mega Golden Foot zastępuje w QA istniejące `gold`: rzucany pocisk, 58 obrażeń / promień 66 / zapalnik 3 s / moc 480 / amunicja 1. Zachowuje pięć `toe`, każdy 12 / promień 16 / zapalnik 1,5 s. Mnożnik odrzutu 1,2 dotyczy rodzica, nie fragmentów. Nie ma nowego ID ani ataku melee.
- Bell Bomb: 44 / promień 32 / zapalnik 3 s / moc 520 / bez wiatru / odrzut 1,15 / 2 sztuki na drużynę. Używa rzeczywistego sweepu i odbicia granatu, nie wybucha przedwcześnie od kontaktu z żabą. Efekt odbicia jest limitowany czasowo; dźwięk respektuje istniejące wyciszenie i pauzę.
- Frog Mine: osobne `frog_mine`, 34 / promień 30 / 2 sztuki na drużynę. Uzbraja się przez 1 s, reaguje wyłącznie na żywego przeciwnika w 48 px, wykonuje jeden skok i wybucha przy kolizji lub po maksymalnie 0,35 s skoku. Wybuch może zranić sojusznika. Śmierć właściciela nie usuwa pułapki; woda ją usuwa, wybuchy mogą uruchomić łańcuch. Umieszczenie podnosi pułapkę nad powierzchnię także na zboczu. Istniejąca Land Mine (`mine`, 50 / promień 40 / 3 sztuki) zachowuje mechanikę.
- Zmiany balansu i minimalne rozszerzenie wyboru CPU dotyczą wyłącznie QA. Standardowe bronie i domyślne zachowanie CPU poza QA pozostają bez zmian. Pozostałe nowe bronie PEP, Doge Flyer i Silver Donkey nadal są zablokowane w UI i silniku.
- Per-match definicje, amunicja, snapshoty i deterministyczne kroki obejmują nowe bronie. Handshake odrzuca różny tryb/stage arsenału, restore nie może zmienić konfiguracji. FX korzystają z zegara animacji: zamierają podczas pauzy, reduced motion wyłącza dodatkowe sekwencje i obrót, reset/restore czyszczą lokalne efekty. Zapisy rozgrywki zachowują stan min i amunicji.

## Zależności i równoległe PR-y

Po pierwszym audycie i utworzeniu naszej gałęzi wykryto równoległe PR-y Cursor #272 (foundation), #274 (simple weapons) oraz kolejne etapy #275–#278. Nie włączano ich kodu. W #274 występują rozbieżności z v10: osobne `goldv2` jako melee zamiast zamiany rzucanego `gold` z pięcioma fragmentami, Bell bez limitu i Frog Mine z trzema sztukami bez wymaganego skoku. Nasze #279 i B stanowią alternatywny zestaw zgodny z dostarczonym v10. Nie należy scalać obu implementacji arsenału; właściciel powinien wybrać zestaw i uzgodnić zależności kolejnych etapów. Wczesny raport A opisuje stan pierwszego audytu; opis PR #279 uzupełniono po wykryciu konkurencyjnych prac.

## Testy wykonane

- 88 testów gry (w tym 6 foundation i 13 nowych testów B), wszystkie zaliczone. Nowe testy obejmują izolację QA, pięć fragmentów, odrzut rodzica, cienkie ściany, wiatr i zapalnik Bell, brak efektów podczas planowania CPU, amunicję drużyn, uzbrojenie/pojedynczy skok miny, martwe cele, sojuszników, śmierć właściciela, wodę, łańcuch, ustawienie na zboczu, zatrzymanie końca tury, replay/snapshot oraz handshake.
- Pełny Node: 227 testów, 216 zaliczonych, 11 pominiętych, 0 błędów. `python scripts/check_site.py`: 179 HTML / 549 JSON / 47 JS, OK. `python scripts/check_i18n.py`: OK z istniejącymi ostrzeżeniami. `git diff --check`: OK.
- `scripts/pondwars-arsenal-browser.py`: Chromium desktop 1440×900, emulowany telefon 390×844/DPR2 i reduced motion. Rzeczywiste akcje UI: Bell i zamrożenie zapalnika podczas pauzy, gold z pięcioma fragmentami, uzbrojenie/skok Frog Mine, reset i odliczanie amunicji. Dodatkowo kategorie, strony 8/8/5, przyszłe blokady, fallback uszkodzonego ładowania Bell do SVG, ikony 24/36/48 px. Brak błędów JS. Dźwięku nie włączano.
- `scripts/pondwars-arsenal-network-browser.py`: dwa klienty QA, 70 opóźnionych kroków, zgodny hash po odtworzeniu, autorytatywny snapshot i wznowienie z zachowaną amunicją. Brak błędów JS.
- Nie testowano fizycznych telefonów ani prawdziwej sieci internetowej. Lokalne zrzuty znajdują się w `/tmp/frog-arsenal-qa/B-*`.

## Wstępna ocena balansu

Dane: [arsenal-B-balance.json](arsenal-B-balance.json). Skrypt: `node scripts/pondwars-arsenal-balance.mjs` (domyślnie 300 rund na broń/mapę). Wykonano 4 800 deterministycznych ocen pojedynczej tury: cztery mapy × QA gold/Bell/Frog Mine i bazowe gold × 300. Obie strony, trzy istniejące poziomy CPU i 2/3/4 żaby na drużynę tam, gdzie mapa na to pozwala. Użyto rzeczywistego planera i kroku silnika z istniejącym odwrotem CPU; dodatkowo powtórzono sondę deterministyczności dla każdej komórki. Brak przekroczeń limitu czasu.

To nie są pełne mecze ani pomiar częstości naturalnego wyboru broni przez CPU. Wymuszono badaną broń i odnowiono jej zapas na każdą rundę. Dla Frog Mine przygotowano pozycje przeciwnika 58/66/74 px od właściciela na rzeczywistej powierzchni, aby ocenić podejście do pułapki. Statystyka obejmuje także upadki i wodę; nie izoluje samych obrażeń wybuchu. Miny pozostałe po końcu tury mogą mieć wartość w dalszych turach, której ten pomiar nie obejmuje.

| Broń | Mapa | Śr. HP przeciwnika utracone | Śr. zabójstwa wodą/rundę | Mina pozostała po turze |
|---|---|---:|---:|---:|
| gold | island | 39.23 | 0.033 | 0.0% |
| gold | twin | 61.71 | 0.237 | 0.0% |
| gold | peaks | 32.53 | 0.000 | 0.0% |
| gold | small | 62.73 | 0.263 | 0.0% |
| bell_bomb | island | 15.73 | 0.003 | 0.0% |
| bell_bomb | twin | 24.01 | 0.077 | 0.0% |
| bell_bomb | peaks | 14.13 | 0.000 | 0.0% |
| bell_bomb | small | 20.02 | 0.023 | 0.0% |
| frog_mine | island | 9.18 | 0.000 | 70.0% |
| frog_mine | twin | 27.18 | 0.223 | 56.0% |
| frog_mine | peaks | 5.41 | 0.000 | 80.0% |
| frog_mine | small | 8.17 | 0.000 | 66.7% |
| gold bazowe | island | 60.68 | 0.010 | 0.0% |
| gold bazowe | twin | 88.94 | 0.237 | 0.0% |
| gold bazowe | peaks | 50.28 | 0.000 | 0.0% |
| gold bazowe | small | 88.69 | 0.223 | 0.0% |

QA gold odbiera średnio 49,05 HP przeciwnikom wobec 72,15 bazowego gold (około 32% mniej). Teoretyczny bezpośredni pułap rodzic + pięć fragmentów spadł z 248 do 118, bez uwzględnienia upadków i łańcuchów. Większy promień/odrzut nadal mocno działa nad wodą, zwłaszcza na małej mapie; nie należy oceniać osłabienia tylko sumą obrażeń.

Bell średnio odbiera 18,47 HP przeciwnikom, przy 1,38 HP obrażeń własnych/sojuszniczych. Frog Mine: 12,48 HP i 0,79 HP odpowiednio; 56–80% pułapek pozostaje po turze. Nie jest to wystarczająca podstawa do wzmocnienia miny: trzeba zmierzyć kilka kolejnych tur i naturalny ruch przeciwnika. Parametrów v10 nie korygowano na podstawie tego wstępnego pomiaru.

## Następny PR

Najpierw przegląd na planszy i wybór jednej implementacji arsenału. Uzupełnić pełne mecze, trwałą wartość pułapek, rozkład wyników oraz rzeczywiste telefony i odsłuch efektów. Następnie osobne etapy PEP weapons, Doge Flyer, Silver Donkey i mapy, po uzgodnieniu ich zależności z równoległymi PR-ami. Nie ma automatycznego odblokowania kolejnych broni ani publikacji.

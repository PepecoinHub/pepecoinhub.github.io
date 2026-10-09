# Pepecoin Holder Watch

Co dzień zapisuje snapshot top ~2000 adresów Pepecoin (PEP) i pokazuje na stronie:

- udział w podaży top 10 / 25 / 50 / 100 / 400 / 1000,
- zmianę tego udziału po 1 dniu, tygodniu, 2 tygodniach, miesiącu, kwartale, pół roku, roku, 2 latach i od początku historii (okresy ustawia jedna lista `PERIODS` w `scripts/build_summary.py`; 5 lat to dopisanie `1825`),
- wykres kołowy struktury (progi rankingu), wykres trendu, kto wszedł do top 1000 i kto wypadł, tabelę wszystkich portfeli,
- drugi widok „bez giełd i pooli”.

Koszt: 0 zł. Bez serwera, bazy i kluczy API. GitHub Actions pobiera dane raz dziennie, zapisuje je w repozytorium, a GitHub Pages serwuje statyczną stronę.

## Uruchomienie (ok. 10 minut)

1. Załóż na GitHubie **publiczne** repozytorium (np. `pepecoin-holder-watch`) i wgraj do niego całą zawartość tego folderu **do głównego katalogu repo** (nie do podfolderu, bo GitHub szuka workflowu tylko w `.github/workflows/` w rootcie). GitHub Pages dla prywatnych repozytoriów wymaga płatnego planu.
2. W repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**. Bez tego zadanie `deploy` kończy się błędem „HttpError: Not Found” w kroku `configure-pages`. Zbieranie danych działa i tak.
3. Zakładka **Actions → Daily snapshot → Run workflow**. Pierwsze uruchomienie robi pierwszy snapshot i publikuje stronę.
4. Adres strony pojawi się w logu zadania `deploy` i w Settings → Pages (zwykle `https://TWOJ-LOGIN.github.io/NAZWA-REPO/`).

Od tego dnia workflow robi się sam o 03:17 UTC. Historia sprzed pierwszego snapshotu jest już w repozytorium (odtworzona z blockchainu, patrz niżej), więc wszystkie okresy, łącznie z 1R, 2L i „Całość”, działają od razu.

## Sprawdź przy pierwszym uruchomieniu

Nie mogłem z mojego środowiska wywołać pepecoinservice.org ani pepeblocks.com, więc kod jest przetestowany na danych próbnych i lokalnym atrapowym API, nie na prawdziwym. Zerknij w log pierwszego runu:

- Krok „Take snapshot” powinien wypisać `rows=2000`, wysokość bloku i podaż. Jeśli się wysypie, w logu będzie powód (np. zmieniony format odpowiedzi API).
- Jeśli przy podaży stoi `(estimate)`, to PepeBlocks nie odpowiedział z serwerów GitHuba. Skrypt liczy wtedy podaż z wysokości bloku (10 000 PEP na blok), a na stronie pokazuje się żółta etykieta „supply estimated”. Różnica jest znikoma, ale daj znać, to podmienimy źródło.

## Oznaczanie adresów (giełdy, pule)

Plik `docs/data/labels.json`. Dopisz linię i zrób commit, następny przebieg przeliczy też historię:

```json
"ADRES": { "name": "Nazwa", "type": "exchange" }
```

Typy `exchange`, `pool`, `burn` znikają w widoku „bez giełd i pooli” (razem z saldami, które odejmuje się od podaży). Typy `project` i `other` tylko dodają etykietę. Wpisy: CoinEx i litecoinpool.org (z rich listy PepeBlocks) oraz XeggeX i NonKYC. Te dwie giełdy sprawdzono na łańcuchu (liczba transakcji, tysiące różnych wpłacających, konsolidacje adresów depozytowych, opróżnienie portfela XeggeX po upadku giełdy 3 lutego 2025); dodatkowe adresy tych giełd są tylko takie, które giełda wydała w jednej transakcji razem ze swoim portfelem (wspólne wejścia = ten sam właściciel klucza), oraz nowy portfel NonKYC od lipca 2025 (`PuXnYSgp…`: przejął cały stary portfel jedną transakcją i od tamtej pory zbiera wpłaty z ponad 1000 tych samych adresów depozytowych). Dowody są w `VALIDATION.md`. Flaga „miner” z API nie jest pokazywana ani brana pod uwagę: liczą się tylko ręczne tagi z tego pliku.

## Pliki

| Plik | Co robi |
|---|---|
| `scripts/snapshot.py` | Pobiera top 2000 adresów, podaż i wysokość bloku, sprawdza sensowność danych i zapisuje `docs/data/snapshots/RRRR-MM-DD.json`. Nic nie zapisze, jeśli dane wyglądają źle. |
| `scripts/build_summary.py` | Liczy udziały, zmiany i ruchy z wszystkich snapshotów (bieżących i odtworzonych), dokłada dzienne punkty z `reconstructed_daily.json`, zapisuje `docs/data/summary.json` i `docs/data/shares.csv` (kolumna `source`: `live`, `reconstructed`, `reconstructed-daily`). Wpisuje też dzisiejsze udziały top 10 … top 1000 zwykłym HTML-em do `docs/rich-list.html` (między znacznikami `static-summary`), dla wyszukiwarek i osób bez JavaScriptu; skrypt strony podmienia ten blok na wykresy. Do tego `docs/data/network.json` (wysokość bloku, podaż, adresy z saldem i czas dla każdego snapshotu) dla strony `network.html`. |
| `scripts/build_sitemap.py` | Ustawia w `docs/sitemap.xml` datę `lastmod` każdej strony na dzień jej ostatniej zmiany w gicie. Lista adresów zostaje bez zmian. Workflow uruchamia go codziennie. |
| `scripts/build_reconstructed_daily.py` | Jednorazowo: z dziennych plików odtworzonych z blockchainu robi zwartą serię `docs/data/reconstructed_daily.json`. Uruchom ponownie po zmianie tagów giełd, jeśli chcesz mieć dzienną historię także w widoku „bez giełd i pooli”. |
| `docs/data/snapshots/` | Snapshoty. Pliki z `"reconstructed": true` w `meta` są odtworzone z blockchainu, pozostałe pochodzą z codziennego pobrania. |
| `VALIDATION.md` | Jak sprawdzono odtworzoną historię (porównanie z archiwalnymi rich listami i z API). |
| `docs/` | Strona (HTML, CSS i JS, bez bibliotek zewnętrznych). Wszystkie pliki CSS i JS są linkowane z jedną, wspólną wersją `?v=` (np. `?v=20261007d`). Po zmianie któregokolwiek z nich (`facts.css`, `chrome.js`, `live.js`, `style.css`, `app.js`) podbij tę jedną wersję na wszystkich stronach naraz, inaczej przeglądarki mogą trzymać starą wersję. Data w nadtytule strony („updated …”) zmienia się tylko przy prawdziwej zmianie treści tej strony. |
| `docs/pl/`, `es/`, `de/`, `fr/`, `tr/`, `it/`, `zh/` | Tłumaczenia pięciu stron: główna, Which is which, Jak kupić, Portfele, Słowniczek. Zmiana treści w angielskiej wersji tych stron musi trafić też do tłumaczeń. Żargon kryptowalutowy bez naturalnego odpowiednika (AuxPoW/merged mining, proof of work, hashrate, mining pool, cold wallet, custodial, premine, fair launch, halving, full node, recovery phrase, ATH) zostaje po angielsku z krótkim wyjaśnieniem w danym języku; po chińsku zostają utrwalone chińskie terminy z angielskim w nawiasie. W słowniczkach hasła są ułożone alfabetycznie według języka strony. Strony wskazują swoje wersje językowe znacznikami `hreflang` w `<head>`, a przełącznik języków w nagłówku (`docs/chrome.js`) bierze adresy właśnie z nich. |
| `docs/games/`, `games/` | Gry społeczności (Draw & Guess, Guess the Picture, stoły: szachy, warcaby, „czwórki w rząd”, statki, gra z botem). Strony w `docs/games/`; serwer (Supabase) opisuje `games/SETUP.md`, kod bazy jest w `games/supabase/`. Bez wpisanych kluczy w `docs/games/js/config.js` działa tylko gra z botem. Żaby do gier generuje `scripts/make_games_frogs.py`. |
| `.github/workflows/snapshot.yml` | Dwa zadania. `snapshot`: pobranie danych, podsumowanie, commit. `deploy`: publikacja strony. Dzięki temu historia zbiera się nawet przed włączeniem Pages. Push też robi snapshot, ale tylko jeśli na dziś jeszcze go nie ma. |

## Lokalnie

```bash
python scripts/snapshot.py          # wymaga dostępu do pepecoinservice.org
python scripts/build_summary.py
python -m http.server 8000 --directory docs   # http://localhost:8000
```

## Historia sprzed pierwszego snapshotu (odtworzona z blockchainu)

API podaje tylko aktualną rich listę, więc dni sprzed pierwszego snapshotu (5 października 2026) odtworzono inaczej: przeliczając cały blockchain Pepecoina od bloku genesis.

- Na własnym pełnym węźle Pepecoin Core (v1.1.0, bez portfela i bez `txindex`) narzędzie do replayu czyta po kolei każdy blok przez lokalne RPC, prowadzi zbiór UTXO na dysku (SQLite) i salda wszystkich adresów, a na koniec każdego dnia UTC (stan tuż przed pierwszym blokiem z następnego dnia) zapisuje top 2000 w dokładnie tym samym formacie co `snapshot.py`.
- Podaż to podaż z harmonogramu emisji na danej wysokości (tak samo liczy PepeBlocks; zgodność co do PEP na wysokościach 1 237 541 i 1 238 910). P2PK liczy się jako odpowiadający mu adres P2PKH; multisig i skrypty niestandardowe nie trafiają na listę (jak w eksploratorach). `lastSeen` to czas ostatniego bloku, w którym adres coś dostał albo wydał. `isMiner` = adres dostał wypłatę z coinbase w ostatnich 30 dniach (strona i tak tego nie używa).
- Do repozytorium trafiły: snapshoty tygodniowe (poniedziałki) od 5.02.2024 do 25.08.2025, dzienne od 1.09.2025 do 4.10.2026 (top 2000), plus `reconstructed_daily.json` z dziennymi udziałami za cały okres. Od 5.10.2026 nadal zbiera je `snapshot.py` (też top 2000). Pliki bieżących snapshotów nie były ruszane.
- Na stronie odtworzone punkty są rysowane linią przerywaną i pustymi kropkami, z dopiskiem „odtworzone” w podpowiedzi, a kolumny tabeli zmian porównujące z odtworzonym snapshotem mają przerywaną ramkę.
- Sprawdzenie: salda i sumy z archiwalnych kopii rich list PepeBlocks i PepecoinExplorer (Internet Archive) w momencie zrobienia kopii oraz bieżące snapshoty z 5 i 6 października 2026 przy tej samej wysokości bloku. Wyniki w `VALIDATION.md`.
- Samego narzędzia do replayu nie ma w repozytorium (wymaga pełnego węzła, ok. 14 GB danych i kilku godzin). Działa poza repozytorium; zasada jest opisana wyżej. Nic nie trzeba przeliczać ponownie, codzienne snapshoty dalej robi `snapshot.py`.

## Ograniczenia, o których warto pamiętać

- Historia sprzed 5 października 2026 jest odtworzona z blockchainu (patrz wyżej): do końca sierpnia 2025 snapshoty są co tydzień, od 1 września 2025 codziennie (top 2000). Lista „kto się ruszył” dotyczy top 1000; tabela portfeli pokazuje wszystkie adresy ze snapshotu.
- Adres to nie człowiek. Giełdy i custodiany trzymają monety wielu osób, a lista tagów jest ręczna i niepełna.
- Udziały liczone są względem podaży z dnia snapshotu.
- Rozmiar: jeden snapshot to ok. 90 KB, czyli ok. 33 MB rocznie w repozytorium. Odtworzona historia dodała ok. 68 MB (481 snapshotów top 2000: tygodniowe od 5.02.2024 do 25.08.2025, dzienne od 1.09.2025 do 4.10.2026, plus seria dzienna ok. 0,2 MB). To mało (limit GitHub Pages to 1 GB), git dodatkowo kompresuje podobne pliki.
- Cron GitHuba potrafi się spóźnić o kilkanaście minut, a w repozytorium bez aktywności zaplanowane workflowy bywają wyłączane po ok. 60 dniach (wystarczy włączyć z powrotem). Codzienne commity ze snapshotami zwykle to zapobiegają.
- Jeśli GitHub ostrzeże o przestarzałych wersjach akcji (`actions/checkout@v4` itd.), podbij numery w `snapshot.yml`.

## Własna domena (opcjonalnie, pod SEO)

W Settings → Pages wpisz domenę (np. `holders.twojadomena.pl`) i ustaw u rejestratora rekord CNAME na `TWOJ-LOGIN.github.io`.

# Pepecoin Holder Watch

Co dzień zapisuje snapshot top ~1250 adresów Pepecoin (PEP) i pokazuje na stronie:

- udział w podaży top 10 / 25 / 50 / 100 / 400 / 1000,
- zmianę tego udziału po 1 dniu, tygodniu, 2 tygodniach, miesiącu, kwartale, pół roku i roku,
- wykres kołowy struktury (progi rankingu), wykres trendu, kto wszedł do top 1000 i kto wypadł, tabelę wszystkich portfeli,
- drugi widok „bez giełd i pooli”.

Koszt: 0 zł. Bez serwera, bazy i kluczy API. GitHub Actions pobiera dane raz dziennie, zapisuje je w repozytorium, a GitHub Pages serwuje statyczną stronę.

## Uruchomienie (ok. 10 minut)

1. Załóż na GitHubie **publiczne** repozytorium (np. `pepecoin-holder-watch`) i wgraj do niego całą zawartość tego folderu. GitHub Pages dla prywatnych repozytoriów wymaga płatnego planu.
2. W repozytorium: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Zakładka **Actions → Daily snapshot → Run workflow**. Pierwsze uruchomienie robi pierwszy snapshot i publikuje stronę.
4. Adres strony pojawi się w logu kroku „deploy” i w Settings → Pages (zwykle `https://TWOJ-LOGIN.github.io/NAZWA-REPO/`).

Od tego dnia workflow robi się sam o 03:17 UTC. Pierwsze zmiany widać następnego dnia, tygodniowe po tygodniu, roczne po roku.

## Sprawdź przy pierwszym uruchomieniu

Nie mogłem z mojego środowiska wywołać pepecoinservice.org ani pepeblocks.com, więc kod jest przetestowany na danych próbnych i lokalnym atrapowym API, nie na prawdziwym. Zerknij w log pierwszego runu:

- Krok „Take snapshot” powinien wypisać `rows=1250`, wysokość bloku i podaż. Jeśli się wysypie, w logu będzie powód (np. zmieniony format odpowiedzi API).
- Jeśli przy podaży stoi `(estimate)`, to PepeBlocks nie odpowiedział z serwerów GitHuba. Skrypt liczy wtedy podaż z wysokości bloku (10 000 PEP na blok), a na stronie pokazuje się żółta etykieta „supply estimated”. Różnica jest znikoma, ale daj znać, to podmienimy źródło.

## Oznaczanie adresów (giełdy, pule)

Plik `docs/data/labels.json`. Dopisz linię i zrób commit, następny przebieg przeliczy też historię:

```json
"ADRES": { "name": "Nazwa", "type": "exchange" }
```

Typy `exchange`, `pool`, `miner`, `burn` znikają w widoku „bez giełd i pooli” (razem z saldami, które odejmuje się od podaży). Typy `project` i `other` tylko dodają etykietę. Na start są dwa wpisy: CoinEx i litecoinpool.org (z rich listy PepeBlocks). Adresy, które API samo oznacza jako górnika, są traktowane jako `miner`.

## Pliki

| Plik | Co robi |
|---|---|
| `scripts/snapshot.py` | Pobiera top 1250 adresów, podaż i wysokość bloku, sprawdza sensowność danych i zapisuje `docs/data/snapshots/RRRR-MM-DD.json`. Nic nie zapisze, jeśli dane wyglądają źle. |
| `scripts/build_summary.py` | Liczy udziały, zmiany i ruchy z wszystkich snapshotów, zapisuje `docs/data/summary.json` i `docs/data/shares.csv`. |
| `docs/` | Strona (HTML, CSS i JS, bez bibliotek zewnętrznych). |
| `.github/workflows/snapshot.yml` | Codzienny przebieg: snapshot → podsumowanie → commit → publikacja. |

## Lokalnie

```bash
python scripts/snapshot.py          # wymaga dostępu do pepecoinservice.org
python scripts/build_summary.py
python -m http.server 8000 --directory docs   # http://localhost:8000
```

## Ograniczenia, o których warto pamiętać

- Historia zaczyna się od pierwszego snapshotu. API podaje tylko aktualną rich listę, więc wstecz nic nie odtworzymy.
- Adres to nie człowiek. Giełdy i custodiany trzymają monety wielu osób, a lista tagów jest ręczna i niepełna.
- Udziały liczone są względem podaży z dnia snapshotu.
- Rozmiar: jeden snapshot to ok. 70 KB, czyli ok. 25 MB rocznie w repozytorium. To mało, git dodatkowo kompresuje podobne pliki.
- Cron GitHuba potrafi się spóźnić o kilkanaście minut, a w repozytorium bez aktywności zaplanowane workflowy bywają wyłączane po ok. 60 dniach (wystarczy włączyć z powrotem). Codzienne commity ze snapshotami zwykle to zapobiegają.
- Jeśli GitHub ostrzeże o przestarzałych wersjach akcji (`actions/checkout@v4` itd.), podbij numery w `snapshot.yml`.

## Własna domena (opcjonalnie, pod SEO)

W Settings → Pages wpisz domenę (np. `holders.twojadomena.pl`) i ustaw u rejestratora rekord CNAME na `TWOJ-LOGIN.github.io`.

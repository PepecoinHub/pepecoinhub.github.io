# Pojedynki w stawie: POND BULLETIN, POND KING, BATTLE OF THREE LILIES

Status: **draft, niewdrożone**. Nic nie zostało uruchomione na produkcyjnej bazie Supabase. Instrukcja uruchomienia jest na końcu.

Trzy części, jeden mechanizm: gracz zostawia ukrytą strategię, a ktoś inny później z nią walczy. Nikt nie musi być online w tym samym czasie. Wszystko jest w PondOS 98 (`/meme/`), po angielsku.

| | POND KING | BATTLE OF THREE LILIES |
|---|---|---|
| Kto z kim | jeden król kontra wszyscy | 1 na 1, wyzwanie dla jednej osoby |
| Ukryta strategia | 3 ruchy kamień / papier / nożyce | 10 much na 3 liściach |
| Logowanie | niepotrzebne (konto opcjonalnie) | wymagane: Discord albo gość (Log On) |
| Strona | `docs/games/pond-king.html` | `docs/games/lilies.html` |

**POND BULLETIN** (`docs/games/bulletin.html`) to wspólna tablica: otwarte wyzwania Lilii, nowi królowie, długie panowania i wyniki pojedynków.

## Zasady BATTLE OF THREE LILIES

- Każdy gracz ma dokładnie 10 much i rozkłada je na Lily A, B i C: liczby całkowite od 0 do 10, suma 10.
- Liść wygrywa ten, kto ma na nim więcej much. Przy równej liczbie liść jest nierozstrzygnięty.
- Pojedynek wygrywa ten, kto weźmie więcej liści (2:1, 2:0, 1:0, 3:0). Przy 1:1 i 0:0 jest remis. Suma much się nie liczy.
- Gracz A tworzy wyzwanie, a jego rozkład jest tajny. Gracz B przyjmuje je z własnym rozkładem. Serwer w jednej transakcji zapisuje ruch B, rozstrzyga pojedynek, zamyka wyzwanie i publikuje wynik w Bulletinie. Dopiero wtedy pokazuje oba rozkłady, i to tylko tym dwóm graczom.
- Wyzwanie jest otwarte 48 godzin. Wygasłe nie daje wygranej ani przegranej. Autor może anulować tylko otwarte wyzwanie.
- Limity: 3 otwarte wyzwania na gracza, 5 nowych na gracza na dobę UTC, 15 nowych na sieć (skrót IP) na dobę UTC, 300 na godzinę w całym stawie.
- Rewanż to nowe wyzwanie z nowym rozkładem, dostępne tylko dla drugiego gracza tamtego pojedynku. Stary tajny rozkład nigdy nie jest użyty ponownie.
- MVP to pojedyncze pojedynki. Best of 5 zostaje na później.

## Zasady POND KING

Opisane w `games/SETUP.md` i w samym pliku SQL. W skrócie: król ma 3 ukryte ruchy, a serwer przy każdym pojedynku tasuje ich kolejność. Pretendent musi wygrać więcej rund niż król, remis zostaje przy królu. **Jeden pojedynek co 4 godziny** na gracza (token przeglądarki albo konto) i na sieć, licząc od ostatniego pojedynku. Po przegranej okno mówi, że żaba jest poobijana i ma wrócić za 4 godziny (z godziną następnej próby). Do tego z jednym królem walczy się raz na osobę i raz na sieć. Nowe w tej wersji: zalogowany gracz jest zapisywany pod kontem (tron działa na każdym urządzeniu, król z Discordem ma link do Paszportu), a nowi królowie i panowania 5, 10, 25, 50, 100… obron trafiają do Bulletinu.

## Architektura

- **Tożsamość.** Używam istniejącej sesji Supabase, tej samej co PEP Games i Log On w PondOS (Discord albo gość z Turnstile). Gracz to zawsze `auth.uid()` z sesji, nigdy argument funkcji. Nick przechodzi przez `games.valid_nick`: nicki graczy Discorda są zarezerwowane i działa filtr. Link do Fren Passport jest tylko dla graczy Discorda, tak jak w LAN Party.
- **Tajne ruchy** są w `games.lily_moves` i `games.pk_kings.moves`. Tabele mają włączone RLS bez żadnych polityk i odebrane wszystkie uprawnienia dla `anon` i `authenticated`. Dostęp jest wyłącznie przez funkcje `security definer` z `search_path = ''`. Zapisanego rozkładu nie da się zmienić: nie ma uprawnień, a dodatkowo trigger blokuje `UPDATE`.
- **Brak Realtime.** Nic z tych gier nie idzie kanałami Realtime. Strony odświeżają dane przy powrocie do karty i co minutę.
- **Bulletin** zapisuje tylko serwer, przez `games.bulletin_post` (niedostępne z przeglądarki), w tej samej transakcji co wynik. Unikalny `event_key` (`lily:<id>`, `pk:crown:<id>`, `pk:def:<id>:<n>`) blokuje duplikaty. Otwarte wyzwania nie są wpisami, tylko czytane na żywo z `games.lily_challenges`, więc przyjęte, anulowane i wygasłe znikają same. Wpisy starsze niż 30 dni są kasowane. Kolejne gry (YEET, Pepe Guesser, osiągnięcia) dodają nowy `kind` i wołają tę samą funkcję.
- **Jednoczesne przyjęcie** tego samego wyzwania: `select … for update` na wierszu wyzwania. Druga osoba czeka, potem widzi status `completed` i dostaje `taken`.
- **Wygasanie** bez procesu w tle: wyzwania zamykają się przy odczycie, tworzeniu i próbie przyjęcia. Odczyt i tak pomija przeterminowane.
- **Okna PondOS.** Gry działają w ramkach (`?embed=1`). Przyciski „View Passport”, „Log On”, „Accept Challenge” czy „Back to Pond Bulletin” wysyłają do PondOS `postMessage({type: 'pondos-open', …})`. PondOS przyjmuje to tylko od własnych ramek z tego samego originu. Poza PondOS te same przyciski prowadzą do zwykłych stron.

### Funkcje (RPC)

| Funkcja | Kto | Co zwraca |
|---|---|---|
| `gry_bulletin(p_limit)` | każdy | otwarte wyzwania (metadane), obecny król, ostatnie wpisy |
| `gry_lily_create(a, b, c, nick, rematch_of)` | zalogowany | metadane wyzwania (bez rozkładu) |
| `gry_lily_accept(id, a, b, c, nick)` | zalogowany | pełny wynik dla przyjmującego |
| `gry_lily_my()` | zalogowany | własne pojedynki: swój rozkład zawsze, cudzy dopiero po rozstrzygnięciu |
| `gry_lily_result(id)` | każdy | gracze: oba rozkłady po rozstrzygnięciu; pozostali: nicki i wynik |
| `gry_lily_cancel(id)` | autor | anulowanie otwartego wyzwania |
| `gry_pk_state / gry_pk_challenge / gry_pk_set_moves` | każdy (konto opcjonalne) | Król Stawu |

## Pliki

- SQL: `games/supabase/update_pond_bulletin.sql`, `update_pond_king.sql`, `update_lilies.sql`
- Strony: `docs/games/bulletin.html`, `lilies.html`, `pond-king.html`, style `pond.css`, `lilies.css`
- JS: `docs/games/js/pond-net.js` (sesja, RPC, komunikacja z PondOS), `lilies.js`, `bulletin.js`, `pond-king.js`
- PondOS: `docs/meme/meme.js` (okna, ikony na pulpicie, menu Start, folder Games, Find, przyciski pod „Today in the pond”, dymek, obsługa `pondos-open`), `docs/meme/meme.css`
- Ikony (tymczasowe): `docs/games/img/pond-king.svg`, `docs/games/img/lilies.svg`
- Testy: `tests/pond-sql-setup.mjs`, `tests/lilies-sql.test.mjs`, `tests/pond-king-sql.test.mjs`
- Prywatność: `docs/games/privacy.html`

## Testy

`tests/lilies-sql.test.mjs` i `tests/pond-king-sql.test.mjs` to testy integracyjne na prawdziwym PostgreSQL. Każde wywołanie idzie z rolą `anon` albo `authenticated`, tak jak z przeglądarki, nigdy jako właściciel tabel. Pokrywają wszystkie 15 punktów briefu:

1. Poprawny rozkład 2/4/4. 2. Sumy 9 i 11. 3. Wartości ujemne, ułamki, tekst i brak wartości. 4. Wygrana 2:1. 5. Remis 1:1 z nierozstrzygniętym liściem. 6. Remis 0:0. 7. Przyjęcie własnego wyzwania. 8. Wygasłe wyzwanie. 9. Dwa równoczesne przyjęcia na dwóch połączeniach z bazą. 10. Ponowne przesłanie ruchu i próba `UPDATE`. 11. Brak dostępu do tajnego rozkładu przed rozstrzygnięciem: tabele, `gry_lily_result`, `gry_lily_my`, Bulletin. 12. Widoczność wyników po zakończeniu. 13. Brak duplikatów w Bulletinie. 14. Powrót do wyniku po ponownym wejściu. 15. Limity: 3 otwarte, 5 na dobę, 15 na sieć.

Dodatkowo: pozostałe przykłady z briefu (5/2/3, 0/5/5), anulowanie tylko przez autora, rewanż tylko dla drugiego gracza, zarezerwowane nicki. W Królu Stawu: tron przypisany do konta, wpisy w Bulletinie.

Uruchomienie (lokalny Postgres, nigdy Supabase):

```bash
PASSPORT_PG_URL=postgres://postgres@localhost:5432/postgres PASSPORT_PG_MODULE=/abs/path/node_modules/pg/lib/index.js node --test tests/lilies-sql.test.mjs tests/pond-king-sql.test.mjs
```

W CI te testy się pomijają, bo nie ma tam Postgresa. Tak samo działają pozostałe testy SQL w repo.

Ręcznie, w przeglądarce (Playwright, lokalna baza zamiast Supabase): gracz Discord tworzy wyzwanie 2/4/4 z Bulletinu w PondOS, gość na telefonie przyjmuje je z 4/3/3 i przegrywa 1:2. Wynik pojawia się w Bulletinie raz, „FrogKing’s Passport” otwiera okno Paszportu, a pierwszy gracz po ponownym wejściu widzi „You win 2:1”.

## Grafiki

Dostarczone (14.11.2026, z ChatGPT) i wstawione do `docs/games/img/pond/`: liście lilii a/b/c, kamień, papier i nożyce, Król Stawu, ikony Lilii i Bulletinu, kafelek korka, pinezka, animacje wygranej, przegranej i remisu (po 4 klatki, jako paski `*-anim.png`) oraz Pepe w koronie (`king-stamp.png`: awatar króla w Bulletinie i w panelu „You are the Pond King”, ikona Paszportu króla). Oryginały miały ok. 1250 px i rozmyte krawędzie. Zostały zmniejszone do prawdziwej siatki 32 px (Król 48 px), z kilkunastoma kolorami i ostrą przezroczystością, i są wyświetlane z `image-rendering: pixelated`. Wszystko razem waży ok. 20 KB.

Nadal rysowane w kodzie: muchy (5x5 px w `docs/games/js/pond-net.js`, bo muchy z GPT przy tym rozmiarze zlewały się w plamę) i woda stawu (dithering w CSS).

### Pierwotne zamówienie

Gotowy prompt do wklejenia w ChatGPT (styl, paleta, rozmiary, nazwy plików i miejsca w kodzie): `games/POND_ART_GPT_PROMPT.md`.

Wszystko poniżej to dziś placeholdery, oznaczone w kodzie (`PLACEHOLDER`):

1. **Liść lilii**: 3 warianty albo jeden do obracania, widok z góry, ok. 256×256, przezroczyste tło, z miejscem na liczbę. Dziś zielone koło z CSS (`.pad-leaf` w `docs/games/lilies.css`).
2. **Mucha**: mała ikona ok. 32×32, do ustawiania od 0 do 10 sztuk na liściu. Dziś emoji 🪰.
3. **Tło stawu** za liśćmi: woda, poziomy pas. Dziś gradient.
4. **Ikona BATTLE OF THREE LILIES**: 64×64 i 16×16 dla pulpitu, menu Start i paska tytułu. Dziś `docs/games/img/lilies.svg`.
5. **Ikona POND BULLETIN**: tablica korkowa z pinezkami, 64×64 i 16×16. Dziś pożyczona `news.webp`.
6. **Animacje wyniku**: wygrana, przegrana, remis. Muchy zlatują na wygrany liść, na remisie się kłócą.
7. **Ikona POND KING**: żaba w koronie, w stylu ikon PondOS. Dziś `docs/games/img/pond-king.svg`, rysowana w kodzie.

## Jak uruchomić później (tego nie wykonano)

1. Scal PR do `main`.
2. Supabase → SQL Editor: po kolei całe pliki `update_pond_bulletin.sql`, `update_pond_king.sql`, `update_lilies.sql`. Kolejność ma znaczenie, każdy plik można powtórzyć.
3. Sprawdź na `/meme/`: przyciski „Pond Bulletin” i „Dethrone Pepe” pod „Today in the pond” pokazują dane, a okna gier nie mówią już „opens soon”.
4. Wyłączenie bez kasowania danych: `revoke execute on function public.gry_lily_create(int, int, int, text, uuid) from authenticated;` blokuje nowe wyzwania. Przyciski na `/meme/` zostają; gdy funkcja nie odpowiada, okno pokazuje komunikat o błędzie.

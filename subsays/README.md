# Sub Says

Codzienna gra dla społeczności subreddita: jednego dnia wszyscy odpowiadają na pytanie ("Name something you'd bring to a picnic"), następnego zgadują, co powiedział sub, i dostają punkty za to, ile procent ludzi podało daną odpowiedź. Aplikacja Reddit (Devvit Web), **bez własnego serwera i bez kosztów**: stan trzyma Redis od Reddita, osobny dla każdego suba.

## Przebieg (rundy nakładają się)

Runda trwa dwa okna po 24 godziny (długość ustawia moderator: 24, 48 albo 72 godziny). Nowa runda startuje codziennie o 15:00 UTC, więc każdy post ma dwie części:

| Dzień | Co widzi gracz |
|---|---|
| 1 | tylko pytanie nr 1: wpisz **3 różne odpowiedzi** |
| 2 | **zgadnij tablicę pytania 1**, jedną odpowiedź naraz (3 próby), i od razu **odpowiedz na pytanie 2** |
| 3 | zgadnij pytanie 2, odpowiedz na pytanie 3. I tak dalej |

- **Odpowiedzi:** dokładnie 3 różne na osobę (przycisk jest nieaktywny, dopóki nie ma trzech; dwa zapisy tej samej odpowiedzi nie liczą się jako dwie), jedno zgłoszenie na rundę, bez edycji. Cudze odpowiedzi nie są widoczne ani sortowane (autouzupełnianie podpowiada tylko pisownię alfabetycznie, bez liczników), żeby ludzie nie klikali tego, co już prowadzi.
- **Scalanie:** wielkość liter, akcenty, przedimki (a/an/the), liczba mnoga i kolejność słów są ignorowane ("Sandwiches" = "a sandwich", "fries, french" = "French fries"). Literówki scala się tylko przy słowach od 6 liter i tylko przy tej samej pierwszej literze (tennis/tenis, ale nie mouse/house).
- **Plansza:** odpowiedź wchodzi, gdy podały ją **co najmniej 3 różne osoby**. 5 odpowiedzi, a od 200 osób, które odpowiedziały, 8 (moderator może wymusić 5 lub 8). Poniżej 3 odpowiedzi spełniających próg albo poniżej minimalnej liczby osób (domyślnie 20) runda jest pomijana i aplikacja to mówi.
- **Zgadywanie po jednej odpowiedzi:** wpisujesz jedną, od razu widzisz, czy jest na tablicy (trafiona odsłania swój rząd na właściwym miejscu), i dopiero potem wpisujesz następną. 3 próby; pudło zużywa próbę. Powtórzenie czegoś, co już sprawdziłeś (także innym zapisem), nic nie kosztuje. Cała tablica pokazuje się po ostatniej próbie.
- **Punkty:** 5 za odpowiedź. Za zgadnięcie: tyle punktów, ile procent osób podało trafioną odpowiedź (62% = 62 pkt). Dwa zapisy tej samej odpowiedzi liczą się raz.
- **Ranking:** tydzień (poniedziałek 00:00 UTC), seria dni z rzędu (🔥), poniedziałkowy komentarz z podium.
- **Wynik do wklejenia** jak w Wordle: `🟩🟨⬜ 100 pts` (zielone: najpopularniejsza odpowiedź, żółte: odpowiedź z tablicy, szare: pudło). Przycisk kopiuje tekst do schowka.
- **Komentarze aplikacji:** pod każdym nowym postem "jak grać" plus wczorajsza tablica (aplikacja próbuje go przypiąć, co działa tylko jeśli jest moderatorem), pod zakończoną rundą komentarz z tablicą końcową.

## Ustawienia dla moderatora

| Ustawienie | Domyślnie |
|---|---|
| Post a new round automatically | tak |
| Question category | General (do wyboru: Food, Gaming, Movies, Music, Sports, Travel, Tech, Crypto, Fitness, Pets, Memes) |
| Your own questions | puste (jedno pytanie na linię, idą przed wbudowanymi) |
| Round length | 24 h (lub 48, 72) |
| People needed to make a board | 20 |
| Board size | Auto |
| Theme | Classic (lub Pepe frogs) |
| Footer note | puste |

Menu moderatora: **Sub Says: start a new round now** (nie częściej niż co 6 godzin) i **Sub Says: hide an answer** (usuwa odpowiedź z trwających rund: podpowiedzi, tablicy i punktacji).

Biblioteka ma ok. 160 pytań: 28 ogólnych plus 10–14 w każdej kategorii, czyli około 40 dni na kategorię. Potem pytania wracają, zaczynając od używanego najdawniej. Własne pytania moderatora mają pierwszeństwo.

## Uruchomienie

Node 22+.

```bash
cd subsays
npm install
npm test             # 18 testów: scalanie odpowiedzi, pełna runda, wyścigi, serie, ukrywanie
npm run typecheck
SEED=1 npm run local # lokalnie, bez Reddita: http://localhost:5175/as/alice
```

W symulatorze: `/dev/advance?h=24` przesuwa zegar o dobę i uruchamia dzienne zadanie (nowa runda, zakończone rundy), `/post/1` pokazuje grę tak, jak widziałby ją stary post, `/as/bob` loguje innego gracza. Zmienne: `MIN`, `HOURS`, `CATEGORY`, `THEME`, `NOTE`, `SUB`.

Na Reddicie:

```bash
npx devvit login
# nazwa "sub-says" w devvit.json musi być wolna
npx devvit playtest TWOJ_TESTOWY_SUBREDDIT   # sub poniżej 200 subskrybentów
npx devvit upload                            # widoczna tylko dla Ciebie
npx devvit publish                           # przegląd Reddita, domyślnie niepubliczna (unlisted)
npx devvit publish --public                  # przegląd do publicznego katalogu aplikacji
```

Zasady i prywatność (potrzebne przy publikacji, bo aplikacja przechowuje nazwy użytkowników i odpowiedzi): `docs/games/sub-says.html`. Szkice wiadomości do moderatorów: `OUTREACH.md`.

## Kod

| Plik | Co robi |
|---|---|
| `src/shared/text.ts` | Czyszczenie odpowiedzi, klucz dopasowania, odległość edycyjna, filtr. |
| `src/shared/questions.ts` | Biblioteka pytań i wybór następnego. |
| `src/shared/time.ts` | Tydzień ISO i doba w UTC. |
| `src/server/rounds.ts` | Autorytatywna logika: runda, odpowiedzi, klastry, tablica, zgadywanie, punkty, serie, ukrywanie. Rozmawia z bazą przez mały interfejs `KV`, więc działa na Devvit Redis i w pamięci (testy). |
| `src/server/index.ts` | Trasy Express, tworzenie postów i komentarzy, zadania cykliczne, menu moderatora. |
| `src/client/` | Interfejs: intro, zgadywanie, odpowiadanie, tablica, ranking. |
| `tools/local.ts` | Symulator z botami i przesuwanym zegarem. |

Tablica rundy jest zamrażana raz (`hSetNX`), więc wszyscy gracze widzą tę samą tablicę, a przy równoczesnych odpowiedziach ta sama odpowiedź ląduje w jednym klastrze (test: 30 osób naraz).

## Czego nie sprawdziłem

Nie miałem dostępu do Reddita. Sprawdzone: typy zgodne z SDK 0.14.8, build, `devvit.json` względem schematu, testy logiki oraz cała ścieżka w przeglądarce na symulatorze (intro, zgadywanie z literówką, autouzupełnianie, blokada drugiej odpowiedzi, przesunięcie zegara, archiwum starego posta). Do obejrzenia przy pierwszym `playtest`:

1. Czy konto aplikacji może przypiąć komentarz (`distinguish`); jeśli nie, komentarz jest zwykły.
2. Kształt danych formularza "hide an answer" (kod przyjmuje `text` albo `values.text`).
3. Czy cron o 15:00 UTC odpala się punktualnie; zadanie jest idempotentne, więc spóźnienie nie psuje rundy.
4. Obciążenie autouzupełniania: zapytanie po 300 ms przerwy w pisaniu, a serwer czyta wszystkie odpowiedzi rundy. Przy dziesiątkach tysięcy graczy to trzeba będzie zoptymalizować.
5. Próg 20 osób i limit 200 do planszy 8 to wartości startowe. Trzeba je skorygować po pierwszych prawdziwych rundach.
6. Czy przycisk "Copy my score" działa w oknie aplikacji (schowek w widoku Reddita); jeśli nie, tekst zostaje zaznaczony do ręcznego skopiowania.
7. Strona z zasadami stoi na stronie Pepecoin Hub ze stopką z adresami do wsparcia. Jeśli recenzent Reddita będzie miał zastrzeżenia do krypto na stronie, wystarczy osobna, czysta strona.

## Pomysły na później

- Wynik jako komentarz od gracza jednym przyciskiem (wymaga zgody gracza przez `runAs: USER`).
- Pytania zgłaszane i głosowane przez społeczność.
- Ranking między subami (wymaga serwera).

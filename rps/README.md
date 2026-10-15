# Subreddit Wars (kamień, papier, nożyce)

Wojna subredditów w kamień-papier-nożyce, plus otwarte pojedynki graczy. Aplikacja Reddit (Devvit Web), **bez własnego serwera i bez kosztów**: cały stan jest w bazie Redis, którą Reddit daje aplikacji.

## Jak to działa bez serwera

Baza w Devvit jest osobna dla każdej instalacji, więc dwa suby nie mogą grać ze sobą przez swoje instalacje. Rozwiązanie: **jedna instalacja w jednym subie** (np. r/pepecoin albo nowy sub tylko do gry), a „subreddit” to **drużyna, którą gracz wybiera** (jak frakcje w r/place). Gracze z r/gaming, r/memes i r/pepecoin wchodzą do tego jednego posta i walczą każdy za swój sub.

- **Wojna drużyn.** Gracz klika kamień, papier albo nożyce. Jeśli czeka rzut gracza z *innej* drużyny, wynik jest od razu (najstarszy rzut pierwszy). Jeśli nie, rzut czeka w puli, a wynik pojawi się przy następnym wejściu ("While you were away") lub jako powiadomienie.
- **Punkty:** 3 za wygraną, 1 za remis. Tablica drużyn, najgorętsze rywalizacje (np. `r/gaming vs r/memes 6:0`), liczba graczy na drużynę. Sezon to tydzień (poniedziałek 00:00 UTC), potem wszystko od zera, a w poniedziałek o 00:05 aplikacja wrzuca komentarz z podium.
- **Pojedynki na subie.** Gracz wystawia ukryty ruch pod swoją nazwą, ktoś inny z suba go przyjmuje z listy i od razu widzi wynik; wystawiający dostaje powiadomienie. Osobna tablica "Top duelists". Pojedynki nie wpływają na punkty drużyn.
- **Limit:** 5 rzutów dziennie na gracza (wspólny dla obu trybów), maksymalnie 3 czekające naraz. Drużynę można zmienić do pierwszego rzutu w tygodniu, potem jest zablokowana do poniedziałku (żeby nie przeskakiwać do zwycięzców).
- **Nazwy drużyn** są sprawdzane przez Reddit API: musi istnieć, nie może być prywatny, NSFW ani w kwarantannie.
- **Ruchy czekających graczy nigdy nie trafiają do klienta** (jest na to test).

## Jak ludzie z innych subów się tu dostają

Aplikacja żyje w jednym subie, więc ruch trzeba przyprowadzić: ludzie linkują post w swoim subie („pomóż r/X wygrać”), crosspostują, a ranking drużyn sam robi z tego zbiórkę (jak w r/place). Nie sprawdziłem, jak Reddit renderuje crosspost posta Devvit, więc nie polegaj na tym bez próby.

## Pepecoin

- Motyw `Pepe frogs` (ustawienie subreddita) i domyślne podpowiedzi drużyn zaczynają się od `pepecoin`.
- Pole `Footer note`: jedna linijka pod areną, np. informacja o tygodniowej nagrodzie od ekipy moderatorów (wypłata poza aplikacją).
- Do sprawdzenia przed publikacją: regulamin Reddit Developer Platform i Developer Funds w sprawie krypto i nagród pieniężnych. Nie mogłem go tu przeczytać.

## Uruchomienie

Node 22+.

```bash
cd rps
npm install
npm test            # 14 testów (parowanie, wyścigi, pojedynki, sezony)
npm run typecheck
SEED=1 npm run local   # lokalnie, bez Reddita: http://localhost:5174/as/alice i /as/bob w dwóch kartach
```

Na Reddicie:

```bash
npx devvit login
# nazwa "rps-subwars" w devvit.json musi być wolna
npx devvit playtest TWOJ_TESTOWY_SUBREDDIT
npx devvit upload
```

Przy instalacji aplikacja sama tworzy post z areną. Moderator może dodać kolejny z menu ("Start a new Subreddit Wars post"); statystyki zostają wspólne.

## Ustawienia

| Ustawienie | Domyślnie | Po co |
|---|---|---|
| `featuredTeams` | pepecoin, gaming, memes, pcmasterrace, AskReddit, dogecoin | podpowiedzi drużyn jednym tapem |
| `dailyThrows` | 5 | rzutów na gracza dziennie |
| `theme` | Classic navy | albo Pepe frogs |
| `sponsorNote` | puste | linijka pod areną, 280 znaków |

## Kod

| Plik | Co robi |
|---|---|
| `src/shared/rules.ts` | Reguły: wynik rzutu, nazwy drużyn, sezony (tydzień ISO, UTC). |
| `src/server/arena.ts` | Logika: parowanie rzutów, pojedynki, statystyki, stan. Rozmawia z bazą przez mały interfejs `KV`, więc działa na Devvit Redis i w pamięci (testy). |
| `src/server/index.ts` | Trasy Express, walidacja drużyn przez Reddit API, powiadomienia, post przy instalacji, tygodniowe podsumowanie. |
| `src/client/` | Interfejs: wybór drużyny, trzy przyciski, zakładki Teams / Duels / Me, ticker na żywo. |
| `tools/local.ts` | Lokalny symulator z fałszywymi graczami. |

Parowanie jest odporne na wyścigi: kto pierwszy zabierze rzut z puli (`zRem`), ten go ma; po dołączeniu do puli rzut sprawdza ją jeszcze raz. Test uruchamia 30 graczy naraz i sprawdza, że żaden rzut nie przepada ani nie jest rozliczony dwa razy.

## Czego nie sprawdziłem

Nie miałem dostępu do Reddita. Sprawdzone: typy zgodne z SDK 0.14.8, build, `devvit.json` względem schematu, testy logiki oraz cała ścieżka w przeglądarce na lokalnym symulatorze. Do obejrzenia przy pierwszym `playtest`:

1. **Powiadomienia** (`notifications`) są eksperymentalne i tylko dla zapisanych graczy. Jeśli niedostępne, wynik i tak czeka w "While you were away".
2. Czy `realtime` dostarcza ticker na żywo (jeśli nie, widok odświeża się co 30 s).
3. Pusta pula na starcie: pierwsi gracze będą czekać na przeciwnika z innej drużyny. Warto zacząć od kilku znajomych z różnych subów.

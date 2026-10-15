# Armada

Cała społeczność subreddita kontra jedna ukryta flota. Każdy dostaje 3 strzały w zapasie i jeden nowy co kilka minut, strzela w planszę widoczną w poście, a trafienia wszyscy widzą na żywo. Aplikacja Reddit (Devvit Web), kod w TypeScript.

## Dlaczego taka gra

Cel to jak najwięcej *Daily Qualified Engagers* (ludzi, którzy kliknęli i coś zrobili w aplikacji danego dnia). Z tego wynikają decyzje:

- **Wszyscy grają naraz.** Plansza jest współdzielona, ale nie ma kolejki "teraz ruch następnej osoby": każdy ma własny zapas strzałów. Przy kolejce klikałby jeden człowiek, a reszta tylko patrzyła, czyli nie liczyłaby się jako zaangażowana.
- **Jeden tap wybiera, drugi strzela.** Telefon, jedna ręka, zero nauki zasad. Błędny tap nie kosztuje strzału.
- **Plansza rośnie z subreddite'm** (8x8 do 16x16, patrz `configFor` w `src/shared/game.ts`), a czas odnowienia strzału też. Mały sub kończy grę w dzień, ogromny nie rozwala jej w dwie minuty. To odpowiedź na obawę "działa na dużych, nie działa na małych".
- **Zero kosztu treści.** Flota jest losowa, więc codzienny post nie wymaga żadnej pracy ani obrazków.
- **Powrót codziennie.** Cron o 15:00 UTC wrzuca nowy post (ustawienie `autoPost`). Zapas strzałów i tablica "Top captains" dają powód, żeby wrócić.
- **Duży sub musi chcieć to zainstalować.** Moderatorzy dużych subów nie zainstalują aplikacji, która reklamuje krypto. Dlatego sama gra jest neutralna (domyślny motyw "Classic navy"), a Pepe i PEP są opcją, patrz niżej.

Uczciwie: sam pomysł nie da 1M dziennie. Tier 8 to dystrybucja, czyli instalacje w wielu dużych subach i ewentualne wyróżnienie przez Reddit. Gra ma tylko do tego nie przeszkadzać: instaluje się jednym kliknięciem, nie wymaga konfiguracji i ma ustawienia dla moderatorów.

## Pepecoin

- **Motyw `Pepe frogs`** (ustawienie subreddita): zielona paleta i żaby zamiast krzyżyków. Włączasz go tylko u siebie, na r/pepecoin i w subach krypto.
- **Pole `Footer note`**: jedna linijka tekstu pod planszą, ustawiana przez moderatorów. Tu można napisać np. "Top captain tygodnia dostaje nagrodę od ekipy moderatorów". Nagrody wypłacasz poza aplikacją, jak w Three Facts (z własnego portfela, publicznie).
- **`Minimum account age`**: odcina świeże konta, jeśli dajesz nagrody.
- **Do sprawdzenia przed publikacją:** regulamin Reddit Developer Platform i Developer Funds w sprawie kryptowalut i nagród pieniężnych. Nie zdołałem go tu przeczytać (developers.reddit.com było dla mnie niedostępne), więc nie wiem, czy aplikacja z nagrodami w PEP w ogóle kwalifikuje się do Funds. Bezpieczny wariant: wersja publiczna bez słowa o krypto, wersja r/pepecoin z nagrodami jako osobna instalacja.

## Uruchomienie

Wymagany Node 22+.

```bash
cd armada
npm install
npm test            # 13 testów logiki gry (strzały równoległe, zatopienie, koniec gry)
npm run typecheck
npm run local       # gra lokalnie, bez Reddita: http://localhost:5173/as/alice i /as/bob w dwóch kartach
```

Na Reddicie:

```bash
npx devvit login
# nazwa aplikacji w devvit.json ("armada-game") musi być wolna; zmień jeśli jest zajęta
npx devvit playtest TWOJ_TESTOWY_SUBREDDIT
npx devvit upload   # potem publikacja i zgłoszenie do przeglądu na developers.reddit.com
```

Przy instalacji aplikacja sama tworzy pierwszy post. Moderator może dorzucić kolejny z menu subreddita ("Start a new Armada game").

## Ustawienia dla moderatorów

| Ustawienie | Domyślnie | Po co |
|---|---|---|
| `autoPost` | włączone | nowa gra codziennie o 15:00 UTC |
| `theme` | Classic navy | albo Pepe frogs |
| `boardSize` | Auto | wymusza rozmiar planszy 8, 10, 12 lub 16 |
| `sponsorNote` | puste | jedna linijka pod planszą (tekst zwykły, 280 znaków) |
| `minAccountDays` | 0 | minimalny wiek konta, żeby strzelać |

## Układ kodu

| Plik | Co robi |
|---|---|
| `src/shared/game.ts` | Czyste reguły: rozmiar planszy, losowanie floty, odnawianie strzałów. |
| `src/server/armada.ts` | Autorytatywna logika (strzał, zatopienie, koniec gry, stan). Rozmawia z bazą przez mały interfejs `KV`, więc działa na Devvit Redis i na pamięci w testach. |
| `src/server/index.ts` | Trasy Express: `/api/state`, `/api/fire`, menu, instalacja, cron; realtime i komentarz po wygranej. |
| `src/client/` | Plansza, przyciski, tablica wyników, odbiór zdarzeń na żywo. |
| `tools/local.ts` | Lokalny serwer z fałszywymi użytkownikami (bez Reddita). |
| `devvit.json` | Konfiguracja aplikacji (zwalidowana ze schematem z `@devvit/shared-types`). |

Flota leży tylko po stronie serwera. Klient dostaje wyłącznie pola, w które ktoś już strzelił, i pola zatopionych okrętów (jest na to test).

## Czego nie sprawdziłem

Nie miałem dostępu do Reddita, więc na żywo nie było testu. Sprawdzone: typy zgodne z SDK 0.14.8, budowanie, `devvit.json` względem schematu, testy logiki i UI w przeglądarce na lokalnym serwerze. Do obejrzenia przy pierwszym `playtest`:

1. Czy `realtime` dostarcza strzały innych graczy w czasie rzeczywistym (jeśli nie, plansza i tak odświeża się co 30 s).
2. Czy `submitCustomPost` bez własnego ekranu startowego wygląda dobrze w feedzie (ewentualnie dodać splash).
3. Czy przegląd aplikacji nie ma zastrzeżeń do pól z nagrodami.

## Pomysły na później

- **Ranking subów**: każdy sub ma swoją flotę, wspólna tablica "kto zatopił szybciej" daje moderatorom powód, żeby się chwalić. Wymaga zewnętrznego serwera (zatwierdzona domena w `permissions.http`).
- **Seria w kolejnych dniach** (streak) i powiadomienie o nowej grze.
- **Gra bez końca**: po zatopieniu floty duży sub dostaje następną po godzinie, zamiast czekać do jutra.

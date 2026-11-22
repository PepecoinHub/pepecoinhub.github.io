# PondOS 98 — optymalizacja ruchu przed promocją (22.11.2026)

Gałąź: `claude/perf-audit-2026-11` (7 commitów na `main` @ `aa6138a`). PEPaint osobno: `claude/pepaint-viral-protection-on-main`.
Nic nie zostało opublikowane, scalone ani uruchomione na produkcyjnym Supabase. Wszystkie testy szły lokalnie
(Postgres 16 / PGlite, headless Chrome, podstawiony Supabase).

## 1. Co zmieniono i dlaczego

### P0 — Haze Mention Delivery
- **Przyczyna:** zewnętrzny worker **zespołu Haze** (podpisuje żądania ich kluczem Ed25519 — workera nie ma w tym repo)
  wywołuje `take` co ~10,5 s przez całą dobę, niezależnie od kolejki. Każde `take` to 1 Edge Function + 1 RPC + zapis
  heartbeatu + 2 DELETE.
- **Edge Function** (`functions/haze-mention-delivery`): każda odpowiedź `take` ma nagłówki `X-Haze-Poll-After`
  i `Retry-After` (60 s przy pustej kolejce, 5 s w trakcie dostarczania, 1 s po pełnej paczce 10). Treść odpowiedzi bez
  zmian, więc obecny worker działa dalej. Podpisy, limit 2 KB, okno 45 s, lease, retry i limity kolejki nietknięte.
- **Opcjonalny SQL** `update_haze_mentions_adaptive.sql` (wymaga Twojej zgody): dokładna podpowiedź (czas do
  najbliższego retry), heartbeat zapisywany najwyżej co 20 s zamiast przy każdym pollu, sprzątanie tylko razem
  z heartbeatem. Rejestracja telefonu nadal wymaga heartbeatu < 3 min — 60 s mieści się z zapasem.
- **Dla twórców Haze:** `games/HAZE_MENTION_WORKER_POLLING.md` (gotowe do wysłania, po angielsku).
- **Efekt:** dopiero gdy worker zacznie respektować nagłówek: ~1 440 zamiast ~8 200 wywołań dziennie (**−82 %**,
  ~43 tys. zamiast ~246 tys. miesięcznie).

### P0 — PepeGochi
Znalezione przyczyny (wszystkie potwierdzone w kodzie):
1. Supabase przy **każdym odświeżeniu tokena** (inna karta, iframe pokoju) nadpisuje klucz w `localStorage`, a taskbar
   traktował to jak zmianę konta: wymuszony odczyt `state` + `life` + `quiz`.
2. Pokój po **zwykłym odczycie** wysyłał do taskbara `pepegochi-changed`, co wymuszało kolejny pełny odczyt tam
   (a po akcji z taskbara odbijało się z powrotem jako `pepegochi-refresh`).
3. Quiz był pobierany ponownie co 5 min przy każdym powrocie do karty, choć pytanie zmienia się raz na dobę UTC.
4. `gry_pepegochi_life` i `gry_pepegochi_diary_save` nie istnieją na produkcji — 404 przy każdym odświeżeniu.

Poprawki: nowy moduł `docs/meme/pepegochi-rpc.mjs` (wspólny dla taskbara i pokoju): deduplikacja trwających zapytań
(także między PondOS a iframe pokoju), cache odczytów per konto (state 15 s, life/pokój 60 s), unieważnienie po
każdym zapisie, a odpowiedź zapisu z pełnym stanem od razu staje się stanem (bez dodatkowego odczytu), capability
gate dla brakujących funkcji (6 h, pamiętany po przeładowaniu). Taskbar reaguje na zmianę klucza auth tylko przy
**zmianie konta**. Pokój pinguje rodzica tylko po zapisie. Quiz: raz na konto i dobę UTC (ponowna próba tylko po błędzie).
Animacje, grafiki i logika gry bez zmian; serwer pozostaje jedynym źródłem stanu i nagród (cache żyje sekundy,
każdy zapis idzie prosto na serwer).

### P1 — LAN Party i grupowe tipy Haze
- **Polling czatu bez Realtime:** 4 s → po cichych odpytaniach 8 s, potem 15 s (pisanie, nowa wiadomość, przywrócenie
  okna wraca do 4 s). Z Realtime: 60 s (widoczne) / 120 s (ukryte lub zminimalizowane) jako siatka bezpieczeństwa.
  **Zminimalizowane okno bez Realtime zostaje na 30 s**, więc licznik nieprzeczytanych i popupy @mention działają jak dotąd.
- **Ponowne łączenie z Realtime:** zamiast co 10 s w nieskończoność — 1, 2, 5, 10, 30 s, potem co 60 s.
- **Grupowe tipy:** widoczne okno bez zmian (20 s / 5 s przed końcem). Zminimalizowane: 60 s / 15 s przed końcem
  (chip z nowym dropem i „ending soon” nadal działają). Karty jednej przeglądarki dzielą się odpowiedzią
  (BroadcastChannel). Paragony tipów w zminimalizowanym oknie co 3 min, po przywróceniu od razu.
- **`haze_group_context` HTTP 400 (101/177):** płatności z cache przeglądarki były sprawdzane przy każdym wejściu
  (do 120 razy), także dla dropów anulowanych, wygasłych albo już nieobecnych — teraz wracają z cache tylko dropy,
  które serwer nadal pokazuje jako `ready`. Odpowiedzi, które nigdy nie dadzą „confirmed”, kończą sprawdzanie;
  „Wait at least 15 seconds” tylko przesuwa następną próbę; jedna próba na płatność na całą przeglądarkę (20 s).
  Płatność nigdy nie jest wysyłana ponownie, weryfikacja transakcji i limity serwera bez zmian.
- **`gry_mentions_seen` HTTP 401 (32/400):** wywołanie szło jako anonim, gdy sesja wygasła. Teraz tylko przy ważnej
  sesji Discord i tylko gdy naprawdę czeka wzmianka (nieudane wywołanie zostaje w kolejce).
- `gry_lobby_who` co 60 s zamiast 30 s; licznik online na pulpicie co 60 s i **jeden na całą przeglądarkę**.
- DOM czatu: najwyżej 300 wiadomości (starsze wychodzą z okna; serwer i tak trzyma 24 h).

### P1 — PEPaint (`codex/pepaint-viral-protection`)
Nie duplikowałem implementacji. Gałąź nakłada się na aktualny `main` + moje zmiany **bez konfliktów** (pliki PEPaint
nie zmieniły się na `main` od jej rozgałęzienia). Wyniki: testy jednostkowe i SQL 7/7, test przeglądarkowy
(rysowanie, retry, widz, undo/snapshot, brak bezpośredniego broadcastu) **OK**. Dodałem dwa skrypty pomiarowe.

### P2 — pulpit
- **Pepe Miner:** w zminimalizowanym oknie lub ukrytej karcie 1 krok/s zamiast 10 i bez rysowania (wydobycie liczone
  identycznie — krok i tak jest ograniczony do 1 s); po przywróceniu natychmiastowe odświeżenie.
- **PWA:** `sw.js` cache’uje teraz **wyłącznie grafiki** (`/meme/img`, emotki, awatary, paszport, `/games/img`):
  pliki z `?v=` z cache, bez wersji odświeżane po 6 h, offline z cache. Strony, skrypty i dane nigdy nie są cache’owane.
  Rejestracja tylko w zainstalowanej aplikacji (jak przełącznik powiadomień, ten sam worker).
- `meme.js` (535 KB): nie dzieliłem — to duża, ryzykowna zmiana; patrz §4.
- Podbite wersje cache (`?v=20261122perf`) dla zmienionych plików.

## 2. Pomiary przed/po (1 h, headless Chrome, podstawiony Supabase)

Ten sam scenariusz na `main` i na gałęzi. Zegar przyspieszony, odpowiedzi serwera podstawione — liczby pokazują
**zachowanie klienta**, nie obciążenie prawdziwej bazy.

| Scenariusz (1 h, 1 użytkownik) | RPC przed | RPC po | Zmiana | Transfer KB | Błędy HTTP |
|---|---:|---:|---:|---|---|
| 1. Pulpit bez interakcji | 80 | 60 | −25 % | 4,2 → 3,2 | 0 → 0 |
| 1b. Pulpit, 2 karty | 160 | 85 | −47 % | 8,4 → 4,5 | 0 → 0 |
| 2a. PepeGochi bez pokoju (aktywny gracz) | 107 | 69 | −36 % | 9,9 → 6,7 | 9×404 → 0 |
| 2b. PepeGochi z otwartym pokojem | 107 | 69 | −36 % | 9,9 → 6,7 | 9×404 → 0 |
| 2c. + odświeżenie tokena co 2 min (12 min) | 31 | 12 | −61 % | — | 5×404 → 0 |
| 3. Zminimalizowany Pepe Miner | 80 | 60 | −25 % | 4,2 → 3,2 | 0 → 0 |
| 4a. LAN Party, Realtime działa | 390 | 330 | −15 % | 26,2 → 19,8 | 0 → 0 |
| 4b. LAN Party, Realtime padł | 1 229 | 506 | **−59 %** | 70,4 → 29,1 | 0 → 0 |
| 4c. LAN Party zminimalizowane, Realtime padł | 330 | 210 | −36 % | 16,6 → 9,8 | 0 → 0 |

Szczegóły, które robią różnicę:
- PepeGochi (same jego RPC): 27 → 9 na godzinę (`quiz_today` 9 → 0, `life` 9×404 → 0, `state` 9 → 9).
- LAN bez Realtime: `gry_lobby_chat` 899 → 236; próby połączenia Realtime 361 → 63/h.
- LAN zminimalizowane: grupowe tipy 180 → 60/h.
- Edge Functions: 0 we wszystkich scenariuszach klienta (worker Haze to osobny proces — §1).
- FPS pulpitu: 60 → 60 (także ze zminimalizowanym Minerem). Czas CPU w scenariuszu z Minerem: 11,3 s → 10,1 s na godzinę.
- Sterta JS 2–12 MB w obu wersjach (różnice w granicach szumu); węzły DOM z Minerem 6 391 → 5 658.

**PEPaint — realne opóźnienie rysowania** (prawdziwy klient pokoju, symulowany serwer z tą samą formułą tempa co
`gry_pepaint_draw`; założenia: RTT 120 ms, Realtime 60 ms, 12 graczy/pokój):

| Równoczesne gry | Odstęp między paczkami | Mediana opóźnienia | p95 |
|---:|---:|---:|---:|
| 1 | 0,75 s | 0,51 s | 0,83 s |
| 2 | 1,0 s | 0,61 s | 1,06 s |
| 4 | 1,75 s | 1,07 s | 1,78 s |
| 8 | 3,0 s | 1,76 s | 2,96 s |

**Symulacja napływu (PGlite, prawdziwy SQL PEPaint):** 25 → 25 graczy / 3 gry; 50 → 50 / 5; 100 → 100 / 8 gier + 1
czeka; **250 → 100 przyjętych, 150 grzecznie odrzuconych**, 8 gier, 13 pokoi czeka. Budżet ≤ 48 dostarczeń/s zawsze dotrzymany.

**Prognoza eventu na Free planie** (mnożenie zmierzonych stawek; to model, nie test na żywych socketach):
- Każde otwarte LAN Party = 1 połączenie Realtime. Limit Free to 200 równoczesnych połączeń i 100 wiadomości/s.
  **Przy 250 jednoczesnych użytkownikach LAN limit połączeń zostanie przekroczony** niezależnie od tych poprawek.
- 25 / 50 / 100 / 250 osób z otwartym LAN przez godzinę: ~8,3 / 16,5 / 33 / 82,5 tys. RPC tła (przed: 9,8 / 19,5 / 39 / 97,5 tys.),
  plus odczyt czatu po każdej nowej wiadomości u każdego klienta (bez zmian: 100 osób × 6 wiad./min ≈ +36 tys./h).

## 3. Testy

- Cała suita: **629 OK / 17 niezaliczonych / 9 pominiętych** z 655 (przed zmianami: 589/19/8 z 616).
  17 niezaliczonych to testy `community-v1-postgres`, które wymagają Dockera — w tym środowisku nie działają ani przed,
  ani po. Brak nowych porażek.
- Nowe testy: `haze-mention-adaptive` (Postgres), `pepegochi-rpc-cache`, `lan-traffic`, `sw-image-cache`.
- Nie wykonano: testów na produkcji, płatności, testu z prawdziwymi socketami Realtime; opóźnień Realtime nie da się
  zmierzyć bez prawdziwego serwera.

## 4. Do Twojej decyzji (nic z tego nie zostało zrobione)

1. **Wdrożenie** frontendu (scalenie gałęzi) i Edge Function `haze-mention-delivery` — obie zmiany są wstecznie zgodne.
2. **SQL** `update_haze_mentions_adaptive.sql` na produkcji (opcjonalny).
3. Wysłanie `HAZE_MENTION_WORKER_POLLING.md` zespołowi Haze — bez ich zmiany P0 Haze nie spadnie.
4. **PEPaint:** przy 8 równoczesnych grach widzowie widzą kreskę co ~3 s. Do rozważenia: limit 4–5 gier (≈1–1,5 s)
   albo większy budżet; w pompie licząc następny termin od wysłania, a nie od odpowiedzi (−RTT na cykl).
   Wdrożenie według `games/PEPAINT_VIRAL_CAPACITY.md`.
5. **Największy koszt eventu po tych zmianach:** każda wiadomość na czacie powoduje odczyt u każdego klienta.
   Wysyłanie treści wiadomości w samym broadcaście Realtime usunęłoby te odczyty (zmiana SQL + klient).
6. Tworzenie dropu Haze nie dzwoni „dzwonkiem” Realtime — gdyby dzwoniło, widoczne LAN mogłoby odpytywać o dropy co 60 s zamiast 20 s.
7. `meme.js` 535 KB: podział na moduły ładowane przy otwarciu aplikacji to osobny, większy projekt.
8. Na pulpicie bez otwartej gry nic nie odświeża tokena — po godzinie część graczy staje się „gośćmi” w LAN.

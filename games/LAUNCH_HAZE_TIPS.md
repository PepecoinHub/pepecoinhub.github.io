# Haze tipy — wszystko z telefonu

**2026-11-19: beta zdjęta, tipy otwarte dla wszystkich** (zalogowanych przez Discord). Kod strony: przełączniki
`HAZE_TIPS_ENABLED` i `HAZE_GROUPS_ENABLED` = `true`, bez `?beta=haze`. Właściciel w Supabase:
1. SQL Editor → wklej `games/supabase/haze-beta/3_open_for_all.sql` → Run (wynik: `enabled=true, beta_only=false, groups_enabled=true`).
2. Edge Functions → Secrets → `HAZE_ACCESS` = `all` (zamiast dwóch ID). Funkcji nie trzeba wdrażać ponownie.

Przycisk diagnostyczny „◇ Server check” (dawniej „Beta check”) widać tylko po otwarciu strony z `?haze=check`
(`?haze=off` go chowa). Poniżej historia zamkniętej bety z 2026-11-16.


Stan na 2026-11-16. Kod: PR #340 (Haze web 1.1.9) + nasze dodatki (dostęp tylko dla testerów na serwerze,
`?beta=haze`, przycisk „Beta check”, `/tip`). Technika: `games/HAZE_TIPPING.md`. Pytania i odpowiedzi Haze:
`games/HAZE_QUESTIONS.md`, `games/HAZE_ANSWERS_2026-11-15.md`.

Ustalenia z Lew (2026-11-16): ukryta beta na pepecoinhub.com; Blockbook `https://bongendpoint.realmasterkush.com/`;
dostęp na serwerze tylko dla **Byl** i **Lewisbong**; pierwszy test grupowy z jednym odbiorcą; przed wyłączeniem
dokończyć oczekujące potwierdzenia.

Pliki do skopiowania (na telefonie: otwórz link, przytrzymaj tekst → Zaznacz wszystko → Kopiuj):

- SQL instalacja: https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/0_install.sql
- SQL włączenie bety: https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/1_beta_on.sql
- SQL wyłączenie bety: https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/2_beta_off.sql
- Funkcja Edge (jeden plik): https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/haze-wallet-dashboard.ts

(Po zmergowaniu do `main` w linkach zamień `ccr-a69f4b09-802tqu` na `main`.)

**Telefon ucina długi tekst?** Te same pliki pocięte na kawałki po ok. 6 KB:

- SQL (każdy osobno: wklej → Run, **po kolei**, wszystkie mają być bez błędu; można powtórzyć): [01](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-01.sql), [02](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-02.sql), [03](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-03.sql), [04](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-04.sql), [05](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-05.sql), [06](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-06.sql), [07](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-07.sql), [08](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/sql-08.sql)
- Funkcja Edge (w edytorze: usuń domyślny kod, wklej 01, potem każdy kolejny **na sam koniec**; każdy kawałek kończy się linią `// ==== END OF PART x OF y ====`, a ostatni napisem „complete file, now Deploy”. Liczba kawałków może się zmienić po aktualizacji — zawsze wklej wszystkie): [01](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/edge-01.txt), [02](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/edge-02.txt), [03](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/edge-03.txt), [04](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/edge-04.txt), [05](https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/ccr-a69f4b09-802tqu/games/supabase/haze-beta/phone/edge-05.txt)

Kawałki SQL dają dokładnie ten sam schemat co `0_install.sql` (sprawdzone na PostgreSQL 17); sklejone kawałki Edge są identyczne z `haze-wallet-dashboard.ts`.


## A. Bez portfela Haze — można zrobić od razu z telefonu

1. **Instalacja SQL** — supabase.com → projekt → SQL Editor → New query → wklej `0_install.sql` → Run.
   Wszystko zostaje wyłączone. Można uruchomić ponownie bez szkody.
2. **Funkcja Edge** — Edge Functions → Deploy a new function → Via Editor → nazwa **`haze-wallet`** → zastąp całą
   treść pliku wklejonym `haze-wallet-dashboard.ts` → Deploy. Potem w ustawieniach funkcji **wyłącz weryfikację
   JWT** („Verify JWT” / „Enforce JWT verification”) — funkcja sama sprawdza logowanie i listę testerów.
3. **Sekret Blockbooka** — Edge Functions → Secrets → dodaj `PEP_BLOCKBOOK_URL` = `https://bongendpoint.realmasterkush.com/`
4. **Logowanie testerów** — Ty i Lewisbong logujecie się raz na pepecoinhub.com przez Discord (zwykłe logowanie do gier).
5. **Włączenie bety** — SQL Editor → wklej `1_beta_on.sql`, w linii z nazwami wpisz swoją nazwę z Discorda zamiast
   `BYL_DISCORD_USERNAME` (małe litery, bez @) → Run. Jeśli nazwa nie pasuje dokładnie do jednego konta, nic się
   nie zmienia i dostajesz komunikat. Ostatni wynik to gotowa wartość **HAZE_ACCESS**.
6. **Sekret dostępu** — Edge Functions → Secrets → dodaj `HAZE_ACCESS` = wartość z kroku 5 (dwa ID po przecinku).
7. **Kod strony** — zmergować gałąź do `main` (GitHub w telefonie: PR → Merge). Przełączniki w kodzie zostają
   wyłączone; przyciski widać tylko z `?beta=haze`.
8. **Beta check** — w telefonie otwórz `https://pepecoinhub.com/games/?beta=haze`, zaloguj się, w czacie dotknij
   **◇ Beta check**. Dobrze: „✅ Indexer OK”. Lewisbong robi to samo. Ktoś spoza listy dostaje „closed beta”.

Jeśli 1–8 przejdą, serwer, baza i Blockbook są gotowe. Wtedy można zaproponować Lew datę testu.

## B. Portfel Haze (potrzebny do samego testu)

- Tipy działają tylko w **Haze web** (hazewallet.com w przeglądarce, także w telefonie). Według Haze aplikacje
  natywne i rozszerzenie jeszcze tego nie obsługują, więc testowa aplikacja mobilna nie zastąpi wersji web.
- Do **odbierania** tipów portfel nie potrzebuje środków. Do **wysłania** 1 PEP potrzeba ok. 1,01 PEP (kwota + opłata).
- Frazę odzyskiwania zapisz na papierze. Nie rób zrzutu ekranu i nie wysyłaj jej nikomu (także Haze ani nam).
- Pytanie do Lew przed testem: czy na telefonie portfel trzeba założyć / odblokować w okienku Haze wewnątrz
  pepecoinhub.com (przeglądarki telefonów rozdzielają dane stron osadzonych), czy wystarczy portfel z hazewallet.com.

## Plan testu (z Lew)

- [ ] Obaj: „Link Haze for tips” → stempel **Haze Linked**.
- [ ] Tip **1 PEP** przyciskiem i drugi przez `/tip Lewisbong 1` (albo Lewisbong → Byl, jeśli Byl nie ma środków).
- [ ] Mały tip grupowy z **jednym odbiorcą**.
- [ ] **2 potwierdzenia**; karta „tipped” w czacie lobby i w LAN Party.
- [ ] Odświeżenie strony w trakcie oczekiwania → potwierdzenie wraca samo, bez ponownej płatności.
- [ ] Stempel **First Haze Tip** u nadawcy.

Każdą kwotę i opłatę zatwierdza właściciel portfela w Haze. Wysłanej płatności nie da się cofnąć.

## Wyłączenie bety

SQL Editor → `2_beta_off.sql`: dwa SELECT-y pokazują płatności, które czekają na potwierdzenie. Gdy oba są puste,
odkomentuj i uruchom ostatni UPDATE. Awaryjnie od razu: `update games.haze_settings set enabled=false where id;`

## Później

- Trzeci tester → prawdziwy podział grupowy.
- ~~Start dla wszystkich~~ zrobione 2026-11-19 (patrz góra pliku).
- Własny Blockbook albo stała zgoda operatora `bongendpoint`.
- Tipy z PepeGochi i czatu PEPaint.

Uwaga dla utrzymania: `haze-beta/0_install.sql` i `haze-beta/haze-wallet-dashboard.ts` są generowane
(`node scripts/bundle-haze-edge.mjs`); test pilnuje, żeby były aktualne.

# Haze Community (czat w portfelu Haze) — kroki właściciela

Paczka Haze z 2026-11-20 (opis techniczny: `games/HAZE-COMMUNITY-V1.md`). Haze dostaje **tylko ograniczony,
odwoływalny token** (czat, tipy, rundy), nigdy pełnej sesji PepecoinHub. Logowanie Discord i zgoda są na naszej
stronie `/games/haze-community.html`. Wszystko jest domyślnie **wyłączone**.

Nasza poprawka do paczki: wiadomości z aplikacji nie niosą adresu IP (wszystkie przychodzą z jednego IP serwera
Supabase), więc wyciszenie za zakazane słowo albo przez hosta działa na konto, a nie na wszystkich użytkowników
aplikacji naraz. Test w `tests/community-v1-postgres.test.mjs` to sprawdza.

## Kroki (telefon wystarczy)

Pliki do kopiowania (zamień `main` na nazwę gałęzi, jeśli jeszcze nie zmergowane):
`https://raw.githubusercontent.com/PepecoinHub/pepecoinhub.github.io/main/games/supabase/haze-beta/phone/…`

1. **SQL** — SQL Editor: kawałki `community-sql-01.sql` … `community-sql-05.sql`, po kolei, każdy Run.
   (Albo cały `games/supabase/update_haze_community_v1.sql` na laptopie.) Wymaga wcześniej zainstalowanych tipów i grup.
2. **Funkcja Edge** — Edge Functions → Deploy a new function → Via Editor → nazwa **`haze-community`** → w `index.ts`
   wklej `community-01.txt` … `community-05.txt` (każdy na koniec; ostatnia linia „complete file, now Deploy”) → Deploy.
   Potem w jej Settings **wyłącz weryfikację JWT**. Sekrety: używa istniejącego `PEP_BLOCKBOOK_URL` (nic nowego).
   Funkcji `haze-wallet` nie ruszamy.
3. **Supabase Auth → URL Configuration → Redirect URLs** — dodaj **tylko**
   `https://pepecoinhub.com/games/haze-community.html`.
   **Nie** dodawaj `https://hazewallet.com/community-auth.html/?state=*` (stara prośba, nieaktualna). Jeśli już dodany — usuń.
4. **Strona zgody** — publikuje się sama po zmergowaniu (GitHub Pages).
5. **Włączenie dla testerów** — SQL Editor: `games/supabase/community-v1/enable-web-beta.sql` z wpisanym
   `Byl_Pepecoin` zamiast `BYL_DISCORD_USERNAME`. Włącza tylko klienta web (`haze-web`) i tylko dla osób z `games.haze_testers`.
6. **Sprzątanie (opcjonalnie)** — Database → Cron (pg_cron) → co 15 minut:
   `select public.community_v1_cleanup('{}'::jsonb);`
   Bez tego też działa (stare wpisy są sprzątane przy logowaniu), cron tylko trzyma tabele w porządku.

## Wyłączenie

`games/supabase/community-v1/disable-beta.sql` — wyłącza tylko czat w Haze i unieważnia jego tokeny.
Czat na stronie, tipy i gry działają dalej.

## Co zostaje u nas, co jest u Haze

- U nas: zasady czatu, moderacja, wyciszenia, kto jest testerem, sprawdzanie tipów, stemple, odwołanie dostępu
  (strona `/games/haze-community.html` pokazuje i pozwala odłączyć połączenia).
- U Haze: wygląd czatu w aplikacji (ich własny ekran). Zmiany wyglądu na naszej stronie nie przechodzą do aplikacji.
- Zmiana nazw/parametrów funkcji z listy w `HAZE-COMMUNITY-V1.md` (gry_lobby_*, gry_haze_*) może zepsuć aplikację —
  uzgadniać z Haze przed zmianą.
- Aplikacja mobilna (`haze-native`, schemat `hazewallet://`) zostaje wyłączona. Przed jej włączeniem poprosić Haze o
  logowanie przez link `https://` (universal/app link) zamiast własnego schematu — inna aplikacja mogłaby się podszyć.

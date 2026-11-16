# Haze tipy — zamknięta beta (dokument właściciela)

Stan na 2026-11-16. Kod to PR #340 (Haze) + nasze dodatki: zamknięta beta po stronie serwera, `?beta=haze`,
test endpointu z Edge (`preflight`) i komenda `/tip`. Technika i model zaufania: `games/HAZE_TIPPING.md`.
Pytania i odpowiedzi Haze: `games/HAZE_QUESTIONS.md`, `games/HAZE_ANSWERS_2026-11-15.md`.

Ustalenia z Haze (Lew, 2026-11-16):
- Ukryta beta na `https://pepecoinhub.com` — bez zmian po stronie Haze.
- Blockbook na betę: `https://bongendpoint.realmasterkush.com/` (MasterKush wie). Przed testem sprawdzić odczyty z naszej funkcji Edge.
- Dostęp ograniczony **na serwerze** do dwóch kont: **Byl** i **Lewisbong**. `?beta=haze` tylko pokazuje przyciski.
- Pierwszy test grupowy: jeden odbiorca. Prawdziwy podział na kilka osób później, z trzecim testerem.
- Przed wyłączeniem bety dokończyć oczekujące potwierdzenia.

## Jak działa dostęp

| Warstwa | Co blokuje | Gdzie |
|---|---|---|
| Baza | `haze_settings.beta_only = true` (domyślnie) + lista `games.haze_testers`. Nie-tester dostaje „not enabled” w każdym RPC, także w funkcjach dla Edge. | `update_haze_tips.sql` (`games.haze_open`) |
| Edge | Sekret `HAZE_ACCESS` = ID testerów po przecinku. Pusty = nikt. `all` = wszyscy (dopiero po starcie). | `functions/haze-wallet` |
| Strona | Przyciski widać tylko w przeglądarce, która otworzyła stronę z `?beta=haze` (`?beta=off` chowa). | `haze-tips.mjs` |

## Kroki (produkcyjny Supabase)

1. **SQL:** uruchomić `games/supabase/update_haze_tips.sql`, potem `games/supabase/update_haze_groups.sql`. Wszystko zostaje wyłączone.
2. **ID testerów:** obaj logują się raz na pepecoinhub.com przez Discord. Potem `games/supabase/haze-beta/1_find_testers.sql` (tylko odczyt) → dwa `user_id`.
3. **Funkcja Edge** (z katalogu `games`):
   ```sh
   supabase functions deploy haze-wallet --project-ref azbwciqfbsdpwubznncg --no-verify-jwt
   supabase secrets set PEP_BLOCKBOOK_URL=https://bongendpoint.realmasterkush.com/ --project-ref azbwciqfbsdpwubznncg
   supabase secrets set HAZE_ACCESS=BYL_USER_ID,LEWISBONG_USER_ID --project-ref azbwciqfbsdpwubznncg
   ```
4. **Włączenie bety:** wpisać oba ID w `games/supabase/haze-beta/2_beta_on.sql` i uruchomić.
5. **Kod strony:** zmergować gałąź do `main` (przełączniki w kodzie zostają `false`; widać tylko z `?beta=haze`).
6. **Preflight Blockbooka z Edge** — zalogowany tester otwiera `https://pepecoinhub.com/games/?beta=haze`, w konsoli przeglądarki (F12) wkleja, podmieniając `TXID` na dowolną zwykłą transakcję PEP z pepeblocks.com (nie coinbase):
   ```js
   const s=JSON.parse(localStorage.getItem('sb-azbwciqfbsdpwubznncg-auth-token'));
   fetch('https://azbwciqfbsdpwubznncg.supabase.co/functions/v1/haze-wallet',{method:'POST',
     headers:{apikey:'sb_publishable_GRByiqlX6v67phR8xcM6VA_6eXXwTKX',Authorization:'Bearer '+s.access_token,'Content-Type':'application/json'},
     body:JSON.stringify({action:'preflight',txid:'TXID'})}).then(r=>r.json()).then(console.log);
   ```
   Dobry wynik: `genesis_ok: true`, `outputs` > 0, `block_ok: true` i `prevout` z `value` (liczba w base units). Błąd albo `genesis_ok: false` = nie testujemy płatności.
   Kontrola dostępu: to samo z konta, którego nie ma na liście, musi dać „Haze tips are in a closed beta.”
7. **Data testu** — zaproponować Lew po udanym kroku 6.

## Plan testu (z Lew)

- [ ] Obaj: „Link Haze for tips” → stempel **Haze Linked** w Passporcie.
- [ ] Byl → Lewisbong: tip **1 PEP** przyciskiem i drugi raz komendą `/tip Lewisbong 1`.
- [ ] Mały tip grupowy z **jednym odbiorcą**.
- [ ] Oczekiwanie na **2 potwierdzenia**; karta „tipped” w czacie lobby i w LAN Party.
- [ ] **Automatyczne odzyskanie** potwierdzenia: odświeżyć stronę w trakcie oczekiwania — bez ponownej płatności i bez wpisywania txid.
- [ ] Stempel **First Haze Tip** u nadawcy.
- [ ] Konto spoza listy nie widzi niczego bez `?beta=haze` i nic nie może zrobić z `?beta=haze`.

Każda kwota i opłata jest zatwierdzana przez właściciela portfela w Haze. Wysłanej płatności nie da się cofnąć.

## Wyłączenie bety

`games/supabase/haze-beta/3_beta_off.sql`: najpierw dwa SELECT-y (oczekujące płatności). Gdy puste — UPDATE z pliku.
Awaryjnie można od razu: `update games.haze_settings set enabled=false where id;` (płatności już wysłane zostają na łańcuchu; ich potwierdzenie wróci po ponownym włączeniu).

## Później

- Trzeci tester → prawdziwy podział grupowy na kilka osób.
- Start dla wszystkich: `beta_only=false`, `HAZE_ACCESS=all`, `HAZE_TIPS_ENABLED`/`HAZE_GROUPS_ENABLED` = `true`, podbić `?v=`.
- Własny Blockbook albo stała zgoda operatora `bongendpoint` na produkcję.
- Tipy z PepeGochi i czatu PEPaint (ten sam model, nowe źródło tipu).

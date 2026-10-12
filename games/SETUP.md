# PEP Games: jak podłączyć serwer gier

Strona gier jest w `docs/games/` (czysty HTML/JS, bez bundlera). Bez serwera działa tylko „Play vs bot” (szachy, warcaby, „czwórki w rząd” i statki z botem, w przeglądarce). Pokoje na żywo, Draw & Guess, Guess the Picture i stoły dla dwóch osób potrzebują darmowego projektu w Supabase. Cała logika gry jest w funkcjach bazy (`games/supabase/schema.sql`), a przeglądarka tylko wysyła „zamiary” i pokazuje wynik.

## Zasady, które trzymamy
- **Projekt Supabase (produkcyjny) jest podłączony** w `docs/games/js/config.js`.
- **Ukryta wersja:** strony gier są pod `pepecoinhub.com/games/`, ale bez linku w menu, bez wpisu w mapie strony, z `noindex` i `Disallow: /games/` w `robots.txt`. Wchodzą tylko osoby z linkiem. Gdy gry będą gotowe do ogłoszenia: dodaj link „Games” do menu (`<nav class="site-nav">` na wszystkich stronach, w każdym języku), wpisy w `sitemap.xml`, usuń `noindex` ze stron w `docs/games/` i `Disallow` z `robots.txt`.
- **Nowy projekt produkcyjny** na koncie związanym z Pepecoinem (logowanie do Supabase przez GitHub PepecoinHub), region **Central EU (Frankfurt)**. Nie używaj projektu testowego z prototypu („pep-frog-lab”).
- Do strony trafiają tylko dwa **publiczne** dane: adres projektu i klucz `sb_publishable_…`. Klucza `secret`/`service_role`, hasła do bazy ani tokenu zarządzania Supabase nie wklejamy nigdzie (ani do repo, ani do rozmowy).
- Nagród w PEP i portfeli w grach **nie ma**. Nagrody wypłaca ręcznie host ze swojego portfela (patrz `docs/games/rules.html`).

## Kroki (ok. 30 min)
1. **Supabase → New project** (Free, Frankfurt). Zapisz hasło do bazy w menedżerze haseł.
2. **SQL Editor**: uruchom po kolei całe pliki `games/supabase/schema.sql`, `seed.sql`, `realtime_policies.sql`.
3. Ustaw własny kod hosta (min. 10 znaków): `select games.set_host_code('twój-kod');`. Opcjonalnie stałych hostów po Discord ID: `insert into games.host_discord(discord_id, note) values ('123…', 'imię');`.
4. **Authentication → Sign In / Providers**: włącz **Allow anonymous sign-ins**. **URL Configuration**: Site URL `https://pepecoinhub.com/games/`, Redirect URLs `https://pepecoinhub.com/games/**`.
5. **Project Settings → Realtime**: wyłącz **Allow public access** (zostają tylko kanały prywatne chronione politykami z kroku 2).
6. **Project Settings → API Keys**: skopiuj Project URL i Publishable key do `docs/games/js/config.js` (`supabaseUrl`, `supabaseKey`) i zrób PR. Po zatwierdzeniu pokoje na żywo ruszą same.
7. **Logowanie Discordem** (rezerwacja nicku, ranking, w przyszłości quiz z nagrodą): Discord Developer Portal → New Application → OAuth2 (Client ID, Secret, Redirect `https://<ref>.supabase.co/auth/v1/callback`) → w Supabase włącz providera Discord i wklej dane → w `config.js` ustaw `discord: true`.
8. **Nie usypiaj projektu:** darmowy projekt usypia się po ok. 7 dniach bez ruchu. Workflow `.github/workflows/games-keepalive.yml` co 5 dni (cron `17 6 */5 * *`, 06:17 UTC) robi jedno małe zapytanie tylko do odczytu (`gry_lobby`) do projektu produkcyjnego. Używa wyłącznie publicznego klucza `sb_publishable_…` z `config.js`, bez sekretów. Działa dopiero po scaleniu do `main`; ręcznie: Actions → „Games keepalive (Supabase)” → Run workflow. Przy zmianie projektu zmień adres i klucz w obu plikach.
9. **Aktualizacje bazy** (po wdrożeniu nowej wersji strony): uruchom raz w SQL Editor plik z `games/supabase/`. Kolejno: `update_picture_plan.sql` (plan wieczoru Guess the Picture: liczba pytań, punktacja, „ostatnie pytanie” z mnożnikiem; już uruchomiony na produkcji), `update_stickers_images.sql` (naklejki w czacie + ponowne wysłanie brakujących kawałków obrazka), `update_limits_cleanup.sql` (limity anty-flood: „joined / left” w czacie max raz na 60 s na gracza, prośby o kawałki obrazka max 6 na obrazek, kod hosta bez globalnej blokady; sprzątanie max raz na 30 s, nieużywane pokoje kasowane po godzinie, ranking zostaje). Pliki są bezpieczne do powtórzenia i same niczego nie kasują.

## Guess the Picture: obrazki w pełnej jakości
- Obrazek do 1 MB idzie **bez zmian** (bajt w bajt). Większy jest zmniejszany (dłuższy bok max 1600 px) i kompresowany (WebP, a gdzie przeglądarka nie umie: JPEG; jakość schodkami 0,92 → 0,48), aż zmieści się w 1 MB. Dzieje się to na urządzeniu hosta przy dodawaniu do kolejki (`docs/games/js/imgchunks.js`).
- Pełny obrazek idzie przez Realtime w kawałkach po ok. 147 KB (limit jednej wiadomości w Free to 256 KB): 1 MB = 10 kawałków. Kawałki są **zaszyfrowane** (AES-GCM, nowy klucz na obrazek) i wysyłane powoli **w trakcie tury**; klucz idzie dopiero przy odsłonięciu, więc nikt nie podejrzy obrazka wcześniej, a odsłonięcie jest natychmiastowe. Odbiorca sprawdza id obrazka, liczbę kawałków i SHA-256. Brakujące kawałki (np. ktoś dołączył w trakcie) gracz zamawia u hosta przez `gry_img_need` (limit 1 prośba / 2 s, do 5 prób; serwer przyjmuje max 6 próśb na gracza na obrazek).
- Tempo: max ok. 60 dostarczonych wiadomości/s na obrazek (każda wiadomość liczy się raz na odbiorcę). Przy 30 graczach to 1 kawałek co ~0,5 s, czyli ~5 s na obrazek 1 MB.
- Nic nie trafia do Storage ani do bazy; kolejka obrazków jest tylko na urządzeniu hosta.

## Naklejki w czacie
Przycisk 🐸 obok czatu (pokoje i stoły). Wysyłane jest tylko id naklejki; serwer przyjmuje wyłącznie id z tabeli `games.stickers`, z limitem jak czat (+ min. 3 s między naklejkami, `games.config.sticker_cooldown_seconds`). Rysujący / host obrazka nie wysyła naklejek w trakcie swojej tury. **Lista jest na razie pusta** (żadnych naszych grafik), a dopóki `manifest.json` nie ma żadnej naklejki, przycisku 🐸 nie widać. Nowa naklejka: plik do `docs/games/img/stickers/` (kwadrat, webp/png/svg/gif, ≤ 150 KB), wpis w `manifest.json`, a w SQL Editor: `insert into games.stickers(id, label, sort) values ('moje-id', 'Podpis', 10);`. Wyłączenie: `update games.stickers set enabled = false where id = '…';`.

## Limity darmowego planu (Supabase Free)
200 jednoczesnych połączeń, 100 wiadomości/s, 2 mln wiadomości/mies., 256 KB na wiadomość, 500 MB bazy, 5 GB transferu (egress)/mies. Piątkowy wieczór gier dla 10–40 osób mieści się w limitach. Największy koszt to transfer obrazków w pełnej jakości: obrazek 1 MB to ok. 1,37 MB (base64) na każdego gracza. Przykład: 30 graczy × 20 obrazków po 1 MB ≈ 0,8 GB na wieczór, 4 wieczory ≈ 3,3 GB/mies. (zwykłe zdjęcia 300–600 KB: ok. 1,0–2,0 GB/mies.). Przy dużym ruchu: plan Pro (25 USD/mies., 250 GB transferu).

## Prywatność i porządek
Strona `docs/games/privacy.html` opisuje, co jest zapisywane (nick, losowe ID gościa, skrót IP z solą, wyniki, czat usuwany po ok. tygodniu). Jeśli zmieni się to, co zbieramy, zmień ją w tym samym PR. Starych anonimowych gości można czyścić raz na kilka miesięcy: `delete from auth.users where is_anonymous and created_at < now() - interval '30 days';`.

## Testowanie lokalnie
Prototyp ma emulator serwera (PGlite) i testy (logika, silniki botów, przeglądarkowe e2e). Leżą poza tym repo, w projekcie prototypu. Przy zmianach SQL lub logiki gier uruchamiaj je przed PR-em.

## Co dalej (nie w tym PR)
Quiz dnia z nagrodą (logowanie Discordem, jeden adres PEP na konto, limit dzienny, zbiorcza wypłata ręcznie z portfela hosta) oraz Frog Tycoon (osobna gałąź, z fikcyjnymi nazwami zamiast prawdziwych giełd).

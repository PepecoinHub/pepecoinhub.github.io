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
8. **Nie usypiaj projektu:** darmowy projekt usypia się po ok. 7 dniach bez ruchu. Plik `games/keepalive.workflow.yml` to gotowy workflow GitHub Actions (kopiuj do `.github/workflows/`, dodaj sekrety `SUPABASE_URL` i `SUPABASE_PUBLISHABLE_KEY`).

## Limity darmowego planu (Supabase Free)
200 jednoczesnych połączeń, 100 wiadomości/s, 2 mln wiadomości/mies., 500 MB bazy, 5 GB transferu. Piątkowy wieczór gier dla 10–40 osób mieści się w limitach. Przy dużym ruchu: plan Pro (25 USD/mies.).

## Prywatność i porządek
Strona `docs/games/privacy.html` opisuje, co jest zapisywane (nick, losowe ID gościa, skrót IP z solą, wyniki, czat usuwany po ok. tygodniu). Jeśli zmieni się to, co zbieramy, zmień ją w tym samym PR. Starych anonimowych gości można czyścić raz na kilka miesięcy: `delete from auth.users where is_anonymous and created_at < now() - interval '30 days';`.

## Testowanie lokalnie
Prototyp ma emulator serwera (PGlite) i testy (logika, silniki botów, przeglądarkowe e2e). Leżą poza tym repo, w projekcie prototypu. Przy zmianach SQL lub logiki gier uruchamiaj je przed PR-em.

## Co dalej (nie w tym PR)
Quiz dnia z nagrodą (logowanie Discordem, jeden adres PEP na konto, limit dzienny, zbiorcza wypłata ręcznie z portfela hosta) oraz Frog Tycoon (osobna gałąź, z fikcyjnymi nazwami zamiast prawdziwych giełd).

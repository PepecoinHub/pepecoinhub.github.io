# PEP Games: jak podłączyć serwer gier

Strona gier jest w `docs/games/` (czysty HTML/JS, bez bundlera). Bez serwera działa tylko „Play vs bot” (szachy, warcaby, „czwórki w rząd” i statki z botem, w przeglądarce). Pokoje na żywo, Draw & Guess, Guess the Picture i stoły dla dwóch osób potrzebują darmowego projektu w Supabase. Cała logika gry jest w funkcjach bazy (`games/supabase/schema.sql`), a przeglądarka tylko wysyła „zamiary” i pokazuje wynik.

## Zasady, które trzymamy
- **Projekt Supabase (produkcyjny) jest podłączony** w `docs/games/js/config.js`.
- **Publiczne wejście:** lobby i Pepe Miner są dostępne z menu oraz strony głównej. Pokoje, stoły, panel hosta i statystyki właściciela pozostają poza wynikami wyszukiwania; aktualne reguły są w `docs/robots.txt` i znacznikach `noindex`.
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
8. **Nie usypiaj projektu:** darmowy projekt usypia się po ok. 7 dniach bez ruchu. Workflow `.github/workflows/games-keepalive.yml` co 3 dni (cron `17 6 */3 * *`, 06:17 UTC) robi jedno małe zapytanie tylko do odczytu (`gry_lobby`) do projektu produkcyjnego. Używa wyłącznie publicznego klucza `sb_publishable_…` z `config.js`, bez sekretów. Działa dopiero po scaleniu do `main`; ręcznie: Actions → „Games keepalive (Supabase)” → Run workflow. Przy zmianie projektu zmień adres i klucz w obu plikach.
9. **Aktualizacje bazy** (po wdrożeniu nowej wersji strony): uruchom raz w SQL Editor plik z `games/supabase/`. Kolejno: `update_picture_plan.sql` (plan wieczoru Guess the Picture: liczba pytań, punktacja, „ostatnie pytanie” z mnożnikiem; już uruchomiony na produkcji), `update_stickers_images.sql` (naklejki w czacie + ponowne wysłanie brakujących kawałków obrazka), `update_limits_cleanup.sql` (limity anty-flood: „joined / left” w czacie max raz na 60 s na gracza, prośby o kawałki obrazka max 6 na obrazek, kod hosta bez globalnej blokady; sprzątanie max raz na 30 s, nieużywane pokoje kasowane po godzinie, ranking zostaje), `update_lobby_chat.sql` (czat w lobby i licznik „online”: wiadomości znikają po 24 h, limity, filtr najcięższych treści, bez linków; host może ukryć wiadomość lub wyciszyć gracza). `update_page_stats.sql` (własny licznik odsłon: odsłony i osoby na dzień i stronę, bez IP; statystyki na `games/stats.html` widzi tylko właściciel z tabeli `games.owners`). Pliki są bezpieczne do powtórzenia i same niczego nie kasują.

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

## Fren Passport (draft PR #184, not yet enabled)

The first iteration of the long-term player Passport runs inside PondOS 98 and
reuses the existing Discord login in the **PH-games** Supabase project. It shows
the actual Supabase account creation date, the YEET personal best, and a collection
of achievements, hidden easter eggs and future inventory.

**Installation order, after code review:**
1. Review the SQL in `games/supabase/update_fren_passport.sql`.
2. Apply it once in the PH-games Supabase SQL editor. It creates the private
   `games.passport_*` tables, read-only `public.gry_passport_state()` and
   low-stakes `public.gry_passport_discover(text)`.
3. Run `node --test tests/passport.test.mjs` and `python scripts/check_site.py`.
4. Merge the PR only after testing Discord login, guest refusal, secret discovery
   on desktop/mobile, and a second opening of the same secret.

The publicly served `docs/meme/passport-catalog.json` contains **labels and hints**,
not reward authorization. The only browser-claimable secrets are `lost_floppy`,
`wrong_frog` and `notes_reader`. They are harmless stamps, and a technically
skilled visitor can discover their IDs from the client. Do not use this claim API
for monetary, scarce, premium, competitive or Discord role rewards.

**YEET Moon Rock:** the current YEET submission RPC checks plausibility, but does
not authoritatively replay a flight. A displayed `Moonwalker` badge is not yet
proof of a server-verified Moon Rock item. No moon-rock inventory item is awarded
by this migration. Future PepeGochi care-day/100-day awards also need their own
server-verified actions. Never grant these through a client-provided badge ID.

The Passport currently performs one Supabase RPC on opening and one small claim
request for each newly discovered secret. Artwork and the achievement catalog
are static assets on GitHub Pages. Don't poll the whole profile each second.

### Fren Avatar Maker and Fresh Fren (draft, not yet enabled)

**Stage D supersedes the earlier v1 avatar migration.** The avatar is now a
stack of hand-drawn 512 × 512 SVG layers (`schema_version 2`). The old v1 draft
(64 × 64, slots mouth/eyes/hat/outfit, a 4-argument save RPC) is replaced; do not
apply it. `games/supabase/update_fren_avatar.sql` in this branch is the v2 file.

`Create Your Fren - Avatar Maker` opens from the Passport (`Create your Fren` /
`Edit your Fren`), from Find… and from the `create_your_fren.mpg` PEP-TV ad. It
stacks the committed 512 × 512 layers in `docs/meme/avatar-assets/layers/`
(35 option layers plus the constant `base_frog`) as listed in
`docs/meme/avatar-options.json`. The v2 `layers_order` is
`[bg, base, clothing, mouth, eyes, hat, accessory]`; `base` is a constant layer
painted between `bg` and `clothing` and is never a saved column. The saveable
slots (columns) are `bg`, `clothing`, `mouth`, `eyes`, `hat`, `accessory`.

Only non-unlock (base) options are offered and saveable this stage. The offered
counts are **bg 4 × clothing 5 × mouth 6 × eyes 6 × hat 7 × accessory 3 = 15,120
looks**, all free. Some manifest options carry an `unlock` key (`bg_sunset`,
`clothing_suit`, `hat_hardhat`, `hat_detective`, `hat_explorer`, `special_explorer`,
`accessory_headphones`): they are reserved for future server-verified activity
achievements, are hidden in the UI, and are rejected by the save RPC exactly like
an unknown id until such an achievement grants them.

**Installation order, after review (and after `update_fren_passport.sql`):**
1. This stage targets a **fresh apply**: `games/supabase/update_fren_avatar.sql`
   runs `create table if not exists games.passport_avatars` with the v2 columns
   (`schema_version` default/check 2; `bg`, `clothing`, `mouth`, `eyes`, `hat`,
   `accessory`). It also creates `public.gry_passport_avatar_save(text, text,
   text, text, text, text)` (six option IDs, in order bg/clothing/mouth/eyes/
   hat/accessory) and a newer `public.gry_passport_state()` that adds the v2
   `avatar` object. It is safe to run twice and awards nothing by itself. This
   file does **not** migrate a live v1 table.
2. If a live v1 `games.passport_avatars` already exists, migrate it in place with
   a reviewed `ALTER` run (outside this draft): rename `outfit` to `clothing` and
   swap its check, add `bg` and `accessory` columns with defaults, set
   `schema_version` default/check to 2, then backfill and remap any legacy
   `outfit_*` ids to `clothing_*`. The exact statements are in the header comment
   of `update_fren_avatar.sql`.
3. Only then merge the frontend. Before the migration the maker still works as
   a preview, but Save Look reports `Saving is waiting for its database update`.
4. If an option is ever added to `avatar-options.json`, add the same ID to the
   matching slot allowlist in the save RPC (and, for a reward part, its
   `(part, stamp)` pair) in a new migration. The tests compare both to the manifest.
5. Then apply `games/supabase/update_passport_awards.sql` **on launch day** (see
   "Fren Passport stamps" below).

### Fren Passport stamps (draft, not yet enabled)

`games/supabase/update_passport_awards.sql` awards the live stamps from the
games' own records. The rules, sources and tests are listed in
`games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md`. Order: after
`update_fren_passport.sql` and `update_fren_avatar.sql`, on a database that
already has the YEET, Where's Pepe, lobby chat, mentions, letters and miner
migrations. Safe to run twice.

- **Run it on launch day.** Its first run gives Pond Pioneer to every account
  that has Discord linked at that moment; `games.passport_meta` makes sure later
  runs never add anyone.
- It backfills Moonwalker, the Pepe Guesser stamps and the letter stamps from
  existing records. Chat, YEET 3×5000 m, Miner time, Welcome Back! and the 30-day
  run count from that day on.
- It replaces `public.gry_yeet_submit` with the same body plus one hook line,
  and adds triggers on `games.wp_plays`, `games.lobby_chat`,
  `games.lobby_mentions`, `games.letters` and `games.miner_saves`. A failing hook
  only logs a warning and never blocks the game.
- New browser RPC: `public.gry_passport_checkin()` (no arguments, Discord only),
  called by PondOS at most every 5 minutes per tab.
- Real-database test: `tests/passport-awards-sql.test.mjs` with the same
  `PASSPORT_PG_URL` / `PASSPORT_PG_MODULE` variables as below.

**Trust rules:** the browser sends only six option IDs (no user id, badge or
image). The server takes the player from `auth.uid()`, requires a real Discord
identity, checks each slot against an exact allowlist, accepts a reward part
only when the player holds its stamp, and writes one row per player. The first save inserts `first_avatar` into
`games.passport_badges` in the same transaction (`on conflict do nothing`), so
Fresh Fren is minted once and a failed save leaves nothing behind. A reward part
sent without its stamp is rejected, so nothing can be unlocked by sending a
fancy id. Saving the same look again is a no-op success; a different look within
3 seconds or past 40 saves per UTC day is an error. Picking parts and Randomize
never call Supabase: one read when the Passport opens, one write per Save Look.

**Tests:** `node --test tests/passport.test.mjs` runs the static v2 checks
(512 canvas layers, 15,120 offered looks, the six-argument save RPC, and the
server allowlists matching the manifest's non-unlock ids).
`tests/passport-avatar-sql.test.mjs` runs the migrations on a real, disposable
PostgreSQL (15 or newer) when `PASSPORT_PG_URL` and `PASSPORT_PG_MODULE` (path to
node-postgres) are set: grants, anonymous/non-Discord rejection, ID injection,
rejection of every reward part without its stamp (`bg_sunset`, `clothing_suit`,
`hat_hardhat`, `hat_detective`, `hat_explorer`, `accessory_headphones`, `special_explorer`),
isolation between players, one badge under concurrent first saves, rollback,
cooldown and the daily limit. Never point it at Supabase. Fresh Fren
(`first_avatar`) is `live` in `docs/meme/passport-catalog.json` only because this
secure server award path is wired and tested.

### Avatar art (2026-11-06)

The avatar layers are the hand-drawn ChatGPT art. The original sheets are kept
losslessly in `games/fren-avatar/source/`; `scripts/build_avatar_layers.py`
cuts each item out, places it on the shared 512×512 canvas and writes
`docs/meme/avatar-assets/layers/<id>.webp` (38 files, about 480 KB). Placement
numbers live in that script, not in CSS. To change a part, edit the sheet or the
numbers and rebuild (`pip install pillow numpy scipy` first). New ids this round:
`hat_fedora` and `bg_meadow`, both free and in the save allowlist. The previous
vector set is in git history (commit before this change) if it is ever needed.

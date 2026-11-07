# Claude Code — task brief: The Pond Messenger
## Co chcemy osiągnąć
Rozwinąć istniejący LAN Party w komunikator PondOS 98, nie robić gry MMO, kolejnego forum ani nowego loginu. Obecny chat ma działać przez cały czas. PR 0 dostarcza wyłącznie dokumentację, grafiki SVG i makietę bez backendu. Wdrażaj kolejne etapy jako **oddzielne małe PR-y**; niczego nie merguj bez akceptacji właściciela.

## Przeczytaj, zanim zmienisz kod
- docs/design/the-pond-messenger/README.md (pełen zakres i kryteria)
- docs/design/the-pond-messenger/preview.html (statyczny prototyp)
- docs/meme/meme.js, docs/meme/meme.css
- docs/games/js/lobbychat.js, docs/games/js/lobby.js, docs/games/js/mentions.js
- games/supabase/update_open_chat.sql, update_lobby_realtime.sql, update_lobby_mentions.sql
- PR #184, #189, #191 (draft Passport + Avatar); PR #186 (draft pet backend); #176 (draft Meme Lab)
- AUDIT_2026-11.md (szczególnie egress i Realtime)

## Spec MVP UI
- Natychmiastowa możliwość wyjścia do obecnego LAN Party, nie usuwaj istniejącego czatu.
- Pasek tytułu + menu aplikacji + Frens | #the-pond | Pond Noticeboard; zachowaj style i skalowanie okien PondOS. Desktop 3 kolumny, mobile zakładki.
- Miniaturki awatarów: korzystaj z **prawdziwych warstw z Avatar Maker** po stabilizacji PR #191; fallback przed ich wdrożeniem. Nie generuj 50 odmiennych Pepe ani nie kopiuj przypadkowych obrazków.
- Nick i avatar są klikane -> nowe okno Fren Passport dla użytkownika z public_fren_id. Przed PR 2 popup może prezentować tylko placeholder.
- Dostępność: role label, focus-visible, keyboard, tap targets 44 px, prefers-reduced-motion, kontrast, zero scroll-lock bugs.
- Nie dodawaj automatycznych pop-upów, monitów, osiągnięć za samo wejście.

## SQL/API dopiero w osobnych PR-ach
**Wyłącznie proponowane kontrakty**, nie implementacja w PR 0:
- gry_fren_public_profile(p_fren_id text) -> allowlist nickname, avatar-options, join month, up to 3 public stamps, pet public snippet, relation-to-viewer; no auth UID.
- gry_frens_list() -> accepted/pending, minimal metadata; gated Discord.
- gry_fren_request(p_fren_id text), gry_fren_respond(p_request_id uuid, p_accept boolean), gry_fren_remove(p_fren_id text), gry_fren_block(p_fren_id text), gry_fren_visibility(p_public boolean, p_show_pet boolean) -> caller derived server-side, rate-limited, idempotent.
- Nie wystawiaj tabel ani JWT identity. Wybieraj losowe public IDs niezależne od Discord/User UUID. Ukryty/blocked => no private data. Limit invitations i pending queue, atomic DB checks.
- Nie używaj samego role=authenticated jako dowodu zweryfikowanego Discorda, ponieważ projekt dopuszcza Supabase anonymous Auth.
- Jeśli nie da się zachować niskiego kosztu Realtime, użyj odczytów na żądanie; nie dodawaj Presence wszystkim znajomym.

## Granice faz
1. **UI-only PR**. Pokaż screeny 1366 i 412 px, test starego czatu i obsługi gościa.
2. **Public profile PR** po migracji Passport+Avatar na staging. Zrób negatywne testy na 2 kontach Discord i gościu.
3. **Friends PR** z blokowaniem, kontrolą spamujących zaproszeń i moderacją.
4. **Noticeboard PR** (treść statyczna, odnośniki).
5. **PepeGochi public view PR** po zatwierdzonym prywatnym API, zgodzie na publiczny widok i serwerowo weryfikowanym inventory.

## Oczekiwana odpowiedź Claude przy każdym PR
- Co zmieniłeś i co pozostaje niegotowe.
- Zrzut desktop i mobile.
- Testy, na których realnie sprawdziłeś działanie.
- Liczba nowych zapytań przy wejściu/otwarciu profilu i odświeżaniu 10 min.
- Potencjalne skutki uboczne dla chat, logowania i limitów Supabase.
- Link do draft PR. Nie wykonuj produkcyjnego SQL ani merge bez zgody.

# PepeGochi A12: życie własne żaby (dla ChatGPT)

Status: ZROBIONE (2026-11-22: wszystkie trzy paczki w grze, w ukrytej becie). Specyfikacja funkcji: dokument „PepeGochi: życie własne żaby — specyfikacja” (Claude, 2026-11-21).

Żaba dostaje życie własne: sama coś robi na pulpicie, pisze pamiętnik o tym, co działo się pod nieobecność gracza,
jeździ na wycieczki i przywozi pocztówki oraz pamiątki, a raz na jakiś czas w pokoju dzieje się coś rzadkiego.
Kod robi Claude. ChatGPT rysuje tylko to, czego jeszcze nie ma.

**Już jest i NIE trzeba rysować:** spanie (`tb_sleep`), podglądanie (`tb_peek`), czytanie (`tb_read`), szukanie
(`tb_search`), radość (`tb_celebrate`), ciekawość, przytulanie, foch, ziewanie, łapanie świetlika, popcorn przy TV,
siadanie na oknach. Kamień z Księżyca (`moon_rock`) i dyskietka (`floppy_disk`) to już dekoracje za stemple, więc
pamiątki z wycieczek muszą być innymi rzeczami.

## Jak to zrobić

Jedna paczka naraz: **A12a → A12b → A12c**. Następna dopiero po sprawdzeniu poprzedniej. Na start ChatGPT pokazuje
3 pliki z A12a (`tb_paint_01..04` jako jeden zestaw, `tb_shades_01..03`, `tb_adult_tinfoil`) do akceptacji.

## Co dołączyć do ChatGPT

Cały folder `wzory/` z tej paczki (jest w `PepeGochi-A12-brief.zip`):

- `tb_adult_sit.png`, `tb_adult_moody.png`, `tb_peek_01..04.png`, `tb_celebrate_01.png`: wzór żaby na pasku (48 × 48).
- `pepegochi_adult_idle.png`, `potted_plant.png`, `rubber_duck.png`, `crt_tv.png`: wzór rzeczy w pokoju (256 × 256).
- `room.png`: tak dziś wygląda pokój.
- `stamp_pond_archivist.webp`: wzór stempla w paszporcie.
- `*_grid.png`: powiększenia z siatką, jeden kwadrat to jeden piksel.

## Tekst do wklejenia

```
You are drawing new art for PEPEGOCHI.EXE, a pixel-art pet frog in PondOS, a Windows 98 style meme desktop
(pepecoinhub.com/meme). The frog gets a "life of its own": it does small things by itself on the desktop, keeps a
diary, goes on trips and brings back postcards and souvenirs, and rare funny events happen in its room.
Code is done by someone else. You ONLY deliver the PNG files listed below. The attached wzory/ folder holds the
approved art: match it exactly. Do not redesign the frog or the duck.

THE FROG (never change): green Pepe frog, the same eyes, mouth and outline as tb_adult_sit.png and
pepegochi_adult_idle.png, blue hoodie with a white letter P copied pixel for pixel from the reference (not "₱",
not mirrored), brown shorts. THE DUCK is the yellow rubber duck from rubber_duck.png: innocent, but suspicious.
Humour: gentle and cute, never rude. No real company logos, no characters from films or games.

FORMATS
B  = taskbar/desktop frame: PNG exactly 48 x 48, real transparency (every pixel fully opaque or fully
     transparent), 1 x 1 grid, at most 32 colours, 1 px dark green outline, no anti-aliasing. The frog sits on the
     taskbar edge: the bottom of the drawing on line y = 47 (last visible row y = 46), body centred on x = 24,
     about 40 px tall, same size as tb_adult_sit.png. ONE FRAME PER FILE, never a sheet. Every animation starts and
     ends close to tb_adult_sit.png so it can return to the sitting pose.
HD = room art: PNG exactly 256 x 256, real transparency, 1 x 1 grid, chunky pixel art like crt_tv.png and
     potted_plant.png (dark outline, flat colours with one or two shades, light from the top left). Replacement
     variants keep the SAME box and bottom line as the file they vary.
C  = cards: PNG exactly 1200 x 675, opaque, pixel art on a 3 x 3 grid (every art pixel a 3 x 3 block), at most
     64 colours, Windows 98 / old paper feel.
S  = souvenir icon: PNG exactly 64 x 64, real transparency, 2 x 2 grid, at most 32 colours, dark outline,
     object centred, bottom on y = 60.
ST = passport stamp: WEBP or PNG 138 x 150, same ink-stamp look as stamp_pond_archivist.webp.
Text inside the art ONLY where a row below says so. File names exactly as listed (lower case, underscores),
animation frames numbered _01, _02 ... Deliver each pack as one zip plus a contact sheet that shows every new
file next to tb_adult_sit.png (A12a) or crt_tv.png (A12b).

PACK A12a — the frog does things by itself (format B, 40 files)
1. tb_paint_01..04: holds a tiny brush and a tiny canvas, paints (01-03), then turns the canvas to the viewer
   proudly (04). The painting is a wobbly green circle.
2. tb_knock_01..04: faces the viewer and knocks on the screen glass with one fist (fist big in front, 02 and 04
   touch the "glass"), curious face.
3. tb_climb_01..05: reaches up (01), jumps (02), hangs by both hands from the top of the frame (03), slips (04),
   lands sitting, a little dazed (05). Everything stays inside 48 x 48.
4. tb_bin_01..03: a small grey Windows 98 recycle bin on the taskbar, the frog is inside it and only one green
   leg sticks out of the top; the leg wiggles (01-03).
5. tb_sign_01..03: pulls out a small wooden sign on a stick (01-02) and holds it up (03). On the sign: a tiny
   tuft of green grass. No letters (the words are added by the code in a speech bubble).
6. tb_argue_01..04: argues with the small rubber duck sitting next to it (the duck about 14 px, at the right).
   The frog leans in and waves its arms, small white symbols # @ ! in a bubble over the frog in 02 and 04,
   the duck does not move at all.
7. tb_shades_01..03: takes out black pixel sunglasses (01), puts them on (02), cool smirk (03).
8. tb_caught_01..02: frozen mid-move, eyes wide, "who, me?" (01), then a fake innocent smile and a tiny whistle
   note (02).
9. tb_adult_tinfoil.png: single pose, the sitting frog wearing a shiny silver tinfoil hat, eyes side-glancing.
10. tb_backpack_01..04: puts on a small brown backpack (01-02), waves goodbye (03), hops away to the right, half
    out of the frame (04).
11. tb_postcard.png: no frog. A postcard with a small stamp lying on the taskbar edge (like tb_letter.png).
    Shown while the frog is away on a trip.
12. tb_dance_01..04: a silly happy dance, arms up, one leg up, swap; for good PEP price days.
13. tb_yawn_clock_01..02: looks at a tiny wall clock and yawns (late at night).

PACK A12b — rare room events (format HD, 13 files)
1. potted_plant_golden.png: the same lemon plant as potted_plant.png, same box and bottom line, but ONE lemon is
   shining gold with 4 small sparkle pixels around it.
2. pepegochi_adult_tinfoil.png: the same frog as pepegochi_adult_idle.png, same box and feet line, wearing a
   tinfoil hat and glancing suspiciously to the side.
3. duck_outline.png: a white chalk outline of the rubber duck on the floor, same box as rubber_duck.png
   (the duck moved and the frog drew where it used to be). Just the dashed chalk line, nothing inside.
4. event_ufo_01..04: a small classic flying saucer with a green dome and blinking lights (01-04 lights blink in
   turn), about 120 px wide, centred, empty space around it. It will fly past the window behind the curtains.
5. event_spy_duck.png: the rubber duck wearing small black sunglasses and holding a tiny notepad, looking in
   from the bottom edge (only head and notepad visible), as if peeking through the window.
6. crt_tv_static_01..03: the same TV as crt_tv.png, same box, but the screen shows black and white static noise
   (three different noise frames). On frame 03 a short row of green digits shows through the noise.
7. event_cake.png: a small round birthday cake with green icing and a single candle shaped like a frog,
   to stand on the table top.
8. room_trip_note.png: a small folded paper note with a pinned corner, to lie on the frog's bed while it is away.

PACK A12c — diary, trips and stamps
Cards (format C):
1. diary_card.png: one page of a squared school notebook for sharing on X. Squared paper, a ring binding on the
   left, a tea stain in a corner, a tiny doodle of the frog in the right margin, a blank writing area on the left
   two thirds (the code writes the text there), at the bottom a small pixel line "pepecoinhub.com/meme" (text
   allowed here).
2. Ten postcards, postcard_<place>.png: a picture on the left 60%, a blank right 40% with a stamp box in the top
   right corner and 4 empty writing lines (the code writes the text there). The frog is in every picture except
   "unknown". Places:
   big_pond (a huge pond, the frog small and amazed on the shore)
   forgotten_coins_swamp (old forgotten coins half sunk in swamp mud, a sad mood, the frog with a lantern)
   scrypt_mine (a warm, noisy mine full of glowing mining rigs, the frog in a yellow hard hat)
   lily_hills (the frog asleep on a lily pad drifting on a river between green hills)
   duck_city (a town full of rubber ducks, the frog in a fake moustache and a trench coat)
   exchange (a generic crypto trading floor with green and red candles on big screens; NO real exchange logo)
   old_internet (a 1998 web page with a visitor counter "000042" and an under-construction sign, the frog proud)
   krakow_dragon (the Wawel castle hill in Krakow at sunset, a friendly cartoon dragon offering a trade, the frog
     shaking its head no)
   moon (the frog sitting on the Moon, Earth in the black sky, very quiet)
   unknown (no frog: only static noise and a short row of coordinates in white pixel digits)
Souvenirs (format S, 10 files):
3. souv_pebble (a smooth pond pebble), souv_shell (a small spiral shell), souv_hard_hat (a yellow miner hard hat),
   souv_photo (a small instant photo of the frog with a thumbs up), souv_duck_feather (a single yellow feather),
   souv_mini_miner_01..02 (a tiny mining rig box with two LEDs; 01 LEDs on, 02 LEDs off), souv_moon_dust (a small
   glass jar of grey glittering dust with a cork), souv_old_cd (a shiny old CD-ROM in a slim case),
   souv_dragon_scale (a single shiny green dragon scale)
Stamps (format ST, 6 files):
4. stamp_dear_diary (an open notebook with a pen), stamp_snoop (an eye peeking through a keyhole, a small moon),
   stamp_tourist (a backpack), stamp_globetrotter (a globe with a frog footprint), stamp_moon_frog (a frog
   footprint on the Moon), stamp_golden_harvest (a golden lemon). Each stamp has its English name in small capitals
   around the edge, like the reference stamp (text allowed here).

ORDER: start with pack A12a. First show me only tb_paint_01..04, tb_shades_01..03 and tb_adult_tinfoil.png for
approval. After my approval do the rest, one pack at a time. If something cannot be done in the given size or
style, say so instead of changing the rules.
```

## Jak Claude to sprawdzi

1. `node scripts/pepegochi_art_qa.mjs` każdego pliku: format B (`--format=B`), HD (`--format=HD`, warianty z
   `--like=` starego pliku), reszta: rozmiar, przezroczystość, siatka, liczba kolorów.
2. Podgląd animacji na pasku i rzeczy w pokoju, na desktopie i telefonie.
3. Dopiero po akceptacji właściciela pliki trafiają do `docs/games/img/pepegochi/` i do gry, za `?beta=fren`.

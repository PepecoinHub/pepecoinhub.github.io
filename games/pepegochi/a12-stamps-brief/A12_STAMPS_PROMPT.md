# PepeGochi A12: 6 stempli Paszportu (dla ChatGPT)

Status: DO ZROBIENIA. Stemple z paczki A12c (`docs/games/img/pepegochi/a12/stamp_*.png`) właściciel odrzucił
2026-11-22: inny styl niż reszta Paszportu (malowany pixel art, prawie bez żaby, inna ramka). Kod jest gotowy
(`games/supabase/update_pepegochi_life.sql`, katalog `docs/meme/passport-catalog.json`, status `planned`).
Dopóki stempel nie ma zatwierdzonego rysunku, Paszport pokazuje neutralne „?”.

To są tylko stemple w Paszporcie. Nic z nich nie trafia do pokoju żaby.

## Co dołączyć do ChatGPT

- `wzory/*.png`: 8 zatwierdzonych stempli z Paszportu (styl, ramka, podpis na dole).
- `wzory_razem.png`: te same obok siebie.

## Tekst do wklejenia

```
You are drawing 6 new stamps for the FREN PASSPORT of PondOS 98 (a Pepecoin fan site). They must look like they
belong to the same set as the attached approved stamps (wzory/*.png), NOT like pixel art:
- the same perforated cream stamp frame with a thin dark outline,
- a bold cartoon scene inside with thick dark outlines and flat, bright colours (like First Hatch, Little Fren,
  One Small Step, Welcome Back!),
- Pepe the frog as the main character in EVERY stamp, in the same cartoon style as the attached stamps (green skin,
  big white eyes, red-brown lips, often the blue hoodie with a white "P"),
- a rounded grey label strip at the bottom with the stamp's name in the same bold dark rounded font, Title Case.
No other text inside the scene, no logos, no real people, no real exchange or brand names.

Theme: PepeGochi, the pet frog that lives on the PondOS desktop. It goes on trips and sends postcards, keeps a
diary about its day, and has a lemon tree in its room.

1. tourist.png, label "Tourist": Pepe with a big backpack and a small paper map, waving, a lily pond and a signpost
   behind him. Happy, sunny, first-trip excitement.
2. globetrotter.png, label "Globetrotter": Pepe holding a stack of postcards fanned out like cards, a globe beside
   him covered in little pins, a passport-style suitcase with travel stickers.
3. moon_frog.png, label "Moon Frog": Pepe in his blue hoodie (no spacesuit, so it is different from One Small
   Step) sitting relaxed on the Moon, holding a small jar of glittering grey moon dust, Earth in the black sky.
4. golden_harvest.png, label "Golden Harvest": Pepe with a small watering can next to a potted lemon tree; one
   lemon shines gold with sparkles, Pepe amazed with sparkling eyes. Warm golden light.
5. dear_diary.png, label "Dear Diary": Pepe at a small desk writing in a squared school notebook with a pen, a cup
   of tea, a rubber duck watching from the corner. Cosy evening.
6. snoop.png, label "Snoop": night scene, a desk lamp on, a clock showing 3:00, Pepe in pyjamas caught red-handed
   reading someone's open diary, looking over his shoulder with a guilty grin. A small moon in the window.

Output: 6 PNG files with a transparent background outside the stamp, each the same proportions as the attached
stamps (portrait, about 138 x 150 at 1x; deliver at 4x, 552 x 600), named exactly as above, in one zip, plus one
contact sheet with the 6 stamps next to 3 of the attached ones (First Hatch, Little Fren, Welcome Back!).
```

## Jak Claude to sprawdzi

1. Proporcje, przezroczyste tło, ramka i podpis zgodne z zatwierdzonymi stemplami; podgląd obok nich w Paszporcie.
2. Po zatwierdzeniu przez właściciela: pliki do `games/fren-passport/source/stamps-new/`, dopisanie 6 nazw do
   `scripts/build_v3_stamps.py` i `PP_V3` w `docs/meme/meme.js`, przebudowa `stamps-v3.webp`.

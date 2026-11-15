# PepeGochi A10: trzy nowe rzeczy w pokoju (dla ChatGPT)

Status: ZROBIONE. Grafiki ChatGPT zatwierdzone przez właściciela 2026-11-15 i w grze.
- **Kubek:** ucho odstaje, a „P” słabo wygląda, więc zamiast niego będzie czerwony kubek „Comfy”.
- **Kaczka:** nie wygląda jak kaczka.
- **Obraz z „P”:** zamiast niego obraz ze **Złotą Stopą** z FROGAGEDDON.

Te same nazwy plików i ta sama wielkość, więc w grze nic się nie przesunie. Każda rzecz ma stałe miejsce w pokoju.

## Co dołączyć do ChatGPT (wszystko jest w paczce)

- `obecny_pokoj.png`: tak dziś wygląda pokój.
- `obecne/*.png`: dzisiejsze rzeczy 128 × 128, czyli te do wymiany (`mug`, `rubber_duck`, `p_poster`) i wzory stylu
  (`lava_lamp`, `crt_tv`, `potted_plant`). Do tego `*_5x_grid.png`, czyli powiększenia z siatką: jeden kwadrat to jeden
  „piksel” 2 × 2.
- `wzory/comfy_mug_photo.png`: zdjęcie czerwonego kubka „Comfy”.
- `wzory/golden_foot.png`, `wzory/mega_golden_foot.png`: Złota Stopa z gry FROGAGEDDON.

## Tekst do wklejenia

```
You are redrawing three props for the ROOM of PEPEGOCHI.EXE, a pixel-art pet frog game in a Windows 98 style site.
The attached obecny_pokoj.png shows the room; obecne/*.png are its props (128 x 128). lava_lamp.png, crt_tv.png and
potted_plant.png are the style to match: chunky pixel art, a dark outline, flat colours with one or two shades,
light from the top left.

RULES
1. PNG, exactly 128 x 128, real transparent background, every pixel fully opaque or fully transparent.
2. Pixel art on a 2 x 2 grid: every art pixel is a 2 x 2 block starting at even x and y. At most 32 colours.
   No anti-aliasing, no blur, no gradients, no photo texture.
3. Same size and place as the file it replaces: the drawing fills about the same box (see each file), its bottom
   on the same line, so it stands on the same piece of furniture.
4. Deliver the three 128 x 128 files named exactly as below, in one zip, plus a contact sheet that shows the three new
   props next to lava_lamp.png and crt_tv.png.

1. mug.png: a RED coffee mug with the word "Comfy" in white hand-written letters, as in wzory/comfy_mug_photo.png.
   Side view, the handle on the left, a CLOSED round handle that touches the mug at the top and the bottom (the
   old mug's handle sticks out). The word must be readable at 64 px: big chunky white pixel letters.
   Same size as the old mug.png.
2. rubber_duck.png: a classic yellow rubber bath duck that reads as a duck at first sight. Side view facing
   left, a round body, a round head with a short orange flat beak, one black dot eye with a white highlight, a
   small raised tail and a darker yellow wing line. Same size as the old rubber_duck.png.
3. p_poster.png: a framed painting for the wall. A gold or dark wood frame, and inside it the GOLDEN FOOT of the
   game FROGAGEDDON (wzory/mega_golden_foot.png: a shiny golden frog foot with a dark outline) shown proudly like a
   trophy, on a dark red background with a few light rays behind the foot. A small hanging nail at the top, as in
   the old one. No letters. Same size as the old p_poster.png.
```

## Jak Claude to sprawdzi

1. `node scripts/pepegochi_art_qa.mjs --prop` każdego pliku: rozmiar, siatka 2 × 2, przezroczystość, kolory.
   Do tego `--like=` ze starym plikiem: to samo miejsce i ta sama wielkość.
2. Podgląd w pokoju na desktopie i telefonie, obok reszty rzeczy.
3. Dopiero po Twojej akceptacji: podmiana plików i nowe nazwy w grze („Comfy mug”, „Golden Foot painting”). Te nazwy
   pojawiają się też w liście pożegnalnym, gdy żaba coś zabierze.

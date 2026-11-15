# PepeGochi A7: list GOODBYE.TXT jako pixel-art (dla ChatGPT)

Status: do wykonania. A1–A6 w grze (2026-11-13). Jeden plik.

Po wyprowadzce na dywanie leży koperta (`goodbye_envelope.png`). Po przeczytaniu listu zamienia się w otwartą kartkę
(`goodbye_letter.png`). Koperta jest już porządnym pixel-artem. Kartka jest jedynym obrazkiem w grze z rozmytymi,
półprzezroczystymi krawędziami (1493 kolory), więc w pokoju odstaje od reszty.

## Co dołączyć do ChatGPT

- `obecny_goodbye_letter.png` i `obecny_goodbye_letter_5x.png`: dzisiejsza kartka (kompozycja do zachowania).
- `goodbye_envelope.png` i `goodbye_envelope_5x_grid.png`: wzór stylu, kolorów i grubości konturu (siatka 2 × 2).

## Tekst do wklejenia

```
Redraw one prop for PEPEGOCHI.EXE, a pixel-art pet frog game in a Windows 98 style site.

goodbye_letter.png: the open GOODBYE letter the frog leaves on the rug. Keep the composition of the attached
obecny_goodbye_letter.png (an open sheet of paper lying a little tilted, a small green waving frog hand drawn on it,
a small red heart under it, a few short lines of "writing"), but draw it as real pixel art in the style of the
attached goodbye_envelope.png (same outline colour and thickness, same paper colour, same red).

RULES
- PNG, exactly 128 x 128, real transparent background, every pixel fully opaque or fully transparent.
- Pixel art on a 2 x 2 grid (every art pixel is a 2 x 2 block starting at even x and y), at most 16 colours,
  no anti-aliasing, no blur, no gradients, no readable text (the "writing" is short dark lines).
- Colours: paper #fff1cc, outline and lines #232e1c, heart and seal red #c63a40 (from goodbye_envelope.png), the
  frog-hand greens of the PepeGochi frog (#71ad37, #5b8b2f, outline #021b02). A slightly darker paper shade for the
  fold is allowed.
- About the same size and place as the current letter: inside x 8-120, y 46-122, centred.
- Deliver the single 128 x 128 PNG (same name) and a 4x preview.
```

## Jak Claude to sprawdzi

`node scripts/pepegochi_art_qa.mjs --prop goodbye_letter.png` (128 × 128, siatka 2 × 2, przezroczystość, kolory),
porównanie z kopertą obok siebie i podgląd w pokoju po przeczytaniu listu.

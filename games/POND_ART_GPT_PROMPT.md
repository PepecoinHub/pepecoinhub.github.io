# Prompt dla GPT: grafiki do POND KING, BATTLE OF THREE LILIES i POND BULLETIN

Wklej do ChatGPT najpierw **prompt główny**, a potem po kolei **zamówienia 1–9**, każde w osobnej wiadomości. Gotowe pliki wrzuć do `docs/games/img/pond/` pod nazwami z tabeli. Kod je podepnie: miejsca na nie są oznaczone w kodzie jako `PLACEHOLDER`.

---

## Prompt główny (wklej raz, na początku rozmowy)

```
You are the pixel artist for "PondOS 98", the meme edition of a crypto fan site about Pepecoin (PEP).
It is a Windows 98 desktop full of frogs: silver window chrome, two-pixel bevels, pond-green title
bars, 16x16 and 32x32 desktop icons. I need game art for three small games that run in PondOS windows:

1. POND KING: rock, paper, scissors for a throne. One frog is king; visitors challenge it.
2. BATTLE OF THREE LILIES: each player puts 10 flies on three lily pads (A, B, C). Win two pads, win the duel.
3. POND BULLETIN: a cork notice board with little Notepad-style notes and a news list.

STYLE (follow it in every image):
- PIXEL ART in the style of late-90s Windows icons and shareware games: a small pixel grid, hard
  edges, NO anti-aliasing, NO blur, NO gradients, NO smooth vector look. Every pixel is one flat colour.
- Draw at the native pixel size I give (for example 32x32), then deliver it scaled up with
  nearest-neighbour by the factor I give, so each art pixel becomes a crisp square block.
- A 1-pixel dark outline (#142016) around shapes, flat fills, at most one darker shade and one lighter
  highlight per colour, optional 2x2 checkerboard dithering for shading (like Windows 98).
- Limited palette, use only these colours:
  outline #142016, white #ffffff, silver #c3c3bd, grey #808080, dark grey #6b6b6b, light grey #d8d8d8,
  frog green #4f9f45, dark green #2e6b2a, light green #9fd36b, leaf #5cb84f, leaf shade #4aa23f,
  leaf vein #3c8a35, gold #f2b544, light gold #ffe08a, red #e0403a, blue #2c5ac4, water #3e8f9a,
  light water #8fd0d6, cork #c99a62, dark cork #b9874f, dark red #8a2a1b, yellow #ffd34d, title green #0c4a24.
- Friendly, cute, a bit silly. Original frog characters only: a round green frog with big white eyes
  and black pupils, a wide smile. Do NOT draw Pepe the Frog or any existing copyrighted character, no
  sad/smug Pepe faces, no logos of real companies or coins.
- Transparent background (PNG with alpha) unless I say "with background". No text inside images.

When I order an asset, reply with the image only, at the exact size I ask, then one line with the file
name I gave. If something in my order conflicts with this style, follow this style.
```

---

## Zamówienia (każde w osobnej wiadomości)

**1. Liść lilii (3 warianty)**
```
Order 1: three top-down pixel lily pads. Native size 32x32 pixels each, delivered at 256x256
(nearest-neighbour x8), transparent background. A round pad with a V-shaped notch pointing up, leaf
#5cb84f with a #4aa23f rim, 5-6 one-pixel veins #3c8a35 from the centre, a #9fd36b highlight
upper-left, 1-pixel #142016 outline. Keep the centre (8x7 pixels) plain: a number box sits there.
Make the three slightly different (a small tear, a water drop, a different notch angle).
Files: lily-pad-a.png, lily-pad-b.png, lily-pad-c.png
```

**2. Mucha (dwie drużyny)**
```
Order 2: a tiny pixel fly seen from above. Native 7x7 pixels, delivered at 56x56 (x8), transparent.
Two white wings, round body, two eye pixels, 1-pixel outline where it helps. Two versions: team "mine"
with a #1d2420 body and red #e0403a eyes, team "theirs" with a #8a2a1b body and yellow #ffd34d eyes.
Files: fly-mine.png, fly-theirs.png
```

**3. Woda stawu (kafelek)**
```
Order 3: a seamless pixel water tile, native 32x32, delivered at 128x128 (x4), WITH background:
#3e8f9a with 2x2 checkerboard dithering and a few short horizontal ripple lines in #8fd0d6, like a
Windows 98 desktop pattern. It must tile without seams.
File: pond-tile.png
```

**4. Król Stawu**
```
Order 4: the Pond King, pixel art: a round green frog (#4f9f45, shade #2e6b2a) sitting on a lily pad,
a small gold crown (#f2b544, light #ffe08a) with red and blue gem pixels, big white eyes with black
pupils, a happy open mouth. Three versions: native 32x32 delivered at 256x256 (x8), plus true 32x32
and 16x16 desktop icons (redrawn for the size, not just shrunk).
Files: pond-king-256.png, pond-king-32.png, pond-king-16.png
```

**5. Ikona BATTLE OF THREE LILIES**
```
Order 5: a Windows 98 style desktop icon: three small pixel lily pads in a triangle on a square water
tile, one fly on each pad. True 32x32 and 16x16 versions (redrawn for each size).
Files: lilies-32.png, lilies-16.png
```

**6. Ikona POND BULLETIN**
```
Order 6: a Windows 98 style desktop icon: a small cork board with a wooden frame, two pinned paper
notes (yellow and light blue) and a red push pin. True 32x32 and 16x16 versions.
Files: bulletin-32.png, bulletin-16.png
```

**7. Elementy tablicy korkowej**
```
Order 7: (a) a seamless pixel cork tile, native 16x16 delivered at 64x64 (x4), WITH background, #c99a62
with #b9874f checkerboard dithering and a few darker speckle pixels; (b) a red pixel push pin, native
8x8 delivered at 32x32 (x4), transparent.
Files: cork-tile.png, push-pin.png
```

**8. Kamień, papier, nożyce**
```
Order 8: three pixel move icons, native 16x16 each, delivered at 128x128 (x8), transparent:
a grey rock with a light-grey highlight and a moss pixel, a sheet of paper with a folded corner and
blue text lines, open scissors with silver blades and green handles. Same style, all readable at 32 px.
Files: move-rock.png, move-paper.png, move-scissors.png
```

**9. Animacje wyniku (klatki)**
```
Order 9: three tiny pixel animations as PNG frame sequences, 4 frames each, native 32x32 delivered at
128x128 (x4), transparent:
(a) WIN: the frog jumps with arms up, flies circling;
(b) LOSE: a dizzy frog with a plaster on its nose and a black eye, little stars circling its head
    (the game says "you are bruised, come back in 4 hours");
(c) DRAW: two frogs pulling one fly between them, both annoyed.
Files: win-1.png … win-4.png, lose-1.png … lose-4.png, draw-1.png … draw-4.png
```

---

## Tabela plików i co zastąpią

| Plik | Gdzie w kodzie | Zastępuje dzisiejszy placeholder |
|---|---|---|
| `lily-pad-a/b/c.png` | `docs/games/js/lilies.js` (`LEAF`, `padSvg`) | pikselowy liść generowany w kodzie |
| `fly-mine.png`, `fly-theirs.png` | `docs/games/js/pond-net.js` (`SPRITES.fly`) | pikselowa mucha w kodzie |
| `pond-tile.png` | `docs/games/lilies.css` (`.pond`) | woda z ditheringu w CSS |
| `pond-king-*.png` | `docs/games/pond-king.html`, `bulletin.html`, `docs/meme/meme.js` (`ico`) | `img/pond-king.svg` |
| `lilies-32/16.png` | `docs/meme/meme.js` (`ico`), `lilies.html` | `img/lilies.svg` |
| `bulletin-32/16.png` | `docs/meme/meme.js`, `bulletin.html` | pożyczona ikona `news.webp` |
| `cork-tile.png`, `push-pin.png` | `docs/games/lilies.css` (`.board`) | korek z ditheringu w CSS |
| `move-rock/paper/scissors.png` | `docs/games/js/pond-net.js` (`SPRITES`) | pikselowe sprite'y w kodzie |
| `win/lose/draw-1…4.png` | ekrany wyniku w obu grach | brak animacji (tylko kolor i tekst) |

Wskazówki dla kodu po dostarczeniu grafik: zostawiamy PNG albo bezstratny WebP (stratna kompresja rozmywa piksele), z `image-rendering: pixelated`. Ikony 16 i 32 px wyświetlamy w naturalnym rozmiarze albo w całkowitych wielokrotnościach.

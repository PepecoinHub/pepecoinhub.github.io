# Prompt dla GPT: grafiki do POND KING, BATTLE OF THREE LILIES i POND BULLETIN

Wklej do ChatGPT najpierw **prompt główny**, a potem po kolei **zamówienia 1–9**, każde w osobnej wiadomości. Gotowe pliki wrzuć do `docs/games/img/pond/` pod nazwami z tabeli. Kod je podepnie: miejsca na nie są oznaczone w kodzie jako `PLACEHOLDER`.

---

## Prompt główny (wklej raz, na początku rozmowy)

```
You are the art director and illustrator for "PondOS 98", the meme edition of a crypto fan site about
Pepecoin (PEP). It looks like a cheerful Windows 98 desktop full of frogs. I need game art for three
small browser games that live in PondOS windows:

1. POND KING: rock, paper, scissors for a throne. One frog is king; visitors challenge it.
2. BATTLE OF THREE LILIES: each player puts 10 flies on three lily pads (A, B, C). Win two pads, win the duel.
3. POND BULLETIN: a cork notice board with pinned sticky notes and newspaper clippings.

STYLE (follow it in every image):
- Flat comic "sticker" style, like modern cartoon stickers: thick dark outline (#142016, about 3 px at
  256 px size), flat colours with ONE simple cel-shade, a small white highlight. No gradients beyond
  that, no photo textures, no 3D render look, no text inside images unless I ask.
- Friendly, cute, a bit silly. Original frog characters only: a round green frog with big white eyes
  and black pupils, a wide smile. Do NOT draw Pepe the Frog or any existing copyrighted character, no
  sad/smug Pepe faces, no logos of real companies or coins.
- Palette (use these exact colours where they fit):
  frog green #4f9f45, deep green #1f5c28, light leaf #5cb84f, leaf vein #3c8a35, gold #f2b544,
  gold light #fff0c9, cream #fffef7, red #b3412e, coral #f2a28f, water #2f7f86 / #1f5f6b / #5fb3bb,
  cork #c99a62, outline #142016.
- Transparent background (PNG with alpha) unless I say "with background".
- Every asset must read clearly at small size (64 px) as well as large.

When I order an asset, reply with the image only, at the exact size I ask, then one line with the
file name I gave. If something in my order conflicts with this style, follow this style.
```

---

## Zamówienia (każde w osobnej wiadomości)

**1. Liść lilii (3 warianty)**
```
Order 1: three top-down lily pads, each 512x512 PNG, transparent background. A round pad with a
V-shaped notch pointing up (cut about 1/8 of the circle), light leaf green #5cb84f, veins #3c8a35 from
the centre, thick #142016 outline, a soft white highlight upper-left, a faint shadow under the pad.
Keep the centre (a circle of about 25% of the width) plain and flat: a number badge sits there.
Make the three slightly different (rotation, a small tear or a water drop), same size and style.
Files: lily-pad-a.png, lily-pad-b.png, lily-pad-c.png
```

**2. Mucha (dwie drużyny)**
```
Order 2: a cute cartoon fly seen from above, 128x128 PNG, transparent background. Round dark body,
two big translucent white wings, tiny red eyes, thick #142016 outline. Make two versions:
team "mine" with a dark green-black body (#1d2420) and team "theirs" with a dark red body (#8a2a1b)
and yellow eyes. They must stay readable at 16 px.
Files: fly-mine.png, fly-theirs.png
```

**3. Tło stawu**
```
Order 3: a seamless horizontal pond water strip, 1600x400 PNG WITH background, top-down view:
calm water in #5fb3bb fading to #2f7f86, a few soft white ripple rings, two or three tiny reeds or
lily buds at the edges only. The middle must stay calm and empty: three lily pads are placed on it.
File: pond-strip.png
```

**4. Król Stawu (żaba w koronie)**
```
Order 4: the Pond King: a round green frog (#4f9f45) sitting proudly on a lily pad, wearing a small
gold crown (#f2b544) with three gems (red, blue, blue), big friendly eyes, confident grin. Front view,
full body, 512x512 PNG, transparent background. Also a 64x64 and a 16x16 icon version of the head
with crown (simplified for small sizes).
Files: pond-king.png, pond-king-64.png, pond-king-16.png
```

**5. Ikona BATTLE OF THREE LILIES**
```
Order 5: an app icon for "Battle of Three Lilies": three small lily pads in a triangle on a round
water tile (#5fb3bb), one fly on each pad, thick outline, Windows 98 desktop-icon feel but in our
sticker style. Sizes 64x64 and 16x16 PNG (the 16 px one simplified to two pads and one fly).
Files: lilies-64.png, lilies-16.png
```

**6. Ikona POND BULLETIN**
```
Order 6: an app icon for "Pond Bulletin": a small cork board (#c99a62) with a wooden frame, two
pinned paper notes (yellow and light blue) and one red push pin, a tiny frog footprint on a note.
Sizes 64x64 and 16x16 PNG.
Files: bulletin-64.png, bulletin-16.png
```

**7. Elementy tablicy korkowej**
```
Order 7: assets for the cork notice board:
(a) a seamless cork texture tile, 256x256 PNG WITH background, base #c99a62, subtle darker speckles;
(b) a red push pin seen slightly from above, 64x64 PNG transparent;
(c) a torn newspaper clipping edge strip, 800x40 PNG transparent, off-white paper #fbf8ef with a
    jagged torn bottom edge.
Files: cork.png, push-pin.png, clipping-edge.png
```

**8. Ruchy kamień, papier, nożyce**
```
Order 8: three game tiles for rock, paper, scissors in our style, 256x256 PNG each, transparent:
a grey cartoon rock with a tiny moss patch, a sheet of paper with a folded corner and a frog doodle,
open scissors with green handles. Same size, same angle, readable at 40 px.
Files: move-rock.png, move-paper.png, move-scissors.png
```

**9. Animacje wyniku (klatki)**
```
Order 9: three short sticker animations as PNG frame sequences, 6 frames each, 256x256, transparent:
(a) WIN: a frog jumps with arms up while small flies circle around it;
(b) LOSE: a dizzy frog with a plaster on its nose and a small black eye, stars circling its head
    (we tell the player "you are bruised, come back in 4 hours");
(c) DRAW: two frogs pulling one fly between them, both annoyed.
Files: win-01.png … win-06.png, lose-01.png … lose-06.png, draw-01.png … draw-06.png
```

---

## Tabela plików i co zastąpią

| Plik | Gdzie w kodzie | Zastępuje dzisiejszy placeholder |
|---|---|---|
| `lily-pad-a/b/c.png` | `docs/games/js/lilies.js` (`padSvg`) | liść rysowany w SVG |
| `fly-mine.png`, `fly-theirs.png` | `docs/games/js/lilies.js` (`fly`) | mucha rysowana w SVG |
| `pond-strip.png` | `docs/games/lilies.css` (`.pond`) | gradient wody w CSS |
| `pond-king*.png` | `docs/games/pond-king.html`, `bulletin.html`, `docs/meme/meme.js` (`ico`) | `img/pond-king.svg` |
| `lilies-64/16.png` | `docs/meme/meme.js` (`ico`), `lilies.html` | `img/lilies.svg` |
| `bulletin-64/16.png` | `docs/meme/meme.js`, `bulletin.html` | pożyczona ikona `news.webp` |
| `cork.png`, `push-pin.png`, `clipping-edge.png` | `docs/games/lilies.css` (`.board`, `.note::before`, `.clip`) | korek, pinezka i postrzępiona krawędź w CSS |
| `move-rock/paper/scissors.png` | `docs/games/js/pond-king.js` (`MOVES`) | emoji 🪨 📄 ✂️ |
| `win/lose/draw-01…06.png` | ekrany wyniku w obu grach | brak animacji (tylko kolor i tekst) |

Wskazówki dla kodu po dostarczeniu grafik: obrazki konwertujemy do WebP (jak inne w `docs/meme/img/`), duże ≤ 60 KB, ikony ≤ 8 KB. Wersje 16 px muszą być ostre: bez skalowania w przeglądarce.

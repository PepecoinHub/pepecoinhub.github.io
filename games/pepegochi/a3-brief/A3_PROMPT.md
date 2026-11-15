# PepeGochi A3: wszystkie dorosłe pozy na stojąco + 9 krótkich animacji na pasek Start, jedna paczka (dla ChatGPT)

Status: do wykonania. A1 i A2 zatwierdzone (2026-11-13). Decyzja właściciela (2026-11-13): na krawędzi paska żaba
zawsze STOI (siedzenie źle wygląda). Jedna paczka, dwie części:
1. 7 dorosłych póz, które dziś siedzą, przerobione na stojące (te same nazwy plików).
2. 33 klatki animacji, liczone już od stojących póz.

## Jak żaba stoi na pasku

Żaba stoi NA górnej krawędzi paska Start (zrzut `frog_on_the_taskbar_edge.png`): linia stóp y = 47 obrazka leży
dokładnie na krawędzi paska. Każda klatka jest wyświetlana w tym samym miejscu co poza bazowa, 1:1, bez skalowania.
Dlatego klatka, w której cokolwiek „pływa” o piksel, od razu widać jako drganie. Stąd zasady niżej.

## Co dołączyć do ChatGPT (wszystko jest w paczce)

- Pozy 48 × 48 z gry (folder `pozy_48px/`): stojące `tb_adult_sit.png` (WZORZEC ciała: nogi i stopy),
  `tb_adult_hungry.png`, `tb_adult_dirty.png`, `tb_adult_moody.png`, `tb_adult_sleepy.png`, jajo `tb_egg.png`, oraz
  siedzące do przerobienia: `tb_adult_neglected.png`, `tb_adult_packing.png`, `tb_adult_recovering.png`,
  `tb_adult_talk.png`, `tb_adult_think.png`, `tb_adult_laugh.png`, `tb_adult_wave.png` (z nich brać twarz, rękę,
  plaster, walizkę).
- `room_adult_neglected.png`, `room_adult_packing.png`, `room_adult_recovering.png`: te same nastroje w pokoju gry
  (128 px, na stojąco): podpowiedź pozy ciała.
- Te same pozy powiększone 12× z siatką i numerami pikseli: `*_12x_grid.png` (czerwona linia = linia stóp y = 47).
- `approved_16_poses_5x.png`: cały zatwierdzony zestaw (wygląd postaci).

## Tekst do wklejenia

```
You are making tiny pixel-art sprites for PEPEGOCHI.EXE, a pet frog that STANDS on the top edge of a Windows 98
taskbar. The attached 48 x 48 PNGs are the poses already in the game. Everything you make is an EDIT of these files,
not a new drawing. This is one package with two parts. Do part 1 first: part 2 uses its results.

PART 1: SEVEN STANDING POSES (replace the sitting ones, same file names)
The frog must STAND in every adult pose, exactly like tb_adult_sit.png (which already stands).
Start each file from tb_adult_sit.png. Keep its legs, feet, shorts and the lower hoodie PIXEL FOR PIXEL, so the frog
never jumps when the pose changes. Change only the head, the face, the arms and the props as described.
  tb_adult_neglected.png: standing, shoulders hunched 1-2 px, sad big eyes, mouth down, arms hanging
                          (face from the current tb_adult_neglected.png; body idea: room_adult_neglected.png)
  tb_adult_packing.png:   standing, worried face, one hand holding the handle of the yellow suitcase that stands
                          on the floor next to the frog, the suitcase's bottom on y = 47 too (suitcase pixels from
                          the current tb_adult_packing.png; idea: room_adult_packing.png)
  tb_adult_recovering.png: standing, the small plaster on the head and the small smile of the current file
  tb_adult_talk.png:      standing, mouth open, one hand raised beside the head (from the current file)
  tb_adult_think.png:     standing, one hand at the chin, eyes looking up (from the current file)
  tb_adult_laugh.png:     standing, laughing, eyes squeezed shut, the little yellow laugh lines (from the current file)
  tb_adult_wave.png:      standing, waving one raised hand (from the current file)
No tail on any adult. Legs and feet identical to tb_adult_sit.png in all seven.

HARD RULES FOR BOTH PARTS (everything is checked by a script and played on top of the base pose; any drift shows as jitter)
1. Start every frame from its base file, pixel for pixel. Change ONLY the pixels the frame description names.
   Everything else (face, hoodie, the white P, shorts, legs, outline) stays exactly the same pixels.
2. Output: PNG, exactly 48 x 48, real transparent background, every pixel fully opaque or fully transparent,
   1 x 1 pixel grid, no anti-aliasing, no blur, no gradients, no text.
3. Colours: only colours that already exist in the base file. Allowed extras: white #fdfdfd and light grey
   #c0c0c0 (for a "z", a breath puff, a sweat drop), and the outline colour for motion lines.
4. Same canvas, same place. The feet stay on the line y = 47 (lowest row y = 46) in every frame, except the
   frames of "hop" that are in the air (described below). Never move the frog sideways unless the frame says so.
5. Do not deliver large images to be scaled down. Deliver the 48 x 48 files themselves, named exactly as listed,
   all files together in one zip, plus one contact sheet PNG for review.

PART 2: ANIMATION FRAMES (name: base file -> what changes)

wobble (4 frames, base tb_egg.png): the egg rocks on its bottom; the bottom row never moves.
  tb_wobble_01: upper half of the egg shifted 1 px left, top quarter 2 px left (a lean to the left)
  tb_wobble_02: back to upright, the face looks left (eyes 1 px left)
  tb_wobble_03: the same lean to the right (upper half 1 px, top quarter 2 px)
  tb_wobble_04: upright, the face looks right (eyes 1 px right)

bob (2 frames, base tb_adult_sit.png): breathing; legs and feet never move.
  tb_bob_01: head and hoodie 1 px up (breath in)
  tb_bob_02: head and hoodie 1 px down (breath out)

peek (4 frames, base tb_adult_sit.png): only the eyes change.
  tb_peek_01: pupils at the far left of the eyes
  tb_peek_02: pupils at the far right of the eyes
  tb_peek_03: pupils at the top of the eyes (looking up)
  tb_peek_04: a blink: the eyes are a closed line (outline colour)

hop (5 frames, base tb_adult_sit.png): a small jump straight up. The same frames are used when the frog jumps
out of the game window onto the taskbar.
  tb_hop_01: crouch: the whole frog 2 px lower with the legs 2 px shorter (bent); feet still on y = 47
  tb_hop_02: take-off: base height, legs straight, arms a little up
  tb_hop_03: in the air: the whole frog 6 px higher (top at y = 1), legs together, feet off the line
  tb_hop_04: landing: like tb_hop_01 but the arms out to the sides
  tb_hop_05: settle: base pose with the arms 1 px out (then the code shows the base pose again)

shuffle (4 frames, base tb_adult_sit.png): the frog shifts its seat along the edge.
  tb_shuffle_01: the whole frog 2 px left, feet on y = 47
  tb_shuffle_02: the whole frog 1 px left, the left foot lifted 1 px
  tb_shuffle_03: the whole frog 2 px right, feet on y = 47
  tb_shuffle_04: the whole frog 1 px right, the right foot lifted 1 px

greet (4 frames, base tb_adult_sit.png; the raised arm exactly as in your new standing tb_adult_wave.png):
  tb_greet_01: the right arm half raised (elbow out, hand at shoulder height)
  tb_greet_02: the arm up, the hand tilted left (copy the arm of tb_adult_wave.png)
  tb_greet_03: the arm up, the hand tilted right
  tb_greet_04: the arm half lowered again (like tb_greet_01)

nod (4 frames, base tb_adult_sleepy.png): dozing off.
  tb_nod_01: the head 1 px down, the eyes closed (a line)
  tb_nod_02: the head 2 px down, a small "z" (3 x 3 px, white with outline) next to the head
  tb_nod_03: the head snaps back to base height, the eyes wide open for a moment
  tb_nod_04: base head, half-closed eyes as in the base, the "z" 1 px higher and smaller

slouch (3 frames, base: your new standing tb_adult_neglected.png): a heavy sigh; legs and feet never move.
  tb_slouch_01: shoulders and head 1 px down
  tb_slouch_02: shoulders and head 2 px down, a small breath puff (light grey, 3-4 px) at the mouth
  tb_slouch_03: shoulders and head 1 px down, the puff gone

tremble (3 frames, base: your new standing tb_adult_packing.png): nervous next to the suitcase; THE SUITCASE NEVER MOVES.
  tb_tremble_01: the frog (not the suitcase) 1 px left
  tb_tremble_02: the frog 1 px right
  tb_tremble_03: the frog at base, a small sweat drop (light blue-white, 2 x 3 px) next to the head

Total: part 1 = 7 files, part 2 = 4 + 2 + 4 + 5 + 4 + 4 + 4 + 3 + 3 = 33 files. All 40 in one zip, plus one
contact sheet: the 7 new poses in a row, then each animation in its own row.
```

## Jak Claude to sprawdzi

0. Część 1: nogi, stopy i spodenki 7 nowych póz porównane piksel po pikselu z `tb_adult_sit.png` (muszą być
   identyczne), potem cały zestaw 16 póz na pasku do Twojej akceptacji.

1. `node scripts/pepegochi_art_qa.mjs tb_*.png`: 48 × 48, siatka 1 × 1, przezroczystość, kolory, linia stóp
   (klatki `tb_hop_03` w powietrzu sprawdzane bez linii stóp).
2. Porównanie z pozą bazową piksel po pikselu: zmienić się mogą tylko opisane części. Klatka, w której „przesunęło
   się” coś, co miało stać, wraca do poprawki.
3. Odtworzenie każdej animacji na pasku PondOS (pulpit i telefon), w tempie gry, i nagranie podglądu.
4. Dopiero po Twoim zatwierdzeniu: kod gra klatki zamiast dzisiejszych przesunięć CSS (te same 9 nazw ruchów).

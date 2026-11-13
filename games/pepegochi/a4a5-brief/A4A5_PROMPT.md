# PepeGochi A4 + A5: chód przy wyprowadzce i stany młodych żab, jedna paczka (dla ChatGPT)

Status: do wykonania. A1, A2 i A3 zatwierdzone i w grze (2026-11-13). Ta paczka dotyczy sprite'ów **w pokoju gry
(128 × 128)**, nie paska Start. Jedna paczka, dwie części; można oddawać w partiach, jak przy A3.

- **Część 1 (A4):** dorosła żaba wychodzi z pokoju z walizką: 6 klatek chodu w miejscu (dziś ta sama poza jest
  przesuwana, bez kroków).
- **Część 2 (A5):** kijanka i młoda żaba dostają własne stany (głodna, brudna, zła, zmęczona, zaniedbana, pakuje się,
  dochodzi do siebie) i własny chód przy wyprowadzce: 22 pliki. Dziś w tych stanach widać tylko szary filtr.

## Co dołączyć do ChatGPT (wszystko jest w paczce)

- `bazy_128px/`: pliki, które się EDYTUJE:
  - `base_tadpole.png`: kijanka z gry na czystej siatce 2 × 2 (wycięta z zatwierdzonej klatki wyklucia `hatch_04`),
  - `pepegochi_froglet_idle.png`: młoda żaba z gry,
  - `depart_01.png`: dorosła żaba obrócona w prawo z walizką (dzisiejsza klatka wyprowadzki),
  - `pepegochi_adult_recovering.png`: wzór poprawnej litery P na bluzie,
  - `suitcase.png`: żółta walizka (wzór koloru).
- `*_5x_grid.png`: te bazy powiększone 5× z siatką (jeden kwadrat = jeden „piksel” 2 × 2, czerwona linia = stopy
  y = 124, zielona = środek x = 60).
- `nastroje_wzor/`: te same nastroje u dorosłej żaby (emocje i rekwizyty do przeniesienia na młode).

## Tekst do wklejenia

```
You are making pixel-art sprites for the ROOM of PEPEGOCHI.EXE (a pet frog game in a Windows 98 style site).
These are 128 x 128 sprites, not the 48 x 48 taskbar ones. Everything is an EDIT of the attached base files,
not a new drawing. One package, two parts; you may deliver it in batches.

RULES FOR BOTH PARTS
1. PNG, exactly 128 x 128, real transparent background, every pixel fully opaque or fully transparent.
2. Pixel art on a 2 x 2 grid: every art pixel is a 2 x 2 block starting at even x and y. At most 64 colours.
   No anti-aliasing, no blur, no gradients, no text (except the white P on a hoodie).
3. Start each file from its base in bazy_128px/, pixel for pixel. Same size, same place, same face style.
   Change ONLY what the description says. The feet (or the tadpole's belly) stand on the line y = 124:
   the lowest visible row is y = 123.
4. Colours only from the base files and the reference files; the suitcase is the yellow of suitcase.png.
5. The white P on any hoodie is the clean upright P of pepegochi_adult_recovering.png.
6. No loose pixels. Deliver exactly 128 x 128 files named as listed, in a zip, plus a contact sheet PNG.

PART 1: THE ADULT WALKS OUT WITH ITS SUITCASE (base depart_01.png)
The frog walks IN PLACE: its body stays centred on x = 60 in every frame (the game moves it across the room).
Replace the brown suitcase of depart_01.png with the yellow suitcase of suitcase.png, held in the right hand.
Fix the P on the hoodie (copy it from pepegochi_adult_recovering.png). Sad face, as in depart_01.png.
  depart_turn_01.png: facing the viewer like the room idle frog, picking up the suitcase (suitcase on the floor)
  depart_turn_02.png: turned to the right (3/4 view, as depart_01.png), suitcase in the right hand
  depart_walk_01.png: step: left leg forward, right leg back
  depart_walk_02.png: legs together, the whole body 2 px higher (one 2 x 2 row)
  depart_walk_03.png: step: right leg forward, left leg back
  depart_walk_04.png: legs together, the whole body 2 px higher
  In every walk frame: the same head, hoodie, suitcase and arm; only the legs and the 2 px bounce change.

PART 2: THE YOUNG FROGS' STATES
Tadpole (base base_tadpole.png; the same size and place, belly on y = 124; it has no hoodie):
  pepegochi_tadpole_hungry.png:     sad eyes, mouth down, a small empty bowl next to it
  pepegochi_tadpole_dirty.png:      a few mud spots, a tiny fly near the head
  pepegochi_tadpole_moody.png:      frowning eyebrows, mouth down
  pepegochi_tadpole_tired.png:      half-closed eyes
  pepegochi_tadpole_neglected.png:  sad big eyes, a small tear, head a little lower
  pepegochi_tadpole_packing.png:    worried face, a tiny yellow suitcase next to it
  pepegochi_tadpole_recovering.png: a small plaster on the head, a small smile
  (the tail tip of base_tadpole.png lacks its outline on the far left: add the dark outline there)
Froglet (base pepegochi_froglet_idle.png; same size and place, feet on y = 124, small tail, hoodie with P):
  pepegochi_froglet_hungry.png, pepegochi_froglet_dirty.png, pepegochi_froglet_moody.png,
  pepegochi_froglet_tired.png, pepegochi_froglet_neglected.png, pepegochi_froglet_packing.png (a small yellow
  suitcase in its hand), pepegochi_froglet_recovering.png: the same emotions and props as the adult ones in
  nastroje_wzor/, on the froglet's own face and body.
Young frogs walking out (in place, like part 1; the game moves them):
  froglet_depart_walk_01..04.png (base pepegochi_froglet_idle.png turned to the right with the small yellow
  suitcase): left leg forward / legs together 2 px up / right leg forward / legs together 2 px up
  tadpole_depart_01..04.png (base base_tadpole.png facing right, a tiny yellow suitcase held in its mouth):
  tail up / tail level / tail down / tail level, the body 2 px up in frames 02 and 04

Total: part 1 = 6 files, part 2 = 14 + 8 = 22 files.
```

## Jak Claude to sprawdzi

1. `node scripts/pepegochi_art_qa.mjs plik.png` (128 × 128, siatka 2 × 2, przezroczystość, kolory, linia stóp) oraz
   `--like=` z bazą: to samo miejsce i ta sama wielkość.
2. Porównanie z bazą piksel po pikselu: przy chodzie głowa, bluza i walizka nie mogą się ruszać, tylko nogi
   i podskok 2 px; przy stanach młodych tylko twarz i rekwizyty.
3. Podgląd w pokoju 640 i 360 px: każdy stan kijanki i młodej żaby, wyprowadzka dorosłej i młodych klatka po klatce.
4. Dopiero po Twoim zatwierdzeniu: podpięcie w grze (kod jest gotowy: nowe stany i chód wchodzą bez zmian logiki).

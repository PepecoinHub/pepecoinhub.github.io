# PepeGochi A6: animacje opieki w pokoju (jedzenie, mycie, zabawa, sen), jedna paczka (dla ChatGPT)

Status: do wykonania. A1–A5 zatwierdzone i w grze (2026-11-13). Dotyczy sprite'ów **w pokoju gry (128 × 128)**.
Po zaakceptowanej opiece (Feed, Clean, Play, Rest) żaba odgrywa krótką animację, potem wraca do swojej pozy.
Dziś po opiece widać tylko napis „Feed: done.”. Kod jest gotowy: klatki wchodzą bez zmian w logice.

Jedna paczka, trzy części, można oddawać w partiach:
- **Część 0:** jedna baza dorosłej żaby bez plastra (`base_adult_care.png`).
- **Część 1 (A6):** dorosła żaba, 4 czynności × 4 klatki = 16.
- **Część 2 (A6b):** kijanka i młoda żaba, 4 czynności × 4 klatki × 2 = 32.

## Co dołączyć do ChatGPT (wszystko jest w paczce)

- `bazy_128px/`: `pepegochi_adult_recovering.png` (z niej powstaje baza dorosłej), `pepegochi_adult_hungry.png` i
  `pepegochi_adult_dirty.png` (wzór miski i błota), `pepegochi_froglet_idle.png`, `base_tadpole.png`,
  `pepegochi_tadpole_moody.png` (wzór poprawnie zamkniętego konturu ogona kijanki).
- `*_5x_grid.png`: bazy powiększone 5× z siatką 2 × 2 (czerwona linia = stopy y = 124).
- `wzor_ruchu/pr226_care_storyboards.png`: stare szkice tych czynności. **Tylko podpowiedź ruchu**: są kreskówkowe
  i bez litery P, styl brać z baz.

## Tekst do wklejenia

```
You are making short care animations for the ROOM of PEPEGOCHI.EXE, a pixel-art pet frog game in a Windows 98 style
site. Sprites are 128 x 128 (room size, not the 48 x 48 taskbar). Everything is an EDIT of the attached base files,
not a new drawing. One package, three parts; you may deliver it in batches.

RULES FOR ALL PARTS
1. PNG, exactly 128 x 128, real transparent background, every pixel fully opaque or fully transparent.
2. Pixel art on a 2 x 2 grid (every art pixel is a 2 x 2 block at even x and y), at most 64 colours, no
   anti-aliasing, no blur, no gradients, no text except the white P on a hoodie.
3. Start every frame from its base file, pixel for pixel: same size, same place, same face style. The feet (or the
   tadpole's belly) stay on the line y = 124 (lowest visible row y = 123), except the play jump frame.
4. Legs, feet and shorts never move except in the play jump frame. Change only the arms, the face and the props.
5. Colours only from the base files; props may add a few colours (bowl, soap, foam, ball, "z").
6. No loose pixels except small separate effects: bubbles, sparkles, "z", motion lines.
7. Deliver files named exactly as listed, all in a zip, plus one contact sheet (each animation in a row, base first).

PART 0: THE ADULT BASE
  base_adult_care.png: pepegochi_adult_recovering.png with the plaster removed (fill it with the head's own green and
  outline) and the same small smile. Nothing else changes. Every adult frame below starts from this file.

PART 1: ADULT CARE ANIMATIONS (base base_adult_care.png, 4 frames each)
feed:
  care_feed_01.png: holds a small bowl with three flies in both hands at chest height (bowl like the one in
                    pepegochi_adult_hungry.png, but full)
  care_feed_02.png: one hand lifts a fly towards the mouth
  care_feed_03.png: eating: mouth closed, cheeks puffed out
  care_feed_04.png: happy wide smile, the bowl empty
clean:
  care_clean_01.png: holds a small white soap bar
  care_clean_02.png: white foam on the belly (over the hoodie, the P still visible)
  care_clean_03.png: foam and 2-3 round bubbles on the head
  care_clean_04.png: clean, a small white sparkle next to the head, happy face
play:
  care_play_01.png: a red-blue-yellow ball at the feet
  care_play_02.png: tosses the ball: ball at head height, arms up
  care_play_03.png: jumps for joy: the whole frog 6 px higher (three 2 x 2 rows), ball above the head
  care_play_04.png: back on the line y = 124, catches the ball, big smile
rest:
  care_rest_01.png: yawns: mouth wide open, eyes half closed
  care_rest_02.png: eyes closing (a thin line)
  care_rest_03.png: sleeping standing up, eyes closed, a small white "z" next to the head
  care_rest_04.png: sleeping, a bigger "Zz"

PART 2: YOUNG FROGS' CARE ANIMATIONS (the same 4 actions and 4 frames, same ideas, smaller props)
Tadpole (base base_tadpole.png; close the outline of the tail tip as in pepegochi_tadpole_moody.png; no hands:
the tadpole uses its mouth and tail, the props lie next to it):
  care_tadpole_feed_01..04.png, care_tadpole_clean_01..04.png, care_tadpole_play_01..04.png,
  care_tadpole_rest_01..04.png
  (play_03: the tadpole hops 4 px up; everything else stays on y = 124)
Froglet (base pepegochi_froglet_idle.png, with its small tail and hoodie with the P):
  care_froglet_feed_01..04.png, care_froglet_clean_01..04.png, care_froglet_play_01..04.png,
  care_froglet_rest_01..04.png
  (play_03: the froglet jumps 4 px up)

Total: part 0 = 1, part 1 = 16, part 2 = 32 files.
```

## Jak Claude to sprawdzi

1. `node scripts/pepegochi_art_qa.mjs` (128 × 128, siatka 2 × 2, przezroczystość, kolory, stopy na y = 124).
2. Porównanie z bazą piksel po pikselu: nogi, stopy i spodenki stoją we wszystkich klatkach poza skokiem.
3. Odtworzenie każdej czynności w pokoju po kliknięciu Feed, Clean, Play i Rest, na pulpicie i telefonie.
4. Dopiero po Twoim zatwierdzeniu: podpięcie w grze.

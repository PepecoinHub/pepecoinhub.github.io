# PepeGochi A2: 16 póz żaby na pasek Start (dla ChatGPT)

Status: do wykonania. A1 zatwierdzone przez właściciela 2026-11-13.
Pełny backlog: `games/pepegochi/CHATGPT_ART_BACKLOG.md` (sekcja A2). Claude sprawdza każdy plik skryptem
`node scripts/pepegochi_art_qa.mjs plik.png` (rozmiar, przezroczystość, kolory, linia stóp) i oglądem na pasku.

## Co dołączyć do ChatGPT

- `docs/games/img/pepegochi/pepegochi_adult_idle.png` (wzorzec twarzy i stroju)
- `docs/games/img/pepegochi/pepegochi_adult_hungry.png`, `pepegochi_adult_dirty.png`, `pepegochi_adult_recovering.png`,
  `pepegochi_adult_moody.png`, `pepegochi_adult_tired.png`, `pepegochi_adult_neglected.png`, `pepegochi_adult_packing.png`
  (emocje dla póz 5–11)
- `docs/games/img/pepegochi/pepegochi_egg_idle.png`, `pepegochi_tadpole_idle.png`, `pepegochi_froglet_idle.png`
- `docs/games/img/pepegochi/goodbye_envelope.png`, `suitcase.png`
- `games/pepegochi/a2-brief/tb_slot_guide_10x.png`: siatka 48×48 powiększona 10×. Czerwona linia = linia stóp
  y = 47, różowy pas = ostatni widoczny rząd (y = 46), zielona = środek x = 24, niebieska ramka = obszar postaci
  dorosłej (ok. 40 px wysokości), niebieskie „P” = kształt litery 3×5 px.
- `games/pepegochi/a2-brief/taskbar_today_pr299.png`: dzisiejszy pasek Start (jajo obok przycisku Start), żeby było
  widać skalę: żaba jest mniej więcej tak wysoka jak przycisk Start.

## Wnioski z A1 (ważne)

- Pierwsza wersja A1 przyszła jako obrazy 1254×1254 i z innym stylem twarzy. Odrzucona. **Oddaj od razu pliki
  48×48**, nie duże obrazy do zmniejszenia.
- Ta sama żaba co w grze: szeroko otwarte oczy i uśmiech jak w `adult_idle`, niebieska bluza z białym „P”,
  **brązowe spodenki**. Nie przymknięte powieki, nie inny charakter.
- Jajo ma **zielone** plamki, jak `egg_idle`.

## Tekst do wklejenia

```
You are drawing tiny taskbar sprites for PEPEGOCHI.EXE, a pixel-art pet frog in a Windows 98 style site.
The frog sits on the Start bar next to the Start button. It is THE SAME frog as the attached
pepegochi_adult_idle.png: same face (wide-open eyes, Pepe smile), blue hoodie with a white P, brown shorts,
green skin, dark green outline. Do not change its character or face style.

FORMAT (every file)
- PNG, exactly 48 x 48 px. Deliver the 48 x 48 file itself, not a large image to be scaled down.
- Real transparent background (no white, black or checkerboard), every pixel fully opaque or fully transparent.
- 1 x 1 pixel grid (like a Windows 98 icon), at most 32 colours, 1 px dark green outline, no anti-aliasing,
  no gradients, no text except the white P on the hoodie.
- The figure stands or sits on the line y = 47: its lowest visible row of pixels is y = 46.
- Body centred on x = 24. Adult about 40 px tall (top near y = 7). Use the attached grid guide.
- White P on the hoodie: 3 x 5 px, upright, the shape shown in the guide.
- One sprite per file, never a sheet. File names exactly as listed.

FILES
1  tb_egg.png              the egg from pepegochi_egg_idle.png (green spots), about 30 px tall, the little face peeking
2  tb_tadpole.png          the tadpole from pepegochi_tadpole_idle.png, lying down, about 24 px tall, tail to the left
3  tb_froglet.png          the young frog from pepegochi_froglet_idle.png sitting, small tail visible, about 34 px tall
4  tb_adult_sit.png        adult sitting, legs hanging down, calm smile like adult_idle
5  tb_adult_hungry.png     sitting, both hands on the belly, sad eyes (like adult_hungry)
6  tb_adult_dirty.png      sitting, mud spots, a tiny fly near the head (like adult_dirty)
7  tb_adult_moody.png      sitting, arms crossed, sulking (like adult_moody)
8  tb_adult_sleepy.png     sitting, eyes half closed, head a little down (like adult_tired)
9  tb_adult_neglected.png  hunched, knees up, sad (like adult_neglected)
10 tb_adult_packing.png    sitting on the yellow suitcase from suitcase.png, worried (like adult_packing)
11 tb_adult_recovering.png sitting, small plaster on the head, small smile (like adult_recovering)
12 tb_adult_talk.png       sitting, mouth open, one hand raised (telling a fact)
13 tb_adult_think.png      sitting, hand at the chin, eyes looking up ("Did you know?")
14 tb_adult_laugh.png      sitting, laughing, eyes squeezed shut
15 tb_adult_wave.png       sitting, waving one hand
16 tb_letter.png           only the envelope from goodbye_envelope.png lying flat, about 14 px tall, no frog
```

## Jak Claude to sprawdzi

1. `node scripts/pepegochi_art_qa.mjs docs/games/img/pepegochi/taskbar/tb_*.png` (format B: 48×48, siatka 1×1,
   do 32 kolorów, linia stóp 47, brak półprzezroczystości).
2. Porównanie obok siebie: 16 póz w skali 1:1, 2× i 4× na tle paska Windows 98.
3. Zrzut paska PondOS z PR #299 (pulpit 1280 px i telefon 360 px) z każdą pozą, w jasnym i ciemnym motywie.
4. Dopiero po zatwierdzeniu: podpięcie póz w PR pomocnika na pasku (dziś PR #299 zmniejsza sprite 128 px do 42 px).

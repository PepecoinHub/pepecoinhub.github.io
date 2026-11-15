# Pond Quiz: 5 stempli Paszportu za poprawne odpowiedzi (dla ChatGPT)

Status: ZROBIONE. Grafiki ChatGPT zatwierdzone przez właściciela 2026-11-15, w atlasie `stamps-v3.webp` (kafelki 49-53).
Kod jest gotowy (`games/supabase/update_pond_quiz.sql`, katalog `docs/meme/passport-catalog.json`, status `planned`).
Dopóki stempel nie ma zatwierdzonego rysunku, Paszport pokazuje neutralne „?” (jak każdy stempel bez grafiki).

## Co dołączyć do ChatGPT

- `wzory/*.png`: 8 zatwierdzonych stempli z Paszportu (styl, ramka, podpis na dole).
- `wzory_razem_2x.png`: te same obok siebie, powiększone 2×.

## Tekst do wklejenia

```
You are drawing 5 new stamps for the FREN PASSPORT of PondOS 98 (a Pepecoin fan site). They must look like they
belong to the same set as the attached approved stamps (wzory/*.png): the same perforated cream stamp frame, a
dark outline, a bright scene inside, and a rounded label strip at the bottom with the stamp's name in the same bold
dark font. Pepe the frog in the same cartoon style as the attached stamps (green skin, big eyes, red-brown lips).
No other text inside the scene, no logos, no real people.

Theme: the Pond Quiz. Every day the little frog that stands on the Windows 98 taskbar asks one Pepecoin question;
each right answer is one point. The stamps mark 1, 10, 25, 50 and 99 right answers, so they should feel like a
journey that grows bigger and more epic from stamp to stamp.

1. quiz_first.png, label "Here We Go!" (1 right answer): Pepe excited at a small school desk, raising his hand,
   a speech bubble with a big "?" next to him. Light, cheerful colours (like First Hatch).
2. quiz_10.png, label "Is That a Lot?" (10 right answers): Pepe shrugging with a cheeky, unsure smile, holding up
   a small sign with "10", a few floating question marks around. Funny, a little ironic.
3. quiz_25.png, label "Pond Scholar" (25): Pepe in round glasses and a graduation cap, reading a big book on a lily
   pad, a stack of books beside him.
4. quiz_50.png, label "Halfway Hopper" (50): Pepe mid-jump between two lily pads over a pond, a little flag with
   "50" on the far pad, the path of pads continuing into the distance.
5. quiz_99.png, label "Keeper of the Pond" (99, all questions: the EPIC one): Pepe in a long wizard-like robe
   with a gold "P" medallion, standing on a glowing lily pad in the middle of a night pond, holding a lantern; a
   golden frame of light, fireflies, the moon reflected in the water. The richest, most impressive stamp of the
   five, gold accents on the frame, but the same stamp shape and size as the others.

Output: 5 PNG files with a transparent background outside the stamp, each the same proportions as the attached
stamps (portrait, about 138 x 150 at 1x; deliver at 4x, 552 x 600), named exactly as above, in one zip, plus one
contact sheet with the 5 stamps next to the attached ones.
```

## Jak Claude to sprawdzi

1. Proporcje, przezroczyste tło, ramka i podpis zgodne z zatwierdzonymi stemplami; podgląd obok nich w Paszporcie.
2. Po zatwierdzeniu przez właściciela: pliki do `games/fren-passport/source/stamps-new/`, dopisanie 5 nazw do
   `scripts/build_v3_stamps.py` i `PP_V3` w `docs/meme/meme.js`, przebudowa `stamps-v3.webp`.

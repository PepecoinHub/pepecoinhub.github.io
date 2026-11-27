# Fren Passport: art spec for ChatGPT

Everything ChatGPT (or an artist) has to draw for the Fren Passport, what each picture is for, and the rules
that make it fit the art we already have. The Passport, the album, the stamp rules and the Avatar Maker
already exist in code; only these pictures are missing.

Status: v3, 2026-11-08. **Everything in this document is confirmed by the owner.** Only §13 and §14 are
optional.

## 0. What to draw (36 pictures, plus 6 optional)

| What | How many | Where it appears | Section |
|---|---|---|---|
| Stamps | 29 new + 1 label edit | Fren Passport: album (34–64 px wide), main page (about 78 px), "new stamp" notice | §1–§9 |
| Special avatars | 4 | Avatar Maker, Special row; the photo in the Passport | §10 |
| The Secret Pond wallpaper | 1 | PondOS desktop background, after the Lost Pond Files are solved | §11 |
| BALI postmark | 1 | The BALI card on the Passport page, once PEP reaches $0.01 | §12 |
| PEP-TV hosts (optional) | 2 | The teleshopping and quiz-show ads | §13 |
| Redraw of 4 AI concepts (optional) | 4 | Album | §14 |

**Order of work:** stamp batch 1 (main page) → batch 2 → special avatars → batch 3 → wallpaper and postmark
→ batch 4.

**How to work with ChatGPT:**
1. Start a chat and attach the reference images of the section you are working on (§1, §10, §11 or §12).
2. Paste the section's rules once (for stamps: §2 to §8).
3. Ask for **one stamp per image** with the prompt from §15 and one card from §9. For batches 3 and 4 three
   stamps on one sheet also work.
4. Check every picture against the list in §8. If the label is misspelled, ask again, or ask for the same
   stamp with an empty label (the build writes the text).

**Where the files go:** upload the PNGs on GitHub (Add file → Upload files) into the folder named in each
section, with the file names from the cards, then tell Kiro. Kiro cuts, scales and wires them in.

## 1. Stamp reference images (attach them every time)

- [sheet 1](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/games/fren-passport/source/stamps-lily/sheet-1-pioneer-welcome-guesser-week-scout-words.png): Pond Pioneer, Welcome Back!, Pepe Guesser, Week Scout, Scout Fren, First Words
- [sheet 2](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/games/fren-passport/source/stamps-lily/sheet-2-pepegochi-14day-icon.png): First Hatch, Little Fren, One Small Step, 14-Day Streak
- [sheet 3](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/games/fren-passport/source/stamps-lily/sheet-3-mentions-editors-miner.png): Hey @Fren, Dear Editor, Junior Editor, Senior Editor, Rookie Miner
- [the strip](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/meme/passport-assets/stamps-lily.webp): all 15 in one row, as the site shows them

These 15 stamps by Lily are the style to match. The five AI concepts in PR #230 (`stamps-custom-v1`) are
**not** the reference: they use a cream label, a navy "P" hoodie and different background colours.

## 2. The stamp frame (the same on every stamp)

| Part | Rule |
|---|---|
| Shape | Portrait postage stamp, width : height about 7 : 8. Everything outside the stamp is transparent. |
| Perforated edge | Round scallops: **7 along the top and the bottom, 8 along each side**. Black outline, about 2% of the stamp width. |
| Paper | Flat cream `#FCEDD5`. |
| Picture window | A rectangle inside the paper with a thick black frame (about 1.5% of the stamp width). Paper margin about 6% of the height at the top and 3 to 4% of the width at the sides. |
| Name label | Rounded rectangle, warm grey `#C7BEAF`, black outline. About 11 to 12% of the stamp height and 80% of its width, centred, lying across the bottom edge of the picture window, with a strip of cream paper below it. |
| Label text | Exactly the text on the card. One line, bold simple sans-serif, near-black `#1E1E1E`, Title Case. |

## 3. Pepe on stamps

Draw the stamp Pepe from the references, **not** the Avatar Maker Pepe (that one is muted olive):

- skin bright green `#67A739` (highlight `#70B235`), black outlines;
- big white eyes `#FCFCFD` with black pupils, the classic Pepe brow folds;
- wide red lips `#E05050` with a lighter inner part;
- a happy expression unless the card says otherwise;
- a big head: about a third of the picture height or more, so he is still recognisable on a small stamp.

Outfits by family:
- **Pepe Guesser, Pond and secrets stamps:** the explorer outfit from the references: khaki `#DBAF63` pith
  helmet with a small frog badge, khaki shirt, yellow neckerchief, brown backpack.
- **YEET THE PEP stamps:** the pilot from the game
  ([pilot.webp](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/games/img/yeet/pilot.webp)):
  red crash helmet with goggles on top, blue T-shirt, grey shorts, red sneakers. No space suit (One Small
  Step already has one).
- **Everything else:** whatever the card says.

## 4. Colour and drawing style

- Thick black outlines and flat fills. At most one flat shadow tone per colour.
- No gradients, glow, airbrush, texture, 3D, glossy highlights or photo look.
- One flat background colour per stamp, plus simple scenery: clouds, hills, water, stars, a Win98-style
  window or a beige CRT monitor.
- Background palette (each card names one):
  sky blue `#4BA6F8`, blue `#4F84EA`, royal blue `#3052D3`, purple `#9C6DE0`, yellow `#FDD236`,
  light green `#9FD480`, navy `#1D266E`.
- Signature motif: 2 or 3 short yellow "spark" strokes (`#FDD236` with a black outline) near Pepe's head.
- At most one short word or number inside the picture, and only when the card asks for it (like the "7" on
  Week Scout's calendar or the "hi" bubble on First Words). Any other "writing" is drawn as grey stripes.

## 5. Small size

The album shows a stamp 34 to 64 px wide; the main page about 78 px (the tile on the site is 138×150 px).
Use one clear subject, one or two props and big shapes. Zoom out to 10%: if you can no longer tell what the
stamp is about, simplify.

## 6. Not allowed

- Real logos and trademarks (NASA, Discord, X/Twitter, Reddit, Windows, McDonald's), real people, a
  celebrity look.
- Other coins or tokens, prices, "$" signs, money bags.
- Realistic weapons, blood, alcohol, smoking. (Pixel shots on a retro arcade screen are fine.)
- The Avatar Maker's olive Pepe, or the navy "P" hoodie from PR #230.
- Gold frames, grey "locked" versions or "?" stamps: the site makes those (§7).
- Counters like "×2" or years: the site adds them on top of the stamp.
- Any text except the label and the one word or number from the card.

## 7. Gold (rare) stamps

Six stamps are rare and their card says **gold**: Moonwalker, Frog of the Week, Season Champion, Vox Populi,
Certified Fren and The Secret Pond. Draw them exactly like the others: cream paper, grey label. The build
recolours the paper to gold, the label to cream and adds a small glint, so all gold stamps match
([gold-frame-demo.jpg](stamps-review/gold-frame-demo.jpg)).

## 8. Stamp delivery and check

- Transparent PNG, **one stamp per image**: the stamp at least 900 px tall, centred, nothing else in the
  picture. (Batches 3 and 4 may come as a sheet of 3, at least 40 px apart; say the ids from left to right.)
- File name: `<stamp_id>.png` (the id from the card).
- Folder: `games/fren-passport/source/stamps-new/`.

Check every stamp before you keep it:
1. The label text is spelled exactly as on the card.
2. The frame: 7 + 8 scallops, cream paper, grey label, black outlines.
3. One flat background colour from the card, no gradients.
4. Pepe looks like the reference Pepe and is still recognisable at 10% zoom.
5. Nothing from §6 is in the picture.
6. Everything outside the stamp is transparent.
7. Next to the strip from §1, it looks like part of the same set.

## 9. Stamp cards

**Rule** says what the player did, so the picture fits. Never write the rule on the stamp.

### The main page

The Passport's main page shows 12 stamps in a 4 × 3 grid above the big BALI card
([main-page-mock.jpg](stamps-review/main-page-mock.jpg)).
The background colours are chosen so neighbours differ; keep them.

| | Column 1 | Column 2 | Column 3 | Column 4 |
|---|---|---|---|---|
| Row 1 | Pond Pioneer (exists, sky blue) | Frog of the Week (purple) | Season Champion (royal blue) | Vox Populi (light green) |
| Row 2 | Moonwalker (navy) | Certified Fren (yellow) | Old Frog (light green) | The Secret Pond (navy) |
| Row 3 | Scout Fren (exists, sky blue) | Detective Fren (purple) | Picasso Fren (yellow) | Good Parent (light green) |

### Batch 1: the main page (10 stamps, draw these first)

**`frog_of_the_week`**, label **"Frog of the Week"**, gold
- Rule: first place of the week in Pepe Guesser (Monday to Sunday, UTC). It can be won again; the site
  shows ×2, ×3 on top.
- Scene: an "employee of the month" joke. Explorer Pepe proudly holds up a big gold trophy cup with **1** on
  it. Behind him, a framed portrait of himself hangs on the wall with a gold ribbon. A map pin and a small
  globe on the desk. Big proud smile, spark lines.
- Background: purple `#9C6DE0`.
- Avoid: podium steps (Podium), a laurel wreath (Season Champion).

**`season_champion`**, label **"Season Champion"**, gold
- Rule: first place at the end of a ranked Pepe Pictures season. It can be won again (×2, ×3 on top).
- Scene: Pepe wearing a laurel wreath and a plain red sash lifts a big gold cup with both hands under a
  spotlight. Confetti falls.
- Background: royal blue `#3052D3`.
- Avoid: the explorer outfit and the framed portrait (Frog of the Week), podium steps, text on the sash.

**`vox_populi`**, label **"Vox Populi"**, gold
- Rule: 10 of your letters printed in the Pond Gazette ("vox populi" is Latin for "the voice of the people").
- Scene: Pepe stands on a wooden soapbox and speaks through a megaphone. Behind him a giant newspaper front
  page with the masthead **GAZETTE**. A small crowd of frog heads cheers with raised hands.
- Background: light green `#9FD480`.

**`moonwalker`**, label **"Moonwalker"**, gold
- Rule: a YEET flight of the full 6000 m. Very rare.
- Scene: the YEET pilot (§3) has been thrown all the way to the Moon. He lands on the grey surface doing a
  backwards-sliding dance step. A dotted flight arc leads back to a small Earth in the corner. A tiny sign
  **6000 m** sticks out of the moon dust.
- Background: navy `#1D266E` with stars.
- Avoid: astronaut suit and helmet (One Small Step), any celebrity look (no fedora, no white glove).

**`certified_fren`**, label **"Certified Fren"**, gold
- Rule: active in PondOS on 100 different days (not in a row).
- Scene: Pepe in a graduation cap and gown holds a framed certificate with a red wax seal and a big **100**.
  Small calendar pages fly around him.
- Background: yellow `#FDD236`.

**`old_frog`**, label **"Old Frog"**
- Rule: one year since joining.
- Scene: grandpa Pepe with bushy white eyebrows and moustache, round glasses, a cardigan and a walking cane,
  in a rocking chair. A cupcake with **one** candle on a small table.
- Background: light green `#9FD480`.

**`the_secret_pond`**, label **"The Secret Pond"**, gold
- Rule: put together the six-piece map of the Lost Pond Files.
- Scene: explorer Pepe holds up an old map made of six torn pieces (the seams show) with a red X. Behind him
  a hidden moonlit pond with glowing lily pads, fireflies and a small blank wooden sign. Amazed, excited face.
- Background: navy `#1D266E`.

**`detective_fren`**, label **"Detective Fren"**
- Rule: a perfect 5000 in Pepe Guesser on 5 different days. It unlocks the detective hat and suit.
- Scene: Pepe in a deerstalker hat and a brown detective suit with a tie (the same parts as in the Avatar
  Maker) holds a magnifier over a photo pinned to a cork board, with red string to a map pin.
- Background: purple `#9C6DE0`.

**`picasso_fren`**, label **"Picasso Fren"**
- Rule: other players guessed 10 of your drawings in Draw & Guess.
- Scene: Pepe with a red beret and a paint palette stands by an easel with a wobbly, funny drawing of a sun.
  A white speech bubble from outside the picture holds a big green check mark: someone guessed it.
- Background: yellow `#FDD236`.

**`good_parent`**, label **"Good Parent"**
- Rule: 30 days of good PepeGochi care.
- Scene: grown-up Pepe in a cosy apron hugs a small froglet (like Little Fren). A heart above them, a
  feeding bowl, a small calendar with **30**.
- Background: light green `#9FD480`.

### Batch 2: live stamps that have no drawing of their own (2 stamps and 1 label edit)

**`like_it_here`**, label **"30-Day Streak"**
- Rule: opened PondOS on 30 days in a row. (The stamp is called Guess You Like It Here; that name is too long
  for the label and stays in the Passport.)
- Scene: Pepe at home in PondOS, sunk into a comfy armchair with his feet up, fluffy slippers, the explorer
  neckerchief, a mug with a frog on it. Next to him a beige CRT monitor with a small Win98 window. On the
  wall a tear-off calendar with a big red **30**. Relaxed, happy, eyes half closed.
- Background: light green `#9FD480`.
- Avoid: binoculars and a globe (14-Day Streak).

**`nasa_is_hiring`**, label **"NASA Is Hiring"**
- Rule: three YEET THE PEP flights above 5000 m.
- Scene: the YEET pilot (§3) soars very high in a superhero pose. Next to him floats a poster with a small
  rocket drawing and three green check marks, no text. A small altitude sign **5000 m**. The curve of the
  Earth far below.
- Background: royal blue `#3052D3` with a few white stars at the top.
- Avoid: any real NASA logo, space suits, the Moon close up.

**`rookie_miner`**, label **"Happy Mining!"** (a label edit, not a new drawing)
- Rule: started Pepe Miner (its first cloud save). It replaces Rookie Miner (10 minutes) and Miner Fren
  (1 hour), and it unlocks the hard hat.
- Task: attach sheet 3 and ask: "Keep this Rookie Miner stamp exactly as it is. Only replace the label text
  'Rookie Miner' with 'Happy Mining!' in the same lettering." If the result changes anything else, skip it:
  the build can rewrite the label.

### Batch 3: new stamps whose data the server already keeps (12)

**`i_voted`**, label **"I Voted"**
- Rule: voted in a Pond Poll.
- Scene: Pepe drops a folded ballot with a green check mark into a wooden ballot box. A round check-mark
  sticker on his chest. Proud smile.
- Background: yellow `#FDD236`.

**`yeet_adept`**, label **"Adept"**
- Rule: a YEET flight of 3000 m. It unlocks the Sunset avatar background.
- Scene: the YEET pilot (§3) has just been launched from a giant wooden slingshot and flies up through
  fluffy clouds, excited. A small altitude sign **3000 m**. Birds below him.
- Background: sky blue `#4BA6F8` with white clouds.
- Avoid: stars and space (the higher YEET stamps).

**`good_game`**, label **"Good Game"**
- Rule: finished a board game (chess, checkers, Connect Four or Sea Battle) with another fren.
- Scene: two Pepes shake hands across a small table with a chessboard and a Connect Four grid. One wears the
  explorer hat, the other a backwards blue cap, so they are easy to tell apart.
- Background: royal blue `#3052D3`.

**`checkmate`**, label **"Checkmate!"**
- Rule: won a game of chess against a fren.
- Scene: the classic smug Pepe (half-closed eyes, satisfied smirk) leans back with his arms crossed. On the
  board in front of him the black king lies tipped over next to his white queen. Spark lines.
- Background: purple `#9C6DE0`.

**`podium`**, label **"Podium"**
- Rule: top 3 in a Pepe Pictures quiz night or a Draw & Guess game.
- Scene: Pepe cheers on the second step of a plain three-step podium (no numbers) with a silver medal; two
  small frogs on the other steps clap. Behind them a quiz screen with a big blocky pixelated picture (Pepe
  Pictures starts with giant pixels).
- Background: sky blue `#4BA6F8`.

**`game_night`**, label **"Game Night"**
- Rule: played in a scheduled PEP Games night.
- Scene: three Pepes on a couch in front of a glowing CRT, party hats, a bucket of popcorn, a wall clock at
  8 o'clock, a crescent moon in the window. One of them cheers.
- Background: navy `#1D266E`.

**`top_ten`**, label **"Top 10"**
- Rule: a place on any LEADERS top 10.
- Scene: Pepe points proudly at a Win98-style window with a list of grey rows; one row is highlighted green
  with a gold star. A ribbon badge with **10**.
- Background: light green `#9FD480`.

**`arcade_hopper`**, label **"Arcade Hopper"**
- Rule: a score recorded in 5 different PondOS games. It unlocks the headphones in the Avatar Maker.
- Scene: Pepe in the middle of a frog jump, wearing big over-ear headphones, between five floating game
  icons: a joystick, a pickaxe, a map pin, a small rocket and a chess pawn.
- Background: blue `#4F84EA`.

**`quiz_master`**, label **"Quiz Master"**
- Rule: hosted a Pepe Pictures quiz night with at least 4 players.
- Scene: Pepe as a game-show host in a bow tie and a sparkly jacket, holding a microphone and a question card
  with a big "?", in front of a quiz screen with a blocky pixelated picture.
- Background: royal blue `#3052D3`.

**`bug_hunter`**, label **"Bug Hunter"**
- Rule: reported a real bug that got fixed. The owner grants it.
- Scene: explorer Pepe swings a butterfly net and catches a cartoon beetle with a "!" sign. Next to him a
  beige CRT shows a small Win98 error window.
- Background: yellow `#FDD236`.

**`fud_buster`**, label **"FUD Buster"**
- Rule: a high score in FUD Invaders (the owner picks the number).
- Scene: Pepe at a retro arcade cabinet, excited, slamming the buttons. On the screen, pixel invaders shaped
  like small grey storm clouds with angry faces explode under green pixel shots. The one word on the screen:
  **FUD**.
- Background: purple `#9C6DE0`.

**`long_snake`**, label **"Long Snake"**
- Rule: a high score in PEP Snake (the owner picks the number).
- Scene: Pepe grips a joystick and grins while a very long pixel snake made of green blocks winds through
  the picture and is about to eat one more block.
- Background: yellow `#FDD236`.

### Batch 4: stamps for features that come later (5)

**`interior_designer`**, label **"Pond Decorator"**
- Rule: placed 10 decorations in the PepeGochi room. (The stamp is called Interior Designer; that name is
  too long for the label.)
- Scene: Pepe on a small step ladder hangs a framed picture in a cosy room: a rug, a lamp, a potted plant, a
  tiny TV and a rubber duck on a shelf. Satisfied smile.
- Background: light green `#9FD480` (the room wall).

**`secret_starter`**, label **"Secret Starter"**
- Rule: found the first PondOS secret.
- Scene: explorer Pepe with a flashlight peeks into a Win98-style recycle bin and finds a glowing old floppy
  disk. Two or three "?" marks in the air.
- Background: royal blue `#3052D3`.

**`treasure_hunter`**, label **"Treasure Hunter"**
- Rule: found 6 secrets.
- Scene: explorer Pepe with a shovel next to an open treasure chest full of floppy disks, with a paper crown
  and a torn piece of an old map on top. Spark lines.
- Background: purple `#9C6DE0`.

**`frogageddon_beta`**, label **"Beta Tester"**
- Rule: played an online FROGAGEDDON match during the beta. Limited: it closes when the game leaves beta.
- Scene: Pepe in a white lab coat and safety goggles ticks a checklist on a clipboard. A small badge on his
  coat reads **BETA**. Behind him a cartoon dust cloud and a tiny gold frog flag.
- Background: blue `#4F84EA`.
- Avoid: weapons.

**`frogmas`**, label **"Frogmas"**
- Rule: active in PondOS on 24 to 26 December (UTC). It comes back every year; the site adds the year.
- Scene: Pepe in a red Santa hat and a knitted sweater with a frog pattern holds a wrapped present next to a
  small decorated pine tree. Snow falls.
- Background: royal blue `#3052D3` with white snowflakes.
- Avoid: a year in the picture, real brands.

## 10. Special avatars (4)

A big stamp unlocks a special avatar: a whole Pepe character in the Avatar Maker's Special row, used as the
Passport photo. When a player picks one, it covers every part except the background.

Reference (attach it): [Explorer Pepe](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/games/fren-avatar/source/special/explorer-pepe-original.png),
the first special avatar (Scout Fren).

Rules:
- The **classic Pepe meme drawing**, like Explorer Pepe, not the cartoon stamp style: skin `#508828` with a
  darker green `#588028` for folds, lips `#A06048`, eye whites `#F8F8F8`, black outlines about 6 px at 512 px,
  flat colours.
- **Square transparent PNG, at least 1024 × 1024** (drawn at 512 × 512 geometry, scaled up). No background:
  the player picks one.
- Head and shoulders, like Explorer Pepe: head centred horizontally, the eyes about 42% from the top, the
  shoulders reaching the bottom edge, the hat no higher than 5% from the top. Nothing cut off at the sides.
- One clear prop at most, held in front of the chest, so the head stays readable in a small circle.
- File: `special_<name>.png` in `games/fren-avatar/source/special/`.

**`special_yeet_pilot`**: unlocked by Moonwalker
- The YEET pilot as a classic Pepe: red crash helmet with the goggles pushed up, blue T-shirt, a little grey
  moon dust on the helmet, a proud wide grin, giving a thumbs-up.

**`special_graduate`**: unlocked by Certified Fren
- A black mortarboard with a yellow tassel, a black gown over the shoulders, holding a rolled diploma with a
  red ribbon. Proud, slightly smug face.

**`special_parent`**: unlocked by Good Parent
- Pepe with a gentle, happy face and apron straps over the shoulders holds a small froglet against his chest;
  the froglet looks up at him.

**`special_archivist`**: unlocked by The Secret Pond
- Pepe with round reading glasses and a knitted cardigan holds up an old 3.5" floppy disk in one hand; an old
  map rolled up with string sticks out from under his other arm. Curious, amazed eyes.

## 11. The Secret Pond wallpaper (1)

The reward for solving the Lost Pond Files: a third PondOS wallpaper, next to the day and night ones.

Reference (attach them): [day wallpaper](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/meme/img/wall-day.webp),
[night wallpaper](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/meme/img/wall-night.webp),
[YEET moon landing](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/games/img/yeet/moon-landing.jpg).

- Style: like those three, a **photo-realistic landscape with a flat classic Pepe pasted in** (the meme
  collage look). This is the one picture where a realistic, detailed background is right.
- Scene: a hidden forest pond at night under a big full moon. Glowing lily pads, fireflies, reeds, mist on the
  water, the moon reflected in it. Classic Pepe (as in §10) peeks happily from behind a big mossy rock,
  amazed, as if he has just found the place.
- Size: **1920 × 1200**, JPG or PNG, no transparency.
- Composition (PondOS crops the picture to fit the screen):
  - Pepe and the moon in the **right half**, between 20% and 60% from the top;
  - the **left third** calm and fairly dark (water, reeds), because the desktop icons sit there;
  - the **bottom 10%** calm (the taskbar covers it);
  - a phone shows only a tall strip around Pepe, so keep Pepe and the moon close together.
- No text, no logos, no coins.
- File: `wall-secret-pond.png` in `games/fren-passport/source/wallpaper/`.

## 12. BALI postmark (1)

Every fren gets the BALI stamp on the day Pepecoin reaches $0.01. Until then the BALI card on the Passport page
shows a padlock. On that day the site stamps this postmark over the padlock and writes the date in its middle.

Reference (attach it): [the Passport page with the BALI card](https://github.com/PepecoinHub/pepecoinhub.github.io/raw/main/docs/meme/passport-assets/page-right.webp).

- A round rubber-stamp postmark, double ring, in dark indigo ink `#281858` (the colour of the "ACHIEVEMENT
  STAMPS" banner). A slightly worn rubber-stamp texture is fine here.
- Ring text: **POND POST · BALI ·** (only these words).
- In the middle: a small **open** padlock drawn in the same ink, and below it an **empty** horizontal band
  for the date (the site writes the date; do not draw one).
- Inside the inner ring a flat paper fill `#F4CDB4` (the card's colour), so the postmark fully covers the old
  padlock.
- Square transparent PNG, at least 600 × 600, the postmark round and centred. The site places it at about
  60 px wide, tilted a little.
- File: `bali-postmark.png` in `games/fren-passport/source/`.

## 13. Optional: PEP-TV hosts (2)

For the new ad looks: the teleshopping ads (PEP-SHOP) and the quiz-show ads (PEP QUIZ). A host stands next to
the product or the question.

- Classic Pepe as in §10, waist-up, facing slightly to the side, transparent PNG, at least 1000 × 1000.
- File: `host-shop.png` or `host-quiz.png` in `games/pep-tv/source/` (Kiro makes the small web copies).

**`host-shop`**: a 90s teleshopping presenter. A shiny purple suit jacket with big shoulder pads, a headset
microphone, a huge toothy smile; one hand points to the side (where the product will be), the other gives a
thumbs-up.

**`host-quiz`**: a TV quiz-show host. A dark navy suit and tie, holding a few question cards, eyebrows raised,
a friendly-serious look ("Is that your final answer?").

## 14. Optional: redraw the four PR #230 AI concepts in this style

Only if the owner wants one consistent set instead of the AI concepts.

| Stamp id | Label | Scene |
|---|---|---|
| `first_fren` | First Fren | Pepe waves hello at a beige CRT showing a tiny PondOS desktop. Yellow. |
| `first_avatar` | Fresh Fren | Pepe at an easel draws his own portrait with a pencil. Purple. |
| `sharp_eye` | Sharp Eye | Explorer Pepe looks through a magnifier at a photo pinned with a red bullseye pin. Sky blue. |
| `community_fren` | Community Fren | Three Pepes around a CRT with chat speech bubbles. Light green. |

## 15. Prompts for ChatGPT

**Stamp** (attach the 4 images from §1, paste §2 to §8 once):

> The attached images are postage stamps from our Fren Passport. Draw ONE new stamp in exactly the same
> style, frame and colours, following the rules I pasted. Transparent background outside the stamp. The
> label must read exactly: "<label>". Stamp card: <paste the card>.

**Special avatar** (attach Explorer Pepe, paste §10):

> The attached image is a special avatar from our site. Draw a new one in exactly the same classic Pepe
> style, size and position, following the rules I pasted: <paste the card>.

**Wallpaper** (attach the 3 images from §11, paste §11):

> Make a desktop wallpaper in the same meme-collage style as the attached images, following these rules:
> <paste §11>.

**Postmark** (attach the Passport page, paste §12):

> Draw a postmark that fits the attached Passport page, following these rules: <paste §12>.

## Appendix: all 48 stamps and BALI

| Stamp | Label | Art | Gold |
|---|---|---|---|
| `first_fren` | First Fren | AI concept (#230), optional redraw §14 | |
| `pond_pioneer` | Pond Pioneer | Lily ✓ | |
| `first_avatar` | Fresh Fren | AI concept (#230), optional redraw §14 | |
| `welcome_back` | Welcome Back! | Lily ✓ | |
| `first_words` | First Words | Lily ✓ | |
| `hey_fren` | Hey @Fren | Lily ✓ | |
| `community_fren` | Community Fren | AI concept (#230), optional redraw §14 | |
| `dear_editor` | Dear Editor | Lily ✓ (first letter sent) | |
| `junior_editor` | Junior Editor | Lily ✓ (rule now: first letter printed) | |
| `senior_editor` | Senior Editor | Lily ✓ (rule now: 5 letters printed) | |
| `vox_populi` | Vox Populi | draw, batch 1 | gold |
| `i_voted` | I Voted | draw, batch 3 | |
| `streak_14` | 14-Day Streak | Lily ✓ | |
| `like_it_here` | 30-Day Streak | draw, batch 2 | |
| `certified_fren` | Certified Fren | draw, batch 1 | gold |
| `old_frog` | Old Frog | draw, batch 1 | |
| `pepe_guesser` | Pepe Guesser | Lily ✓ | |
| `sharp_eye` | Sharp Eye | AI concept (#230), optional redraw §14 | |
| `detective_fren` | Detective Fren | draw, batch 1 | |
| `week_scout` | Week Scout | Lily ✓ | |
| `scout_fren` | Scout Fren | Lily ✓ | |
| `frog_of_the_week` | Frog of the Week | draw, batch 1 | gold |
| `yeet_adept` | Adept | draw, batch 3 | |
| `nasa_is_hiring` | NASA Is Hiring | draw, batch 2 | |
| `moonwalker` | Moonwalker | draw, batch 1 | gold |
| `rookie_miner` | Happy Mining! | Lily ✓, label edit, batch 2 | |
| `good_game` | Good Game | draw, batch 3 | |
| `checkmate` | Checkmate! | draw, batch 3 | |
| `picasso_fren` | Picasso Fren | draw, batch 1 | |
| `podium` | Podium | draw, batch 3 | |
| `game_night` | Game Night | draw, batch 3 | |
| `season_champion` | Season Champion | draw, batch 1 | gold |
| `quiz_master` | Quiz Master | draw, batch 3 | |
| `top_ten` | Top 10 | draw, batch 3 | |
| `arcade_hopper` | Arcade Hopper | draw, batch 3 | |
| `fud_buster` | FUD Buster | draw, batch 3 | |
| `long_snake` | Long Snake | draw, batch 3 | |
| `bug_hunter` | Bug Hunter | draw, batch 3 | |
| `frogageddon_beta` | Beta Tester | draw, batch 4 | |
| `first_hatch` | First Hatch | Lily ✓ | |
| `little_fren` | Little Fren | Lily ✓ | |
| `grown_fren` | One Small Step | Lily ✓ | |
| `good_parent` | Good Parent | draw, batch 1 | |
| `interior_designer` | Pond Decorator | draw, batch 4 | |
| `secret_starter` | Secret Starter | draw, batch 4 | |
| `treasure_hunter` | Treasure Hunter | draw, batch 4 | |
| `the_secret_pond` | The Secret Pond | draw, batch 1 | gold |
| `frogmas` | Frogmas | draw, batch 4 | |
| `bali` | (printed on the page) | exists; unlocked postmark §12 | mythic |

Totals: 48 stamps and BALI. 15 by Lily, 4 AI concepts, 29 to draw, 1 label edit.

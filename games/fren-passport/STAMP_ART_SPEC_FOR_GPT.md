# Fren Passport: stamp art spec (for ChatGPT or an artist)

Give this document, together with the reference images in §1, to whoever draws the new Fren Passport
stamps. The goal: every new stamp looks like it belongs to the same set as Lily's 15 stamps. The Passport,
the album and the stamp rules already exist in code; only the pictures are missing.

**How to use it with ChatGPT:** attach the reference images from §1, paste §2 to §8 once, then ask for
one stamp card from §9 at a time (or three cards for one sheet). A ready prompt is in §11.

Status: v2, 2026-11-07. Groups A and B in §9 are confirmed by the owner (labels marked "proposed" are not
decided yet). Group C waits for the owner's final list; group D is optional.

## 1. Reference images (attach them every time)

- `games/fren-passport/source/stamps-lily/sheet-1-pioneer-welcome-guesser-week-scout-words.png`
- `games/fren-passport/source/stamps-lily/sheet-2-pepegochi-14day-icon.png`
- `games/fren-passport/source/stamps-lily/sheet-3-mentions-editors-miner.png`
- `docs/meme/passport-assets/stamps-lily.webp` (all 15 in one row, as the site shows them)

These are the style to match. The five AI concepts in PR #230 (`stamps-custom-v1`) are **not** the
reference: they use a cream label, a navy "P" hoodie and different background colours.

## 2. The frame (the same on every stamp)

| Part | Rule |
|---|---|
| Shape | Portrait postage stamp, width : height about 7 : 8. Everything outside the stamp is transparent. |
| Perforated edge | Round scallops: **7 along the top and the bottom, 8 along each side**. Black outline, about 2% of the stamp width. |
| Paper | Flat cream `#FCEDD5`. |
| Picture window | A rectangle inside the paper with a thick black frame (about 1.5% of the stamp width). Paper margin about 6% of the height at the top and 3 to 4% of the width at the sides. |
| Name label | Rounded rectangle, warm grey `#C7BEAF`, black outline. About 11 to 12% of the stamp height and 80% of its width, centred, lying across the bottom edge of the picture window, with a strip of cream paper below it. |
| Label text | Exactly the text on the card. One line, bold simple sans-serif, near-black `#1E1E1E`, Title Case. Up to 14 characters is ideal, 16 at most. |

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
- **YEET THE PEP stamps:** aviator goggles and a red scarf (no space suit: One Small Step already has one).
- **Everything else:** whatever the card says.

## 4. Colour and drawing style

- Thick black outlines and flat fills. At most one flat shadow tone per colour.
- No gradients, glow, airbrush, texture, 3D, glossy highlights or photo look.
- One flat background colour per stamp, plus simple scenery: clouds, hills, water, stars, a Win98-style
  window or a beige CRT monitor.
- Background palette (stamps next to each other should differ; the main page grid is in §9):
  sky blue `#4BA6F8`, blue `#4F84EA`, royal blue `#3052D3`, purple `#9C6DE0`, yellow `#FDD236`,
  light green `#9FD480`, navy `#1D266E`.
- Signature motif: 2 or 3 short yellow "spark" strokes (`#FDD236` with a black outline) near Pepe's head.
- At most one short word or number inside the picture, and only when the card asks for it (like the "7" on
  Week Scout's calendar or the "hi" bubble on First Words). Any other "writing" is drawn as grey stripes.

## 5. Small size

The album shows a stamp between 34 and about 64 px wide; the 12 stamps on the Passport's main page will be
about 78 px wide (the tile is 138×150 px). Use one clear subject, one or two props and big shapes. Zoom out
to 10%: if you can no longer tell what the stamp is about, simplify.

## 6. Not allowed

- Real logos and trademarks (NASA, Discord, X/Twitter, Reddit, Windows), real people, a celebrity look.
- Other coins or tokens, prices, "$" signs, money bags. (The BALI stamp is already printed on the page.)
- Realistic weapons, blood, alcohol, smoking. (Pixel shots on a retro arcade screen are fine.)
- The Avatar Maker's olive Pepe, or the navy "P" hoodie from PR #230.
- Gold frames, grey "locked" versions or "?" stamps: the site makes those (§7).
- Counters like "×2" or years: the site adds them on top of the stamp.
- Any text except the label and the one word or number from the card.

## 7. Gold (rare) stamps

Rare stamps say **gold** on their card: Moonwalker, Frog of the Week, Season Champion, Vox Populi,
Certified Fren and The Secret Pond. Draw them exactly like the others: cream paper, grey label. The build
recolours the paper to gold, the label to cream and adds a small glint, so all gold stamps match. See
`games/fren-passport/stamps-review/gold-frame-demo.jpg`.

## 8. Delivery

- Transparent PNG.
- Either **one stamp per image** (the stamp at least 900 px tall, centred, nothing else in the picture), or
  **a sheet** with up to 6 stamps in a 3 × 2 grid, at least 40 px from each other and from the edges.
- File names: `<stamp_id>.png`, or `sheet-<n>.png` plus the stamp ids in order (left to right, top to bottom).
- The files go to `games/fren-passport/source/stamps-new/`. A script like `scripts/build_lily_stamps.mjs`
  cuts them into the tile strip.
- If a label comes out misspelled and cannot be fixed, deliver the same stamp with an empty label. The build
  then writes the text.

Check before delivering:
1. The label text is spelled exactly as on the card.
2. The frame: 7 + 8 scallops, cream paper, grey label, black outlines.
3. One flat background colour, no gradients.
4. Pepe looks like the reference Pepe and is still recognisable at 10% zoom.
5. Nothing from §6 is in the picture.
6. Everything outside the stamp is transparent.
7. Next to `stamps-lily.webp`, the new stamp looks like part of the same set.

## 9. Stamp cards

**Rule** says what the player did, so the picture fits. Do not write the rule on the stamp.

### Main page grid

The Passport's main page shows these 12 stamps in a 4 × 3 grid, with the BALI stamp below them. The
background colours in the cards are chosen so that neighbours differ:

| | Column 1 | Column 2 | Column 3 | Column 4 |
|---|---|---|---|---|
| Row 1 | Pond Pioneer (exists, sky blue) | Frog of the Week (purple) | Season Champion (royal blue) | Vox Populi (light green) |
| Row 2 | Moonwalker (navy) | Certified Fren (yellow) | Old Frog (light green) | The Secret Pond (navy) |
| Row 3 | Scout Fren (exists, sky blue) | Detective Fren (purple) | Picasso Fren (yellow) | Good Parent (light green) |

### A. Live stamps that still have no drawing of their own (draw these first)

**`detective_fren`**, label **"Detective Fren"** (main page)
- Rule: a perfect 5000 in Pepe Guesser on 5 different days. It unlocks the detective hat and suit.
- Scene: Pepe in a deerstalker hat and a brown detective suit with a tie (the same parts as in the Avatar
  Maker) holds a magnifier over a photo pinned to a cork board, with red string to a map pin.
- Background: purple `#9C6DE0`.
- Note: today this stamp shows an old pixel icon, which would stand out on the main page.

**`like_it_here`**, label **"30-Day Streak"** (proposed)
- Rule: opened PondOS on 30 days in a row. (Its full name, Guess You Like It Here, is too long for the
  label; the Passport still shows the full name.)
- Scene: Pepe at home in PondOS, sunk into a comfy armchair with his feet up, fluffy slippers, the explorer
  neckerchief, a mug with a frog on it. Next to him a beige CRT monitor with a small Win98 window. On the
  wall a tear-off calendar with a big red **30**. Relaxed, happy, eyes half closed.
- Background: light green `#9FD480`.
- Avoid: binoculars and a globe (that is 14-Day Streak).

**`nasa_is_hiring`**, label **"NASA Is Hiring"**
- Rule: three YEET THE PEP flights above 5000 m.
- Scene: YEET Pepe (goggles, red scarf) soaring very high in a superhero pose, the scarf flapping. Next to
  him floats a "help wanted" poster with a small rocket drawing and three green check marks. A small altitude
  sign **5000 m**. The curve of the Earth far below.
- Background: royal blue `#3052D3` with a few white stars at the top.
- Avoid: any real NASA logo, space suits, the Moon close up.

**`moonwalker`**, label **"Moonwalker"**, gold (main page)
- Rule: a YEET flight of the full 6000 m. Very rare.
- Scene: YEET Pepe has been thrown all the way to the Moon. He lands on the grey surface doing a
  backwards-sliding dance step. A dotted flight arc leads back to a small Earth in the corner. A tiny sign
  **6000 m** sticks out of the moon dust.
- Background: navy `#1D266E` with stars.
- Avoid: astronaut suit and helmet (One Small Step already shows an astronaut Pepe on the Moon), any
  celebrity look (no fedora, no white glove).

### B. Confirmed by the owner (2026-11-07)

No new drawings for the editor stamps: Dear Editor, Junior Editor and Senior Editor keep Lily's art even if
their rules change.

**`rookie_miner`**, label **"Happy Mining!"** (proposed; a label edit, not a new drawing)
- Rule (new): started Pepe Miner (its first cloud save). It replaces Rookie Miner (10 minutes) and
  Miner Fren (1 hour).
- Task: keep Lily's Rookie Miner drawing exactly as it is (sheet 3, bottom right). Only replace the label
  text "Rookie Miner" with "Happy Mining!" in the same lettering. Other names under discussion:
  "Good Luck, Miner!", "Proof of Work".

**`frog_of_the_week`**, label **"Frog of the Week"** (proposed), gold (main page)
- Rule: first place of the week in Pepe Guesser (Monday to Sunday, UTC). It can be won again; the site
  shows ×2, ×3 on top.
- Scene: an "employee of the month" joke. Explorer Pepe proudly holds up a big gold trophy cup with **1**
  on it. Behind him, a framed portrait of himself hangs on the wall with a gold ribbon. A map pin and a
  small globe on the desk. Big proud smile, spark lines.
- Background: purple `#9C6DE0`.
- Avoid: podium steps (Podium uses them), a laurel wreath (Season Champion uses it).

**`season_champion`**, label **"Season Champion"**, gold (main page)
- Rule: first place at the end of a ranked Pepe Pictures season. It can be won again (×2, ×3 on top).
- Scene: Pepe wearing a laurel wreath and a red champion sash lifts a big gold cup with both hands under a
  spotlight. Confetti falls.
- Background: royal blue `#3052D3`.
- Avoid: the explorer outfit and the framed portrait (Frog of the Week), podium steps.

**`vox_populi`**, label **"Vox Populi"** (proposed name for "the voice of the people"), gold (main page)
- Rule: 10 of your letters printed in the Pond Gazette.
- Scene: Pepe stands on a wooden soapbox and speaks through a megaphone. Behind him a giant newspaper front
  page with the masthead **GAZETTE**. A small crowd of frog heads cheers with raised hands.
- Background: light green `#9FD480`.

**`certified_fren`**, label **"Certified Fren"**, gold (main page)
- Rule: active in PondOS on 100 different days (not in a row).
- Scene: Pepe in a graduation cap and gown holds a framed certificate with a red wax seal and a big **100**.
  Small calendar pages fly around him.
- Background: yellow `#FDD236`.

**`old_frog`**, label **"Old Frog"** (main page)
- Rule: one year since joining.
- Scene: grandpa Pepe with bushy white eyebrows and moustache, round glasses, a cardigan and a walking
  cane, in a rocking chair. A cupcake with **one** candle on a small table.
- Background: light green `#9FD480`.

**`the_secret_pond`**, label **"The Secret Pond"**, gold (main page)
- Rule: put together the six-piece map of the Lost Pond Files.
- Scene: explorer Pepe holds up an old map made of six torn pieces (the seams show) with a red X. Behind
  him a hidden moonlit pond with glowing lily pads, fireflies and a small wooden sign. Amazed, excited face.
- Background: navy `#1D266E`.

**`picasso_fren`**, label **"Picasso Fren"** (main page)
- Rule: other players guessed your drawings in Draw & Guess (one drawing, or 10 if the owner raises it).
- Scene: Pepe with a red beret and a paint palette stands by an easel with a wobbly, funny drawing of a sun.
  A white speech bubble from outside the picture holds a big green check mark: someone guessed it.
- Background: yellow `#FDD236`.

**`good_parent`**, label **"Good Parent"** (main page)
- Rule: 30 days of good PepeGochi care.
- Scene: grown-up Pepe in a cosy apron hugs a small froglet (like Little Fren). A heart above them, a
  feeding bowl, a small calendar with **30**.
- Background: light green `#9FD480`.

**`frogageddon_beta`**, label **"Beta Tester"**
- Rule: played an online FROGAGEDDON match during the beta. Limited: it closes when the game leaves beta.
- Scene: Pepe in a white lab coat and safety goggles ticks a checklist on a clipboard. A small badge on his
  coat reads **BETA**. Behind him a cartoon dust cloud and a tiny gold frog flag.
- Background: blue `#4F84EA`.
- Avoid: weapons.

**`frogmas`**, label **"Frogmas"**
- Rule: active in PondOS on 24 to 26 December (UTC). It comes back every year; the site adds the year.
- Scene: Pepe in a red Santa hat and a knitted sweater with a frog pattern holds a wrapped present next to
  a small decorated pine tree. Snow falls.
- Background: royal blue `#3052D3` with white snowflakes.
- Avoid: a year in the picture, real brands.

**`fud_buster`**, label **"FUD Buster"**
- Rule: a FUD Invaders score of at least X (the owner picks X).
- Scene: Pepe at a retro arcade cabinet, excited, slamming the buttons. On the screen, pixel invaders shaped
  like small grey storm clouds with angry faces explode under green pixel shots. The one word: **FUD** on the
  screen.
- Background: purple `#9C6DE0`.

**`long_snake`**, label **"Long Snake"**
- Rule: a PEP Snake score of at least X (the owner picks X).
- Scene: Pepe grips a joystick and grins while a very long pixel snake made of green blocks winds through the
  picture and is about to eat one more block.
- Background: yellow `#FDD236`.

### C. Proposed (wait for the owner's final list)

**`i_voted`**, label **"I Voted"**
- Rule: voted in a Pond Poll.
- Scene: Pepe drops a folded ballot with a green check mark into a wooden ballot box. A round check-mark
  sticker on his chest. Proud smile.
- Background: yellow `#FDD236`.

**`yeet_adept`**, label **"Adept"**
- Rule: a YEET flight of 3000 m.
- Scene: YEET Pepe has just been launched from a giant wooden slingshot and flies up through fluffy clouds,
  excited. A small altitude sign **3000 m**. Birds below him.
- Background: sky blue `#4BA6F8` with white clouds.
- Avoid: stars and space (those are the higher YEET stamps).

**`good_game`**, label **"Good Game"**
- Rule: finished a board game (chess, checkers, Connect Four or Sea Battle) with another fren.
- Scene: two Pepes shake hands across a small table with a chessboard and a Connect Four grid. One wears
  the explorer hat, the other a backwards blue cap, so they are easy to tell apart.
- Background: royal blue `#3052D3`.

**`checkmate`**, label **"Checkmate!"**
- Rule: won a game of chess against a fren.
- Scene: the classic smug Pepe (half-closed eyes, satisfied smirk) leans back with his arms crossed. On the
  board in front of him the black king lies tipped over next to his white queen. Spark lines.
- Background: purple `#9C6DE0`.

**`podium`**, label **"Podium"**
- Rule: top 3 in a Pepe Pictures quiz night or a Draw & Guess game.
- Scene: Pepe on a three-step podium (on step 2) with a silver medal, cheering. Behind him a quiz screen
  with a big blocky pixelated picture (Pepe Pictures starts with giant pixels).
- Background: sky blue `#4BA6F8`.

**`game_night`**, label **"Game Night"**
- Rule: played in a scheduled PEP Games night.
- Scene: three Pepes on a couch in front of a glowing CRT, party hats, a bucket of popcorn, a wall clock
  at 8 o'clock, a crescent moon in the window. One of them cheers.
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

**`interior_designer`**, label **"Pond Decorator"** (the name Interior Designer is too long for the label;
the owner picks the final name)
- Rule: placed 10 decorations in the PepeGochi room.
- Scene: Pepe on a small step ladder hangs a framed picture in a cosy room: a rug, a lamp, a potted plant,
  a tiny TV and a rubber duck on a shelf. Satisfied smile.
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

**`bug_hunter`**, label **"Bug Hunter"**
- Rule: reported a real bug that got fixed. The owner grants it.
- Scene: explorer Pepe swings a butterfly net and catches a cartoon beetle with a "!" sign. Next to him a
  beige CRT shows a small Win98 error window.
- Background: yellow `#FDD236`.

**`quiz_master`**, label **"Quiz Master"**
- Rule: hosted a Pepe Pictures quiz night with at least 4 players.
- Scene: Pepe as a game-show host in a bow tie and a sparkly jacket, holding a microphone and a question
  card, in front of a quiz screen with a blocky pixelated picture.
- Background: royal blue `#3052D3`.

### D. Optional: redraw the other four PR #230 concepts in this style

Only if the owner wants one consistent set instead of the AI concepts.

| Stamp id | Label | Scene |
|---|---|---|
| `first_fren` | First Fren | Pepe waves hello at a beige CRT showing a tiny PondOS desktop. Yellow. |
| `first_avatar` | Fresh Fren | Pepe at an easel draws his own portrait with a pencil. Purple. |
| `sharp_eye` | Sharp Eye | Explorer Pepe looks through a magnifier at a photo pinned with a red bullseye pin. Sky blue. |
| `community_fren` | Community Fren | Three Pepes around a CRT with chat speech bubbles. Light green. |

## 10. Special avatars (only the ones the owner picks)

Some big stamps unlock a special avatar: a whole Pepe character in the Avatar Maker's Special row. These are
not stamps, and they use a different style:

- the classic Pepe meme drawing, like `docs/meme/avatar-assets/layers/special_explorer.webp` (Explorer Pepe),
  not the cartoon stamp style;
- a 512×512 transparent PNG, head and shoulders, head centred around x = 256, eyes around y = 215,
  shoulders reaching the bottom edge (the geometry is in `games/fren-avatar/ART_SPEC_FOR_GPT.md`, §3);
- no background (the player picks one).

Candidates, not decided yet: The Secret Pond (archivist Pepe with a floppy and the map), Certified Fren
(graduate Pepe), Frog of the Week (explorer Pepe with the gold trophy), Season Champion (Pepe with a laurel
wreath), Moonwalker (YEET Pepe with goggles and scarf).

## 11. Prompt for ChatGPT

> The attached images are postage stamps from our Fren Passport. Draw ONE new stamp in exactly the same
> style, frame and colours, following sections 2 to 8 of the spec below. Transparent background outside the
> stamp. The label must read exactly: "<label>". Stamp card: <paste the card>.

For a sheet: "Draw these three stamps side by side on one transparent image, at least 40 px apart:
<three cards>."

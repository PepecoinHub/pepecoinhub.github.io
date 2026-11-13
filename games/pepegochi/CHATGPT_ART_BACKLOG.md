# PepeGochi: backlog grafik dla ChatGPT (2026-11-13)

Zadania graficzne do PepeGochi. ChatGPT rysuje, Claude sprawdza każdy plik (skrypt QA + podgląd w pokoju)
i dopiero wtedy integruje. Pełny kontekst: `AUDIT_2026-11-13.md` w tym folderze.

## Zasady dla każdego pliku

**Zawsze dołącz jako wzór** (to są zaakceptowane grafiki, nie wolno zmieniać ich wyglądu):
`docs/games/img/pepegochi/pepegochi_adult_idle.png`, `pepegochi_egg_idle.png`, `pepegochi_tadpole_idle.png`,
`rubber_duck.png`, `room_clean_base.png`. Podgląd całości: `games/pepegochi/audit-2026-11-13/sprites_in_game.png`.

Format A (postać i rzeczy w pokoju, „128”):

- PNG, dokładnie **128 × 128 px**, prawdziwa przezroczystość (bez białego, czarnego ani szachownicy w tle).
- Pixel-art na siatce **2 × 2** (każdy „piksel” to blok 2×2), najwyżej 64 kolory, bez rozmycia, antyaliasingu,
  gradientów, półprzezroczystych krawędzi i tekstu.
- **Stopy / dół na linii y = 124**: postać stoi na tej linii, czyli ostatni widoczny rząd pikseli to y = 123 (tak jak w `adult_idle`). Dorosła żaba: 113 px wysokości (góra y = 9), tułów (bluza) wyśrodkowany na x = 60.
- Jedna klatka w jednym pliku. Nigdy arkusz.
- Bluza: niebieska, z białą literą **P skopiowaną piksel w piksel z `pepegochi_adult_idle.png`**. Nie „₱”, nie przekreślona,
  nie lustrzana (porównanie: `audit-2026-11-13/hoodie_p_compare.png`, pierwszy obrazek = wzór).
- Twarz Pepe jak w `adult_idle`: te same oczy, usta, kontur. Kolory z palety `adult_idle`.

Format B (pasek Start, „48”):

- PNG, dokładnie **48 × 48 px**, prawdziwa przezroczystość, siatka **1 × 1** (mała ikona w stylu Windows 98),
  najwyżej 32 kolory, ciemnozielony kontur 1 px, bez antyaliasingu.
- Żaba **siedzi na krawędzi paska**: dół postaci na linii **y = 47** (ostatni widoczny rząd pikseli to y = 46), wysokość postaci ok. 40 px (może wystawać ponad pasek).
- Środek tułowia na x = 24. To ta sama żaba co `adult_idle`: zielona, niebieska bluza z białym „P” (3 × 5 px), brązowe spodenki.

Nazwy plików dokładnie jak w tabelach (małe litery, podkreślniki). Klatki animacji numerowane `_01`, `_02`…

---

Każdy plik sprawdzam przed integracją: `node scripts/pepegochi_art_qa.mjs plik.png` (rozmiar, przezroczystość, siatka,
liczba kolorów, linia stóp). Plik, który nie przejdzie, wraca do poprawy.

## Kolejność produkcji

| Paczka | Co | Plików | Priorytet |
|---|---|---:|---|
| **A1** | Poprawki grafik już używanych w grze (te same nazwy) | 6 | ✅ zatwierdzone 2026-11-13 |
| **A2** | Pasek Start: 16 póz | 16 | ✅ zatwierdzone 2026-11-13, w grze (`docs/games/img/pepegochi/taskbar/`) |
| **A3** | Pasek Start: 9 krótkich animacji | 33 | ✅ w grze 2026-11-13 (`docs/games/img/pepegochi/taskbar/anim/`); pozy dorosłe na stojąco |
| **A4** | Wyprowadzka dorosłej żaby: prawdziwy chód | 6 | 4. |
| **A5** | Stany kijanki i młodej żaby + ich wyprowadzka | 22 | 5. |
| **A6** | Animacje opieki dorosłej żaby (jedzenie, mycie, zabawa, sen) | 16 | 6. |
| **A7** | List GOODBYE.TXT jako pixel-art | 1 | 7. |
| **A8** | Przedmioty pokoju w natywnej wielkości (wymaga zgody właściciela) | 9 | 8. |
| A6b | Animacje opieki kijanki i młodej żaby | 32 | później |
| A9 | Stara żaba (**tylko po decyzji właściciela**) | 9 | warunkowo |

Jedna paczka naraz. Następna dopiero po sprawdzeniu poprzedniej.

---

## A1. Poprawki istniejących grafik (format A, folder `docs/games/img/pepegochi/`)

Podmiana 1:1: ta sama nazwa, ten sam kadr, ta sama wielkość i linia stóp. Zmienić tylko to, co opisane.

Obecny kadr (widoczne piksele: lewo, góra, prawo, dół; dół 124 = linia stóp). Nowy plik ma stać w tym samym miejscu:
środek przesunięty najwyżej o 6 px, wysokość różna najwyżej o 8 px, dół dokładnie 124.

| Plik | Obecny kadr |
|---|---|
| `pepegochi_adult_hungry.png` | 26, 8, 100, 124 |
| `pepegochi_adult_dirty.png` | 26, 8, 114, 124 (z muchą) |
| `pepegochi_adult_recovering.png` | 26, 8, 100, 124 |
| `pepegochi_froglet_idle.png` | 24, 30, 94, 124 |
| `pepegochi_hatch_03.png` | 30, 20, 96, 124 (jajo 30–96 jak `hatch_01/02`, czubek skorupki uniesiony do y = 20) |
| `pepegochi_hatch_04.png` | nowy: kijanka w miejscu `tadpole_idle` (16, 50, 111, 124), połówki skorupki obok, dół 124 |

| Plik | Referencja | Co poprawić |
|---|---|---|
| `pepegochi_adult_hungry.png` | obecny plik + `adult_idle` | litera P jak w `adult_idle`; usunąć zbłąkane niebieskie piksele przy dłoniach i spodenkach; poza czytelna z daleka: obie dłonie na brzuchu, smutne oczy, mała pusta miska u stóp (mieści się w kadrze, dół na y = 124) |
| `pepegochi_adult_dirty.png` | obecny plik | tylko litera P |
| `pepegochi_adult_recovering.png` | obecny plik | tylko litera P (plaster na głowie zostaje) |
| `pepegochi_froglet_idle.png` | obecny plik | litera P (mniejsza bluza, ale ten sam kształt litery); wysokość ok. 95 px, ogonek zostaje |
| `pepegochi_hatch_03.png` | `hatch_02`, `tadpole_idle` | z pękniętej skorupki wygląda **kijanka z `tadpole_idle`** (te same oczy i uśmiech Pepe), czubek skorupki unosi się; dół na y = 124 |
| `pepegochi_hatch_04.png` (nowy) | `hatch_03`, `tadpole_idle` | kijanka już wyszła, obok leżą dwie połówki skorupki; łącznik między `hatch_03` a `tadpole_idle` |

---

## A2. Pasek Start: 16 póz (format B, folder `docs/games/img/pepegochi/taskbar/`)

Gotowy brief z tekstem do wklejenia, siatką 48×48 i zrzutem paska: `games/pepegochi/a2-brief/A2_PROMPT.md`.

Każda poza to jedna nieruchoma klatka. Kod wybiera pozę ze stanu serwera, ten sam co w grze.

| # | Plik | Kiedy | Opis pozy |
|---:|---|---|---|
| 1 | `tb_egg.png` | brak żaby / jajo | jajo z `egg_idle` w małej skali, oczy wyglądają zza skorupki |
| 2 | `tb_tadpole.png` | kijanka | kijanka z `tadpole_idle`, leży na pasku, ogon zwisa za krawędź |
| 3 | `tb_froglet.png` | młoda żaba | siedzi, nogi zwisają z krawędzi paska, ogonek widoczny |
| 4 | `tb_adult_sit.png` | dorosła, zdrowa | siedzi, nogi zwisają, spokojny uśmiech (jak `adult_idle`) |
| 5 | `tb_adult_hungry.png` | głodna | dłonie na brzuchu, smutne oczy |
| 6 | `tb_adult_dirty.png` | brudna | plamki błota, mucha obok głowy |
| 7 | `tb_adult_moody.png` | zły nastrój | ręce skrzyżowane, obrażona mina (jak `adult_moody`) |
| 8 | `tb_adult_sleepy.png` | zmęczona | oczy w połowie zamknięte, głowa lekko opuszczona |
| 9 | `tb_adult_neglected.png` | zaniedbana | skulona, smutna, kolana pod brodą |
| 10 | `tb_adult_packing.png` | pakuje się | siedzi na żółtej walizce (kolor z `suitcase.png`) |
| 11 | `tb_adult_recovering.png` | dochodzi do siebie | plaster na głowie, mały uśmiech |
| 12 | `tb_adult_talk.png` | mówi ciekawostkę | usta otwarte, jedna dłoń uniesiona |
| 13 | `tb_adult_think.png` | „Did you know?” | dłoń przy brodzie, oczy w górę |
| 14 | `tb_adult_laugh.png` | zabawny komentarz | śmieje się, oczy zmrużone |
| 15 | `tb_adult_wave.png` | najechanie myszą | macha jedną ręką |
| 16 | `tb_letter.png` | żaba się wyprowadziła | sama koperta z `goodbye_envelope.png` leżąca na pasku, bez żaby |

---

## A3. Pasek Start: 9 krótkich animacji (format B, folder `docs/games/img/pepegochi/taskbar/anim/`)

Nazwy ruchów są takie same jak w kodzie PR #299, żeby zamienić ruch CSS na klatki bez zmiany logiki.
Każda animacja zaczyna się i kończy pozą bazową (podana w kolumnie). Kod gra ją raz, ok. 1 s, rzadko (co 13–33 s).
Postać nie może wychodzić poza 48 × 48 (skok liczy się w kadrze).

| # | Ruch | Pliki | Klatek | Poza bazowa | Opis ruchu |
|---:|---|---|---:|---|---|
| 1 | wobble | `tb_wobble_01..04.png` | 4 | `tb_egg` | jajo kiwa się w lewo, w prawo, w lewo, wraca |
| 2 | bob | `tb_bob_01..02.png` | 2 | `tb_adult_sit` | oddech: 01 = ramiona 1 px niżej, 02 = baza |
| 3 | peek | `tb_peek_01..04.png` | 4 | `tb_adult_sit` | patrzy w lewo, środek, w prawo, środek (tylko oczy i głowa) |
| 4 | hop | `tb_hop_01..05.png` | 5 | `tb_adult_sit` | przysiad, odbicie, w powietrzu (stopy ok. 8 px nad linią), lądowanie, powrót. Te klatki posłużą też do wyskoczenia z okna gry na pasek |
| 5 | shuffle | `tb_shuffle_01..04.png` | 4 | `tb_adult_sit` | przesuwa się na pośladkach 2 px w lewo, wraca, 2 px w prawo, wraca |
| 6 | greet | `tb_greet_01..04.png` | 4 | `tb_adult_sit` | macha ręką: ręka w górze, w lewo, w prawo, opada |
| 7 | nod | `tb_nod_01..04.png` | 4 | `tb_adult_sleepy` | przysypia: głowa opada, małe „z” obok głowy, budzi się, wraca |
| 8 | slouch | `tb_slouch_01..03.png` | 3 | `tb_adult_neglected` | ciężkie westchnienie: plecy się garbią, mała chmurka oddechu, wraca |
| 9 | tremble | `tb_tremble_01..03.png` | 3 | `tb_adult_packing` | nerwowo trzyma walizkę: drgnięcie 1 px w lewo, w prawo, baza |

Razem 33 klatki.

---

## A4. Wyprowadzka dorosłej żaby (format A, folder `docs/games/img/pepegochi/`)

Obecne `depart_01..06` to jedna poza przesuwana w kadrze, bez kroków. Nowe klatki to **chód w miejscu**: żaba stoi na środku
kadru w każdej klatce, kod przesuwa ją po pokoju i chowa za prawą krawędzią. Stare pliki zostają do czasu akceptacji.

| Plik | Opis |
|---|---|
| `depart_turn_01.png` | jak `adult_packing`, ale bierze żółtą walizkę (`suitcase.png`) do prawej ręki |
| `depart_turn_02.png` | obrócona w prawo (profil 3/4), walizka w ręce |
| `depart_walk_01.png` | krok: lewa noga z przodu |
| `depart_walk_02.png` | nogi razem, ciało 2 px wyżej |
| `depart_walk_03.png` | krok: prawa noga z przodu |
| `depart_walk_04.png` | nogi razem, ciało 2 px wyżej |

Wszystkie: 113 px wysokości, stopy na y = 124, tułów na x = 60 (nie przesuwać postaci w kadrze), smutna mina, litera P jak w `adult_idle`.
Referencje: `pepegochi_adult_packing.png`, `suitcase.png`, `pepegochi_adult_idle.png`.

---

## A5. Stany kijanki i młodej żaby (format A)

Dziś kijanka i młoda żaba mają tylko pozę idle, a stany są udawane szarym filtrem. Każdy stan to ta sama postać w tej samej
wielkości i miejscu co jej idle. Emocje i rekwizyty jak w odpowiednim stanie dorosłej żaby.

| Plik | Referencja wielkości | Referencja emocji |
|---|---|---|
| `pepegochi_tadpole_hungry.png` | `tadpole_idle` (góra y = 50) | `adult_hungry` |
| `pepegochi_tadpole_dirty.png` | `tadpole_idle` | `adult_dirty` |
| `pepegochi_tadpole_moody.png` | `tadpole_idle` | `adult_moody` |
| `pepegochi_tadpole_tired.png` | `tadpole_idle` | `adult_tired` |
| `pepegochi_tadpole_neglected.png` | `tadpole_idle` | `adult_neglected` |
| `pepegochi_tadpole_packing.png` | `tadpole_idle` | `adult_packing` (malutka żółta walizka obok) |
| `pepegochi_tadpole_recovering.png` | `tadpole_idle` | `adult_recovering` |
| `pepegochi_froglet_hungry.png` | `froglet_idle` (góra y = 30) | `adult_hungry` |
| `pepegochi_froglet_dirty.png` | `froglet_idle` | `adult_dirty` |
| `pepegochi_froglet_moody.png` | `froglet_idle` | `adult_moody` |
| `pepegochi_froglet_tired.png` | `froglet_idle` | `adult_tired` |
| `pepegochi_froglet_neglected.png` | `froglet_idle` | `adult_neglected` |
| `pepegochi_froglet_packing.png` | `froglet_idle` | `adult_packing` (mała żółta walizka w ręce) |
| `pepegochi_froglet_recovering.png` | `froglet_idle` | `adult_recovering` |

Wyprowadzka młodych (chód w miejscu, jak A4):

| Plik | Klatek | Opis |
|---|---:|---|
| `froglet_depart_walk_01..04.png` | 4 | młoda żaba idzie w prawo z małą walizką, cykl kroków jak w A4 |
| `tadpole_depart_01..04.png` | 4 | kijanka pełznie w prawo, ogon na zmianę w górę i w dół, malutka walizka w pyszczku |

Razem 22 pliki.

---

## A6. Animacje opieki dorosłej żaby (format A)

Grane raz po zaakceptowanej akcji, 4 klatki po ok. 200 ms, potem powrót do pozy stanu. Pozy z `pr226_care_storyboards.png`
(PR #226) to **tylko podpowiedź ruchu**: tamte rysunki są kreskówkowe i bez litery P, więc styl brać z `adult_idle`.
Wielkość, linia stóp i miejsce jak `adult_idle` w każdej klatce.

| Akcja | Pliki | Opis klatek |
|---|---|---|
| Karmienie (`feed`) | `care_feed_01..04.png` | 01 trzyma miskę z muchami, 02 bierze jedną, 03 je (policzki pełne), 04 zadowolona, miska pusta |
| Mycie (`clean`) | `care_clean_01..04.png` | 01 mydło w ręce, 02 piana na brzuchu, 03 piana i bańki na głowie, 04 czysta, iskierka |
| Zabawa (`play`) | `care_play_01..04.png` | 01 piłka przy stopach, 02 podrzuca, 03 skacze z radości (stopy maks. 6 px nad linią), 04 łapie piłkę |
| Sen (`rest`) | `care_rest_01..04.png` | 01 ziewa, 02 oczy się zamykają, 03 śpi na stojąco „z”, 04 śpi „Zz” (03–04 mogą się zapętlić) |

## A6b. Animacje opieki kijanki i młodej żaby (później)

Te same 4 akcje × 4 klatki dla `tadpole_` i `froglet_`, w wielkości ich idle: `care_tadpole_feed_01..04.png`,
`care_froglet_feed_01..04.png` itd. Razem 32 pliki. Dopiero po akceptacji A6.

---

## A7. List GOODBYE.TXT (format A)

| Plik | Referencja | Opis |
|---|---|---|
| `goodbye_letter.png` | obecny plik, `goodbye_envelope.png` | ta sama kompozycja (otwarta kartka, zielona dłoń, serduszko), ale prawdziwy pixel-art: siatka 2×2, bez półprzezroczystych krawędzi, najwyżej 16 kolorów |

---

## A8. Przedmioty pokoju w natywnej wielkości (format A, folder `docs/games/img/pepegochi/props-native/`)

**Wymaga zgody właściciela.** Dziś przedmioty są zmniejszane w kodzie o niecałkowitą skalę (np. 128 → 89,6 px), więc piksele
się gubią. Nowe pliki: ten sam rysunek, ta sama nazwa, ale narysowany od razu w docelowej szerokości w kadrze 128 × 128,
dół przedmiotu na y = 124, wyśrodkowany. Kod wyświetli je 1:1. Stare pliki zostają.

| Plik | Szerokość przedmiotu |
|---|---:|
| `p_poster.png` | 70 px |
| `crt_tv.png` | bez zmian: już wyświetlany 1:1 (118 px), nie rysować |
| `lava_lamp.png` | 52 px |
| `potted_plant.png` | 100 px |
| `rubber_duck.png` | 66 px |
| `mug.png` | 62 px |
| `moon_rock.png` | 48 px |
| `paper_crown.png` | 52 px |
| `golden_fly.png` | 48 px |
| `floppy_disk.png` | 42 px |

Szerokości = obecna widoczna szerokość w pokoju 640 px, zaokrąglona do parzystej (siatka 2×2). Wysokość proporcjonalnie.
Razem 9 plików (bez telewizora).

---

## A9. Stara żaba (warunkowo, NIE zaczynać przed decyzją właściciela)

Etap nie istnieje w grze. Jeśli właściciel go zatwierdzi: `pepegochi_elder_idle.png` + `_hungry`, `_dirty`, `_moody`,
`_tired`, `_neglected`, `_packing`, `_recovering` (format A, wielkość jak dorosła, 109 px, lekko zgarbiona, siwe brwi,
okulary do czytania, wyblakła niebieska bluza z tym samym P) oraz `tb_elder_sit.png` (format B). Razem 9 plików.

---

## Gotowy tekst do wklejenia w ChatGPT (paczka A1 i A2)

```
You are drawing sprites for PEPEGOCHI.EXE, a pixel-art pet frog game in a Windows 98 style site.
Match the attached sprites exactly: same frog, same face, same blue hoodie, same palette, same light.
The attached pepegochi_adult_idle.png is the accepted master. Never change its look.

FORMAT A (game sprites, A1)
- PNG, exactly 128 x 128 px, real transparent background (no white, black or checkerboard fill).
- Real pixel art on a 2 x 2 grid (every "pixel" is a 2 x 2 block), at most 64 colours, no blur,
  no anti-aliasing, no gradients, no semi-transparent edges, no text. One sprite per file, never a sheet.
- Feet stand exactly on the line y = 124 (the lowest visible row of pixels is y = 123). Same size and position
  as the file being fixed.
- The white P on the hoodie is copied pixel for pixel from pepegochi_adult_idle.png (not a peso sign,
  not crossed, not mirrored).

FORMAT B (taskbar companion, A2)
- PNG, exactly 48 x 48 px, real transparent background, 1 x 1 pixel grid, at most 32 colours,
  1 px dark green outline, no anti-aliasing, no text.
- The same frog as pepegochi_adult_idle.png, sitting on the top edge of a Windows 98 taskbar:
  the body stands on the line y = 47 (lowest visible row y = 46), about 40 px tall, body centred on x = 24, white P on the blue hoodie (3 x 5 px).

Deliver one file per image, named exactly as in the list.
[paste the A1 or A2 table here]
```

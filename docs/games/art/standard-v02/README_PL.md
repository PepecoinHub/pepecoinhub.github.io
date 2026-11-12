# FROGAGEDDON 2.0 – STANDARD FROG + DETACHABLE HELMET (ART PROTOTYPE v0.2)

**Status:** prototyp wizualny do zatwierdzenia. To nie jest komplet gotowych, ręcznie animowanych sprite'ów, nie został dodany do repozytorium ani opublikowany.

## Zmiana uzgodniona

Jedna domyślna żaba do Frogageddon 2.0. Inne istniejące skiny pozostają w repozytorium jako archiwum / opcja przyszłych aktualizacji, ale nie wymagają osobnych animacji na początku. Postać: zielony Pepe, niebieska bluza z kapturem, brązowe spodnie i złota klamra. Prosty oliwkowy hełm z literą P. Broń jest zawsze osobną warstwą rysowaną przez silnik.

## Pliki

- `sprites/standard_frog_no_helmet.png` – baza, 512×512 PNG RGBA, strona prawa, bez hełmu i broni.
- `sprites/helmet_overlay_on_512_canvas.png` – osobna warstwa hełmu, identyczny canvas i współrzędne, RGBA.
- `sprites/standard_frog_with_helmet.png` – podgląd złożenia, **nie używać jako głównego sprite'a gry**, bo duplikuje hełm.
- `sprites/helmet_cutout.png` – przycięty hełm do dodatkowych efektów.
- `sprites/manifest_prototype.json` – sprawdzalna struktura zgodna ze schematem adaptera PR #267, **bez nowych klatek akcji**. Jedna klatka z tego samego obrazu dla każdego stanu; ruch pochodzi od animatora proceduralnego. Zawiera orientacyjne punkty dłoni wymagające dalszej kalibracji.
- `preview/helmet_loss_prototype.webp` – transparentny pokaz przykładowego zdarzenia, na dużej planszy podglądu, a nie sheet postaci.
- `preview/helmet_loss_preview.gif` – GIF demonstracyjny na ciemnym tle.
- `preview/helmet_only_fall.webp` – animacja hełmu bez postaci.
- `preview/helmet_mechanic_overview.png` – trzy fazy: start, odpadanie, brak hełmu.
- `docs/helmet_contract.json` – pomysł na warstwę hełmu; **nie jest częścią formatu manifestów Codexa**.
- `docs/CODEX_HANDOFF_PL.md` – zlecenie integracyjne.

## Geometria – prototyp, do QA w rzeczywistej grze

Rozmiar canvasa: **512×512**; wymiary stałe między stanami. Orientacja źródła: **w prawo**. Punkt stóp w przybliżeniu **[256,486]**. Umowny punkt dłoni **[368,346]** nie jest jeszcze prawdziwym uchwytem dla wszystkich póz, bo obecne źródło jest klatką idle z ręką przy biodrze. Dla aim/fire nie wolno uznać go za produkcyjnie zatwierdzony. Docelowy punkt stóp pozostaje stały, a ręka otrzyma punkt kotwiczący osobno dla każdej klatki.

**Ważne:** projekt bazuje na naszym wcześniejszym koncepcie ChatGPT, nie na bezpośredniej edycji pliku `classic.webp` z repozytorium. Na tym etapie właściciel musi potwierdzić zgodność stylistyczną z pozostałą oprawą Frogageddon. Zestaw jest tylko referencją dla PR artystycznego.

## Reguła hełmu

- Każda postać zaczyna mecz z hełmem, niezależnie od drużyny.
- Po pierwszym realnym spadku HP (minimum 1) hełm trwale znika na resztę meczu.
- Każde źródło straty HP się liczy: ostrzał, wybuch, upadek i obrażenia sojusznicze. Brak zmian HP nie powoduje utraty hełmu.
- Hełm to efekt **kosmetyczny**, nie pochłania obrażeń i nie wpływa na hitboxy.
- Efekt upadania/wirowania hełmu powinien ruszyć tylko raz. Ma własną krótką animację i znika po zakończeniu, nie pozostaje jako interaktywna przeszkoda.
- Przy `prefers-reduced-motion` hełm po prostu znika bez wyrzutu.
- Jeśli wczytujemy stan gry, w którym HP jest już niższe od początkowego, pokazujemy postać bez hełmu bez odtwarzania wyrzutu na starcie. Utrata hełmu jest rekonstruowalna z HP, gdy nie ma mechaniki leczenia; jeśli w przyszłości będzie leczenie, dodajemy jawny znacznik do serializowanego stanu rozgrywki.
- Nie zmieniać silnika fizyki, trafień, obrażeń, AI, protokołu sieciowego ani nagród.

## Docelowa lista klipów jednej postaci

| Clip w PR #267 | Plan klatek | Zdarzenie / ekspresja |
|---|---:|---|
| `idle` | 4 | oddech, pojedyncze mrugnięcie, znudzenie |
| `aim` | 3 | uniesienie dłoni, skoncentrowane oczy |
| `charge` | 3 | napięcie, zaciśnięte zęby |
| `fire` | 5 | strzał i odrzut, bez broni w grafice |
| `jump` | 4 | przysiad, wybicie, lot |
| `backflip` | 4 | rotacja, lekko przerażona mimika |
| `falling` | 3 | ręce w górę, panika |
| `landing` | 3 | amortyzacja |
| `hit` | 4 | szok, mrugnięcie, gwiazdki wyłącznie jako FX |
| `victory` | 6 | triumf i memiczna satysfakcja |
| `ko` | 4 | przewrócenie, fade, nagrobek istniejącego silnika |

Razem **43 planowane klatki postaci plus oddzielny efekt hełmu**. Nie trzeba robić wersji z hełmem i bez hełmu dla każdej klatki. Warstwa hełmu śledzi transformację ciała do pierwszej utraty HP.

## Kolejność integracji

1. Codex kończy i zabezpiecza PR #267 (po bazowym PR #266).
2. W odrębnym Draft PR właściciel zatwierdza jeden wygląd bazowy, warstwę hełmu i regułę pierwszego uszkodzenia.
3. Codex ładuje warstwy bez ingerencji w kolizje. Póki nie ma nowych, autorskich klatek, działa 11 animacji proceduralnych.
4. ChatGPT przygotowuje następne klatki, z bezwzględnie stałym punktem stóp i osobnymi, kalibrowanymi punktami dłoni.
5. Testy w Chromium + prawdziwy telefon, obie drużyny, każdy typ obrażeń, pauza, reduced motion, wznowienie stanu i ewentualne odtworzenie sieciowe.

**Zakaz merge i publikacji bez zgody właściciela.**

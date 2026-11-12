# The Lost Pond Files — PondOS Mysteries

**Status:** zapisany projekt koncepcyjny do przyszłego wdrożenia. **Nie jest zaimplementowany.**  
**Data:** 2026-11-07  
**Projekt:** PepecoinHub / PondOS 98 / Fren Passport / przyszły PepeGochi  
**Decyzja produktowa:** najpierw przygoda, ciekawość i społeczność; odznaki są pamiątką, nie celem samym w sobie.

## 1. Wizja — dlaczego to robimy

PondOS 98 jest pozornie zwykłym, lekko absurdalnym systemem z przełomu XX i XXI wieku. Ktoś jednak zostawił w nim stare pliki, skróty, dyskietki, niekompletne notatki, ślady w Gazette, transmisjach PEP-TV i grywalnych aplikacjach. Gracz początkowo odkrywa pojedyncze easter eggi, ale później widzi, że łączą się w większą historię: **The Lost Pond Files (Zaginione pliki stawu)**.

To NIE ma być osobna gra MMO, forum ani odznaki za klikanie. To **warstwa przygód point-and-click osadzona w istniejącym PondOS**, rozgrywana we własnym tempie. Każdy powinien móc znaleźć coś zabawnego w pięć minut, a chętni powinni móc odkrywać większą tajemnicę przez kolejne wizyty.

**Pętla powrotu:** ciekawa wskazówka → odkrycie → zagadka → połączenie faktów → nagroda / fragment historii → kolejny trop → rozmowa ze znajomymi. Nie wymaga codziennych streaków, opłat, wymuszonego polecania projektu ani PEP na nagrody.

## 2. Poziomy doświadczenia

### Poziom 1 — proste easter eggi
Zabawne sekretne reakcje w menu, koszu lub plikach. Czasem od razu kosmetyczna pamiątka, czasem tylko żart. Bez ciężkich zabezpieczeń. Część takich rzeczy każdy może odkryć przypadkiem.

### Poziom 2 — małe zagadki wieloetapowe
Znajdujemy wskazówkę w jednej aplikacji, wykorzystujemy ją w innej, rozwiązujemy problem. Server zapisuje etap i wynik dopiero po wiarygodnej weryfikacji. Przykład: stary plik tekstowy → właściwości podejrzanego skrótu → kombinacja symboli → odbudowany plik.

### Poziom 3 — dłuższa zagadka sezonowa lub stała
Sześć **fragmentów starej mapy stawu** z różnych miejsc PondOS tworzy finał przygody. Sekwencja odkryć i warianty symboli mogą się różnić między kontami. Wszystkie fragmenty muszą być zdobywalne bez czekania do konkretnej godziny lub na wydarzenie.

## 3. Plan fabuły i 12 sekretów (katalog już ma te identyfikatory)

Są to **propozycje projektowe**, nie twierdzenie, że funkcje obecnie działają.

| ID z katalogu | Nazwa | Pomysł fabularny i mechanika | Poziom |
|---|---|---|---|
| lost_floppy | The Lost Floppy | W Recycle Bin odzyskujemy dyskietkę BACKUP_1998.TXT. W niej wskazówka: „The shortcut doesn't lead where it says. Check its properties.” Odkrycie samo w sobie łatwe, a plik rozpoczyna historię. | 1 |
| wrong_frog | The Wrong Frog | Podejrzany skrót udaje niewłaściwą aplikację; kliknięcie daje fałszywy błąd, a okno Properties ujawnia symbole lub informację potrzebną do kolejnego kroku. | 1–2 |
| notes_reader | The Forgotten Notes | Ukryty notatnik zawiera wiadomość wymagającą złożenia wskazówki z dyskietki i skrótu. | 2 |
| bsod_fren | Blue Screen of Fren | Udawany BSOD w bezpiecznym oknie (nie blokuje urządzenia). W kodzie błędu znajduje się część rozwiązania i zabawna instrukcja odzyskania „systemu”. | 2 |
| midnight_fren | Midnight Fren | Wygaszacz ze stawem i gwiazdami pokazuje układ symboli; bez obowiązku realnego grania o północy. | 2 |
| paper_crown | Paper Crown | Dowcipna legenda o Królu Stawu. Trop w Gazette, część dowodu w koszu; nagroda to koronka papierowa. | 2 |
| pond_map_1–6 | Map Fragment I–VI | Sześć części jednej mapy, każda związana z innym rodzajem aktywności (pliki, Gazette, PEP-TV, komunikator, gry, pulpit). Po złożeniu powstaje finał The Lost Pond Files. | 3 |

**Pierwszy rozdział MVP:** The Lost Floppy + The Wrong Frog + The Forgotten Notes. Tylko po jego przetestowaniu planować pozostałe.

**Wskazówka przykładowa z dyskietki:** „Dear fren, if you're reading this, I probably deleted the wrong folder again. The shortcut doesn't lead where it says. Check its properties. P.S. Don't trust the purple frog.”

Różne tropy powinny prowadzić do opowieści, a nie polegać na zapamiętywaniu setek kodów. Dowcip i satysfakcja mają pierwszeństwo przed nadmierną trudnością.

## 4. Kolekcja i nagrody — co ma z nich wynikać

Bierzemy istniejący katalog **8 planned items** jako punkt wyjścia. Te powiązania są **propozycjami przyszłych mechanik**, bez przyznawania czegokolwiek obecnie.

| ID itemu | Proponowany sposób zdobycia | Użyteczność w przyszłości |
|---|---|---|
| old_floppy | Ukończenie zagadki BACKUP_1998.TXT | Trwała pamiątka + odtworzenie archiwalnego wpisu |
| paper_crown_item | Zagadka Króla Stawu | Opcjonalne ubranko PepeGochi |
| rubber_duck | Zabawny „system error” związany z kąpielą | Dekoracja pokoju zwierzaka |
| tiny_computer | Tajemnica historii PondOS | Miniaturowy komputer w pokoju |
| frog_tv | Ukryty przekaz w PEP-TV | Telewizorek w pokoju |
| golden_fly | Sekret „najdroższej przekąski” | Kosmetyczna pamiątka lub króciutka animacja |
| moon_rock | Dopiero **serwerowo potwierdzony** lot na 6000 m w YEET | Księżycowy eksponat w PepeGochi |
| moonlight_room | Ukończenie odpowiedniej długiej historii | Wystrój pokoju PepeGochi |

**Bardzo ważne:** przedmioty PepeGochi NIE są wydawane, dopóki nie powstanie serwerowo zweryfikowany ekwipunek i spójny system praw własności. Nie tworzyć kosmetycznego „inventory” tylko na localStorage jako rzekomo autentycznej nagrody. Zmiany w istniejących grach nie mogą psuć aktualnej rozgrywki.

Nie każdy sekret daje item lub stamp. Możliwe nagrody: zabawny ekran, notatka fabularna, nowa tapeta, ozdoba, fragment mapy, jedno wyjątkowe osiągnięcie za całą historię. **Nigdy nagrody finansowe, transfer PEP, token, losowe dropy.**

## 5. Jak ma wyglądać zakładka Fren Passport → Collection

Obecny ekran ma dwie kolumny: **Items 0/8** oraz **Secrets 0/12**. Zachować stylistykę Windows 98, zielone nagłówki i szare obwódki.

Rozróżnić:
- **Undiscovered**: aktywny sekret / przedmiot, jeszcze nie znaleziony, z krótką zagadkową podpowiedzią (bez jawnego miejsca i rozwiązania).
- **Coming soon**: planowana rzecz, nie istnieje możliwość zdobycia; nie udawać, że użytkownik musi jej szukać.
- **Discovered**: ilustracja, data (opcjonalnie), tytuł, krótka historia, ewentualnie „Use in PepeGochi” dopiero gdy prawdziwy inventory to obsłuży.

Po odkryciu małe, dostępne powiadomienie w stylu starego systemu (opcjonalny dźwięk, z możliwością wyciszenia), które nie zapełnia ekranu i nie spamuje po odświeżeniu.

## 6. Uczciwa trudność i wskazówki

- Trzy poziomy podpowiedzi **na żądanie**: (1) fabularna, (2) nazwa aplikacji/obszaru, (3) mocniejszy trop. Bez karania graczy za pomoc.
- Normalna krótka zagadka: jedna sesja; duży quest: wiele powrotów, ale bez przymusowych długich przerw.
- Wszystko możliwe na telefonie: odpowiednik prawokliku/Properties pod long-press albo osobnym przyciskiem.
- Nie wymagać prawdziwej północy, stałej obecności na Game Night, kliknięć co godzinę ani codziennego logowania.
- Czytelność, focus, klawiatura, opcja reduced motion, bez ślepych pułapek i CAPTCHA co krok.
- Frens mogą dzielić się wskazówkami i rozwiązywać razem. To jest **funkcja społecznościowa**, nie oszustwo.
- Gracz może wybrać granie solo, bez Discorda do samego oglądania wskazówek; zapis nagród zgodnie z obecną polityką Discord-only.

## 7. Czy da się utrudnić botom i skryptom? Tak, lecz bez gwarancji pełnej tajności

PepecoinHub jest stroną statyczną. Każde hasło, sprawdzenie i identyfikator ukryte tylko w JS/HTML można znaleźć przez DevTools lub skrypt. **Nie deklarować „antybot 100%”.** Dla kosmetycznych easter eggów nie warto inwestować w ciężką ochronę.

Dla nagród i większych questów:
- Prawdziwe **etapy postępu w Supabase**: konto, quest, indeks etapu, tylko przyznane nagrody. Wykonywanie zapisu musi być idempotentne.
- Serwer kontroluje kolejność etapu, warunki i należący do konta wariant rozwiązania (parametry stworzone i trzymane na serwerze, nie przysłane przez klienta jako „ukończyłem!”).
- Warunki **faktycznie potwierdzalne** na serwerze. Nie uznawać za bezsporny dowód „otworzyłem menu”, „obejrzałem obrazek” lub „kliknąłem w skrót”, bo takie klientowe zdarzenia można sfałszować.
- Odpowiedzi mogą mieć 2–4 warianty lub wersje per-konto, aby jedno wykradzione hasło nie odblokowywało wszystkiego. Publiczne wskazówki mogą być takie same i wspólnie dyskutowane.
- Coarse rate-limit i transakcyjne przyznawanie nagród, bez nieprzyjemnych ograniczeń normalnego użytkownika. Brak kar za zgadywanie przy małych zagadkach.
- Prosty sekret może wymagać ukończenia następnego serwerowego kroku, ale nie dowodzi to, że człowiek faktycznie obejrzał wszystkie okna. Nie dopisywać fałszywych gwarancji.
- Nie dodawać ciągłego nasłuchiwania Realtime do questów. Odczyty na wejściu oraz zapisy tylko na istotnym etapie. Można cache'ować publiczne wskazówki.
- Przestrzegać autoryzacji rzeczywistego Discord użytkownika, RLS/allowlist RPC, bez wystawiania admin key do frontend. Zachować istniejące mechanizmy moderacji.
- Testy negatywne: inny user ID, gość, powtórka tego samego etapu, pominięcie 1–2 etapów, ta sama nagroda w dwóch równoległych żądaniach, reset przeglądarki, brak połączenia, prosty bot.

Zalecenie: nie używać skomplikowanych CAPTCHA ani sztucznej trudności jako substytutu dobrej zagadki. To projekt społecznościowy, nie turniej o nagrody.

## 8. Techniczna możliwość na obecnej stronie

**Tak, bez nowego stacku.** UI i fabuła to małe statyczne okna / assety w PondOS; supabase to logowanie, postęp, unlock, ewentualnie skromny rejestr akcji. Paszport pozostaje źródłem prawdy o odznakach i kolekcji, nie tworzyć drugiej tabeli „osiągnięć” niezależnej od istniejącego systemu.

Zweryfikowany stan na 2026-11-07:
- PR #184 (draft) ma katalog 12 sekretów / 8 itemów i 3 dotychczasowe casual easter eggi.
- PR #191 (draft) rozwija wygląd paszportu i serwerowe stemple.
- PR #212 (merged) udostępnił **ukrytą betę** Passport + Maker przez parametr ?beta=fren, nie jest to publiczny release.
- PR #201 (draft) przechowuje niezależny projekt The Pond Messenger i społecznościowych profili.
- PepeGochi backend jest osobnym draftem (#186), bez gotowego systemu room inventory.

Nie deklarować, że SQL z PR #184 i #191 wdrożono na produkcji; zweryfikować stan w Supabase przed jakimkolwiek rozpoczęciem implementacji.

**Obciążenie:** małe, jeśli stany odczytuje się przy otwarciu paszportu/questu, a serwer zapisuje rozwiązane etapy. Nie wymaga 24/7 połączeń ani Realtime per-konto. Ostateczne koszty zależą od liczby użytkowników i sposobu implementacji.

**Integracja:** nie nadpisywać ważnych rzeczy w aktualnym Fren Passport, nie zmieniać istniejących identyfikatorów sekretów, wspierać zapisane postępy i rozliczenie daty zdobycia. Serwer powinien przyznawać item tylko raz.

## 9. Harmonogram prac — etapami, bez wdrożenia bez decyzji właściciela

### Etap A — rozpiska historii i pierwszych zagadek (teraz)
Ta specyfikacja. Rozrysować pierwszą sekwencję Lost Floppy → Wrong Frog → Forgotten Notes i trzy stopnie podpowiedzi. Ustalić precyzyjnie, co weryfikuje serwer, a co jest tylko interakcją wizualną.

### Etap B — MVP pierwszego rozdziału (mały osobny draft PR)
Trzy zadania, bez dużej grafiki i bez nowego systemu inventory; sprawdzanie etapów w Supabase; działanie desktop i mobile. Test użytkowy przez osoby, które nie widziały zagadek.

### Etap C — Collection UX
Rozróżnienie Undiscovered / Coming soon / Discovered, podpowiedzi, pokazanie daty i wyraziste, lekkie powiadomienia. Ewentualnie stary styl „The file was recovered”.

### Etap D — większa tajemnica
Blue Screen of Fren, Midnight Fren, Paper Crown, sześć części mapy i finał; osobny publiczny mechanizm dzielenia się wskazówkami, bez obowiązkowej społecznej bramki.

### Etap E — integracja z PepeGochi
Dopiero po bezpiecznym API inventory: w pokoju pojawiają się pamiątki z zagadek, bez zdublowanych źródeł nagród. Moon Rock wymaga osobnej serwerowej weryfikacji lotu w YEET.

## 10. Jak sprawdzać, czy to faktycznie działa

Po testowym rozdziale sprawdzić:
- ilu ludzi zaczyna i kończy pierwszą przygodę,
- czy wracają rozwiązać kolejny etap,
- na którym kroku się gubią,
- czy gracze pomagają sobie w The Pond / Discordzie,
- czy przeciętny gracz radzi sobie na telefonie.

Nie oceniać sukcesu po liczbie rozdanych badge'y. Nie budować pełnych 12 sekretów, jeśli trzy pierwsze nie dają radości.

## 11. Handoff do Claude

Polecenie: **„Przeczytaj docs/design/lost-pond-files/README.md, dokumentację i katalog obecnego Fren Passport. Najpierw przedstaw storyboard trzech zagadek z etapami, podpowiedziami i nieoszukiwalnymi warunkami zapisu; niczego nie implementuj, dopóki nie zaakceptuję scenariusza. Uwzględnij aktualną ukrytą betę ?beta=fren i wcześniejsze PR-y #184/#191/#212. Nie wdrażaj SQL na produkcję, nie merge'uj ani nie publikuj bez zgody.”**

## 12. Ostatnia decyzja

**Zagadka to nie rzadki badge.** Zagadki mają być wciągającą opowieścią osadzoną w starym systemie operacyjnym. Kolekcja jest pamiętnikiem przygody. Budujemy przywiązanie do PondOS i relacje między frens, a nie obowiązek codziennego logowania.

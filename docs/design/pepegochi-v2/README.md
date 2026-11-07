# PepeGochi 2.0 — specyfikacja gry dla PepecoinHub
**Status:** PROJEKT / zasady rozgrywki, nie wdrożenie. Wersja 0.1, 2026-11-07. 
**Przeznaczenie:** handoff do Claude Code oraz zapis decyzji po rozmowie z właścicielem PepecoinHub.
**Kolejność:** najpierw zaprojektować i zaimplementować logikę oraz integrację; **projekt graficzny i finalne assety pozostają do osobnego zatwierdzenia z ChatGPT/właścicielem**.

## 0. Sedno gry

Jedna osoba ma **własnego PepeGochi** (nie wracamy do oryginalnego konceptu jednego zwierzaka dla wszystkich). Zwierzak rośnie, ma potrzeby i osobowość, lecz nie jest nieśmiertelną dekoracją. **Może odejść po dłuższym zaniedbaniu**: użytkownik wraca do pustego pokoju i znajduje zabawny list, bo żaba znudziła się czekaniem i wyprowadziła. NIE pokazywać dosłownej śmierci. Właściciel może zaadoptować kolejne jajko/żabę. **Przeszłe osiągnięcia, wspomnienia i kolekcje pozostają na koncie.** Znika tylko aktualny zwierzak, aktywny ciąg opieki i wyzwania związane z tym konkretnym życiem.

Przykładowy najważniejszy tekst doświadczenia: "My PepeGochi left me and took the TV lmao." Meme vibe, humor starego internetu, ale bez upokarzania gracza.

## 1. Co użytkownik zaakceptował, a co jest propozycją

### Uzgodniony kierunek (potwierdzony w rozmowie)
- Każdy użytkownik ma osobistego, nazwanego PepeGochi z trwałym stanem powiązanym z Discord.
- **Ryzyko utraty aktualnego zwierzaka** jest pożądane: osiągnięcia za długą, świadomą opiekę będą wtedy wartościowsze.
- Porażka narracyjna to **wyprowadzka żaby**, nie śmierć: pusty pokój + list zostawiony na stole/podłodze + ponowna adopcja.
- Wpasowanie w retro PondOS 98 i memiczny klimat PepecoinHub. Żart, nie ciężki dramat.
- Dłuższy rozwój niż obecne 7 dni do dorosłej żaby; chcemy aktywności po 30, 60 i 100 dniach.
- Integracja ze wspólnym **Fren Passport**: osiągnięcia, stemple, kolekcje, historia zwierzaków.
- Tylko jedna aktywna żaba na użytkownika w wersji początkowej, bez wspólnej żaby dla wszystkich.
- Wygląd i art direction przygotujemy osobno. Claude nie ma wymyślać na własną rękę nowej estetyki ani podmieniać zaakceptowanej grafiki PondOS.
- Użytkownik rozważa nagrody związane z PEP, ale **mechanika rzeczywistych wypłat i mnożnika NIE została zatwierdzona**.

### Proponowane parametry, DO POTWIERDZENIA po playteście
- Zaniedbanie po 1–2 dobach: hungry/moody; 3–4: neglected/sad; 5–6: packing suitcase / ostrzeżenie; po **7 pełnych dobach** bez przyjętej opieki: departed (wyprowadzka).
- Dwa dni rekonwalescencji po krytycznym zaniedbaniu, zamiast jednego kliknięcia przywracającego pełne szczęście.
- Opcjonalne wyzwanie "Fren Guardian" wymagające 30 dni świadomej opieki z maksymalnie 3 dniami ochronnymi.
- Proponowane długie kamienie milowe: 30 dni "Good Parent", 100 dni z jedną żabą "Best Fren Forever", sekretny humorystyczny zapis pierwszej wyprowadzki "It's Not Me, It's You". Te etykiety i progi **nie są jeszcze obowiązującymi rekordami katalogu**.
- Dobrowolne Rebirth po ~60+ dniach / alternatywne ewolucje: pomysł na późniejszą fazę, NIE implementować przy pierwszym MVP.
- Proponowane osobowości (leniuch, żarłok, ciekawski), różne warianty listu i animacji: faza późniejsza.

Nie przedstawiać tych wartości jako istniejących na produkcji ani jako decyzji wdrożeniowych niepodlegających dyskusji.

## 2. Dokładny cykl jednego życia

### 2.1 Adopcja
- Użytkownik Discord wybiera imię i adoptuje jajko/kijankę. Nowy zapis po stronie serwera zawiera niezależny, nieodgadywalny pet-life ID, owner Auth user_id, daty server UTC oraz kondycję.
- Tylko jeden aktywny zwierzak jednocześnie; nie można uzyskać równolegle dwóch adopcji przez wyścig żądań.
- Adopcja jest nieodwracalna w trakcie aktywnego życia; "replace" nie służy do farmienia rewardów.
- Użytkownik bez Discorda może widzieć podgląd edukacyjny tylko jeśli nie udaje on prawdziwego zapisu.

### 2.2 Rozwój
Obecny backend v1 ma etapy: tadpole = 0–1 distinct care days, froglet = 2–6, adult = 7+. Chcemy **zachować ten kompatybilny fundament**, lecz dorosłość nie jest końcem:
- 1–7 dni: podstawy, karmienie, kąpiel, zabawa, odpoczynek, zmiany etapu życia;
- 8–30 dni: lepsze reakcje i pierwsze wyzwania, ewentualnie "personality seeds";
- 31–60 dni: interakcje z pokojem i trwałe małe kosmetyczne ulepszenia;
- 61–100 dni i dalej: kolejne wyzwania, pamiątki, przygody, ewentualne dobrowolne rebirth (po osobnym projekcie i zgodzie).
- **Nie projektować teraz rozbudowanych leveli ani losowych rzadkości**. Zaczynamy od sensownej pętli opieki i pozytywnego feedbacku.

### 2.3 Cztery potrzeby i akcje
Używamy obecnych czterech potrzeb: hunger, hygiene, mood, energy; i akcji feed, clean, play, rest. Docelowo mają znaczenie nie tylko kosmetyczne:
- Gdy zaniedbane: widoczna zmiana zachowania, humoru i otoczenia oraz ograniczenie zwykłej zabawy, dopóki nie nastąpi poprawa.
- Po kilku dniach zaniedbania **nie wszystko wraca do 100 po jednym Feed**. Recovery wymaga dobrej opieki w więcej niż jednej sesji / przez co najmniej 2 doby (propozycja).
- Nie budować mechaniki stale wymagającej 12 kliknięć każdego dnia. Wystarczy krótka, sensowna sesja.
- V1 obecnie ma server-timestamp, fractional need decay, cap 12 zaakceptowanych akcji/dzień i cooldowny 30/20/45/60 min — patrz oryginalny kontrakt. Zachować te zasady dopóki testy nie pokażą potrzeby zmiany.

### 2.4 Zaniedbanie i ostrzeżenia
Przykładowa, testowana polityka oparta o **czas serwerowy od ostatniej skutecznej akcji opieki**:
- poniżej 48 h: normalny/hungry/moody;
- od 48 h do poniżej 120 h: sad/neglected, ryzyko choroby;
- od 120 h do poniżej 168 h: warning / walizka / pakowanie i zbliżająca się wyprowadzka;
- od 168 h: departed, o ile nie nastąpiło skuteczne uratowanie.
- Nie używać zegara urządzenia, lokalStorage ani local midnight jako autorytatywnej miary czasu.
- **Zanim nastąpi wyprowadzka, ekran powinien wprost ostrzec: "Your Fren is thinking of leaving".** Zasady muszą być jasne w momencie adopcji.
- Progi to kandydat do playtestu. Finalne liczby wybrać po sprawdzeniu reakcji zwykłych graczy oraz wskaźników porzuceń; ostrzeżenia w aplikacji nie są powiadomieniami push.
- W pierwszym wdrożeniu można oprzeć departure o brak opieki w czasie. Później dodać precyzyjne warunki jakościowe bazujące na potrzebach. **Nie wypuszczać algorytmu, w którym pojedyncze wywołanie dowolnej akcji co 6 dni gwarantuje prestiżowy badge bez faktycznej opieki.**

### 2.5 Wyprowadzka
- Po wejściu w stan departed: pokój pozostaje, ale żaby brak, jej walizka znika, na ekranie jest koperta/list GOODBYE.TXT.
- **Nie usuwać przedmiotów z konta**, nawet jeśli żaba w żartach napisała, że zabrała TV. Można schować TV jedynie w wizualnej scenie odejścia; po adopcji nowej żaby wraca do inventory.
- Zakończony life zapisuje się do historii: name, adopted_at, departed_at, distinct care days, days together, longest good-care streak, opcjonalny quote/reason. Ewentualnie lista maksymalnie ostatnich N w UI; w DB minimum dla integralności.
- Stare stamps, achievements, specjalne awatary, nadane tytuły, dekoracje i profil zostają. Traci się tylko aktualny pet i bieżące wyzwania przypisane do life_id.
- Stan departed zapisuje się **co najwyżej raz**, bez wielu kolejnych listów i bez ponownego przyznawania "It's Not Me, It's You" w nieskończoność.
- Dopiero po wyświetleniu listu gracz może dobrowolnie rozpocząć nową adopcję / jajko. **Nie wykonywać automatycznej reinkarnacji bez wiedzy właściciela.**
- Nie nagradzać zaniedbywania atrakcyjnymi zasobami. Humorystyczną pamiątkę "It's Not Me, It's You" można zapisać jako memory/secret, nie w głównej ścieżce progresji.

### 2.6 Powrót po dłuższej przerwie
- Jedno otwarcie aplikacji po 7+ dobach oblicza zaległy stan i wyświetla scenę, bez potrzeby crona, heartbeatów i serwera nasłuchującego co minutę.
- Krytycznie: **nie wolno retroaktywnie wyrzucać istniejących petów przy pierwszym uruchomieniu nowego kodu**. Dla migrowanych petów zaplanować jednorazową ochronę/grace i widoczne wyjaśnienie nowych zasad. Nie fałszować poprzednich care days.
- Testować granicę 168 h, brak sieci, dwie karty, ponawianie requestu, zmianę strefy czasowej, rollback po błędzie.

## 3. Nagrody i Fren Passport — jedna księga prawdy

Stamps = pamiątki za osiągnięcia, Achievements = lista warunków / postępu, Collection = fizyczne / dekoracyjne przedmioty, History / Stats = historia kolejnych życia; nie tworzyć trzech osobnych, niespójnych mechanizmów award.

### 3.1 Istniejące planowane ID z katalogu
- first_hatch (adopt), little_fren (2nd care day), grown_fren (7th care day): planowane teraz, odblokować tylko w pełni serwerowo potwierdzone; to najważniejszy pierwszy zakres integracji.
- good_parent (30 distinct care days): wcześniej planowany; jeśli zmieniamy regułę na **30 dni dobrej opieki w jednym life** trzeba jawnie zaktualizować opis oraz migrację, a nie potajemnie zmienić regułę.
- perfect_parent (miesiąc "good care"): planowane, wymaga jasnej, odróżnialnej od good_parent definicji. Nie publikować jako drugiej odznaki za to samo.
- interior_designer, lunar_decorator, trophy_shelf, collector: dopiero gdy działa autorytatywny room/inventory backend.
- certified_fren oznacza **100 różnych dni aktywności w PondOS**, a nie 100 dni PepeGochi; bridge PR #186 musi zostać poprawiony/zastąpiony przed wdrożeniem.

### 3.2 Proponowane nowe nagrody / memories
- "Fren Guardian": opcjonalne wyzwanie 30 dni prawdziwej, dobrej opieki w obrębie jednego życia; maksymalnie 3 dni ochronne. Dokładny algorytm jakości i dni trzeba zatwierdzić i przetestować.
- "Good Parent": zasadniczy stempel 30 dni dobrej opieki w jednym życiu. Zamiast duplikatu, to właśnie ukończenie Fren Guardian może odblokowywać Good Parent.
- "Best Fren Forever": wyjątkowa długoterminowa pamiątka za 100 dni utrzymania **tego samego** zwierzaka bez odejścia; nie jest to jeszcze zatwierdzona reguła.
- "It's Not Me, It's You": zabawne archiwalne wspomnienie pierwszego odejścia, bez przedmiotu, rzadkiego avatara czy PEP.
- Lepiej mniej konkretnych milestones, niż 100 odznak za każde nakarmienie.

### 3.3 Co ma się wyświetlać
- Passport Overview: avatar właściciela, podgląd obecnego PepeGochi (name, stage, status, pet life day, next meaningful milestone) + wejście do pokoju. Jeśli zwierzak odszedł, nie udawać że nadal żyje; widok "Former Fren / Adopt new egg".
- Achievements: rzeczywiście odblokowane milestone'y i opis następnego celu; planned pokazane jako "Coming soon" zgodnie z polityką katalogu.
- Stamps: ważne osiągnięcia jako prawdziwe pieczątki, nie sztuczne licznikowe spamowanie.
- Collection: tylko przedmioty rzeczywiście posiadane; Moon Rock, Old Floppy, Paper Crown, Rubber Duck i inne z osobnych przygód dopiero po backendzie inventory.
- Stats / Pet History: dane poprzednich zwierzaków: Former Frens, Longest Friendship, Current Fren, earned care days, departures. Pokaz tylko danych użytkownika; ewentualny publiczny snapshot to osobny opt-in etap.
- Nie dodawać szóstego ogromnego obszaru, jeśli mniejsza karta w Overview wystarczy.

## 4. Wyzwanie 30 dni: dlaczego i jak nie robić z niego udręki

**Cel:** gracz ma chronić jedną konkretną żabę i dbać o jej potrzeby; może wyzwanie przegrać bez utraty osiągnięć z przeszłości. Frajdę daje prawdziwy sukces, nie czekanie na licznik.

**Proponowany bezpieczny wariant do playtestu:**
- Gracz dobrowolnie rozpoczyna challenge dla bieżącego life_id.
- Zbiera 30 kwalifikowanych dni opieki, w oknie do maksymalnie 33 kolejnych dni kalendarzowych; 3 dni można opuścić bez zniweczenia szansy.
- Kwalifikowany dzień musi obejmować serwerowo zaakceptowaną, sensowną opiekę z dostateczną kondycją zwierzaka (konkretne progi ustalić w testach); samo wejście do gry NIE wystarcza.
- Wyprowadzka zwierzaka kończy wyzwanie porażką.
- Po porażce można rozpocząć nową próbę; nie usuwać wcześniej zdobytych nagród.
- Brak automatycznego przyznawania PEP za logowanie. Żadnej real-money puli w MVP.
- Zanim to wejdzie na produkcję, koniecznie sprawdzić, czy 3 darmowe dni nie kolidują z 7-dniowym departure i czy nierówny rozkład dni pozwala ukończyć challenge w sensowny sposób.

**Alternatywa:** prostszy pierwszy MVP "30 odrębnych dni dobrej opieki jednym zwierzakiem, bez opuszczania do 7 dni z rzędu", bez 33-dniowego eventu. Claude ma przedstawić obie implementacje, koszty i potencjalną irytację graczy. Właściciel zdecyduje przed kodowaniem challenge.

## 5. Krypto i Pepe Guesser — pomysł, ale BEZ IMPLEMENTACJI W MVP

W rozmowie właściciel zaproponował np. **1,5× do wypłaty w PEP przy wyniku/rozgrywce Pepe Guesser po 30 dniach opieki**. Nie został przyjęty jako decyzja produkcyjna.

Powody ostrożności:
- Automatyczne karmienie botem / multikonta przez Discord są możliwe, niezależnie od autorytatywnego stanu i allowlist RPC.
- Realne wypłaty PEP oznaczają koszt, reklamacje, reguły rozliczeń i potencjalne obowiązki prawne. Nie budować prostego zapytania, które pozwoli klientowi ustawiać multiplier=1.5.
- Gry i wypłaty mają obecnie odrębne mechanizmy. Nie obiecywać automatycznych nagród ani samoczynnego transferu tokenów.
- Na MVP **wynagrodzenie wyłącznie kosmetyczne**: stamp, avatar, dekoracja, zabawna animacja. Jeśli później bonus PEP, tylko po osobnym audycie anti-multi, zasad konkursu, budżetu, prawa i weryfikacji wyników gry.
- Można użyć bonusu 1,5× do **wewnętrznego, niewymienialnego postępu kosmetycznego** bez wpływu na ranking wyników lub PEP. To także wymaga akceptacji projektowej.

## 6. Room i przedmioty: nie udawać że już działają

PepeGochi backend v1 z PR #186 nie posiada inventory ani zapisywania wystroju. Nie można tworzyć fikcyjnych "server-authoritative items" przez localStorage.

W przyszłości należy:
- przechowywać stan pokoju i własność przedmiotów na serwerze powiązanym z paszportem;
- odblokowywać dekoracje przez potwierdzone zdarzenia (The Lost Pond Files PR #214, istniejące gry, wydarzenia, rzeczywiste care milestones);
- utrzymywać kolekcję właściciela przy odejściu zwierzaka; nowa żaba może korzystać z dawnych dekoracji;
- unikać pay-to-win lub rzadkich losowych nagród, które wypychają zwykłych graczy;
- w razie korzystania z grafiki z prywatnego repo mlewis412/pepegachi potwierdzić licencję/zgodę autora.

## 7. Konsekwencje społeczne i przyszłość

- Użytkownik może pochwalić się osiągnięciem, ale bez automatycznego floodu na czacie.
- Opcjonalny publiczny podgląd pet + paszport powiązać z The Pond Messenger (osobny projekt w PR #201).
- Nie tworzyć na razie wspólnego PepeGochi. Może istnieć w przyszłości jako niezależna maskotka eventowa, ale nie zamiast osobistego zwierzaka.
- Wzajemne odwiedziny/podarunki do rozważenia dopiero po wdrożeniu bezpiecznego inventory i ustawień prywatności.
- Osobowości (żarłok, leniuch, ciekawski), różne zabawne listy, nowe generacje czy Rebirth zachować na późniejszą wersję.

## 8. Zależności — stan repo przy zapisie 2026-11-07

- PR #186: draft backendu jednego zwierzaka na użytkownika, *nie wdrożony* na Supabase; zawiera games/supabase/update_pepegochi_v1.sql i games/PEPEGOCHI_API.md.
- **Nie kopiować ślepo** gier z prywatnego mlewis412/pepegachi. Źródło wymaga weryfikacji uprawnień i portu z Devvit do statycznego PondOS.
- PR #212: **scalona** ukryta beta Fren Passport / Avatar Maker dostępna po wejściu z parametrem ?beta=fren. Gdy odpowiednich RPC brak, zmiany są local test preview, nie live progress.
- PR #213: poprawki Maker (usta, oczy itd.) **scalone** 2026-11-07.
- PR #215: poprawki elementów nakrycia głowy/okularów były w toku przy przygotowaniu dokumentu; zweryfikować najnowszy stan zanim zacznie się implementację.
- games/FREN_PASSPORT_ACHIEVEMENTS_DECISIONS_2026-11-06.md: zaakceptowane reguły stampów; nadrzędne dla sprzecznych opisów ze starych PR.
- PR #214: The Lost Pond Files, fabuła, sekrety i przyszłe itemy.
- PR #201: The Pond Messenger, potencjalny publiczny profil zwierzaka.
- W kontrakcie PR #186 działa jeden pet na konto i trwała adopcja — **to musi zostać świadomie zmigrowane na kilka kolejnych cykli życia z jednym aktywnym petem**, a nie ominięte przez implementację frontendu.

## 9. Kryteria jakości całego projektu

1. Od adopcji do zakończenia życia jest jasny, przewidywalny przebieg; ostrzeżenia nie są ukryte.
2. Żaba nie umiera: odchodzi i zostawia list, a użytkownik może zacząć od nowa.
3. Pierwsze odejście pokazuje scenę dokładnie raz; kolejna adopcja możliwa, a stare historyczne stany zachowane.
4. Zdobyte stampy, przedmioty i avatary nigdy nie są odbierane przy wyprowadzce.
5. Każda nagroda serwerowo autoryzowana, bez klientowego wywołania "daj mi stempel".
6. 30-dniowe osiągnięcie ma realnie wymagającą, ale ludzką regułę i nie jest duplikatem nagrody za zwykłe dni kalendarzowe.
7. Nikt nie traci już istniejącej żaby wskutek samego upgrade'u.
8. Użytkownik na telefonie może w pełni wykonać wszystkie interakcje.
9. Brak nowego serwera, crona, Realtime na każdą klatkę, autonomicznych wypłat PEP.
10. Najpierw stabilna logika i testy, **wygląd będzie projektowany później**.

**Ta specyfikacja opisuje pomysły, nie zaimplementowaną grę ani zgodę na produkcyjne zmiany.**

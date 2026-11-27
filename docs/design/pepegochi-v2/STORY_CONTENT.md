# PepeGochi 2.0 — sceny, dialogi i teksty (EN)
**Stan:** pomysły fabularne do zatwierdzenia, bez ostatecznych grafik i bez implementacji. 2026-11-07.
**Zasada:** klimat lat 1998–2003, klasyczne okienko programu, humor internetu i Pepe, bez makabrycznej śmierci i agresywnej manipulacji emocjonalnej.

## 1. Ton i dramaturgia
To jest memo / komediowe Tamagotchi. Żaba ma charakter i może mieć dość. Właściciel po nieobecności zastaje **pusty pokój**, niedomkniętą szufladę, zakurzony ekran, kopertę z plikiem GOODBYE.TXT i ślady wyprowadzki. Można pokazać walizkę, ale nie straszyć dzieci ani przedstawiać zwierzęcia jako umierającego. Mimo odejścia przygoda właściciela trwa; może adoptować nowego Fren.

**Nie używać tonu:** "You're a horrible owner", "you killed me", "you have lost all progress", "pay to revive me" czy innych zawstydzających tekstów.
**Język interfejsu:** angielski internetowy, krótki, naturalny; możliwość lokalizacji później.

## 2. Przykładowa sekwencja na ekranie

### Adopcja
Nagłówek: "A new fren has arrived!"
Tekst: "Give your little frog a name. Feed, clean, play and let it rest. But don't disappear forever — frens have feelings too."
Przyciski: "Adopt Fren" / "Maybe Later".
Po adopcji: "Nice. You have a roommate now."

### Zaniedbanie: początek
Stan: "Hungry" / "Moody".
Okienko: "Your Fren misses you. Maybe check on them?"
Nie wymaga powiadomienia push.

### Neglected, 3–4 dni (liczby robocze)
Stan: "Not impressed".
Tekst: "The food bowl is empty. Your Fren has started judging you."
Wymagana opieka i recovery, bez automatycznej utraty dorobku.

### Walizka, 5–6 dni (liczby robocze)
Stan: "Packing..."
Tekst: "Your Fren packed a tiny suitcase. This is not a drill."
Opis: "Come back and take care of your frog before they decide to leave."
Pokaż wyraźnie możliwy próg wyprowadzki. Najpóźniej tutaj gracz musi rozumieć konsekwencję.

### Wyprowadzka, po przekroczeniu finalnie zatwierdzonego progu
Scena: pusty pokój, list na podłodze/stole. Opcjonalnie napis "PEPEGOCHI.EXE — Your fren has left the pond". Nie usuwać przedmiotów z inventory.
Akcja: klik w list otwiera klasyczny notatnik "GOODBYE.TXT".
Na dole: "Adopt a New Fren" i "View Past Frens".

## 3. Kanoniczny szkic listu GOODBYE.TXT

Dear Fren,

I waited.
I got hungry.
I ate the furniture.

Then I realized I deserve better.

So I packed my stuff and left.

Don't worry about me. I'll be fine.

You should probably get yourself another frog.

P.S. I took the TV.

- Your former PepeGochi

**Uwaga mechaniczna:** P.S. jest wyłącznie żartem. Telewizorek i każde zakupione/odblokowane wyposażenie pozostaje w account inventory. Jeśli scena nie pokazuje TV, powinno się je odzyskać natychmiast po opuszczeniu sceny.

## 4. Potencjalne warianty (nie każdemu graczowi ten sam list)
Wybrać wyłącznie na podstawie zweryfikowanego, prostego podsumowania historii akcji; nie wprowadzać AI ani generycznego "zły rodzic". Nie tworzyć osobnych nagród za odczytanie każdego wariantu.

### Fed but never played
"You fed me every day, but we never had any fun. I'm moving to a more interesting pond."

### Neglected hygiene
"I can finally smell fresh air. Please clean that room before adopting someone else."

### Spoiled then abandoned
"I was living like a king. Then you disappeared. My lawyer will contact you."

### Minimalist / no room decor
"Nice room. Shame there was nothing to do except stare at the wall."

### Hungry and angry
"I considered staying, but then I remembered the last meal. Good luck with your next roommate."

### Brief farewell
"It's not me. It's you. Anyway, bye."

Te warianty zachować jako opcjonalne. W pierwszym MVP wystarczy jeden kanoniczny list.

## 5. Re-adopcja i wspomnienia
Po scenie:
- "Not all frens stay forever. But the good times stay in your Passport."
- "Former Frens: 1" 
- "Longest Friendship: 84 days" (wyłącznie rzeczywista liczba z backendu)
- "New Egg" / "Adopt a New Fren"
- Zapis w Stats: imię, czas wspólnej historii, liczba dni rzeczywistej opieki, nazwa "Left for a different pond".
- Po adopcji nowego: "Welcome home, tiny fren. Try not to eat the sofa."

## 6. Wyzwania
- "Fren Guardian" — optional long-term care challenge (reguły do zatwierdzenia).
- "Good Parent" — meaningful 30-day care milestone with server-side proof.
- "Best Fren Forever" — possible 100-day one-pet award (unapproved).
- "It's Not Me, It's You" — optional private memory for first departure, NOT a motivational reward for deliberately neglecting pets.
- Po sukcesie: "Your Fren stayed. That's love. Or maybe the food's just really good."

## 7. Potencjalne zadania na assety (na później, po uzgodnieniu grafiki)
- Egg/tadpole/froglet/adult + idle/sick/packing animations matching the existing PepeGochi art style.
- Small room states: clean/untidy/empty; suitcase, letter on table, classic Notepad panel.
- Room icons Feed/Clean/Play/Rest, care-day counter and new-egg action.
- Passport small pet summary and Past Frens page.
- Animacja listu / floppy disk / old Windows dialog. Bez tworzenia finalnych renderów w tym dokumentacyjnym PR.
- Nie zmieniać zatwierdzonego awatara właściciela ani oryginalnych special avatars.

## 8. Feedback od graczy do sprawdzenia przed publikacją
- Czy po 5–7 dniach żaba wygląda na zaniedbaną, ale jej odejście nie jest niespodzianką?
- Czy powrót do pustego pokoju wywołuje śmiech i chęć adoptowania kolejnej żaby?
- Czy osiągnięcie 30 dni jest odczuwane jako sukces, nie codzienny obowiązek?
- Czy można to ogarnąć na telefonie w 2–3 minuty na sesję?
- Czy 100 dni z jednym zwierzakiem ma realny sens, gdy zwykłe grafiki i zwyczajowe akcje stają się monotonne?

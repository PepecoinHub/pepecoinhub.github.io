# Jak znaleźć moderatorów, którzy zainstalują Sub Says

## Zanim cokolwiek wyślesz

1. `devvit publish` (domyślnie niepubliczna) albo `--public`; do przeglądu przyda się strona z zasadami i prywatnością (`docs/games/sub-says.html`, po wdrożeniu strony: `https://pepecoinhub.github.io/games/sub-says.html`, sprawdź adres).
2. Sprawdź nazwę w bazie znaków towarowych (USPTO, EUIPO). Wyszukiwanie, które zrobiłem, jest płytkie.
3. Uruchom grę w 2–3 własnych subach i zbierz liczby: ilu graczy dziennie, ile osób wraca następnego dnia, ile rund zakończyło się planszą. Panel Reddit Developer pokazuje dzienną liczbę osób, które coś kliknęły w aplikacji (ten sam wykres, który masz w zrzucie ekranu).

## Kogo wybrać (około 20, każdego osobno)

- Średnie, żywe społeczności (orientacyjnie 50 tys. do 1 mln) z silną tożsamością: fandomy konkretnych gier i seriali, kuchnia, fitness, kluby sportowe, miasta, kryptowaluty.
- Takie, które już mają codzienne wątki dyskusyjne ("Daily Discussion", "Question of the day"): moderator od razu widzi, że to zastępuje jego pracę.
- Odpuść największe suby (moderatorów nie da się dopisać) i suby bez aktywności (nie osiągną progu 20 odpowiadających).

## Wiadomość do moderatorów (modmail, po angielsku)

> **Subject:** Free daily game for r/{sub}, with 30 questions I wrote for your community
>
> Hi! I built Sub Says, a free survey-guessing game that runs entirely on Reddit. Every day your members answer one question ("Name something you'd bring to a picnic"), and the next day they guess what the sub said, one answer at a time. Points go to whoever guesses what most people answered.
>
> It posts itself, needs no upkeep, has no ads, and no data leaves Reddit (it uses Reddit's own storage, no outside server). You pick the question category, can add your own questions, and can hide any answer from the mod menu.
>
> I've attached 30 questions written for r/{sub}. Edit or veto any of them. Install link: {link}. You can uninstall at any time.
>
> Happy to answer questions. Thanks for reading!

Do każdej wiadomości dołącz 30 pytań napisanych pod ten sub (w formacie "Name ...", po jednym w linii: moderator wkleja je w ustawienie "Your own questions"). To jest główny argument.

## Post w r/Devvit (po angielsku, krótki)

> **Sub Says: a daily "guess what the sub said" game, no external server**
> Players answer one question a day; the next day they guess the board of most common answers. Answers merge typos and plurals, need 3 people to reach the board, and moderators can hide any answer. Built on Devvit Web with Redis only. Happy to share what I learned about {…}. Feedback welcome!

Zamiast reklamy dodaj coś, co pomaga innym twórcom (np. jak scalasz odpowiedzi bez serwera, jak zrobiłeś symulator z przesuwanym zegarem). Posty tylko-reklamowe wypadają słabo.

## Realistyczne oczekiwania

Wielu moderatorów nie odpowie. Przy 20 starannie dobranych subach licz raczej na kilka zgód niż na lawinę. Masowa wysyłka grozi blokadą za spam, więc pisz po kolei i każdemu inaczej.

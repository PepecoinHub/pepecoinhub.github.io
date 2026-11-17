# PepeGochi A11 — Private Pond

Graficzne ulepszenie pokoju do wspólnego, odroczonego wydania Pepegachi w PR #353.

- Nowe tło: zielona tapeta z liliami, księżycowy staw za zasłonami, ciepłe drewniane meble i podłoga, pikowane legowisko, dywan z żabim motywem.
- Osobna tabliczka „NO FUD AFTER BEDTIME” i cienie pod niezależnymi przedmiotami.
- Układ 640×400 i wszystkie dotychczasowe identyfikatory, współrzędne wyposażenia, położenie żaby oraz listu pozostają bez zmian.
- Telewizor, lampa, obraz, kubek, roślina, kaczka i zdobywane dekoracje pozostają oddzielnymi warstwami. Nie są wrysowane w tło. Pusty ekwipunek nie otrzymuje dekoracji; wyprowadzka nadal ukrywa wyłącznie wskazany przedmiot.

`preview.html` działa offline. Zrzuty wykonano rzeczywistym rendererem, z lokalnym przykładowym wyposażeniem; pełny pokój na podglądzie nie oznacza przyznania graczom wszystkich przedmiotów. Porównanie starego i nowego tła korzysta z aktualnych osobnych warstw i nowej tabliczki.

Grafika wygenerowana na podstawie istniejącego tła; źródło w `source/generated-room.png`. Eksport techniczny przez `scripts/export_pepegochi_room.cjs`: 320×200 logicznych pikseli, paleta do 256 kolorów, następnie nearest-neighbour ×2 do 640×400. Runtime: `docs/games/img/pepegochi/room_pond_den_v1.png`. Oryginalne tło zachowane.

QA: Node 346 zaliczonych / 26 pominiętych środowiskowo / 0 błędów; kontrola strony. Chromium: pełne/puste wyposażenie, młoda żaba, wyprowadzka i klawiaturowo dostępny list, szerokości 320/390/900 px, komplet obrazków, bez zewnętrznych żądań. Test: `node tests/pepegochi-room-browser.cjs`.

Nie scalono ani nie wdrożono. Wchodzi razem z całością Pepegachi po decyzji właściciela o premierze.

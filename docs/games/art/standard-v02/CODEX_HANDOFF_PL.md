# CODEX: Frogageddon 2.0 – jedna żaba, hełm po pierwszych obrażeniach

Aktualizacja wymagań właściciela po PR #267. **Nie modyfikuj już fundamentu animacji #267 bez konieczności.** Nowe prace w osobnym Draft PR zależnym od #267, po uzyskaniu akceptacji grafik.

1. Wersja 2.0 ma jeden domyślny wygląd żaby. Zachowaj stare skiny w repozytorium; nie kasuj assetów i danych. Jeśli zmieniasz wybór postaci w betie, rób to na osobnym feature flag / PR, nie naruszając klasycznego Pond Wars.
2. Ciało i hełm to **dwie niezależne warstwy**. Broń pozostaje warstwą istniejącą od PR #266. Nie wbudowuj bazooki w animacje ciała ani hełmu w 11 klipów.
3. Po **pierwszej rzeczywistej utracie co najmniej 1 HP** postać trwale traci hełm do końca meczu. To czysta kosmetyka; obrażenia i hitboxy nie zmieniają się.
4. Przez krótką animację hełm obraca się i odlatuje od głowy. Powinien być rysowany w przestrzeni świata i istnieć tylko jako particle visual. Nie koliduje z terenem i żabami, nie ma znaczenia dla serwera czy rozgrywki.
5. Wykorzystaj istniejący `CharacterAnimator.observe()` / HP transitions, ale uniknij przypadkowej wielokrotnej utraty hełmu; pamiętaj o odtworzeniu stanu po reconnect / reload. Obecnie wszystkie żaby zaczynają od 100 HP i nie istnieje mechanika leczenia, dlatego `hp < initialHP` wystarcza do pokazania braku hełmu po odtworzeniu. Jeśli kiedyś dojdzie leczenie, potrzebna będzie trwała flaga w snapshotach.
6. Pauza zatrzymuje lot hełmu, reduced-motion usuwa hełm natychmiast. Reset meczu go przywraca. Nie restartuj efektu po reconnect, powtórnym renderze ani przejściu między turami.
7. Zachowaj kierunek źródłowej grafiki w prawo, stały pivot stóp, odwzorowanie odbicia lustrzanego przez `f.face`, punkty dłoni i istniejące celowanie; nie ruszaj `projectileOrigin()`. Źródło konceptu ma 512×512 px, ale punkt dłoni jest wstępny i wymaga kalibracji do póz aim/fire.
8. Testy: pierwszy damage = 1 HP, damage 0, friendly fire, fall damage, wielokrotne trafienia, one-shot KO, pauza, reduced-motion, game reset, reconnect ze stanem HP <100, każdy kierunek, telefon 390 px, przeciętne 30/60/144 fps. Sprawdź czy hełm nie zasłania HUD i flag drużyn.

Paczka artystyczna v0.2: `sprites/standard_frog_no_helmet.png`, `sprites/helmet_overlay_on_512_canvas.png`, `preview/helmet_loss_prototype.webp`, `docs/helmet_contract.json`. To **koncept do wizualnej akceptacji**, nie gotowe 43 klatki i nie nowy renderer.

Do dalszego uzgodnienia: wybór jednej postaci jako domyślnej oraz ostateczne proporcje / anchor dłoni. Proszę o wyraźne rozdzielenie w raporcie tego, co już działa z #267, od tego, co tylko jest planowane w nowych plikach.

Nie merge, nie wdrażaj, nie zmieniaj Supabase, SQL, rewardów ani balansu.

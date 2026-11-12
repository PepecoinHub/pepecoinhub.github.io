# FROGAGEDDON 2.0 — ART v0.6

Nowa, ręcznie skonstruowana grafika 2D w formacie rzeczywistego pixel artu.

- **Model:** zielony Pepe 3/4 skierowany w prawo; niebieska bluza; brązowe spodnie; oliwkowy hełm z literą P.
- **Dwie osobne warstwy:** `atlas.png` (ciało BEZ hełmu i BEZ broni) oraz `helmet_pose_atlas.png` (hełm zsynchronizowany klatka po klatce).
- **Klatki:** 128×128 RGBA, piksele 2×2, 11 stanów i 53 klatki, wspólna stopa [64,122].
- **Broń:** nie narysowano jej w klatkach; jest renderowana przez istniejący kod.
- **Wymagane:** tylko porównanie i QA bez zastępowania zatwierdzonych grafik; PR #270 pozostaje prototypem, a model v0.6 to nowy KANDYDAT.
- **Punkty dłoni:** w manifeście podane wizualne pozycje pięści. Do kalibracji w rzeczywistej grze dla granatu/bazooki/rewolweru, bez zmiany projectileOrigin.
- **Backflip:** 8 zróżnicowanych klatek pełnego obrotu. To nie jest idealny rysunek każdej pozy, lecz realna rotacja atlasu, możliwa do dalszego retuszu.
- **Hełm:** warstwa z 53 osobnymi klatkami do nakładania 1:1; animacja `previews/helmet_loss.gif` jest demem, nie efektem gameplay.
- **Walidacja:** `docs/QA.json`.

## Co przekazać Codex

Nowy zestaw powinien być podłączony WYŁĄCZNIE w osobnej fladze QA, np. `?art=pixel-v06`, bez podmiany `pixel-v04`, `standard-v02` albo `classic.webp`. Należy dodać obsługę 53 klatek, użyć `helmet_pose_atlas.png` według tych samych rect co ciało, nie wprowadzać dodatkowych proceduralnych transformacji podczas klipów autorskich. `CharacterAnimator` i zasady utraty hełmu z PR #269 pozostają bez zmian. Nie merge, nie deploy bez decyzji właściciela.

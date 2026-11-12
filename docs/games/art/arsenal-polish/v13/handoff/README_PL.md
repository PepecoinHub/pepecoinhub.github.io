# Frogageddon FX v1.3 — handoff PR #283

Paczka zawiera 6 odrębnych, prawdziwie przezroczystych atlasów PNG. To **grafiki do gry**, nie makiety pełnych ekranów. Wszystkie klatki: 128×128 RGBA, 2×2 bez antyaliasingu, 8+ px bezpiecznego marginesu, oś klipu [64,64].

## Co podłączyć
- `donkey.explosion`: nowy wybuch i opadający pył, 8 klatek.
- `doge.explosion`: czytelna pomarańczowa eksplozja z łapą, 8 klatek.
- `moon.explosion`: błysk księżycowy, 8 klatek.
- `pep.explosion`: niewielki rozbłysk po uderzeniu pojedynczego tokena, 6 klatek.
- `donkey.activation`: ostrzeżenie przed nalotem, 6 klatek. **W kodzie należy dopiero podłączyć klip do fazy warning; sam manifest nie wystarczy.**
- `ban.activation`: efekt uderzenia młota, 6 klatek. **Wymaga osobnego punktu zaczepienia przy trafieniu / eventu; nie nakładać na rękę bez kalibracji.**

Pierwsze cztery klipy da się podmienić/zarejestrować przez istniejący adapter w `docs/games/js/pondwars-weapon-art.mjs`; nie zmieniać hitboxów, prędkości, obrażeń ani punktu fizycznego. W `manifest_patch.json` są tylko nowe role, **łączyć je z istniejącym `manifest.json`, nie zastępować całego manifestu**. Zastosować zmiany do osobnej gałęzi bazującej na #283.

### Testy
- Zachować odtwarzanie z zegara animacji, pauzę, reduced motion oraz czyszczenie FX po restore.
- W reduced motion stosować `reducedFrame` albo klatkę 0 tam, gdzie adapter nie wspiera tego pola. Obecny runtime może wymagać małej poprawki klipów przy `reducedFrame`.
- Zweryfikować ekran prawdziwego uderzenia dla Moon, PEP, Doge i Donkey, także przy wielu równoczesnych trafieniach PEP.
- Animacje nie mogą zasłaniać licznika HP/znacznika drużyny ani zakrywać w pełni żaby przez cały czas.
- Nie scalać i nie publikować bez akceptacji właściciela.

**Uwaga:** To nowe projekty efektów specjalnych stworzone proceduralnie w spójnej, ograniczonej palecie. Trzeba je zatwierdzić wizualnie w skali 1200×600; `battlefield_scale_preview.png` jest tylko referencją rozmiaru, nie screenem z silnika.

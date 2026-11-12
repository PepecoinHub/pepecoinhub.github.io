# FROGAGEDDON – Miner’s Pickaxe v14

Komplet sześciu gotowych zasobów PNG RGBA, z przezroczystością i siatką 2×2 fizycznych pikseli. Zachowano kierunek i podwójnie zakończoną stalową głowicę obecnego kilofa, wzmocniono cieniowanie stali i słoje drewna oraz dodano wyraźną jasną owijkę chwytu.

## Pliki

| Ścieżka | Arkusz | Przeznaczenie |
|---|---|---|
| `held/pickaxe.png` | 64×64, 1 | Kilof w ręce, chwyt (18,48) |
| `sprites/pickaxe_flight.png` | 1024×128, 8 | Lot, 12 FPS, błysk na nieruchomej w lokalnej klatce głowicy |
| `effects/pickaxe_dig.png` | 768×128, 6 | Wbicie, iskra, ziemia i kamienie |
| `effects/pickaxe_hit.png` | 768×128, 6 | Bez napisów: rozbłysk, gwiazdki i iskry |
| `effects/pickaxe_catch.png` | 768×128, 6 | Złote kółko i rozbłysk przy złapaniu |
| `hud/pickaxe.png` | 64×64, 1 | Ikona menu broni |

Każda animacja jest pojedynczym **poziomym** atlasem klatek 128×128. Siatka 2×2, 8 px lub więcej przezroczystego marginesu w każdej klatce. Brak filtrów i antyaliasingu. Kontrola techniczna jest w `codex/asset_validation.json`.

## Integracja

Dane do podpięcia w silniku: `codex/manifest_patch.json`. Klucze `src`, `frame`, `columns`, `frames`, `fps`, `loop`, `anchor`, `size` oraz `grip` dla held. Ścieżki w manifeście są względne do katalogu głównego paczki. `size` to całkowity rozmiar arkusza w pikselach.

**Obrót:** 8 klatek lotu celowo nie obraca kilofa. Obracanie przedmiotu wokół jego środka (64,64) oraz ruch po paraboli wykonuje silnik gry. Przy braku trafienia gra powinna wyciąć fragment ziemi przy punkcie uderzenia, odtworzyć `pickaxe_dig` i zawrócić pocisk do właściciela. Przy trafieniu żaby odtworzyć `pickaxe_hit`, a przy schwytaniu `pickaxe_catch`.

**Ważne:** Same grafiki nie implementują logiki fizyki, wycinania gruntu, kolizji, powrotu ani nowych zasad obrażeń. Podpięcie jest zadaniem dla kodu gry; manifest jest patchem danych, nie gotowym mechanizmem rozgrywki.

`preview.png` pokazuje 1:1 i powiększenie ×3 obok referencyjnej żaby v06. Żaden istniejący zasób nie został nadpisany.

# Credits

Pepecoin Hub (pepecoinhub.com) is a fan site made by a regular person from r/pepecoin. It uses work by other people. This file says whose work it is, where it came from and under what terms. If you made something used here and want it credited differently or removed, write a letter through the Gazette on the site or open an issue on this repository.

Most of the site (pages, scripts, game code and the original PondOS art made for it) is this project's own work. The sections below list only what came from somewhere else.

## Characters and brands

- **Pepe the Frog** is a character created by Matt Furie. The frogs on this site are fan art and memes; nothing here is official or endorsed by him.
- **Pepecoin (PEP)** logos in `docs/assets/brand/official/` are the official logo files from [pepecoin.com](https://pepecoin.com). They are used only to name and identify Pepecoin. The press kit offers only these files for download.
- **Other coin logos** in `docs/assets/coins/` (BTC, LTC, DOGE, PEPE, Bells, Luckycoin, Junkcoin, Dingocoin, Shibacoin) are trademarks of their projects and are shown only to identify each coin. Sources and licences: [`docs/assets/coins/LICENSE.txt`](docs/assets/coins/LICENSE.txt) (web3icons and Trust Wallet assets, MIT; wallet icons from each project's MIT-licensed repository).

## Animations and pictures

| What | Where on the site | Author / source | Terms |
| --- | --- | --- | --- |
| Animated Pepe GIFs (good-morning GIFs, Image Viewer, some chat emotes: gmfren, heart, shh, wen, facts, hmm, sleepy, bigbrain) | `docs/meme/img/gif-*`, `docs/meme/img/gm-*`, `docs/games/img/emotes/` | **Lily in Pyjamas**, [klipy.com/profile/lilyinpyjamas](https://klipy.com/profile/lilyinpyjamas/) | Shared publicly on Klipy; credited on the meme home, in Image Viewer and in the About box. No written licence on file. |
| Pepe, Apu, Peepo and Pepega chat emotes (217 files) | `docs/meme/emotes/` | **Pepe Emojis for Reddit** by Pepecoin.com, [github.com/pepecoinppc/pepe_emojis_for_reddit](https://github.com/pepecoinppc/pepe_emojis_for_reddit) (source recorded in `docs/meme/emotes/emotes.json`) | The repository states no licence. Used as community emotes from the official Pepecoin project. |
| "What's that? Pepecoin. Can I have some?" comic | meme pages | **@CryptoByMathieu**, shared on r/pepecoin | Credited under the comic. |
| Pepe Guesser daily photos | Pepe Guesser | **Wikimedia Commons** photographers; each photo's author, licence and source link are stored with the puzzle (`credit`, `license`, `source_url`) and shown in the game | Per photo, usually CC BY / CC BY-SA |
| Map pictures in Pepe Guesser | Pepe Guesser | **Esri** (ArcGIS World Imagery) and **OpenStreetMap** contributors (fallback) | Attribution shown on the map |
| PEPaint logo and icon | `docs/games/img/pepaint-*.webp`, `docs/meme/img/ico/pepaint.webp` | Drawn by the site owner | Own work |

## Fonts

| Font | Used on | Source | Licence |
| --- | --- | --- | --- |
| Figtree, Space Mono, VT323 | PondOS meme edition (self-hosted) | [Fontsource](https://fontsource.org) 5.3.0 | SIL Open Font License 1.1, see [`docs/meme/fonts/OFL.txt`](docs/meme/fonts/OFL.txt) |
| Ubuntu, Ubuntu Mono, Fredoka | Serious pages and games (loaded from Google Fonts) | [Google Fonts](https://fonts.google.com) | Ubuntu Font Licence 1.0 (Ubuntu), SIL OFL 1.1 (Fredoka) |

## Code libraries

| Library | File | Licence |
| --- | --- | --- |
| Leaflet 1.9.4 | `docs/games/vendor/leaflet-1.9.4/` | BSD 2-Clause, see its `LICENSE` |
| supabase-js 2.117.3 | `docs/games/vendor/supabase-2.117.3.js` | MIT |

## Data

Prices, market figures and charts come from public APIs (CoinGecko, DefiLlama, Deribit, alternative.me Fear & Greed). Chain figures (supply, hashrate, rich list) come from the Pepecoin blockchain itself. Each page names its sources.

## Not yet traced

These folders hold pictures whose origin is not written down anywhere in the repository. Until the source is filled in here, treat them as "origin unknown":

- `docs/meme/img/` meme pictures that are not Lily's GIFs (for example `so-back`, `so-over`, `unclesam`, `wrongpep`, `stands`, `smoke`, `wall-day`/`wall-night`)
- `docs/assets/frog-run.webp` (running frog in the press kit)
- `docs/games/img/frog-*.svg`, `avatar-*.svg`, `draw-frog*.webp`, `frog-break.*`
- Frog crew chat emotes (balloons, juicebox, brb, chonky, comfy, explorer, backpack) and the first set (peek, ready, waiting, …) in `docs/games/img/emotes/`
- Fren Passport stamps and Avatar Maker parts (`docs/meme/passport-assets/`, `docs/meme/avatar-assets/`), PepeGochi, POND WARS, Gold Hook and Pepe Miner art (`docs/games/img/`)

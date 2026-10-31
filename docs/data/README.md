# Price and supply methodology

`market-prices.json` is the common current-quote snapshot for both editions, the ticker,
press kit, price page, market cards and calculators. The scheduled workflow fetches it
once per hour through `scripts/fetch_quotes.py`, before generating the HTML fallbacks.
Provider failures retain the previous complete snapshot and its measurement time.
Browsers refresh this same file, rather than requesting independent current quotes.

The original CoinGecko quote rows (including their reported supply and market cap) remain
in `markets`. `pep_supply` records issued PEP from the daily PepeBlocks-backed network
snapshot, with its own time and source. PEP valuations on this site use:

    PEP price × issued on-chain PEP supply

This calculated valuation can differ from an aggregator's circulating-supply market cap.
The distinction is stated on the pages. Other assets' market caps remain provider figures.
`price.json` is the compact PEP fallback, produced from the same quote and supply data.

`price-live.json` and `market-live.json` contain charts and market context and are published
as deployment artifacts. Chart points and sentiment measurements have their own sampling
times; they are not alternative sources for the current PEP quote.

Network and rich-list figures update daily. Address counts refer to addresses with a balance,
not to individual people. Both editions use the rich-list total (`holders_listed`) when
available, consistently with the historical network series.

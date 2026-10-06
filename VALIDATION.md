# Validation of the reconstructed history

> **Update (top 2000).** Reconstructed snapshots now list the top **2000** addresses. Weekly Mondays run from 2024-02-05 (first Monday on/after genesis) through 2025-08-25; daily files run from 2025-09-01 through 2026-10-04. Live snapshots stay as they are (1250 rows on 5–6 Oct 2026); from tomorrow `snapshot.py` also writes top 2000. Re-checked at live heights 1,237,541 and 1,238,910: the first 1250 rows of the new top-2000 cuts match the live files exactly (addresses, balances, `isMiner`, `lastSeen`, every top-N share 0.0000 pp apart). Chart groups still stop at top 1000; the holders table lists every address in the snapshot.

## Summary

| Check | Result |
|---|---|
| Live snapshots 2026-10-05 and 2026-10-06, same block height | **identical**: 1250/1250 addresses, 1250/1250 balances to the satoshi, top-N shares 0.0000 pp apart, supply equal, `isMiner` and `lastSeen` equal for 1250/1250 rows |
| Archived explorer rich lists (Internet Archive), 26 captures on 21 days, Oct 2024 – Aug 2025, at the capture time | 848/860 listed balances identical; max top-N share difference **0.0034 pp** (one capture excluded, see below; with it 0.1361 pp); top-25/50/75/100 group totals within 0.0103 %; supply within 0.00077 % |
| Committed snapshot files vs Blockbook balance history (api.pepecoinservice.org) | 138/140 sampled balances identical on 7 dates (top 10 + 10 random ranks each) |
| Supply | scheduled emission at the snapshot height; equals the live `supply_sats` (PepeBlocks) at both live heights |

## 1. Live snapshots (same block height)

The replay was cut right after the block height recorded in each live snapshot's `meta.height`.

| Live file | Height | Supply (PEP) live / replay | Addresses in both (of 1250) | Same top 1000 set | Balances identical | Max share diff |
|---|---|---|---|---|---|---|
| 2026-10-05 | 1,237,541 | 104,812,920,000 / 104,812,920,000 | 1250 | 1000/1000 | 1250/1250 | 0.0000 pp |
| 2026-10-06 | 1,238,910 | 104,826,610,000 / 104,826,610,000 | 1250 | 1000/1000 | 1250/1250 | 0.0000 pp |

Top-N shares at height 1,238,910 (live = replay): top 10 15.6774 %, top 25 23.2473 %, top 50 30.7591 %, top 100 39.1726 %, top 400 59.7184 %, top 1000 74.1723 %.

A cut at the live `fetched_at` time instead of the height (block 1,237,542 for 2026-10-05) gives the same balances; only the supply moves by one block reward.

Row order: 90 of the first 1000 positions differed only among addresses with exactly equal balances. The live API orders ties by address, descending; the replay and the committed files now use the same order.

**isMiner.** The live API flags 7 addresses in the top 1250. In the replay, "received a coinbase output within the last N days" reproduces exactly those 7 (0 false positives, 0 misses) for every N from 1 to 365 days; "ever received a coinbase" adds 3 false positives. The replay uses 30 days, which matches. The page does not use this flag (build_summary.py ignores it), so it only matters for people reading the raw files.

`address_count`: the replay counts addresses with a positive balance (294,460 at the end of 4 Oct 2026); the live API reports 289,337 / `holders_listed` 295,767, so the API uses a slightly different definition. The page does not show this number.

## 2. Archived explorer rich lists

Every Internet Archive capture of the PepeBlocks rich list / distribution and of the PepecoinExplorer rich list found for this period was compared with the replay cut at the capture timestamp (state after the last block with a timestamp before it). Explorers index with a delay of a few blocks, so small differences on busy exchange and pool addresses are expected.

| Capture (UTC) | Source | Replay height | Listed balances identical | Max top-N share diff | Max top-25/50/75/100 total diff | Supply diff |
|---|---|---|---|---|---|---|
| 2024-10-15 11:50:29 | PepeBlocks rich list | 245,955 | 497/500 | 0.0007 pp (top 400 max) | 0.0000 % | +0.00077 % |
| 2024-10-15 13:05:39 | PepeBlocks getdistribution | 246,033 | – | – | 0.0000 % | +0.00077 % |
| 2024-12-23 00:39:49 | PepeBlocks rich list | 340,456 | 10/10 | 0.0001 pp (top 10 max) | 0.0000 % | +0.00014 % |
| 2024-12-29 14:24:25 | PepeBlocks rich list | 349,476 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00000 % |
| 2025-01-12 23:15:25 | PepeBlocks rich list | 369,212 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00007 % |
| 2025-01-18 09:29:17 | PepeBlocks rich list | 376,651 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00007 % |
| 2025-01-24 05:59:18 | PepeBlocks rich list | 384,676 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00007 % |
| 2025-03-03 16:33:20 | PepeBlocks rich list | 437,446 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00003 % |
| 2025-03-10 11:25:12 | PepeBlocks rich list | 446,761 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00003 % |
| 2025-03-13 19:50:12 | PepeBlocks rich list | 451,332 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00000 % |
| 2025-03-20 18:00:24 | PepecoinExplorer rich list | 460,859 | 47/50 | 0.0034 pp (top 50 max) | – | – |
| 2025-03-21 21:24:04 | PepeBlocks rich list | 462,416 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00003 % |
| 2025-03-23 01:51:37 | PepeBlocks rich list | 464,050 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00003 % |
| 2025-03-29 17:54:51 | PepeBlocks rich list | 473,192 | 9/10 | 0.0015 pp (top 10 max) | 0.0103 % | +0.00003 % |
| 2025-03-29 17:55:54 | PepecoinExplorer rich list | 473,193 | 47/50 | 0.0030 pp (top 50 max) | – | – |
| 2025-03-29 19:11:45 | PepeBlocks rich list | 473,265 | 10/10 | 0.0000 pp (top 10 max) | 0.0075 % | +0.00007 % |
| 2025-04-27 15:50:52 | PepeBlocks rich list | 512,949 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00002 % |
| 2025-05-30 08:12:13 | PepeBlocks rich list | 557,945 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | -0.00003 % |
| 2025-05-30 08:13:19 | PepeBlocks rich list | 557,948 | 10/10 | 0.0000 pp (top 10 max) | 0.0004 % | +0.00002 % |
| 2025-06-11 04:06:13 | PepeBlocks rich list | 574,202 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00002 % |
| 2025-06-28 06:49:58 | PepecoinExplorer rich list | 597,703 | 49/50 | 0.1361 pp (top 50 max) | – | – |
| 2025-06-29 18:58:40 | PepeBlocks rich list | 599,769 | 9/10 | 0.0001 pp (top 10 max) | 0.0004 % | +0.00003 % |
| 2025-07-16 17:17:20 | PepeBlocks rich list | 623,015 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00000 % |
| 2025-08-02 01:14:12 | PepeBlocks rich list | 645,450 | 10/10 | – | 0.0000 % | +0.00001 % |
| 2025-08-02 02:07:52 | PepeBlocks rich list | 645,502 | 10/10 | – | 0.0000 % | +0.00001 % |
| 2025-08-16 17:28:46 | PepeBlocks rich list | 665,630 | 10/10 | 0.0000 pp (top 10 max) | 0.0000 % | +0.00001 % |

Notes on the differences:

- Every balance that differs belongs to an address that was transacting at that moment: CoinEx (`PeU3PG…`), NonKYC (`PXwJ7a…`) and litecoinpool.org (`PnBFXe…`, off by exactly one block reward, i.e. the explorer was one block behind). No dormant address differs anywhere.
- PepecoinExplorer, 2025-06-28 06:49: its list leaves out `PryjXWHPDRQChb3sDZwUby3cTtNatfR1tE` (379.8 M PEP, rank 29 in the replay). Blockbook confirms that address held that balance (19,432 transactions, an active hot wallet), so the explorer list is incomplete there; that omission is the whole 0.136 pp top-50 gap. All 50 listed balances that it does show match.
- Supply differences of up to 0.0008 % (Oct 2024) equal a few block rewards: the explorer's supply was a few blocks behind the capture time.
- One capture (PepeBlocks, 2024-11-24 08:10) holds no rows or totals and is skipped.

## 3. Committed files vs Blockbook

For seven committed snapshot files, the top 10 and 10 random ranks were checked against Blockbook's balance history at the snapshot's last block time.

| Snapshot | Height | Identical |
|---|---|---|
| 2024-06-03 | 65,178 | 19/20 |
| 2024-11-25 | 303,247 | 19/20 |
| 2025-02-03 | 399,409 | 20/20 |
| 2025-06-30 | 601,437 | 20/20 |
| 2025-10-06 | 736,293 | 20/20 |
| 2026-03-15 | 957,221 | 20/20 |
| 2026-10-04 | 1,236,934 | 20/20 |

The two mismatches on 2024-06-03 and 2024-11-25 are pool addresses off by exactly one block reward. Asking Blockbook for the time 2 minutes later gives exactly the replay's balance; block timestamps are not strictly increasing, so a time filter can cut one block differently from a height cut. So all 140 balances agree.

Earlier checks during development: raw-block parsing (block hashes, txids, output addresses) matched Blockbook for blocks 41,999–42,002 (AuxPoW start), 42,500, 300,000, 600,123, 1,000,000 and 1,238,000; resuming from checkpoints produces byte-identical snapshots; supply matches PepeBlocks `getmoneysupply` at heights 1,235,437 and 1,238,910.

## 4. Exchange tags (XeggeX, NonKYC)

### XeggeX `PqXDo4G31C2mysViyRHLmHtTaVdpKHxDBm`

XeggeX went offline on 3 Feb 2025 (withdrawals stopped) and announced bankruptcy on 27 Jun 2025.

- 10,505 transactions (2024-02-12 – 2025-07-25): 6,000 incoming from **4,571 different addresses**, 4,505 outgoing to **7,532 different addresses**. Incoming transactions have a median of 12 distinct input addresses (consolidated deposit addresses).
- It spent together with **1,968 other addresses** as inputs of the same transactions (deposit-address sweeps), which only the key holder can do.
- Peak balance 35,226,350,314 PEP on 2024-09-15.
- Balance: 2024-10-15: 32,317 M, 2025-01-01: 20,372 M, 2025-02-01: 11,261 M, 2025-02-03: 11,003 M, 2025-02-10: 11,040 M, 2025-03-01: 7,875 M, 2025-04-01: 2,852 M, 2025-05-01: 1,242 M, 2025-06-01: 0 M, 2025-07-01: 3 M, 2025-08-01: 0 M, 2026-10-06: 0 M.
- Activity around the shutdown: 58–71 transactions a day from 27 Jan to 2 Feb 2025, 6 on 3 Feb, then 0–3 a day until 12 Feb. Customer-style inflow stopped: monthly inflow fell from 8.5–12.6 B PEP (Oct 2024 – Feb 2025) to 0.26 B in March 2025. After 3 Feb about 10.5 B PEP was moved *in* in a few large transfers (for example eight transfers of 500 M PEP on 12 Feb) and 21.5 B PEP went *out* to 885 addresses, emptying the address by June 2025. The last movements (four 1 M PEP payouts) were on 25 Jul 2025.

### NonKYC `PXwJ7a32FVHF5GWS7annH2tDf5zuAA38Bm`

NonKYC still lists PEP; this address was its wallet until July 2025.

- 1,894 transactions (2024-10-25 – 2025-07-20): 1,117 incoming from **2,449 different addresses**, 777 outgoing to **1,211 different addresses**. Incoming transactions have a median of 11 distinct input addresses (consolidated deposit addresses).
- It spent together with **366 other addresses** as inputs of the same transactions (deposit-address sweeps), which only the key holder can do.
- Peak balance 1,285,774,400 PEP on 2025-02-09.
- Balance: 2024-10-15: 0 M, 2025-01-01: 736 M, 2025-02-01: 1,056 M, 2025-02-03: 1,084 M, 2025-02-10: 933 M, 2025-03-01: 433 M, 2025-04-01: 455 M, 2025-05-01: 587 M, 2025-06-01: 9 M, 2025-07-01: 14 M, 2025-08-01: 0 M, 2026-10-06: 0 M.
- High two-way flow every month from Oct 2024 to Jul 2025. On 20 Jul 2025 (tx `df8c0b9b…`) the address and 10 other addresses it controlled were swept in one transaction, with a single output and no change, into `PuXnYSgp2fecgy9SE6YQKwSbzHiAPwg62o`, and the address has not been used since.

### Extra addresses tagged

Rule: an address is tagged only if it was spent **in the same transaction as the exchange's main address** (common-input ownership: the exchange signed for it) **and** it sat in the top 1000 on at least 7 reconstructed days. Of the 105 addresses co-spent with the two original addresses that ever reached the top 1000, six meet it; the rest were deposit addresses swept within a day or two. NonKYC's successor wallet (below) adds two more.

| Address | Exchange | Evidence | Days in top 1000 | Best rank | Max balance |
|---|---|---|---|---|---|
| `PnLf5cc7eWKjeLwMir1dCns2BrtbNPv7qT` | XeggeX | co-spent with the XeggeX address in 7 sweep transactions, 27 Nov – 12 Dec 2024 | 232 | 13 | 295.5 M PEP |
| `PdG6b29Nxw4o2FnJELF3kPk1oZF2VLXn3E` | NonKYC | co-spent in the final 20 Jul 2025 sweep (`df8c0b9b…`) | 13 | 11 | 665.7 M PEP |
| `PsnJpNbgQDYrKxsvchXa7RdcC2h2YLVjt4` | NonKYC | co-spent in an 85-input sweep into the NonKYC address, 8 May 2025 (`63b90bd7…`) | 56 | 151 | 96.2 M PEP |
| `PhWiJ2UbgQno6zHE2N3vm8KowCih2Pp7Sa` | NonKYC | co-spent with the NonKYC address | 44 | 911 | 15.3 M PEP |
| `Pj6SBAPscGprF44NDDC75MkQiJYsBzz7kb` | NonKYC | co-spent with the NonKYC address, 27 Jun 2025 (`5a5d2d78…`) | 17 | 520 | 27.0 M PEP |
| `Pq22asKx2sms6quyTLQtUxHC2FbFsrUZB2` | NonKYC | co-spent with the NonKYC address | 12 | 840 | 11.3 M PEP |
| `PuXnYSgp2fecgy9SE6YQKwSbzHiAPwg62o` | NonKYC | successor wallet, see below | 377 | 11 | 575.8 M PEP |
| `PoSAh8qdrsgfZe63Fe8PsmMqx18k4FiCCR` | NonKYC | co-spent with PuXnYSgp… on 2 Mar 2026 (`102896f6…`) and 13 May 2026 (`4540c0fd…`); received 657.0 M PEP on 23 Jul 2025 and has sent 31 PEP since | 440 | 8 | 657.0 M PEP |

### NonKYC successor wallet `PuXnYSgp2fecgy9SE6YQKwSbzHiAPwg62o`

- 20 Jul 2025 02:50: a NonKYC-controlled input sent a 10 PEP test payment to it (tx `3e252d58…`); the change output of that payment was then spent by NonKYC in the sweep below.
- 20 Jul 2025 02:58: the whole NonKYC wallet (the main address plus 10 addresses co-spent with it) was swept into it in a single-output transaction (`df8c0b9b…`). The old address has not been used since.
- **1,040 deposit addresses** that had been swept into the old NonKYC address (in multi-input sweeps, so signed by whoever holds those deposit keys) were later swept into `PuXnYSgp…`, from 20 Jul 2025 to 6 Oct 2026 (943 sweep transactions). Only the exchange holds its deposit-address keys, so the same operator is sending to this address.
- It behaves like an exchange hot wallet: 1,698 transactions, 1,502 distinct senders, 1,023 recipients, 496 co-spent deposit addresses, still active. In the top 1000 on 377 days (best rank 11, up to 576 M PEP); balance 0 at the latest snapshot.
- There is no transaction where the old and new main addresses are inputs together, so this is the one tag that rests on deposit-address continuity rather than direct co-spending. It and `PoSAh8qd…` (rank 11 today, 657 M PEP, about 0.63 % of supply) are the two tags that move today's "without exchanges" numbers. Removing them is two lines in labels.json.

### Not tagged (needs a decision)

- `Prj6QbUQL9wSzk2Xxedms3jLqDVjTDs2Sm` (rank 2 today, 3.33 B PEP): received 2.31 B PEP from the XeggeX address *after* the shutdown (Feb–Mar 2025) and has sent only 66 PEP ever. It could be the operator's or a large user's wallet; receiving alone does not show who owns it.
- `PryjXWHPDRQChb3sDZwUby3cTtNatfR1tE`: an exchange-like hot wallet (19,432 transactions) of an unknown operator, in the top 1250 since Feb 2025.
- `PgRLcaCTEkXSguu6ZgzkuncHdCxADmPBXP`: labelled "Mining-Dutch" (a mining pool) by PepeBlocks in Oct 2024; 82,647 transactions. Not an exchange, so not in scope here.

## Reproducing

The replay tool is not in this repository (it needs a full node). The checks above are against public data: the snapshot files themselves, Internet Archive captures of pepeblocks.com / pepecoinexplorer.com, and Blockbook at api.pepecoinservice.org.

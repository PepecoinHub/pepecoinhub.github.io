#!/usr/bin/env python3
"""Build docs/merge-mining.html and docs/<lang>/merge-mining.html (8 languages).

    python3 scripts/build_merge_mining.py && python3 scripts/add_csp.py

The page is for people who already mine Litecoin / Dogecoin with a Scrypt ASIC: which pools pay
Pepecoin (PEP) on top, how to claim it, and what a miner adds per day. Words live in
scripts/merge_mining_text.py; the header and footer are copied from each language's mining.html,
so they stay the same as the rest of the site. Edit the text there and re-run this script.
"""
import html
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from merge_mining_text import T  # noqa: E402

DOCS = os.path.join(HERE, "..", "docs")
SITE = "https://pepecoinhub.com/"
PAGE = "merge-mining.html"
LANGS = ["en", "pl", "es", "de", "fr", "tr", "it", "zh"]
TAG = {"en": "en", "pl": "pl", "es": "es", "de": "de", "fr": "fr", "tr": "tr", "it": "it", "zh": "zh-Hans"}

# Fallback figures shown before the scripts load (the scripts read data/mining.json, network.json, price.json).
FALLBACK = {"net_ph": 2.10, "net_date": "2026-11-24", "bpd": 1379, "price": 0.00006037}

POOLS = {
    # group: [(name, url or None, note key, [(source label, url)])]
    "auto": [("ViaBTC", "https://www.viabtc.com/", "n_viabtc",
              [("ViaBTC, 2024-12-10", "https://support.viabtc.com/hc/en-us/articles/11466386489743-PEP-LKY-Mining-Pools-Officially-Launched-Enjoy-30-Day-Zero-Fees")])],
    "addr": [("Binance Pool", "https://pool.binance.com/", "n_binance",
              [("Binance, 2024-12-23", "https://www.binance.com/en/support/announcement/detail/0323d984af9a4360b2da6bd0df76f220")])],
    "check": [("F2Pool", "https://www.f2pool.com/coin/pepecoin", None, [("F2Pool", "https://www.f2pool.com/coin/pepecoin")]),
              ("AntPool", "https://www.antpool.com/", None,
               [("Ultramining, 2024-12-06", "https://ultramining.com/news/en/antpool-launches-joint-mining-of-ltc-with-lky-pep-and-jkc/")]),
              ("KuPool", "https://www.kupool.com/", None, [("KuPool", "https://www.kupool.com/")]),
              ("EMCD", "https://emcd.io/pool/pepecoin/", None, [("EMCD", "https://emcd.io/pool/pepecoin/")]),
              ("Mining-Dutch", "https://www.mining-dutch.nl/pools/pepecoin.php", "n_dutch",
               [("Mining-Dutch", "https://www.mining-dutch.nl/pools/pepecoin.php")])],
    "value": [("litecoinpool.org", "https://www.litecoinpool.org/help", "n_lcp", [("litecoinpool.org", "https://www.litecoinpool.org/help")]),
              ("Kryptex Pool", "https://pool.kryptex.com/", "n_kryptex",
               [("Kryptex, 2025-01-13", "https://www.kryptex.com/en/news/pepecoin-merge-mining-en")])],
}
SEEN = ["dogegogo", "BTC.com", "hash-hut", "GoodLuckyBoom", "HashSpace", "LSoftware DMCC"]
PRESETS = [("Antminer L9", "16"), ("Antminer L7", "9.5"), ("ElphaPex DG1", "11")]
SOURCES = [
    ("ViaBTC: PEP and LKY pools launched, 2024-12-10", "https://support.viabtc.com/hc/en-us/articles/11466386489743-PEP-LKY-Mining-Pools-Officially-Launched-Enjoy-30-Day-Zero-Fees"),
    ("ViaBTC: what is Pepecoin and how to mine it, 2024-12-12", "https://www.viabtc.com/en/blog/what-is-pepecoin-pep-how-to-mine-pepecoin-pep-369"),
    ("Binance Pool: JKC and PEP merged mining, 2024-12-23", "https://www.binance.com/en/support/announcement/detail/0323d984af9a4360b2da6bd0df76f220"),
    ("Kryptex Pool: Pepecoin added to LTC merged mining, 2025-01-13", "https://www.kryptex.com/en/news/pepecoin-merge-mining-en"),
    ("Ultramining: AntPool adds LKY, PEP and JKC, 2024-12-06", "https://ultramining.com/news/en/antpool-launches-joint-mining-of-ltc-with-lky-pep-and-jkc/"),
    ("litecoinpool.org help (merge-mined coins raise the PPS ratio)", "https://www.litecoinpool.org/help"),
    ("Pepecoin chainparams.cpp (AuxPoW from block 42,000)", "https://github.com/pepecoinppc/pepecoin/blob/master/src/chainparams.cpp"),
    ("Pepecoin src/rpc/mining.cpp (createauxblock, submitauxblock)", "https://github.com/pepecoinppc/pepecoin/blob/master/src/rpc/mining.cpp"),
    ("PepeBlocks: network hashrate", "https://pepeblocks.com/"),
    ("miningpoolstats: Pepecoin pools", "https://miningpoolstats.stream/pepecoin"),
]

STYLE = """
/* Merge-mining page: one machine, three chains; pool groups; calculator */
.mm-flow { display: grid; grid-template-columns: minmax(0, 0.9fr) 64px minmax(0, 1.25fr); align-items: center; margin: 6px 0 26px; }
.mm-rig { padding: 20px 22px; border-radius: 18px; background: var(--ink); color: var(--paper); display: grid; gap: 6px; }
.mm-rig b { font-size: 1.12rem; }
.mm-rig span { font-size: 0.88rem; opacity: 0.78; }
.mm-rig code { justify-self: start; font-size: 0.78rem; padding: 3px 8px; border-radius: 6px; background: rgba(128, 128, 128, 0.22); color: inherit; }
.mm-wire { width: 64px; height: 100%; min-height: 190px; color: var(--accent); opacity: 0.45; }
.mm-chains { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mm-chains li { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 14px; border-radius: 14px; background: var(--panel); border: 1px solid var(--rule); }
.mm-chains img { width: 34px; height: 34px; border-radius: 50%; }
.mm-chains b { display: block; }
.mm-chains small { color: var(--muted); }
.mm-chains .ok { font-size: 0.8rem; color: var(--muted); }
.mm-chains li.pep { border: 1.5px solid var(--gold); background: linear-gradient(120deg, var(--gold-soft, #fff4dd), var(--panel) 75%); }
.mm-chains li.pep .ok { color: var(--ink); font-weight: 700; }
@media (max-width: 720px) {
  .mm-flow { grid-template-columns: 1fr; }
  .mm-wire { display: none; }
  .mm-rig { border-radius: 18px 18px 6px 6px; }
  .mm-chains { margin-top: 10px; }
  .mm-chains li { grid-template-columns: 30px minmax(0, 1fr); }
  .mm-chains img { width: 30px; height: 30px; }
  .mm-chains .ok { grid-column: 2; }
}
.mm-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-flow: row dense; gap: 14px; margin: 16px 0 10px; }
.mm-group.check { grid-column: 2; grid-row: span 2; }
@media (max-width: 760px) { .mm-groups { grid-template-columns: 1fr; } .mm-group.check { grid-column: auto; grid-row: auto; } }
.mm-group { padding: 18px 20px; border-radius: 16px; background: var(--panel); border: 1px solid var(--rule); border-top: 4px solid var(--c, var(--rule)); display: grid; gap: 10px; align-content: start; min-width: 0; }
.mm-group h3 { margin: 0; font-size: 1.05rem; display: grid; gap: 4px; }
.mm-group h3 i { justify-self: start; font-style: normal; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--c); white-space: nowrap; }
.mm-group.auto { --c: var(--accent); }
.mm-group.addr { --c: var(--flag, #c27a2c); background: linear-gradient(160deg, var(--gold-soft, #fff4dd), var(--panel) 60%); }
.mm-group.check { --c: var(--accent-mid, #3f9e5f); }
.mm-group.value { --c: var(--muted); }
.mm-group.seen { --c: var(--rule); }
.mm-group ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.mm-group li { display: grid; gap: 2px; grid-template-columns: minmax(0, 1fr); padding-top: 10px; border-top: 1px dashed var(--rule); }
.mm-group li:not(:has(p)) { grid-template-columns: minmax(0, 1fr) auto; align-items: baseline; gap: 10px; }
.mm-group li:first-child { padding-top: 0; border-top: 0; }
.mm-group li a.pool { font-weight: 700; }
.mm-group li p { margin: 0; font-size: 0.93rem; }
.mm-group li small { font-size: 0.78rem; color: var(--muted); }
.mm-group li small a { color: inherit; }
.mm-group .tags { display: flex; flex-wrap: wrap; gap: 6px; }
.mm-group .tags span { font-size: 0.85rem; font-weight: 600; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--rule); background: var(--paper); }
.mm-group > p { margin: 0; font-size: 0.93rem; }
.mm-calc { padding: 24px; border-radius: 22px; border: 1px solid var(--rule); background: var(--panel); box-shadow: var(--shadow); }
.mm-calc h2 { margin-top: 0; }
.mm-in { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 14px 18px; margin: 16px 0; }
.mm-in label { display: grid; gap: 6px; font-weight: 600; font-size: 0.92rem; min-width: 0; align-content: start; }
.mm-in small { font-weight: 400; color: var(--muted); }
.mm-in .box { display: flex; gap: 6px; align-items: center; min-width: 0; }
.mm-in input { flex: 1; min-width: 0; width: 100%; padding: 10px 12px; font: inherit; border: 1px solid var(--rule); border-radius: 10px; background: var(--paper); color: var(--ink); }
.mm-in .box b { font-weight: 600; color: var(--muted); }
.mm-presets { display: flex; flex-wrap: wrap; gap: 6px; margin: -4px 0 14px; }
.mm-presets button { font: inherit; font-size: 0.82rem; padding: 6px 11px; border-radius: 999px; border: 1px solid var(--accent); background: var(--accent-soft); color: var(--accent-deep); cursor: pointer; }
.mm-presets button[aria-pressed="true"] { background: var(--accent); color: #fff; }
.mm-out { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 10px; }
.mm-out div { padding: 14px; border-radius: 16px; background: var(--accent-soft); display: grid; gap: 2px; min-width: 0; }
.mm-out div:first-child { background: var(--ink); color: var(--paper); }
.mm-out div:first-child span, .mm-out div:first-child em { color: inherit; opacity: 0.75; }
.mm-out span { font-size: 0.8rem; color: var(--muted); }
.mm-out strong { font-size: 1.25rem; overflow-wrap: anywhere; }
.mm-out em { font-style: normal; font-size: 0.86rem; color: var(--muted); }
@media (max-width: 560px) { .mm-out { grid-template-columns: 1fr 1fr; } .mm-out div:first-child { grid-column: 1 / -1; } }
.mm-calc .note { margin-top: 14px; }
.mm-nfa { font-size: 0.8rem; color: var(--muted); margin: 6px 0 0; }
""".strip()

WIRE = ('<svg class="mm-wire" viewBox="0 0 64 200" preserveAspectRatio="none" aria-hidden="true">'
        '<path d="M0 100 C 30 100, 30 34, 64 34 M0 100 L64 100 M0 100 C 30 100, 30 166, 64 166" fill="none" '
        'stroke="currentColor" stroke-width="3" vector-effect="non-scaling-stroke"/></svg>')


def strip_tags(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s))


def num(lang, v, digits):
    s = f"{v:,.{digits}f}"
    if lang in ("pl", "fr", "es"):
        s = s.replace(",", " ")
        s = s.replace(".", ",")
    elif lang in ("de", "tr", "it"):
        s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return s


def section(src, pattern):
    m = re.search(pattern, src, re.S)
    if not m:
        raise SystemExit(f"template part not found: {pattern}")
    return m.group(0)


def build(lang):
    t = T[lang]
    prefix = "" if lang == "en" else lang + "/"
    tpl_path = os.path.join(DOCS, prefix + "mining.html")
    with open(tpl_path, encoding="utf-8") as fh:
        tpl = fh.read()
    url = SITE + prefix + PAGE

    head_start = section(tpl, r"\A.*?<meta name=\"viewport\"[^>]*>\n")
    assets = section(tpl, r"<link rel=\"icon\".*?</script>\n")  # icon, fonts, facts.css, theme script
    og_alt = re.search(r'<meta property="og:image:alt" content="([^"]*)">', tpl).group(1)
    crumbs = json.loads(re.search(r'<script type="application/ld\+json">(\{"@context": "https://schema.org", "@type": "BreadcrumbList".*?)</script>', tpl).group(1))
    guides_name = crumbs["itemListElement"][1]["name"]
    goat = section(tpl, r"<script data-goatcounter[^\n]*\n")
    site_head = section(tpl, r"<header class=\"site-head\">.*?</header>\n").replace(' aria-current="page"', "")
    footer = section(tpl, r"<footer class=\"site-foot\">.*?</footer>\n").replace("/mining.html\"", "/" + PAGE + "\"")
    skip = section(tpl, r"<a class=\"skip\"[^\n]*\n")

    alts = "".join(f'<link rel="alternate" hreflang="{TAG[l]}" href="{SITE}{"" if l == "en" else l + "/"}{PAGE}">\n' for l in LANGS)
    alts += f'<link rel="alternate" hreflang="x-default" href="{SITE}{PAGE}">\n'
    e = html.escape
    meta = (f"<title>{e(t['title'])}</title>\n"
            f'<meta name="description" content="{e(t["desc"])}">\n'
            f'<link rel="canonical" href="{url}">\n{alts}'
            '<meta property="og:type" content="article">\n<meta property="og:site_name" content="Pepecoin Hub">\n'
            f'<meta property="og:title" content="{e(t["title"])}">\n'
            f'<meta property="og:description" content="{e(t["desc"])}">\n'
            f'<meta property="og:url" content="{url}">\n'
            '<meta property="og:image" content="https://pepecoinhub.com/assets/og-image.png">\n'
            '<meta property="og:image:width" content="1200">\n<meta property="og:image:height" content="630">\n'
            f'<meta property="og:image:alt" content="{og_alt}">\n'
            '<meta name="twitter:card" content="summary_large_image">\n'
            '<meta name="twitter:image" content="https://pepecoinhub.com/assets/og-image.png">\n')
    bc = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Pepecoin Hub", "item": SITE + prefix},
        {"@type": "ListItem", "position": 2, "name": guides_name, "item": SITE + prefix + "guides.html"},
        {"@type": "ListItem", "position": 3, "name": t["crumb"], "item": url}]}
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": strip_tags(q), "acceptedAnswer": {"@type": "Answer", "text": strip_tags(a)}} for q, a in t["faq"]]}
    ld = (f'<script type="application/ld+json">{json.dumps(bc, ensure_ascii=False)}</script>\n'
          f'<script type="application/ld+json">{json.dumps(faq, ensure_ascii=False)}</script>\n')

    F = FALLBACK
    net = num(lang, F["net_ph"], 2)
    bpd = num(lang, F["bpd"], 0)

    def pool_li(name, href, note, srcs):
        s = " · ".join(f'<a href="{u}">{e(lbl)}</a>' for lbl, u in srcs)
        body = f'<p>{t[note]}</p>' if note else ''
        return (f'<li><a class="pool" href="{href}">{e(name)}</a>{body}'
                f'<small>{t["src_word"]}: {s}</small></li>')

    groups = ""
    for g in ("auto", "addr", "check", "value"):
        lis = "".join(pool_li(*p) for p in POOLS[g])
        lead = f'<p>{t["n_check"]}</p>' if g == "check" else ''
        groups += (f'<div class="mm-group {g}"><h3><i>{t["g_" + g + "_k"]}</i>{t["g_" + g]}</h3>'
                   f'{lead}<ul>{lis}</ul></div>\n')
    tags = "".join(f"<span>{e(n)}</span>" for n in SEEN)
    groups += (f'<div class="mm-group seen"><h3><i>{t["g_seen_k"]}</i>{t["g_seen"]}</h3>'
               f'<div class="tags">{tags}</div><p>{t["n_seen"]}</p></div>\n')

    presets = "".join(f'<button type="button" data-gh="{gh}">{n}</button>' for n, gh in PRESETS)
    faq_html = "".join(f"<details><summary>{q}</summary><p>{a}</p></details>\n    " for q, a in t["faq"])
    srcs = "".join(f'<li><a href="{u}">{e(lbl)}</a></li>' for lbl, u in SOURCES)
    price_txt = "$" + (f"{F['price']:.8f}".rstrip("0") if lang == "en" else f"{F['price']:.8f}".rstrip("0").replace(".", "," if lang != "zh" else "."))

    main = f"""<main class="wrap" id="main">
<header class="page-head">
  <p class="eyebrow">{t['eyebrow']}</p>
  <h1>{t['h1']}</h1>
  <p class="lede">{t['lede']}</p>
</header>

<section class="mm-flow" aria-label="{e(t['flow_label'])}">
  <div class="mm-rig"><b>{t['rig']}</b><span>{t['rig_sub']}</span><code>stratum+tcp://… · Scrypt</code></div>
  {WIRE}
  <ul class="mm-chains">
    <li><img src="assets/coins/ltc.png" alt="" width="34" height="34"><span><b>Litecoin <small>LTC</small></b><small>{t['ltc_role']}</small></span><span class="ok">✓ {t['paid']}</span></li>
    <li><img src="assets/coins/doge.png" alt="" width="34" height="34"><span><b>Dogecoin <small>DOGE</small></b><small>{t['doge_role']}</small></span><span class="ok">✓ {t['paid']}</span></li>
    <li class="pep"><img src="assets/brand/icon.svg" alt="" width="34" height="34"><span><b>Pepecoin <small>PEP</small></b><small>{t['pep_role']}</small></span><span class="ok">{t['pep_q']}</span></li>
  </ul>
</section>

<section aria-label="{e(t['facts_label'])}">
  <div class="stats">
    <div class="stat"><span class="label">{t['st_power_l']}</span><span class="value">0 W</span><span class="sub">{t['st_power_s']}</span></div>
    <div class="stat"><span class="label">{t['st_reward_l']}</span><span class="value">{num(lang, 10000, 0)} PEP</span><span class="sub">{t['st_reward_s']}</span></div>
    <div class="stat"><span class="label">{t['st_hash_l']}</span><span class="value" id="mm-net-v">{net} PH/s</span><span class="sub">PepeBlocks, <span id="mm-net-d">{F['net_date']}</span></span></div>
    <div class="stat"><span class="label">{t['st_aux_l']}</span><span class="value">{t['st_aux_v']}</span><span class="sub">{t['st_aux_s']}</span></div>
  </div>
</section>

<section aria-labelledby="pools">
  <h2 id="pools">{t['pools_h']}</h2>
  <p>{t['pools_intro']}</p>
  <div class="mm-groups">
{groups}  </div>
  <p class="src">{t['pools_note']}</p>
</section>

<section class="mm-calc" aria-labelledby="calc">
  <h2 id="calc">{t['calc_h']}</h2>
  <p>{t['calc_intro']}</p>
  <div class="mm-in">
    <label>{t['l_hash']}<span class="box"><input id="mm-hash" type="number" min="0" step="any" inputmode="decimal" value="16"><b>GH/s</b></span></label>
    <label>{t['l_n']}<span class="box"><input id="mm-n" type="number" min="1" step="1" inputmode="numeric" value="1"></span></label>
    <label>{t['l_fee']}<span class="box"><input id="mm-fee" type="number" min="0" max="99" step="any" inputmode="decimal" value="2"><b>%</b></span></label>
    <label>{t['l_price']}<span class="box"><b>$</b><input id="mm-price" type="number" min="0" step="any" inputmode="decimal" value="{F['price']}"></span><small>{t['price_src']} <span id="mm-price-d">{price_txt}, {F['net_date']}</span></small></label>
  </div>
  <div class="mm-presets" role="group" aria-label="{e(t['presets_label'])}">{presets}</div>
  <div class="mm-out" aria-live="polite">
    <div><span>{t['o_year']}</span><strong id="mm-year">—</strong><em id="mm-usd-y">—</em></div>
    <div><span>{t['o_month']}</span><strong id="mm-month">—</strong><em id="mm-usd-m">—</em></div>
    <div><span>{t['o_day']}</span><strong id="mm-day">—</strong><em id="mm-usd-d">—</em></div>
  </div>
  <p class="note">{t['calc_note'].replace('{net}', f'<span id="mm-net" data-hs="{F["net_ph"]}e15">{net}</span>').replace('{bpd}', f'<span id="mm-bpd" data-bpd="{F["bpd"]}">{bpd}</span>')}</p>
  <p class="mm-nfa">{t['nfa']}</p>
</section>

<section aria-labelledby="steps">
  <h2 id="steps">{t['steps_h']}</h2>
  <ol class="guide-steps">
    <li><h3>{t['s1_t']}</h3><p>{t['s1_p']}</p></li>
    <li><h3>{t['s2_t']}</h3><p>{t['s2_p']}</p></li>
    <li><h3>{t['s3_t']}</h3><p>{t['s3_p']}</p></li>
  </ol>
</section>

<section aria-labelledby="why">
  <h2 id="why">{t['why_h']}</h2>
  <div class="prose">
    <p>{t['why_p1']}</p>
    <p>{t['why_p2']}</p>
  </div>
</section>

<section aria-labelledby="faq">
  <h2 id="faq">{t['faq_h']}</h2>
  <div class="faq">
    {faq_html.rstrip()}
  </div>
</section>

<section aria-labelledby="more">
  <h2 id="more">{t['more_h']}</h2>
  <div class="cards">
    <a class="card" href="mining.html"><h3>{t['c_mining_t']}</h3><p>{t['c_mining_p']}</p></a>
    <a class="card" href="scrypt-family.html"><h3>{t['c_scrypt_t']}</h3><p>{t['c_scrypt_p']}</p></a>
    <a class="card" href="compare.html"><h3>{t['c_doge_t']}</h3><p>{t['c_doge_p']}</p></a>
    <a class="card" href="wallets.html"><h3>{t['c_wallets_t']}</h3><p>{t['c_wallets_p']}</p></a>
  </div>
</section>

<section aria-labelledby="sources">
  <h2 id="sources">{t['sources_h']}</h2>
  <div class="sources"><div><ul>{srcs}</ul></div></div>
</section>
</main>
"""
    out = (head_start + meta + assets + ld + "<style>\n" + STYLE + "\n</style>\n" + goat + "</head>\n<body>\n" + skip + "\n"
           + site_head + main + footer + "\n"
           + '<script src="prices.js?v=20261104lazy" defer></script>\n'
           + '<script src="merge-mining.js?v=20261125" defer></script>\n'
           + re.search(r'<script src="(?:\.\./)?chrome\.js\?v=[^"]*" defer></script>\n', tpl).group(0)
           + "</body>\n</html>\n")
    if lang != "en":
        out = out.replace('src="merge-mining.js', 'src="../merge-mining.js').replace('src="prices.js', 'src="../prices.js')
        out = out.replace('src="assets/coins/', 'src="../assets/coins/').replace('<img src="assets/brand/icon.svg"', '<img src="../assets/brand/icon.svg"')
    with open(os.path.join(DOCS, prefix + PAGE), "w", encoding="utf-8") as fh:
        fh.write(out)


if __name__ == "__main__":
    for l in (sys.argv[1:] or LANGS):
        build(l)
        print("built", l)

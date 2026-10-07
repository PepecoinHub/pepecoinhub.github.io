/* Pepecoin Holder Watch
   Reads data/summary.json (built by scripts/build_summary.py) and draws everything
   as plain DOM + SVG. No libraries, no network calls except the one JSON file. */
(() => {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  const DAY = 864e5;
  const EXPLORER = 'https://pepeblocks.com/address/';

  /* ------------------------------------------------------------------ strings */
  const STR = {
    en: {
      title: 'Pepecoin Holder Watch',
      eyebrow: 'Rich list · snapshot of {date}',
      eyebrow_plain: 'Rich list',
      lede: 'How much of the PEP supply sits in the biggest wallets, and how that changes. One snapshot of the top ~2000 addresses every day; the charts focus on the top 1000.',
      view_all: 'All addresses',
      view_ex: 'Without exchanges & pools',
      view_ex_note: 'Addresses tagged as exchange, pool or burn are taken out, and their balances are taken out of the supply too. Tags are a hand-kept list, so some exchange wallets may still be counted.',
      snapshot: 'Snapshot',
      block: 'Block',
      supply: 'Circulating supply',
      denominator: 'Supply without tagged addresses',
      est: 'supply estimated',
      hist_one: 'First snapshot is in. Changes appear from tomorrow, and a 7-day comparison after a week.',
      hist_many: 'History: {n} daily snapshots since {date}. Longer periods fill in as the history grows.',
      hist_rc: 'History: {live} live daily snapshots since {live_date}, plus {rc} snapshots and daily trend points reconstructed from the blockchain back to {date}.',
      conc_h: 'Concentration',
      conc_p: 'Share of the circulating supply held by the largest addresses, compared with the same time {period} ago.',
      conc_p_all: 'Share of the circulating supply held by the largest addresses, compared with the earliest point in the history ({date}).',
      period: 'Period',
      period_all: 'All',
      period_all_words: 'the start of the history',
      years: '{n} years',
      na_hist: 'needs {p} days of history, have {have}',
      na_hist_all: 'needs at least two snapshots',
      vs_ref: 'vs {date}',
      vs_ref_rc: 'vs {date} (reconstructed)',
      rc_tag: 'reconstructed',
      rc_note: 'Dashed line and hollow points: reconstructed by replaying the Pepecoin blockchain block by block, for the days before the live daily snapshots began on {date}.',
      rc_cols: 'Dashed cells compare with a reconstructed snapshot.',
      rc_ref: 'Compared with a reconstructed snapshot from {date}.',
      spark_all: '{n}-day trend',
      spark_full: 'full history',
      spark_hover: '{date}',
      struct_h: 'Where the supply sits',
      struct_p: 'The top 1000 split into rank tiers. The grey slice is everything below rank 1000.',
      col_rank: 'Rank',
      col_held: 'Held (PEP)',
      col_pct: '% of supply',
      col_change: 'Change',
      rest: 'Below #1000',
      center: 'Top 1000',
      threshold: 'Entry to the top 1000 now takes {pep} PEP.',
      trend_h: 'Trend',
      trend_p: 'Share of supply held by the top N addresses, one point per day.',
      top_n: 'Top {n}',
      range_30: '30D', range_90: '90D', range_180: '6M', range_365: '1Y', range_730: '2Y', range_all: 'All',
      trend_empty: 'The trend needs at least two daily snapshots in this range.',
      tip_holds: 'holds',
      tip_supply: 'Supply',
      data_table: 'Show the plotted numbers',
      col_date: 'Date',
      matrix_h: 'Change by period',
      matrix_p: 'Percentage points of supply gained or lost by each group. ▲ means the group holds more of the supply than before.',
      more: 'more concentrated',
      less: 'less concentrated',
      group: 'Group',
      move_h: 'Who moved',
      entered: 'Entered the top 1000',
      exited: 'Left the top 1000',
      threshold_now: 'Entry threshold now',
      threshold_was: 'then',
      buyers: 'Biggest buyers',
      sellers: 'Biggest sellers',
      newcomers: 'New in the top 1000',
      dropped: 'Dropped out',
      col_addr: 'Address',
      col_bal: 'Balance',
      col_was: 'Was',
      col_now: 'Now',
      move_note: 'Counts near the #1000 cut-off are noisy: a wallet hovering around the threshold can flip in and out. Moves between two addresses of the same owner look like a buyer and a seller.',
      move_none: 'Nothing to show for this period yet.',
      hold_h: 'Top holders',
      hold_p: 'Balances at the latest snapshot (up to 2000 addresses). Click an address to open it in PepeBlocks.',
      search: 'Search address or tag',
      col_tag: 'Tag',
      col_last: 'Last seen',
      page_of: 'Page {a} of {b}',
      prev: 'Previous', next: 'Next',
      no_match: 'No address matches that search.',
      notes_h: 'How to read this',
      notes: [
        'Live daily snapshots from the API start on 5 Oct 2026. Earlier history, back to June 2024, was reconstructed by replaying every block of the Pepecoin blockchain on a full node: weekly snapshots until September 2025, daily ones after that, and a daily trend series for the whole period. It is drawn dashed or hollow. Checks against archived explorer rich lists and the live API are in VALIDATION.md in the repository.',
        'An address is not a person. Exchanges, pools and custodians hold coins for many users. The view without exchanges and pools is a closer picture of everyone else, but the tags are incomplete.',
        'All shares are measured against the circulating supply on the day of the snapshot, so a growing supply alone lowers a share a little each day.',
        'Each day uses that day\'s top addresses, so the group changes as wallets climb or fall. The tables below show who moved.'
      ],
      sources: 'Data: Pepecoin Service rich list, PepeBlocks supply; history before 5 Oct 2026 reconstructed from the Pepecoin blockchain.',
      csv: 'Download daily history (CSV)',
      nofa: 'Not financial advice.',
      theme: 'Theme', auto: 'Auto', light: 'Light', dark: 'Dark',
      lang_to: 'Po polsku', lang_to_tag: 'pl',
      err_title: 'No snapshot yet',
      err_body: 'The first snapshot is created by the scheduled run. Open the Actions tab of the repository and start “Daily snapshot” once.',
      types: { exchange: 'exchange', pool: 'pool', burn: 'burn', project: 'project', other: 'tagged' },
      of_supply: 'of supply',
      addrs: 'addresses'
    },
    pl: {
      title: 'Pepecoin Holder Watch',
      eyebrow: 'Rich lista · snapshot z {date}',
      eyebrow_plain: 'Rich lista',
      lede: 'Ile podaży PEP leży w największych portfelach i jak się to zmienia. Codziennie jeden snapshot top ~2000 adresów; wykresy skupiają się na top 1000.',
      view_all: 'Wszystkie adresy',
      view_ex: 'Bez giełd i pooli',
      view_ex_note: 'Adresy oznaczone jako giełda, pool lub burn są wyłączone, a ich salda odjęte też od podaży. Tagi to ręcznie prowadzona lista, więc część portfeli giełd może nadal być wliczona.',
      snapshot: 'Snapshot',
      block: 'Blok',
      supply: 'Podaż w obiegu',
      denominator: 'Podaż bez oznaczonych adresów',
      est: 'podaż szacowana',
      hist_one: 'Pierwszy snapshot jest. Zmiany pojawią się od jutra, a porównanie 7-dniowe po tygodniu.',
      hist_many: 'Historia: {n} dziennych snapshotów od {date}. Dłuższe okresy uzupełnią się wraz z historią.',
      hist_rc: 'Historia: {live} dziennych snapshotów na żywo od {live_date} oraz {rc} snapshotów i dzienne punkty trendu odtworzone z blockchainu od {date}.',
      conc_h: 'Koncentracja',
      conc_p: 'Udział największych adresów w podaży w obiegu, porównany z tym samym momentem {period} wcześniej.',
      conc_p_all: 'Udział największych adresów w podaży w obiegu, porównany z najwcześniejszym punktem historii ({date}).',
      period: 'Okres',
      period_all: 'Całość',
      period_all_words: 'początek historii',
      years: '{n} lat',
      na_hist: 'potrzeba {p} dni historii, jest {have}',
      na_hist_all: 'potrzeba co najmniej dwóch snapshotów',
      vs_ref: 'vs {date}',
      vs_ref_rc: 'vs {date} (odtworzone)',
      rc_tag: 'odtworzone',
      rc_note: 'Linia przerywana i puste punkty: dane odtworzone przez przeliczenie blockchainu Pepecoina blok po bloku, dla dni sprzed startu dziennych snapshotów na żywo ({date}).',
      rc_cols: 'Komórki z przerywaną ramką porównują z odtworzonym snapshotem.',
      rc_ref: 'Porównanie z odtworzonym snapshotem z {date}.',
      spark_all: 'trend {n} dni',
      spark_full: 'cała historia',
      spark_hover: '{date}',
      struct_h: 'Gdzie leży podaż',
      struct_p: 'Top 1000 podzielone na progi rankingu. Szary kawałek to wszystko poniżej miejsca 1000.',
      col_rank: 'Miejsce',
      col_held: 'Saldo (PEP)',
      col_pct: '% podaży',
      col_change: 'Zmiana',
      rest: 'Poniżej #1000',
      center: 'Top 1000',
      threshold: 'Wejście do top 1000 wymaga teraz {pep} PEP.',
      trend_h: 'Trend',
      trend_p: 'Udział w podaży top N adresów, jeden punkt na dzień.',
      top_n: 'Top {n}',
      range_30: '30D', range_90: '90D', range_180: '6M', range_365: '1R', range_730: '2L', range_all: 'Całość',
      trend_empty: 'Trend potrzebuje co najmniej dwóch dziennych snapshotów w tym zakresie.',
      tip_holds: 'trzyma',
      tip_supply: 'Podaż',
      data_table: 'Pokaż liczby z wykresu',
      col_date: 'Data',
      matrix_h: 'Zmiana w czasie',
      matrix_p: 'Punkty procentowe podaży zyskane lub stracone przez każdą grupę. ▲ znaczy, że grupa ma teraz większy udział niż wcześniej.',
      more: 'większa koncentracja',
      less: 'mniejsza koncentracja',
      group: 'Grupa',
      move_h: 'Kto się ruszył',
      entered: 'Weszło do top 1000',
      exited: 'Wypadło z top 1000',
      threshold_now: 'Próg wejścia teraz',
      threshold_was: 'wtedy',
      buyers: 'Najwięksi kupujący',
      sellers: 'Najwięksi sprzedający',
      newcomers: 'Nowi w top 1000',
      dropped: 'Wypadli',
      col_addr: 'Adres',
      col_bal: 'Saldo',
      col_was: 'Było',
      col_now: 'Jest',
      move_note: 'Liczby wejść i wyjść przy progu #1000 mocno skaczą: portfel krążący wokół progu potrafi wpadać i wypadać. Przesunięcie między dwoma adresami tego samego właściciela wygląda jak kupujący i sprzedający.',
      move_none: 'Na razie nie ma nic do pokazania dla tego okresu.',
      hold_h: 'Top portfele',
      hold_p: 'Salda z ostatniego snapshotu (do 2000 adresów). Kliknij adres, żeby otworzyć go w PepeBlocks.',
      search: 'Szukaj adresu lub tagu',
      col_tag: 'Tag',
      col_last: 'Ostatnia aktywność',
      page_of: 'Strona {a} z {b}',
      prev: 'Wstecz', next: 'Dalej',
      no_match: 'Żaden adres nie pasuje do wyszukiwania.',
      notes_h: 'Jak to czytać',
      notes: [
        'Dzienne snapshoty z API zaczynają się 5 paź 2026. Wcześniejsza historia, od czerwca 2024, została odtworzona przez przeliczenie każdego bloku blockchainu Pepecoina na pełnym węźle: snapshoty tygodniowe do września 2025, potem dzienne, oraz dzienna seria trendu za cały okres. Jest rysowana linią przerywaną lub pustymi punktami. Porównanie z archiwalnymi rich listami eksplorerów i z API na żywo jest w pliku VALIDATION.md w repozytorium.',
        'Adres to nie człowiek. Giełdy, pule i custodiany trzymają monety wielu użytkowników. Widok bez giełd i pooli lepiej oddaje resztę rynku, ale tagi są niekompletne.',
        'Wszystkie udziały liczone są względem podaży w obiegu z dnia snapshotu, więc samo rosnące podaż obniża udział o odrobinę każdego dnia.',
        'Każdy dzień bierze ówczesne top adresy, więc skład grupy się zmienia, gdy portfele awansują lub spadają. Tabele niżej pokazują, kto się ruszył.'
      ],
      sources: 'Dane: rich lista Pepecoin Service, podaż z PepeBlocks; historia sprzed 5 paź 2026 odtworzona z blockchainu Pepecoina.',
      csv: 'Pobierz dzienną historię (CSV)',
      nofa: 'To nie jest porada inwestycyjna.',
      theme: 'Motyw', auto: 'Auto', light: 'Jasny', dark: 'Ciemny',
      lang_to: 'In English', lang_to_tag: 'en',
      err_title: 'Brak pierwszego snapshotu',
      err_body: 'Pierwszy snapshot tworzy zaplanowane uruchomienie. Wejdź w zakładkę Actions w repozytorium i raz uruchom „Daily snapshot”.',
      types: { exchange: 'giełda', pool: 'pool', burn: 'burn', project: 'projekt', other: 'tag' },
      of_supply: 'podaży',
      addrs: 'adresów'
    }
  };

  // Periods come from summary.json (build_summary.py PERIODS). Whole years without an
  // entry here get a generic label (1825 -> 5Y / 5L), and "all" means the earliest snapshot.
  const PERIOD_LABEL = {
    en: { 1: '1D', 7: '7D', 14: '2W', 30: '1M', 90: '3M', 180: '6M', 365: '1Y', 730: '2Y' },
    pl: { 1: '1D', 7: '7D', 14: '2T', 30: '1M', 90: '3M', 180: '6M', 365: '1R', 730: '2L' }
  };
  const PERIOD_WORDS = {
    en: { 1: 'a day', 7: 'a week', 14: 'two weeks', 30: 'a month', 90: 'a quarter', 180: 'half a year', 365: 'a year', 730: 'two years' },
    pl: { 1: 'dobę', 7: 'tydzień', 14: 'dwa tygodnie', 30: 'miesiąc', 90: 'kwartał', 180: 'pół roku', 365: 'rok', 730: 'dwa lata' }
  };

  /* -------------------------------------------------------------------- state */
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* private mode */ } }
  };

  const state = {
    lang: (function () {
      var stored = store.get('phw-lang');
      if (stored === 'en' || stored === 'pl') return stored;
      var htmlLang = (document.documentElement.lang || '').toLowerCase();
      if (htmlLang.indexOf('pl') === 0) return 'pl';
      try { if ((location.pathname || '').indexOf('/pl/') === 0) return 'pl'; } catch (e) {}
      return (navigator.language || 'en').toLowerCase().startsWith('pl') ? 'pl' : 'en';
    })(),
    view: 'all',
    period: 7,
    range: 90,
    topIdx: 3,
    q: '',
    page: 0
  };
  // Data files live next to app.js (site root), not next to /pl/rich-list.html.
  const DATA_BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    try { return new URL('.', s || location.href).href; } catch (e) { return ''; }
  })();
  const dataUrl = (name) => DATA_BASE + 'data/' + name;

  let S = null;            // summary.json
  let resizers = [];       // chart redraw callbacks, rebuilt on every render

  const app = document.getElementById('app');
  const t = (k, vars) => {
    let s = STR[state.lang][k];
    if (s == null) s = STR.en[k];
    if (typeof s === 'string' && vars) s = s.replace(/\{(\w+)\}/g, (_, n) => (vars[n] == null ? '' : vars[n]));
    return s;
  };
  const isAll = (p) => p === 'all';
  function periodLabel(p) {
    if (isAll(p)) return t('period_all');
    if (PERIOD_LABEL[state.lang][p]) return PERIOD_LABEL[state.lang][p];
    if (p % 365 === 0) return p / 365 + (state.lang === 'pl' ? 'L' : 'Y');
    return p + 'D';
  }
  function periodWords(p) {
    if (isAll(p)) return t('period_all_words');
    if (PERIOD_WORDS[state.lang][p]) return PERIOD_WORDS[state.lang][p];
    if (p % 365 === 0) return t('years', { n: p / 365 });
    return p + (state.lang === 'pl' ? ' dni' : ' days');
  }
  const naHist = (p) => (isAll(p) ? t('na_hist_all') : t('na_hist', { p, have: spanDays() }));
  const refTitle = (d) => t(d.rc ? 'vs_ref_rc' : 'vs_ref', { date: fmtDate(d.ref) });

  /* ----------------------------------------------------------------- dom utils */
  function setAttrs(el, attrs) {
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'text') el.textContent = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  function add(el, kids) {
    for (const k of kids.flat(Infinity)) {
      if (k == null || k === false) continue;
      el.append(k.nodeType ? k : document.createTextNode(String(k)));
    }
    return el;
  }
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); setAttrs(el, attrs); return add(el, kids); };
  const s = (tag, attrs, ...kids) => { const el = document.createElementNS(NS, tag); setAttrs(el, attrs); return add(el, kids); };

  /* ---------------------------------------------------------------- formatting */
  const fmtCache = {};
  function nf(opts) {
    const key = state.lang + JSON.stringify(opts);
    return fmtCache[key] || (fmtCache[key] = new Intl.NumberFormat(state.lang, opts));
  }
  const dec = (d) => nf({ minimumFractionDigits: d, maximumFractionDigits: d });
  const fmtPct = (v, d = 2) => (v == null ? '—' : dec(d).format(v) + '%');
  const fmtInt = (v) => (v == null ? '—' : nf({ maximumFractionDigits: 0 }).format(v));
  const fmtCompact = (v) => (v == null ? '—' : nf({ notation: 'compact', maximumFractionDigits: 2 }).format(v));
  function fmtPP(v) {
    if (v == null) return '—';
    const a = Math.abs(v);
    const txt = dec(2).format(a);
    if (a < 0.005) return '0.00'.replace('.', state.lang === 'pl' ? ',' : '.');
    return (v > 0 ? '+' : '−') + txt;
  }
  function dateObj(iso) { return new Date(iso + 'T00:00:00Z'); }
  function fmtDate(iso) {
    return new Intl.DateTimeFormat(state.lang, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateObj(iso));
  }
  function fmtEpoch(sec) {
    if (!sec) return '—';
    return new Intl.DateTimeFormat(state.lang, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(sec * 1000));
  }
  const shortAddr = (a) => a.slice(0, 7) + '…' + a.slice(-5);
  const daysBetween = (a, b) => Math.round((dateObj(b) - dateObj(a)) / DAY);

  const V = () => S.views[state.view];
  const spanDays = () => daysBetween(S.first_date, S.latest.date);

  /* -------------------------------------------------------------------- tooltip */
  function makeTip(host) {
    const el = h('div', { class: 'tip', hidden: true, role: 'status' });
    host.append(el);
    return {
      show(html, x, y) {
        el.replaceChildren(...html);
        el.hidden = false;
        const hw = host.clientWidth, w = el.offsetWidth, hh = el.offsetHeight;
        let left = x + 14;
        if (left + w > hw) left = Math.max(0, x - w - 14);
        let top = Math.min(Math.max(0, y - hh / 2), Math.max(0, host.clientHeight - hh));
        el.style.left = left + 'px';
        el.style.top = top + 'px';
      },
      hide() { el.hidden = true; }
    };
  }
  const line = (k, v) => h('div', {}, h('span', { class: 'k' }, k + ' '), h('b', {}, v));

  /* ------------------------------------------------------------------- header */
  // Same title block as the other pages: eyebrow, full-width h1, lede.
  const pageHead = (eyebrow) => h('header', { class: 'page-head' },
    h('p', { class: 'eyebrow' }, eyebrow),
    h('h1', {}, t('title')),
    h('p', { class: 'lede' }, t('lede')),
    h('p', { class: 'muted', style: 'max-width:62ch' }, t('labels_note')));

  function header() {
    const L = S.latest;
    const seg = h('div', { class: 'seg', role: 'group', 'aria-label': t('view_all') + ' / ' + t('view_ex') },
      ['all', 'ex'].map((v) => h('button', {
        type: 'button', 'data-key': 'view-' + v, 'aria-pressed': String(state.view === v),
        onclick: () => { state.view = v; state.page = 0; render(); }
      }, t('view_' + v))));

    const langBtn = h('button', {
      type: 'button', class: 'iconbtn', 'data-key': 'lang', lang: t('lang_to_tag'),
      onclick: () => {
        state.lang = state.lang === 'en' ? 'pl' : 'en';
        store.set('phw-lang', state.lang);
        document.documentElement.lang = state.lang;
        render();
      }
    }, t('lang_to'));

    const meta = h('div', { class: 'meta num' },
      L.height ? h('span', {}, t('block') + ' ', h('b', {}, fmtInt(L.height))) : null,
      h('span', {}, t('supply') + ' ', h('b', {}, fmtCompact(L.supply) + ' PEP')),
      state.view === 'ex' ? h('span', {}, t('denominator') + ' ', h('b', {}, fmtCompact(V().denominator) + ' PEP')) : null,
      L.supply_source === 'estimate' ? h('span', { class: 'badge' }, t('est')) : null);

    const histNote = S.reconstructed_snapshots && S.first_live_date
      ? t('hist_rc', { live: fmtInt(S.live_snapshots), live_date: fmtDate(S.first_live_date), rc: fmtInt(S.reconstructed_snapshots), date: fmtDate(S.first_date) })
      : S.snapshots < 2
        ? t('hist_one')
        : (S.snapshots < 366 ? t('hist_many', { n: fmtInt(S.snapshots), date: fmtDate(S.first_date) }) : null);

    return h('div', { class: 'top' },
      pageHead(t('eyebrow', { date: fmtDate(L.date) })),
      h('div', { class: 'top-row' }, h('div', { class: 'tools' }, seg, langBtn), meta),
      state.view === 'ex' ? h('p', { class: 'small muted', style: 'margin:0;max-width:80ch' }, t('view_ex_note')) : null,
      histNote ? h('div', { class: 'notice' }, histNote) : null);
  }

  /* ------------------------------------------------------------ period chooser */
  function periodChips() {
    return h('div', { class: 'chips', role: 'group', 'aria-label': t('period') },
      S.periods.map((p) => h('button', {
        type: 'button', class: 'chip', 'data-key': 'period-' + p, 'aria-pressed': String(state.period === p),
        title: periodWords(p),
        onclick: () => { state.period = p; render(); }
      }, periodLabel(p))));
  }

  /* Split a line into solid (live) and dashed (reconstructed, or a gap of more than
     3 days) segments. Returns [solidPath, dashedPath]. */
  function splitPath(pts, fx, fy) {
    let solid = '', dash = '', penS = null, penD = null;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const ax = fx(a, i - 1).toFixed(1) + ' ' + fy(a).toFixed(1), bx = fx(b, i).toFixed(1) + ' ' + fy(b).toFixed(1);
      if (a.rc || b.rc || (a.t && b.t - a.t > 3 * DAY)) {
        dash += (penD === ax ? '' : 'M' + ax) + 'L' + bx; penD = bx;
      } else {
        solid += (penS === ax ? '' : 'M' + ax) + 'L' + bx; penS = bx;
      }
    }
    return [solid, dash];
  }

  /* ------------------------------------------------------------------ sparkline */
  function sparkline(box, pts, foot, windowLabel) {
    box.replaceChildren();
    if (pts.length < 2) { foot.textContent = '—'; return; }
    const W = Math.max(60, box.clientWidth || 140), H = 36, pad = 4;
    const vals = pts.map((p) => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; }
    const x = (i) => pad + (i * (W - 2 * pad)) / (pts.length - 1);
    const y = (v) => H - pad - ((v - lo) / (hi - lo)) * (H - 2 * pad);
    const d = pts.map((p, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1)).join('');
    const area = d + `L${x(pts.length - 1).toFixed(1)} ${H}L${x(0).toFixed(1)} ${H}Z`;
    const [solidD, dashD] = splitPath(pts, (p, i) => x(i), (p) => y(p.v));
    const dot = s('circle', { cx: x(pts.length - 1), cy: y(pts[pts.length - 1].v), r: 3.5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 });
    const cursor = s('circle', { r: 3.5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' });
    const hit = s('rect', { x: 0, y: 0, width: W, height: H, fill: 'transparent' });
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': windowLabel },
      s('path', { d: area, fill: 'var(--s1)', 'fill-opacity': 0.12 }),
      s('path', { d: solidD, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
      dashD ? s('path', { d: dashD, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 1.5, 'stroke-dasharray': '3 3', 'stroke-opacity': 0.8 }) : null,
      dot, cursor, hit);
    const rest = foot.textContent;
    hit.addEventListener('pointermove', (e) => {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const i = Math.max(0, Math.min(pts.length - 1, Math.round(((px - pad) / (W - 2 * pad)) * (pts.length - 1))));
      cursor.setAttribute('cx', x(i)); cursor.setAttribute('cy', y(pts[i].v)); cursor.setAttribute('visibility', 'visible');
      foot.textContent = fmtDate(pts[i].d) + ' · ' + fmtPct(pts[i].v) + (pts[i].rc ? ' · ' + t('rc_tag') : '');
    });
    hit.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); foot.textContent = rest; });
    box.append(svg);
  }

  /* --------------------------------------------------------------------- tiles */
  function histWindow(days) {
    if (!isFinite(days)) return V().history;
    const cut = dateObj(S.latest.date).getTime() - days * DAY;
    return V().history.filter((e) => dateObj(e.d).getTime() >= cut);
  }

  function tilesSection() {
    const v = V();
    const p = state.period;
    const dl = v.deltas[String(p)];
    const win = isAll(p) ? Infinity : Math.max(p, 7);
    const hist = histWindow(win);
    const winText = win === Infinity ? t('spark_full') : t('spark_all', { n: win });
    const sparks = [];

    const tiles = S.tops.map((n, i) => {
      const val = v.shares[i];
      const pp = dl ? dl.pp[i] : null;
      let deltaEl;
      if (pp == null) {
        deltaEl = h('div', { class: 'delta', title: naHist(p) }, '— ', h('span', { class: 'muted' }, periodLabel(p)));
      } else {
        const arrow = pp > 0.004 ? '▲' : pp < -0.004 ? '▼' : '•';
        const col = pp > 0.004 ? 'rgb(var(--up))' : pp < -0.004 ? 'rgb(var(--down))' : 'var(--muted)';
        deltaEl = h('div', { class: 'delta' + (dl.rc ? ' rc' : ''), title: refTitle(dl) },
          h('span', { class: 'arrow', style: 'color:' + col, 'aria-hidden': 'true' }, arrow),
          fmtPP(pp) + ' pp ', h('span', { class: 'muted' }, periodLabel(p)));
      }
      const spark = h('div', { class: 'spark' });
      const foot = h('div', { class: 'foot' }, winText);
      const pts = hist.map((e) => ({ d: e.d, t: dateObj(e.d).getTime(), v: e.s[i], rc: !!e.rc })).filter((q) => q.v != null);
      sparks.push(() => sparkline(spark, pts, foot, t('top_n', { n }) + ', ' + winText));
      return h('div', { class: 'tile' },
        h('div', { class: 'eyebrow' }, t('top_n', { n: fmtInt(n) })),
        h('div', { class: 'val' }, val == null ? '—' : [dec(2).format(val), h('small', {}, '%')]),
        deltaEl, spark, foot);
    });

    resizers.push(() => sparks.forEach((f) => f()));
    queueMicrotask(() => sparks.forEach((f) => f()));

    return h('section', {},
      h('div', { class: 'sec-head' },
        h('div', {}, h('h2', {}, t('conc_h')), h('p', {}, isAll(p)
          ? t('conc_p_all', { date: fmtDate(dl ? dl.ref : S.first_date) })
          : t('conc_p', { period: periodWords(p) }))),
        periodChips()),
      h('div', { class: 'tiles' }, tiles));
  }

  /* --------------------------------------------------------------- structure now */
  function ringPath(cx, cy, R, r, a0, a1) {
    const pt = (rad, a) => [cx + rad * Math.sin(a), cy - rad * Math.cos(a)];
    const big = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(R, a0), [x1, y1] = pt(R, a1), [x2, y2] = pt(r, a1), [x3, y3] = pt(r, a0);
    return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 ${big} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}L${x2.toFixed(2)} ${y2.toFixed(2)}A${r} ${r} 0 ${big} 0 ${x3.toFixed(2)} ${y3.toFixed(2)}Z`;
  }

  function structSection() {
    const v = V();
    const dl = v.deltas[String(state.period)];
    const refEntry = dl ? v.history.find((e) => e.d === dl.ref) : null;

    const rows = S.tiers.map((tr, i) => ({
      label: '#' + tr[0] + '–' + tr[1],
      color: 'var(--t' + (i + 1) + ')',
      pct: v.tiers[i],
      pep: v.tiers_pep[i],
      delta: refEntry && v.tiers[i] != null && refEntry.t[i] != null ? v.tiers[i] - refEntry.t[i] : null
    }));
    rows.push({
      label: t('rest'), color: 'var(--rest)', pct: v.rest, pep: v.rest_pep,
      delta: refEntry && v.rest != null && refEntry.r != null ? v.rest - refEntry.r : null
    });
    const ready = rows.every((r) => r.pct != null);

    const ringHost = h('div', { class: 'ring' });
    const trs = [];
    if (ready) {
      const tip = makeTip(ringHost);
      const total = rows.reduce((a, r) => a + r.pct, 0);
      let a = 0;
      const paths = rows.map((r, i) => {
        const span = Math.min((r.pct / total) * Math.PI * 2, Math.PI * 2 - 0.0001);
        const path = s('path', { d: ringPath(150, 150, 142, 90, a, a + span), fill: r.color });
        a += span;
        const on = (e) => {
          ringHost.classList.add('hl'); path.classList.add('on'); trs[i] && trs[i].classList.add('on');
          const box = ringHost.getBoundingClientRect();
          tip.show([h('b', {}, r.label), line('', fmtPct(r.pct)), line('', fmtCompact(r.pep) + ' PEP')], e.clientX - box.left, e.clientY - box.top);
        };
        const off = () => { ringHost.classList.remove('hl'); path.classList.remove('on'); trs[i] && trs[i].classList.remove('on'); tip.hide(); };
        path.addEventListener('pointermove', on);
        path.addEventListener('pointerleave', off);
        path._on = on; path._off = off;
        return path;
      });
      const svg = s('svg', { viewBox: '0 0 300 300', role: 'img', 'aria-label': t('struct_h') + ': ' + rows.map((r) => r.label + ' ' + fmtPct(r.pct)).join(', ') },
        paths,
        s('text', { x: 150, y: 140, 'text-anchor': 'middle', fill: 'var(--muted)', 'font-size': 12, 'letter-spacing': '0.06em' }, t('center').toUpperCase()),
        s('text', { x: 150, y: 172, 'text-anchor': 'middle', fill: 'var(--ink)', 'font-size': 34, 'font-weight': 700 }, fmtPct(v.shares[S.tops.length - 1], 1)));
      ringHost.prepend(svg);
      ringHost._paths = paths;
    } else {
      ringHost.append(h('div', { class: 'empty' }, '—'));
    }

    const tbody = h('tbody', {}, rows.map((r, i) => {
      const tr = h('tr', {
        onpointerenter: () => ringHost._paths && ringHost._paths[i]._on({ clientX: ringHost.getBoundingClientRect().left + 150, clientY: ringHost.getBoundingClientRect().top + 20 }),
        onpointerleave: () => ringHost._paths && ringHost._paths[i]._off()
      },
        h('td', {}, h('span', { class: 'sw', style: 'background:' + r.color }), r.label),
        h('td', {}, fmtCompact(r.pep)),
        h('td', {}, fmtPct(r.pct)),
        h('td', {}, r.delta == null ? '—' : fmtPP(r.delta) + ' pp'));
      trs.push(tr);
      return tr;
    }));

    const table = h('div', { class: 'scroll' }, h('table', { class: 'tiers' },
      h('thead', {}, h('tr', {}, h('th', {}, t('col_rank')), h('th', {}, t('col_held')), h('th', {}, t('col_pct')), h('th', {}, t('col_change') + ' ' + periodLabel(state.period)))),
      tbody));

    return h('section', {},
      h('div', { class: 'sec-head' }, h('div', {}, h('h2', {}, t('struct_h')), h('p', {}, t('struct_p')))),
      h('div', { class: 'panel split' }, ringHost,
        h('div', {}, table,
          v.cutoff_pep != null ? h('p', { class: 'small muted', style: 'margin:10px 0 0' }, t('threshold', { pep: fmtCompact(v.cutoff_pep) })) : null)));
  }

  /* -------------------------------------------------------------------- trend */
  function niceStep(raw) {
    const exp = Math.floor(Math.log10(raw));
    const f = raw / Math.pow(10, exp);
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * Math.pow(10, exp);
  }
  function niceTicks(lo, hi, count) {
    const step = niceStep((hi - lo) / Math.max(1, count - 1));
    const start = Math.floor(lo / step + 1e-9) * step;
    const out = [];
    for (let v = start; v < hi + step - 1e-9; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }

  function trendPoints() {
    const idx = state.topIdx;
    let pts = V().history.map((e) => ({ d: e.d, t: dateObj(e.d).getTime(), v: e.s[idx], rc: !!e.rc })).filter((p) => p.v != null);
    if (isFinite(state.range)) {
      const cut = dateObj(S.latest.date).getTime() - state.range * DAY;
      pts = pts.filter((p) => p.t >= cut);
    }
    return pts;
  }

  function renderTrend(box) {
    box.replaceChildren();
    const pts = trendPoints();
    if (pts.length < 2) { box.append(h('div', { class: 'empty' }, t('trend_empty'))); return; }

    const W = Math.max(280, box.clientWidth || 640);
    const H = W < 520 ? 240 : 300;
    const m = { l: 50, r: 16, t: 12, b: 28 };
    const pw = W - m.l - m.r, ph = H - m.t - m.b;

    let lo = Math.min(...pts.map((p) => p.v)), hi = Math.max(...pts.map((p) => p.v));
    if (hi - lo < 0.02) { const mid = (hi + lo) / 2; lo = mid - 0.1; hi = mid + 0.1; }
    const pad = (hi - lo) * 0.12;
    const { ticks, step } = niceTicks(Math.max(0, lo - pad), Math.min(100, hi + pad), 5);
    const y0 = ticks[0], y1 = ticks[ticks.length - 1];
    const decimals = Math.min(3, Math.max(0, -Math.floor(Math.log10(step) + 1e-9)));
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    const x = (tm) => m.l + ((tm - t0) / (t1 - t0)) * pw;
    const y = (v) => m.t + (1 - (v - y0) / (y1 - y0)) * ph;

    const longSpan = (t1 - t0) / DAY > 300;
    const fmtTick = (tm) => new Intl.DateTimeFormat(state.lang, longSpan
      ? { month: 'short', year: '2-digit', timeZone: 'UTC' }
      : { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(tm));
    const nx = W < 520 ? 3 : 5;
    const xt = Array.from({ length: nx }, (_, i) => t0 + ((t1 - t0) * i) / (nx - 1));

    const path = pts.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join('');
    const areaD = path + `L${x(t1).toFixed(1)} ${m.t + ph}L${x(t0).toFixed(1)} ${m.t + ph}Z`;
    const [solidD, dashD] = splitPath(pts, (p) => x(p.t), (p) => y(p.v));

    const grid = s('g', { class: 'grid' }, ticks.map((v) => s('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v) })));
    const yAxis = s('g', { class: 'axis' }, ticks.map((v) => s('text', { x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end' }, fmtPct(v, decimals))));
    const xAxis = s('g', { class: 'axis' },
      s('line', { class: 'base', x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph }),
      xt.map((tm, i) => s('text', { x: x(tm), y: H - 8, 'text-anchor': i === 0 ? 'start' : i === nx - 1 ? 'end' : 'middle' }, fmtTick(tm))));

    // live snapshots are filled dots, reconstructed ones hollow (dots only when there are few points)
    const dots = pts.length <= 45 ? pts.map((p) => p.rc
      ? s('circle', { cx: x(p.t), cy: y(p.v), r: 3, fill: 'var(--surface)', stroke: 'var(--s1)', 'stroke-width': 1.5 })
      : s('circle', { cx: x(p.t), cy: y(p.v), r: 2.5, fill: 'var(--s1)' })) : [];
    const last = pts[pts.length - 1];
    const endDot = s('circle', { cx: x(last.t), cy: y(last.v), r: 4.5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2 });

    const cross = s('line', { y1: m.t, y2: m.t + ph, stroke: 'var(--line)', 'stroke-width': 1, visibility: 'hidden' });
    const cursor = s('circle', { r: 4.5, fill: 'var(--s1)', stroke: 'var(--surface)', 'stroke-width': 2, visibility: 'hidden' });
    const hit = s('rect', { x: m.l, y: m.t, width: pw, height: ph, fill: 'transparent' });

    const label = t('top_n', { n: fmtInt(S.tops[state.topIdx]) }) + ' ' + t('of_supply');
    const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': label + ', ' + fmtDate(pts[0].d) + ' – ' + fmtDate(last.d) },
      grid, yAxis, xAxis,
      s('path', { d: areaD, fill: 'var(--s1)', 'fill-opacity': 0.10 }),
      s('path', { d: solidD, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }),
      dashD ? s('path', { class: 'rc-line', d: dashD, fill: 'none', stroke: 'var(--s1)', 'stroke-width': 1.75, 'stroke-dasharray': '5 4', 'stroke-opacity': 0.85 }) : null,
      dots, endDot, cross, cursor, hit);
    box.append(svg);
    const tip = makeTip(box);

    function at(e) {
      const r = svg.getBoundingClientRect();
      const px = ((e.clientX - r.left) / r.width) * W;
      const tm = t0 + ((px - m.l) / pw) * (t1 - t0);
      let best = 0, bd = Infinity;
      for (let i = 0; i < pts.length; i++) { const dd = Math.abs(pts[i].t - tm); if (dd < bd) { bd = dd; best = i; } }
      const p = pts[best];
      const cx = x(p.t), cy = y(p.v);
      cross.setAttribute('x1', cx); cross.setAttribute('x2', cx); cross.setAttribute('visibility', 'visible');
      cursor.setAttribute('cx', cx); cursor.setAttribute('cy', cy); cursor.setAttribute('visibility', 'visible');
      cursor.setAttribute('fill', p.rc ? 'var(--surface)' : 'var(--s1)');
      cursor.setAttribute('stroke', p.rc ? 'var(--s1)' : 'var(--surface)');
      const scale = r.width / W;
      tip.show([h('b', {}, fmtDate(p.d) + (p.rc ? ' · ' + t('rc_tag') : '')), line(t('top_n', { n: fmtInt(S.tops[state.topIdx]) }) + ' ' + t('tip_holds'), fmtPct(p.v))], cx * scale, cy * scale);
    }
    hit.addEventListener('pointermove', at);
    hit.addEventListener('pointerdown', at);
    hit.addEventListener('pointerleave', () => { cross.setAttribute('visibility', 'hidden'); cursor.setAttribute('visibility', 'hidden'); tip.hide(); });
  }

  function trendSection() {
    const box = h('div', { class: 'chart' });
    const nChips = h('div', { class: 'chips', role: 'group', 'aria-label': t('trend_h') },
      S.tops.map((n, i) => h('button', {
        type: 'button', class: 'chip', 'data-key': 'top-' + i, 'aria-pressed': String(state.topIdx === i),
        onclick: () => { state.topIdx = i; render(); }
      }, t('top_n', { n: fmtInt(n) }))));
    const ranges = [30, 90, 180, 365, 730, Infinity];
    const rChips = h('div', { class: 'chips', role: 'group', 'aria-label': t('period') },
      ranges.map((r) => h('button', {
        type: 'button', class: 'chip', 'data-key': 'range-' + r, 'aria-pressed': String(state.range === r),
        onclick: () => { state.range = r; render(); }
      }, t(r === Infinity ? 'range_all' : 'range_' + r))));

    const details = h('details', { class: 'small', style: 'margin-top:10px' }, h('summary', { style: 'cursor:pointer;color:var(--ink-2)' }, t('data_table')));
    details.addEventListener('toggle', () => {
      if (!details.open || details.querySelector('table')) return;
      const pts = trendPoints().slice().reverse();
      details.append(h('div', { class: 'scroll', style: 'max-height:260px;overflow:auto;margin-top:6px' }, h('table', {},
        h('thead', {}, h('tr', {}, h('th', {}, t('col_date')), h('th', {}, t('top_n', { n: fmtInt(S.tops[state.topIdx]) }) + ' ' + t('of_supply')))),
        h('tbody', {}, pts.map((p) => h('tr', {}, h('td', {}, fmtDate(p.d) + (p.rc ? ' (' + t('rc_tag') + ')' : '')), h('td', {}, fmtPct(p.v, 3))))))));
    });

    resizers.push(() => renderTrend(box));
    queueMicrotask(() => renderTrend(box));

    return h('section', {},
      h('div', { class: 'sec-head' },
        h('div', {}, h('h2', {}, t('trend_h')), h('p', {}, t('trend_p'))),
        rChips),
      h('div', { class: 'panel' }, nChips, h('div', { style: 'height:12px' }), box,
        V().history.some((e) => e.rc)
          ? h('p', { class: 'small muted rc-note', style: 'margin:8px 0 0' }, h('span', { class: 'rc-swatch', 'aria-hidden': 'true' }), t('rc_note', { date: fmtDate(S.first_live_date || S.latest.date) }))
          : null,
        details));
  }

  /* ------------------------------------------------------------------- matrix */
  function matrixSection() {
    const v = V();
    const cols = S.periods;
    const colMax = cols.map((p) => {
      const d = v.deltas[String(p)];
      return d ? Math.max(0.0001, ...d.pp.filter((q) => q != null).map(Math.abs)) : 1;
    });

    const head = h('tr', {}, h('th', {}, t('group')), cols.map((p) => {
      const d = v.deltas[String(p)];
      return h('th', { class: d && d.rc ? 'rc' : null, title: d ? refTitle(d) : naHist(p) }, periodLabel(p));
    }));

    const body = S.tops.map((n, i) => h('tr', {}, h('td', {}, t('top_n', { n: fmtInt(n) })),
      cols.map((p, ci) => {
        const d = v.deltas[String(p)];
        const val = d ? d.pp[i] : null;
        if (val == null) return h('td', { class: 'na', title: naHist(p) }, '—');
        const a = 0.06 + 0.30 * Math.min(1, Math.abs(val) / colMax[ci]);
        const bg = Math.abs(val) < 0.005 ? '' : `background:rgba(var(${val > 0 ? '--up' : '--down'}),${a.toFixed(2)})`;
        const arrow = val > 0.004 ? '▲ ' : val < -0.004 ? '▼ ' : '';
        return h('td', { style: bg, class: d.rc ? 'rc' : null, title: refTitle(d) }, arrow + fmtPP(val));
      })));

    return h('section', {},
      h('div', { class: 'sec-head' }, h('div', {}, h('h2', {}, t('matrix_h')), h('p', {}, t('matrix_p')))),
      h('div', { class: 'panel' },
        h('div', { class: 'scroll' }, h('table', { class: 'matrix' }, h('thead', {}, head), h('tbody', {}, body))),
        h('div', { class: 'legend-line', style: 'margin-top:10px' },
          h('span', {}, h('span', { class: 'sw', style: 'background:rgba(var(--up),0.5)' }), '▲ ' + t('more')),
          h('span', {}, h('span', { class: 'sw', style: 'background:rgba(var(--down),0.5)' }), '▼ ' + t('less')),
          cols.some((p) => v.deltas[String(p)] && v.deltas[String(p)].rc)
            ? h('span', {}, h('span', { class: 'sw rc-sw' }), t('rc_cols')) : null)));
  }

  /* ------------------------------------------------------------------- movers */
  function addrCell(a, label) {
    return h('td', {}, h('a', { class: 'mono', href: EXPLORER + a, target: '_blank', rel: 'noopener', title: a }, shortAddr(a)),
      label ? h('span', { class: 'tag' }, label) : null);
  }

  function moversSection() {
    const c = V().churn[String(state.period)];
    const head = h('div', { class: 'sec-head' },
      h('div', {}, h('h2', {}, t('move_h')), h('p', {}, t('move_note'))), periodChips());
    if (!c) {
      return h('section', {}, head, h('div', { class: 'panel empty' }, naHist(state.period)));
    }
    const list = (title, cols, rows) => h('div', { class: 'panel' }, h('h3', {}, title),
      rows.length
        ? h('div', { class: 'scroll' }, h('table', {}, h('thead', {}, h('tr', {}, cols.map((k, i) => h('th', {}, t(k))))), h('tbody', {}, rows)))
        : h('p', { class: 'small muted', style: 'margin:0' }, t('move_none')));

    const signed = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtCompact(Math.abs(v));
    return h('section', {}, head,
      h('div', { class: 'stats num' },
        h('span', {}, t('entered') + ' ', h('b', {}, fmtInt(c.entered))),
        h('span', {}, t('exited') + ' ', h('b', {}, fmtInt(c.exited))),
        c.cutoff_now != null ? h('span', {}, t('threshold_now') + ' ', h('b', {}, fmtCompact(c.cutoff_now) + ' PEP'),
          c.cutoff_ref != null ? ' (' + t('threshold_was') + ' ' + fmtCompact(c.cutoff_ref) + ')' : '') : null,
        c.rc ? h('span', { class: 'rc-text' }, t('rc_ref', { date: fmtDate(c.ref) })) : null),
      h('div', { class: 'movers' },
        list(t('buyers'), ['col_addr', 'col_change', 'col_bal'], c.gainers.map((r) => h('tr', {}, addrCell(r.a, r.l), h('td', {}, signed(r.d)), h('td', {}, fmtCompact(r.b))))),
        list(t('sellers'), ['col_addr', 'col_change', 'col_bal'], c.losers.map((r) => h('tr', {}, addrCell(r.a, r.l), h('td', {}, signed(r.d)), h('td', {}, fmtCompact(r.b))))),
        list(t('newcomers'), ['col_addr', 'col_bal', 'col_rank'], c.entered_top.map((r) => h('tr', {}, addrCell(r.a, r.l), h('td', {}, fmtCompact(r.b)), h('td', {}, '#' + fmtInt(r.r))))),
        list(t('dropped'), ['col_addr', 'col_was', 'col_now'], c.exited_top.map((r) => h('tr', {}, addrCell(r.a, r.l), h('td', {}, fmtCompact(r.b)), h('td', {}, r.now == null ? '—' : fmtCompact(r.now)))))));
  }

  /* ------------------------------------------------------------------ holders */
  const PAGE = 50;
  function holderRows() {
    const ex = state.view === 'ex';
    const q = state.q.trim().toLowerCase();
    const out = [];
    for (const r of S.holders) {
      const rank = ex ? r[7] : r[0];
      if (rank == null) continue;
      const tag = r[4] || (r[5] ? STR[state.lang].types[r[5]] || r[5] : '');
      if (q && !(r[1].toLowerCase().includes(q) || tag.toLowerCase().includes(q))) continue;
      out.push({ rank, addr: r[1], pep: r[2], pct: ex ? r[8] : r[3], tag, type: r[5], last: r[6] });
    }
    out.sort((a, b) => a.rank - b.rank);
    return out;
  }

  function holdersSection() {
    const tbody = h('tbody');
    const pager = h('div', { class: 'pager' });
    const note = h('div', { class: 'empty', hidden: true }, t('no_match'));

    function paint() {
      const rows = holderRows();
      const pages = Math.max(1, Math.ceil(rows.length / PAGE));
      state.page = Math.min(state.page, pages - 1);
      const slice = rows.slice(state.page * PAGE, state.page * PAGE + PAGE);
      tbody.replaceChildren(...slice.map((r) => h('tr', {},
        h('td', {}, fmtInt(r.rank)),
        h('td', {}, h('a', { class: 'mono', href: EXPLORER + r.addr, target: '_blank', rel: 'noopener' }, r.addr)),
        h('td', {}, r.tag ? h('span', { class: 'tag', style: 'margin-left:0' }, r.tag) : ''),
        h('td', {}, fmtInt(r.pep)),
        h('td', {}, fmtPct(r.pct, 3)),
        h('td', {}, fmtEpoch(r.last)))));
      note.hidden = rows.length > 0;
      pager.replaceChildren(
        h('button', { type: 'button', disabled: state.page === 0, onclick: () => { state.page--; paint(); } }, t('prev')),
        h('span', { class: 'num' }, t('page_of', { a: fmtInt(state.page + 1), b: fmtInt(pages) })),
        h('button', { type: 'button', disabled: state.page >= pages - 1, onclick: () => { state.page++; paint(); } }, t('next')));
    }

    const input = h('input', { type: 'search', id: 'q', placeholder: t('search'), 'aria-label': t('search'), value: state.q, autocomplete: 'off' });
    input.addEventListener('input', () => { state.q = input.value; state.page = 0; paint(); });
    paint();

    return h('section', {},
      h('div', { class: 'sec-head' }, h('div', {}, h('h2', {}, t('hold_h')), h('p', {}, t('hold_p')))),
      h('div', { class: 'panel' },
        h('div', { class: 'tools-row' }, input, pager),
        h('div', { class: 'scroll', style: 'margin-top:8px' }, h('table', { class: 'holders' },
          h('thead', {}, h('tr', {}, h('th', {}, '#'), h('th', {}, t('col_addr')), h('th', {}, t('col_tag')), h('th', {}, t('col_bal')), h('th', {}, t('col_pct')), h('th', {}, t('col_last')))),
          tbody)),
        note));
  }

  /* -------------------------------------------------------------------- notes */
  function notesSection() {
    return h('section', {}, h('h2', {}, t('notes_h')),
      h('div', { class: 'notes' }, h('ul', {}, t('notes').map((n) => h('li', {}, n)))));
  }
  function footer() {
    return h('footer', {},
      h('span', {}, t('sources')),
      h('a', { href: dataUrl('shares.csv') }, t('csv')),
      h('span', {}, t('nofa')));
  }

  /* ------------------------------------------------------------------- render */
  function render() {
    const active = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null;
    const keepY = window.scrollY;
    resizers = [];
    app.replaceChildren(header(), tilesSection(), structSection(), trendSection(), matrixSection(), moversSection(), holdersSection(), notesSection(), footer());
    document.title = t('title') + ' | PEP rich list and concentration tracker';
    if (active) { const el = app.querySelector('[data-key="' + active + '"]'); if (el) el.focus({ preventScroll: true }); }
    window.scrollTo(0, keepY);
  }

  let lastW = 0, timer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const w = app.clientWidth;
      if (Math.abs(w - lastW) > 8) { lastW = w; resizers.forEach((f) => f()); }
    }, 120);
  });

  function showEmpty() {
    app.replaceChildren(
      pageHead(t('eyebrow_plain')),
      h('div', { class: 'panel' }, h('h2', {}, t('err_title')), h('p', {}, t('err_body'))));
  }

  document.documentElement.lang = state.lang;
  fetch(dataUrl('summary.json'), { cache: 'no-cache' })
    .then((r) => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then((data) => { S = data; lastW = app.clientWidth; render(); })
    .catch(showEmpty);
})();

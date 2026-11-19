/* PondOS Newsroom.exe: the owner writes, previews and publishes The Pond Gazette and PEP-TV ads.
   Loaded only when the owner opens it (Frog Mail → 📰 Newsroom). Everything is saved in Supabase through
   games/supabase/update_gazette_newsroom.sql, which checks games.owners on every call: this file only draws the forms.
   The page that shows an issue (meme.js gzIssueHtml / gzScene) escapes every text, so nothing typed here can run code. */
(function () {
  'use strict';
  // pictures that already live on the site (docs/meme/img); scripts/build_newsroom_pictures.py rebuilds this list
  var PICS = ["alarm.webp","beach-break.webp","believe.webp","big-eyes.webp","bong.webp","born-to-fren.webp","brain.webp","btc.png","casino.webp","charts.webp","chonk.webp","coin-bells.webp","coin-dingo.webp","coin-jkc.webp","coin-lky.webp","coin-shic.webp","coin-spin.webp","comic-frens.webp","cowboy.webp","cup.webp","detective.webp","diamond.webp","distracted.webp","doge.png","dream.webp","empty-pool.webp","exit.webp","farmer.webp","fire-fren.webp","fren-bus.webp","fren-chain.webp","gibup.webp","gif-007.webp","gif-025.webp","gif-029.webp","gif-032.webp","gif-034.webp","gif-035.webp","gif-038.webp","gif-040.webp","gif-045.webp","gif-047.webp","gif-048.webp","gif-059.webp","gif-063.webp","gif-064.webp","gif-071.webp","gif-072.webp","gif-075.webp","gif-079.webp","gif-080.webp","gif-083.webp","gif-084.webp","gif-085.webp","glasses.webp","gm-015.webp","gm-019.webp","gm-033.webp","gm-041.webp","gm-073.webp","gz12-install.webp","gz12-notify.webp","gz12-tips.webp","gz5-oops.webp","happy.webp","hardhat.webp","how-to-be-rich.webp","hug.webp","internet.webp","laptop.webp","ltc.png","math.webp","mentioned.webp","news.webp","newspaper.webp","night-shift.webp","p-eyes.webp","pancake.webp","peaky.webp","peek-up.webp","peek.webp","pep-loading.webp","pep-logo.webp","pep-tv-ads.webp","pepe-doge.webp","pepe-search.webp","pepe.png","pepecoin2016.webp","phone.webp","pickaxe.webp","pills.webp","pond-playground.webp","pond-tv.webp","pondos-192.png","pondos-512.png","pondos-badge-96.png","pondos-maskable-512.png","popcorn-watch.webp","pre-rich.webp","rich.webp","serious.webp","shop-bag.webp","shrimp.webp","sled.webp","sleep.webp","smoke.webp","so-back.webp","so-over.webp","stands.webp","stop.webp","suit-lighter.webp","tired.webp","triple-mine.png","unclesam.webp","whisper.webp","wow.webp","wp-pepe.webp","wrongpep.webp","zipper.webp","chars/backpack.webp","chars/balloons.webp","chars/brb.webp","chars/chonky.webp","chars/comfy.webp","chars/explorer.webp","chars/juicebox.webp"];
  var STYLES = [['story', 'Story'], ['breaking', 'Breaking news (red flashing line)'], ['letters', 'Letters / quotes'],
    ['notes', 'Notice board (pinned notes)'], ['facts', 'Did you know? (list)'], ['poll', 'Pond Poll (readers vote)']];
  var LS = 'pondos-newsroom:';
  function rnd(n) { var s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
  function local(k, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(LS + k) || 'null'); if (v === null) localStorage.removeItem(LS + k); else localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {}
    return null;
  }
  function when(iso) { if (!iso) return ''; var d = new Date(iso); return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

  window.PondNewsroom = function (api) {
    var esc = api.esc, data = { issues: [], ads: [] }, A;
    A = api.openApp('newsroom', 'Newsroom.exe - The Pond Gazette', 'newspaper-still', function (W) {
      A = W;
      W.body.innerHTML = '<div class="nr"><p class="nr-msg" role="status">Opening the newsroom…</p></div>';
      load().then(function () { list('issues'); });
    }, 880);
    if (A && A.host) A.host.classList.add('nr-win');

    var root = function () { return A.body.querySelector('.nr'); };
    var say = function (t, bad) { var m = A.body.querySelector('.nr-msg'); if (m) { m.textContent = t; m.classList.toggle('err', !!bad); } };
    function load() {
      return api.rpc('gry_newsroom', {}).then(function (j) {
        if (!j) throw new Error('Only the site owner can open the Newsroom. Log on with the owner Discord account.');
        data = { issues: j.issues || [], ads: j.ads || [] };
      }).catch(function (e) {
        var m = (e && e.message) || '';
        root().innerHTML = '<p class="nr-msg err">' + esc(/gry_newsroom|function|schema/i.test(m) ? 'The Newsroom is not switched on yet: run games/supabase/update_gazette_newsroom.sql in Supabase (SQL Editor), then open this again.' : m || 'The Newsroom cannot be reached right now.') + '</p>';
        throw e;
      });
    }

    // ---------- the lists ----------
    function list(tab) {
      var nextNum = Math.max(api.latest(), data.issues.reduce(function (m, x) { return Math.max(m, +x.num); }, 0)) + 1;
      var rows = tab === 'ads'
        ? data.ads.map(function (a) { return '<li><img src="' + esc(api.img(a.icon) || 'img/pep-tv-ads.webp') + '" alt="" width="32" height="32"><div><b>' + esc(a.title) + '</b><small>' + esc(a.id) + '</small></div>' + status(a) + '<button type="button" class="app-btn" data-ad="' + esc(a.id) + '">Edit</button></li>'; }).join('')
        : data.issues.map(function (x) { return '<li><b class="nr-num">#' + x.num + '</b><div><b>' + esc(x.title || '(no title yet)') + '</b><small>' + (x.blocks || []).length + ' stories · saved ' + esc(when(x.updated)) + '</small></div>' + status(x) + '<button type="button" class="app-btn" data-issue="' + x.num + '">Edit</button></li>'; }).join('');
      root().innerHTML = '<div class="nr-tabs" role="tablist"><button type="button" role="tab" data-tab="issues" aria-selected="' + (tab !== 'ads') + '">📰 Gazette issues</button><button type="button" role="tab" data-tab="ads" aria-selected="' + (tab === 'ads') + '">📺 PEP-TV ads</button></div>' +
        '<div class="nr-list">' + (tab === 'ads'
          ? '<button type="button" class="app-btn go nr-new">+ New PEP-TV ad</button><ul>' + rows + '</ul>' + (data.ads.length ? '' : '<p class="nr-hint">No ads from the Newsroom yet. The ads already on the site stay in the site code.</p>')
          : '<button type="button" class="app-btn go nr-new">+ New issue #' + nextNum + '</button><ul>' + rows + '</ul><p class="nr-hint">Issues #2–#' + Math.min(10, api.latest()) + ' are part of the site code and stay as they are. Everything from #11 on is written here.</p>') +
        '<details class="nr-help"><summary>How it works</summary><ul>' +
        '<li><b>Save draft</b> keeps it on the server; only you can see it (it shows in Frog Mail with a DRAFT stripe when you open it from here).</li>' +
        '<li><b>Publish</b> puts it on the stands for everyone at once: the mailbox flag goes up for every visitor. You can still fix typos after publishing, or take it back to a draft.</li>' +
        '<li>Your typing is also kept on this device, so a closed tab or a dead phone battery does not eat your text.</li>' +
        '<li>Pictures: pick one of the site\'s own, or upload a photo from your phone (it is shrunk to under 1 MB first).</li></ul></details>' +
        '<p class="nr-msg" role="status"></p></div>';
      root().querySelectorAll('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { list(b.getAttribute('data-tab')); }); });
      root().querySelector('.nr-new').addEventListener('click', function () {
        if (tab === 'ads') editAd({ id: '', title: '', ch: 'CH 7 · PEP-TV LATE NIGHT', look: '', kitsch: true, icon: '', scenes: [{ kick: '', big: '', sub: '' }, { kick: '', big: '', sub: '' }] });
        else editIssue({ num: nextNum, title: '', edition: 'Weekly', foot: '', blocks: [{ style: 'breaking', kicker: 'Breaking news', heading: '', body: '' }, { style: 'story', kicker: '', heading: '', body: '' }], fresh: true });
      });
      root().querySelectorAll('[data-issue]').forEach(function (b) { b.addEventListener('click', function () { var n = +b.getAttribute('data-issue'); editIssue(JSON.parse(JSON.stringify(data.issues.filter(function (x) { return +x.num === n; })[0]))); }); });
      root().querySelectorAll('[data-ad]').forEach(function (b) { b.addEventListener('click', function () { var id = b.getAttribute('data-ad'); editAd(JSON.parse(JSON.stringify(data.ads.filter(function (x) { return x.id === id; })[0]))); }); });
    }
    function status(x) { return x.at ? '<span class="nr-st live">● Live since ' + esc(when(x.at)) + '</span>' : '<span class="nr-st">Draft</span>'; }

    // ---------- small form helpers ----------
    function goSelect(b, cls) {
      b = b || {};
      var ads = api.builtinAds().concat(data.ads.filter(function (a) { return a.at; }).map(function (a) { return [a.id, a.title]; }));
      var cur = b.go === 'url' ? 'url' : b.go || '';
      return '<select class="' + cls + '" data-bf="go"><option value="">No button</option>' +
        api.go.map(function (g) { return '<option value="' + g[0] + '"' + (cur === g[0] ? ' selected' : '') + '>Opens ' + esc(g[1]) + '</option>'; }).join('') +
        '<optgroup label="Plays a PEP-TV ad">' + ads.map(function (a) { return '<option value="ad:' + esc(a[0]) + '"' + (cur === 'ad:' + a[0] ? ' selected' : '') + '>📺 ' + esc(a[1]) + '</option>'; }).join('') + '</optgroup>' +
        '<option value="url"' + (cur === 'url' ? ' selected' : '') + '>Opens a link…</option></select>';
    }
    function btnRow(b, k) {
      b = b || {};
      return '<div class="nr-btn" data-b="' + k + '"><input data-bf="label" maxlength="60" placeholder="Button text (e.g. Play today\'s photo →)" value="' + esc(b.label || '') + '">' + goSelect(b, '') +
        '<input data-bf="url" maxlength="300" placeholder="https://… or mining.html" value="' + esc(b.url || '') + '"' + (b.go === 'url' ? '' : ' hidden') + '></div>';
    }
    function picField(src) {
      var u = api.img(src);
      return '<div class="nr-pic">' + (u ? '<img src="' + esc(u) + '" alt="" width="56" height="56">' : '<span class="nr-nopic">no picture</span>') +
        '<button type="button" class="app-btn nr-pick">🖼 ' + (u ? 'Change' : 'Add picture') + '</button>' + (u ? '<button type="button" class="app-btn nr-unpic" title="Remove the picture">✕</button>' : '') + '</div>';
    }
    // autosave on this device + a "leave without saving?" guard
    function keeper(key, w, server) {
      var t = 0, dirty = false;
      return {
        touch: function () { dirty = true; clearTimeout(t); t = setTimeout(function () { local(key, { at: Date.now(), w: w }); }, 500); },
        clean: function () { dirty = false; clearTimeout(t); local(key, null); },
        dirty: function () { return dirty; },
        offer: function (into, apply) {
          var d = local(key);
          if (!d || !d.w || (server && Date.parse(server) > d.at)) return;
          var box = document.createElement('p'); box.className = 'nr-restore';
          box.innerHTML = 'Unsaved changes from ' + esc(when(new Date(d.at).toISOString())) + ' are kept on this device. <button type="button" class="app-btn go">Bring them back</button> <button type="button" class="app-btn">Throw away</button>';
          box.querySelector('.go').addEventListener('click', function () { apply(d.w); });
          box.querySelectorAll('button')[1].addEventListener('click', function () { local(key, null); box.remove(); });
          into.insertBefore(box, into.firstChild);
        }
      };
    }
    function back(k, tab) { if (k.dirty() && !window.confirm('Leave without saving? Your text stays on this device and comes back next time.')) return; list(tab); }

    // ---------- an issue ----------
    function editIssue(w) {
      var live = !!w.at, keep = keeper('issue:' + w.num, w, w.updated);
      w.blocks = Array.isArray(w.blocks) ? w.blocks : [];
      var paint = function () {
        root().innerHTML = '<div class="nr-ed"><div class="nr-top"><button type="button" class="app-btn nr-back">← All issues</button><b>Issue #' + w.num + '</b>' + status(w) + '</div>' +
          '<div class="nr-meta"><label>Title in the archive<input data-k="title" maxlength="120" placeholder="e.g. 10 secrets found already" value="' + esc(w.title || '') + '"></label>' +
          '<label>Label at the top right<input data-k="edition" maxlength="40" placeholder="Weekly" value="' + esc(w.edition || '') + '"></label>' +
          '<label>Last line<input data-k="foot" maxlength="200" placeholder="See you in the pond. 🐸 The Editor" value="' + esc(w.foot || '') + '"></label></div>' +
          '<details class="nr-paste"><summary>⚡ Quick paste: turn a whole text into stories</summary>' +
          '<p class="nr-hint">Paste your text. Every line that starts with <code>##</code> starts a new story and is its heading. Write <code>## Games desk | The new duels</code> to set the small red line too. The rest is the story text. The stories are added at the end.</p>' +
          '<textarea class="nr-paste-in" rows="7" placeholder="## Breaking news | We are LIVE!&#10;The beta is over…&#10;&#10;## Rumour mill | 10 secrets found already?!&#10;Word in the pond is…"></textarea>' +
          '<button type="button" class="app-btn go nr-paste-go">Make stories</button></details>' +
          '<ol class="nr-blocks">' + w.blocks.map(blockCard).join('') + '</ol>' +
          '<div class="nr-add">' + STYLES.map(function (s) { return '<button type="button" class="app-btn" data-add="' + s[0] + '">+ ' + esc(s[1].replace(/ \(.*\)$/, '')) + '</button>'; }).join('') + '</div>' +
          '<details class="nr-help"><summary>Text tricks</summary><ul><li><code>**bold**</code> and <code>*italic*</code></li><li>An empty line starts a new paragraph</li>' +
          '<li>Lines starting with <code>- </code> make a list (on a Notice board: pinned notes)</li><li>Lines starting with <code>&gt; </code> make a quote box</li>' +
          '<li><code>[words](https://…)</code> or <code>[words](mining.html)</code> make a link</li><li>Emoji work everywhere 🐸</li></ul></details>' +
          '<div class="nr-foot"><button type="button" class="app-btn nr-prev">👁 Preview</button><button type="button" class="app-btn nr-save">💾 ' + (live ? 'Save changes' : 'Save draft') + '</button>' +
          (live ? '<button type="button" class="app-btn nr-unpub">Back to draft</button>' : '<button type="button" class="app-btn go nr-pub">🚀 Publish</button>') +
          (live ? '' : '<button type="button" class="app-btn nr-del" title="Delete this draft">🗑</button>') + '<span class="nr-msg" role="status"></span></div></div>';
        wireIssue();
      };
      var blockCard = function (b, i) {
        var poll = b.poll || {};
        return '<li class="nr-block st-' + esc(b.style || 'story') + '" data-i="' + i + '"><div class="nr-bhead"><span class="nr-bn">' + (i + 1) + '</span><select data-f="style" aria-label="Kind of story">' +
          STYLES.map(function (s) { return '<option value="' + s[0] + '"' + ((b.style || 'story') === s[0] ? ' selected' : '') + '>' + esc(s[1]) + '</option>'; }).join('') + '</select>' +
          '<button type="button" class="app-btn" data-mv="-1" title="Move up"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="app-btn" data-mv="1" title="Move down"' + (i < w.blocks.length - 1 ? '' : ' disabled') + '>↓</button><button type="button" class="app-btn" data-rm title="Remove this story">✕</button></div>' +
          '<input data-f="kicker" maxlength="80" placeholder="Small line above the heading (e.g. Games desk)" value="' + esc(b.kicker || '') + '">' +
          '<input class="nr-h" data-f="heading" maxlength="160" placeholder="Heading" value="' + esc(b.heading || '') + '">' +
          '<div class="nr-picrow">' + picField(b.img) + (api.img(b.img) ? '<select data-f="imgSize" aria-label="Where the picture goes"><option value="">Next to the text</option><option value="wide"' + (b.imgSize === 'wide' ? ' selected' : '') + '>Wide, above the text</option></select>' : '') + '</div>' +
          '<textarea data-f="body" rows="5" maxlength="6000" placeholder="' + (b.style === 'notes' ? '- 📌 First note&#10;- 📌 Second note' : 'The story…') + '">' + esc(b.body || '') + '</textarea>' +
          (b.style === 'poll' ? '<div class="nr-poll"><input data-pf="question" maxlength="200" placeholder="Poll question" value="' + esc(poll.question || '') + '">' +
            '<textarea data-pf="options" rows="3" placeholder="One answer per line (2 to 8)">' + esc((poll.options || []).join('\n')) + '</textarea>' +
            '<label>Open for <select data-pf="days">' + [1, 2, 3, 5, 7, 14].map(function (d) { return '<option' + (+(poll.days || 2) === d ? ' selected' : '') + '>' + d + '</option>'; }).join('') + '</select> days</label>' +
            '<p class="nr-hint">The poll starts when you save. After the first vote its answers are locked.</p></div>' : '') +
          '<input data-f="fine" maxlength="300" placeholder="Small print under the story (optional)" value="' + esc(b.fine || '') + '">' +
          [0, 1].map(function (k) { return btnRow((b.btns || [])[k], k); }).join('') + '</li>';
      };
      var wireIssue = function () {
        var r = root();
        keep.offer(r.querySelector('.nr-ed'), function (got) { Object.keys(got).forEach(function (k) { w[k] = got[k]; }); keep.touch(); paint(); });
        r.querySelector('.nr-back').addEventListener('click', function () { back(keep, 'issues'); });
        r.querySelectorAll('[data-k]').forEach(function (inp) { inp.addEventListener('input', function () { w[inp.getAttribute('data-k')] = inp.value; keep.touch(); }); });
        r.querySelector('.nr-blocks').addEventListener('input', function (e) { field(e.target); });
        r.querySelector('.nr-blocks').addEventListener('change', function (e) {
          var f = e.target.getAttribute('data-f'), bf = e.target.getAttribute('data-bf');
          field(e.target);
          if (f === 'style' || f === 'imgSize') paint();
          if (bf === 'go') { var u = e.target.parentNode.querySelector('[data-bf="url"]'); u.hidden = e.target.value !== 'url'; if (!u.hidden) u.focus(); }
        });
        r.querySelectorAll('.nr-block').forEach(function (li) {
          var i = +li.getAttribute('data-i');
          li.querySelectorAll('[data-mv]').forEach(function (b) { b.addEventListener('click', function () { var j = i + +b.getAttribute('data-mv'); var t = w.blocks[i]; w.blocks[i] = w.blocks[j]; w.blocks[j] = t; keep.touch(); paint(); }); });
          li.querySelector('[data-rm]').addEventListener('click', function () { if ((w.blocks[i].body || w.blocks[i].heading) && !window.confirm('Remove story ' + (i + 1) + '?')) return; w.blocks.splice(i, 1); keep.touch(); paint(); });
          li.querySelector('.nr-pick').addEventListener('click', function () { picker(function (src) { w.blocks[i].img = src; keep.touch(); paint(); }); });
          var un = li.querySelector('.nr-unpic'); if (un) un.addEventListener('click', function () { delete w.blocks[i].img; delete w.blocks[i].imgSize; keep.touch(); paint(); });
        });
        r.querySelectorAll('[data-add]').forEach(function (b) {
          b.addEventListener('click', function () {
            var st = b.getAttribute('data-add'), nb = { style: st, kicker: st === 'breaking' ? 'Breaking news' : st === 'poll' ? 'Pond Poll' : st === 'notes' ? 'Notice board' : st === 'facts' ? 'Did you know?' : '', heading: '', body: '' };
            if (st === 'poll') nb.poll = { id: 'gz' + w.num + '_' + rnd(6), question: '', options: ['Yes', 'No'], days: 2 };
            w.blocks.push(nb); keep.touch(); paint();
            var last = root().querySelector('.nr-block:last-of-type .nr-h'); if (last) { last.focus(); if (last.scrollIntoView) last.scrollIntoView({ block: 'center' }); }
          });
        });
        r.querySelector('.nr-paste-go').addEventListener('click', function () {
          var got = splitText(r.querySelector('.nr-paste-in').value);
          if (!got.length) { say('Paste some text first.', true); return; }
          w.blocks = w.blocks.filter(function (b) { return b.heading || b.body || b.img; }).concat(got); keep.touch(); paint();
          say(got.length + (got.length === 1 ? ' story' : ' stories') + ' added. Check them, add pictures and buttons, then preview.');
        });
        r.querySelector('.nr-prev').addEventListener('click', preview);
        r.querySelector('.nr-save').addEventListener('click', function () { save(null); });
        var pub = r.querySelector('.nr-pub'); if (pub) pub.addEventListener('click', function () { if (window.confirm('Publish issue #' + w.num + ' for everyone now? The mailbox flag goes up for every visitor.')) save(true); });
        var un = r.querySelector('.nr-unpub'); if (un) un.addEventListener('click', function () { if (window.confirm('Take issue #' + w.num + ' off the stands? Readers will not see it until you publish it again.')) save(false); });
        var del = r.querySelector('.nr-del'); if (del) del.addEventListener('click', function () {
          if (!window.confirm('Delete the draft of issue #' + w.num + '? This cannot be undone.')) return;
          if (w.fresh) { keep.clean(); list('issues'); return; }
          api.rpc('gry_newsroom_delete_issue', { p_num: w.num }).then(function () { keep.clean(); return load(); }).then(function () { list('issues'); }, function (e) { say(e.message, true); });
        });
      };
      var field = function (t) {
        var li = t.closest('.nr-block'); if (!li) return;
        var b = w.blocks[+li.getAttribute('data-i')], f = t.getAttribute('data-f'), pf = t.getAttribute('data-pf'), bf = t.getAttribute('data-bf');
        if (f) b[f] = t.value;
        if (pf) { b.poll = b.poll || { id: 'gz' + w.num + '_' + rnd(6) }; b.poll[pf] = pf === 'options' ? t.value.split('\n') : pf === 'days' ? +t.value : t.value; }
        if (bf) { var k = +t.closest('[data-b]').getAttribute('data-b'); b.btns = b.btns || []; b.btns[k] = b.btns[k] || {}; b.btns[k][bf] = t.value; }
        keep.touch();
      };
      var clean = function () {
        return w.blocks.map(function (b) {
          var o = { style: b.style || 'story' };
          ['kicker', 'heading', 'body', 'fine', 'img', 'imgSize', 'alt'].forEach(function (k) { if (b[k] && String(b[k]).trim()) o[k] = String(b[k]).replace(/\s+$/, ''); });
          if (o.style === 'poll' && b.poll) o.poll = { id: b.poll.id, question: String(b.poll.question || '').trim(), options: (b.poll.options || []).map(function (x) { return String(x).trim(); }).filter(Boolean), days: +b.poll.days || 2 };
          var btns = (b.btns || []).filter(function (x) { return x && String(x.label || '').trim() && x.go; }).map(function (x) { var y = { label: String(x.label).trim(), go: x.go }; if (x.go === 'url') y.url = String(x.url || '').trim(); return y; });
          if (btns.length) o.btns = btns;
          return o;
        }).filter(function (o) { return o.heading || o.body || o.img || o.poll; });
      };
      var preview = function () {
        var html = api.issueHtml({ num: w.num, edition: w.edition, foot: w.foot, blocks: clean(), draft: !live });
        var ov = document.createElement('div'); ov.className = 'nr-over';
        ov.innerHTML = '<div class="nr-over-bar"><b>Preview: this is what readers see</b><button type="button" class="app-btn go">Back to editing</button></div><div class="mail-pane">' + html + '</div>';
        A.body.appendChild(ov);
        ov.querySelector('button').addEventListener('click', function () { ov.remove(); });
        ov.querySelectorAll('a, button[data-go]').forEach(function (x) { x.addEventListener('click', function (e) { e.preventDefault(); }); });
      };
      var save = function (pub) {
        var blocks = clean();
        var bad = blocks.filter(function (b) { return b.poll && (b.poll.question.length < 3 || b.poll.options.length < 2); })[0];
        if (bad) { say('The Pond Poll needs a question and at least 2 answers.', true); return; }
        if (pub && !blocks.length) { say('Write at least one story first.', true); return; }
        if (pub && !String(w.title || '').trim()) { say('Give the issue a title first (it shows in the archive).', true); root().querySelector('[data-k="title"]').focus(); return; }
        root().querySelectorAll('.nr-foot button').forEach(function (b) { b.disabled = true; });
        say('Saving…');
        api.rpc('gry_newsroom_save_issue', { p_num: w.num, p_title: w.title || '', p_edition: w.edition || '', p_foot: w.foot || '', p_blocks: blocks, p_publish: pub }).then(function (res) {
          keep.clean(); w.at = res.at; w.updated = res.updated; w.fresh = false; live = !!res.at;
          return load().then(function () { return api.refresh(); });
        }).then(function () {
          paint();
          say(pub === true ? 'Published! Issue #' + w.num + ' is on the stands. 🐸' : pub === false ? 'Back to draft. Readers no longer see it.' : 'Saved at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.');
        }, function (e) {
          root().querySelectorAll('.nr-foot button').forEach(function (b) { b.disabled = false; });
          say((e && e.message) || 'Not saved. Your text is still here and on this device; try again in a minute.', true);
        });
      };
      paint();
    }
    // "## Kicker | Heading" lines start stories; text before the first ## becomes a story without a heading
    function splitText(t) {
      var out = [], cur = null;
      String(t || '').replace(/\r/g, '').split('\n').forEach(function (ln) {
        var m = /^\s*#{2,3}\s*(.+)$/.exec(ln);
        if (m) {
          var p = m[1].split('|');
          cur = { style: out.length ? 'story' : 'breaking', kicker: p.length > 1 ? p[0].trim() : '', heading: (p.length > 1 ? p.slice(1).join('|') : p[0]).trim(), body: '' };
          out.push(cur);
        } else {
          if (!cur) { if (!ln.trim()) return; cur = { style: 'story', kicker: '', heading: '', body: '' }; out.push(cur); }
          cur.body += (cur.body ? '\n' : '') + ln;
        }
      });
      out.forEach(function (b) { b.body = b.body.replace(/^\n+|\s+$/g, ''); });
      return out.filter(function (b) { return b.heading || b.body; });
    }

    // ---------- a PEP-TV ad ----------
    function editAd(w) {
      var saved = !!w.id, live = !!w.at, keep = keeper('ad:' + (w.id || 'new'), w, w.updated), autoId = !saved;
      w.scenes = Array.isArray(w.scenes) && w.scenes.length ? w.scenes : [{}];
      var paint = function () {
        root().innerHTML = '<div class="nr-ed"><div class="nr-top"><button type="button" class="app-btn nr-back">← All ads</button><b>' + esc(w.title || 'New ad') + '</b>' + status(w) + '</div>' +
          '<div class="nr-meta"><label>Title<input data-k="title" maxlength="80" placeholder="e.g. The Frog Gym" value="' + esc(w.title || '') + '"></label>' +
          '<label>File name (in the PEP-TV folder)<input data-k="id" maxlength="45" placeholder="frog_gym.mpg" value="' + esc(w.id || '') + '"' + (saved ? ' readonly title="The file name stays once saved"' : '') + '></label>' +
          '<label>Channel line<input data-k="ch" maxlength="80" placeholder="CH 7 · PEP-TV LATE NIGHT" value="' + esc(w.ch || '') + '"></label>' +
          '<label>TV look<select data-k="look"><option value="">Classic</option>' + api.looks.map(function (l) { return '<option' + (w.look === l ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></label>' +
          '<label class="nr-check"><input type="checkbox" data-k="kitsch"' + (w.kitsch ? ' checked' : '') + '> Extra kitsch (glitter, wobble)</label>' +
          '<div class="nr-iconrow"><span>Folder icon</span>' + picField(w.icon) + '</div></div>' +
          '<ol class="nr-blocks">' + w.scenes.map(sceneCard).join('') + '</ol>' +
          (w.scenes.length < 10 ? '<div class="nr-add"><button type="button" class="app-btn nr-addscene">+ Scene</button></div>' : '') +
          '<p class="nr-hint">Each scene shows for about 4 seconds. Write <code>*word*</code> in the big text to make it glow. Facts must be real; jokes and "offers" should say they are not real (that is the PEP-TV way).</p>' +
          '<div class="nr-foot"><button type="button" class="app-btn nr-prev">▶ Play it</button><button type="button" class="app-btn nr-save">💾 ' + (live ? 'Save changes' : 'Save draft') + '</button>' +
          (live ? '<button type="button" class="app-btn nr-unpub">Back to draft</button>' : '<button type="button" class="app-btn go nr-pub">🚀 Publish</button>') +
          (saved ? '<button type="button" class="app-btn nr-del" title="Delete this ad">🗑</button>' : '') + '<span class="nr-msg" role="status"></span></div></div>';
        wireAd();
      };
      var sceneCard = function (s, i) {
        return '<li class="nr-block" data-i="' + i + '"><div class="nr-bhead"><span class="nr-bn">' + (i + 1) + '</span><b class="grow">Scene ' + (i + 1) + '</b>' +
          '<button type="button" class="app-btn" data-mv="-1" title="Move up"' + (i ? '' : ' disabled') + '>↑</button><button type="button" class="app-btn" data-mv="1" title="Move down"' + (i < w.scenes.length - 1 ? '' : ' disabled') + '>↓</button>' +
          (w.scenes.length > 1 ? '<button type="button" class="app-btn" data-rm title="Remove this scene">✕</button>' : '') + '</div>' +
          '<input data-f="kick" maxlength="120" placeholder="Small line on top (e.g. Tired of waiting?)" value="' + esc(s.kick || '') + '">' +
          '<textarea class="nr-h" data-f="big" rows="2" maxlength="120" placeholder="BIG words (*word* glows)">' + esc(s.big || '') + '</textarea>' +
          '<div class="nr-picrow">' + picField(s.img) + '</div>' +
          '<textarea data-f="sub" rows="2" maxlength="300" placeholder="Smaller text under it">' + esc(s.sub || '') + '</textarea>' +
          '<div class="nr-two"><input data-f="burst" maxlength="16" placeholder="Star sticker (e.g. NEW!)" value="' + esc(s.burst || '') + '"><input data-f="fine" maxlength="200" placeholder="Small print (e.g. Not a real offer.)" value="' + esc(s.fine || '') + '"></div>' +
          btnRow(s.btn, 0) + '</li>';
      };
      var wireAd = function () {
        var r = root();
        keep.offer(r.querySelector('.nr-ed'), function (got) { Object.keys(got).forEach(function (k) { w[k] = got[k]; }); keep.touch(); paint(); });
        r.querySelector('.nr-back').addEventListener('click', function () { back(keep, 'ads'); });
        r.querySelectorAll('[data-k]').forEach(function (inp) {
          inp.addEventListener(inp.type === 'checkbox' || inp.tagName === 'SELECT' ? 'change' : 'input', function () {
            var k = inp.getAttribute('data-k');
            w[k] = inp.type === 'checkbox' ? inp.checked : inp.value;
            if (k === 'id') autoId = false;
            if (k === 'title' && autoId) { w.id = slug(inp.value); var f = r.querySelector('[data-k="id"]'); if (f) f.value = w.id; }
            keep.touch();
          });
        });
        r.querySelector('.nr-iconrow .nr-pick').addEventListener('click', function () { picker(function (src) { w.icon = src; keep.touch(); paint(); }); });
        var ui = r.querySelector('.nr-iconrow .nr-unpic'); if (ui) ui.addEventListener('click', function () { w.icon = ''; keep.touch(); paint(); });
        r.querySelector('.nr-blocks').addEventListener('input', function (e) { field(e.target); });
        r.querySelector('.nr-blocks').addEventListener('change', function (e) {
          field(e.target);
          if (e.target.getAttribute('data-bf') === 'go') { var u = e.target.parentNode.querySelector('[data-bf="url"]'); u.hidden = e.target.value !== 'url'; if (!u.hidden) u.focus(); }
        });
        r.querySelectorAll('.nr-block').forEach(function (li) {
          var i = +li.getAttribute('data-i');
          li.querySelectorAll('[data-mv]').forEach(function (b) { b.addEventListener('click', function () { var j = i + +b.getAttribute('data-mv'); var t = w.scenes[i]; w.scenes[i] = w.scenes[j]; w.scenes[j] = t; keep.touch(); paint(); }); });
          var rm = li.querySelector('[data-rm]'); if (rm) rm.addEventListener('click', function () { w.scenes.splice(i, 1); keep.touch(); paint(); });
          li.querySelector('.nr-pick').addEventListener('click', function () { picker(function (src) { w.scenes[i].img = src; keep.touch(); paint(); }); });
          var un = li.querySelector('.nr-unpic'); if (un) un.addEventListener('click', function () { delete w.scenes[i].img; keep.touch(); paint(); });
        });
        var add = r.querySelector('.nr-addscene'); if (add) add.addEventListener('click', function () { w.scenes.push({}); keep.touch(); paint(); });
        r.querySelector('.nr-prev').addEventListener('click', function () { api.previewAd(cleanAd()); });
        r.querySelector('.nr-save').addEventListener('click', function () { save(null); });
        var pub = r.querySelector('.nr-pub'); if (pub) pub.addEventListener('click', function () { if (window.confirm('Publish "' + (w.title || w.id) + '" on PEP-TV for everyone now?')) save(true); });
        var unp = r.querySelector('.nr-unpub'); if (unp) unp.addEventListener('click', function () { if (window.confirm('Take this ad off PEP-TV?')) save(false); });
        var del = r.querySelector('.nr-del'); if (del) del.addEventListener('click', function () {
          if (!window.confirm('Delete the ad ' + w.id + '? This cannot be undone.')) return;
          api.rpc('gry_newsroom_delete_ad', { p_id: w.id }).then(function () { keep.clean(); return load(); }).then(function () { return api.refresh(); }).then(function () { list('ads'); }, function (e) { say(e.message, true); });
        });
      };
      var field = function (t) {
        var li = t.closest('.nr-block'); if (!li) return;
        var s = w.scenes[+li.getAttribute('data-i')], f = t.getAttribute('data-f'), bf = t.getAttribute('data-bf');
        if (f) s[f] = t.value;
        if (bf) { s.btn = s.btn || {}; s.btn[bf] = t.value; }
        keep.touch();
      };
      var cleanAd = function () {
        return { id: w.id, title: String(w.title || '').trim(), ch: String(w.ch || '').trim(), look: w.look || '', kitsch: !!w.kitsch, icon: w.icon || '',
          scenes: w.scenes.map(function (s) {
            var o = {};
            ['kick', 'big', 'img', 'sub', 'burst', 'fine'].forEach(function (k) { if (s[k] && String(s[k]).trim()) o[k] = String(s[k]).replace(/\s+$/, ''); });
            if (s.btn && String(s.btn.label || '').trim() && s.btn.go) { o.btn = { label: String(s.btn.label).trim(), go: s.btn.go }; if (s.btn.go === 'url') o.btn.url = String(s.btn.url || '').trim(); }
            return o;
          }).filter(function (o) { return Object.keys(o).length; }) };
      };
      var save = function (pub) {
        var ad = cleanAd();
        if (!/^[a-z0-9][a-z0-9_]{1,40}\.mpg$/.test(ad.id || '')) { say('File name: small letters, digits and _, ending in .mpg (e.g. frog_gym.mpg).', true); return; }
        if (!saved && api.builtinAds().some(function (a) { return a[0] === ad.id; })) { say('An ad with this file name is already on PEP-TV. Pick another name.', true); return; }
        if (!ad.scenes.length) { say('Write at least one scene first.', true); return; }
        root().querySelectorAll('.nr-foot button').forEach(function (b) { b.disabled = true; });
        say('Saving…');
        api.rpc('gry_newsroom_save_ad', { p_id: ad.id, p_title: ad.title, p_ch: ad.ch, p_look: ad.look, p_kitsch: ad.kitsch, p_icon: ad.icon, p_scenes: ad.scenes, p_publish: pub }).then(function (res) {
          keep.clean(); if (!saved) local('ad:new', null);
          saved = true; autoId = false; w.at = res.at; w.updated = res.updated; live = !!res.at;
          keep = keeper('ad:' + w.id, w, w.updated);
          return load().then(function () { return api.refresh(); });
        }).then(function () {
          paint();
          say(pub === true ? 'Published! It is in the PEP-TV Ads folder with a red dot. 📺' : pub === false ? 'Back to draft. Viewers no longer see it.' : 'Saved at ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.');
        }, function (e) {
          root().querySelectorAll('.nr-foot button').forEach(function (b) { b.disabled = false; });
          say((e && e.message) || 'Not saved. Try again in a minute.', true);
        });
      };
      paint();
    }
    function slug(t) { var s = String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 36); return s.length > 1 ? s + '.mpg' : ''; }

    // ---------- the picture picker: site pictures, your uploads, or a new photo ----------
    function picker(done) {
      var ov = document.createElement('div'); ov.className = 'nr-over';
      ov.innerHTML = '<div class="nr-over-bar"><b>Pick a picture</b><button type="button" class="app-btn nr-x">Cancel</button></div>' +
        '<div class="nr-tabs" role="tablist"><button type="button" role="tab" data-pt="site" aria-selected="true">Site pictures</button><button type="button" role="tab" data-pt="mine" aria-selected="false">My uploads</button>' +
        '<label class="app-btn go nr-up">📷 Upload a photo<input type="file" accept="image/*" hidden></label></div><p class="nr-msg" role="status"></p><div class="nr-grid"></div>';
      A.body.appendChild(ov);
      var grid = ov.querySelector('.nr-grid'), msg = ov.querySelector('.nr-msg');
      var close = function () { ov.remove(); };
      var pick = function (src) { close(); done(src); };
      var show = function (items) {
        grid.innerHTML = items.length ? items.map(function (x) { return '<button type="button" data-src="' + esc(x) + '"><img src="' + esc(api.img(x)) + '" alt="" loading="lazy"></button>'; }).join('') : '<p class="nr-hint">Nothing here yet.</p>';
        grid.querySelectorAll('[data-src]').forEach(function (b) { b.addEventListener('click', function () { pick(b.getAttribute('data-src')); }); });
      };
      var tab = function (t) {
        ov.querySelectorAll('[data-pt]').forEach(function (b) { b.setAttribute('aria-selected', String(b.getAttribute('data-pt') === t)); });
        msg.textContent = '';
        if (t === 'site') return show(PICS);
        grid.innerHTML = '<p class="nr-hint">Loading your uploads…</p>';
        storage('POST', 'object/list/gazette', JSON.stringify({ prefix: '', limit: 200, offset: 0, sortBy: { column: 'created_at', order: 'desc' } }), 'application/json')
          .then(function (j) { show((j || []).filter(function (o) { return o && o.name && o.id; }).map(function (o) { return api.store + o.name; }).filter(api.img)); },
            function (e) { grid.innerHTML = ''; msg.textContent = e.message; msg.classList.add('err'); });
      };
      ov.querySelector('.nr-x').addEventListener('click', close);
      ov.querySelectorAll('[data-pt]').forEach(function (b) { b.addEventListener('click', function () { tab(b.getAttribute('data-pt')); }); });
      ov.querySelector('input[type=file]').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0]; if (!f) return;
        msg.classList.remove('err'); msg.textContent = 'Shrinking the photo…';
        shrink(f).then(function (blob) {
          msg.textContent = 'Uploading (' + Math.round(blob.size / 1024) + ' KB)…';
          var name = Date.now().toString(36) + '-' + rnd(6) + (blob.type === 'image/webp' ? '.webp' : blob.type === 'image/gif' ? '.gif' : blob.type === 'image/png' ? '.png' : '.jpg');
          return storage('POST', 'object/gazette/' + name, blob, blob.type).then(function () { pick(api.store + name); });
        }).catch(function (err) { msg.textContent = (err && err.message) || 'The upload did not work.'; msg.classList.add('err'); });
      });
      tab('site');
    }
    function storage(method, path, body, type) {
      return api.session().then(function (s) {
        if (!s || !s.access_token) throw new Error('Log on with Discord first.');
        return fetch(api.sbUrl + '/storage/v1/' + path, { method: method, headers: { apikey: api.sbKey, Authorization: 'Bearer ' + s.access_token, 'Content-Type': type, 'x-upsert': 'false', 'cache-control': '31536000' }, body: body });
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) throw new Error(/bucket not found/i.test(j.message || '') ? 'The picture shelf is not set up yet: run games/supabase/update_gazette_newsroom.sql in Supabase.' : /row-level|policy|unauthorized/i.test(j.message || j.error || '') ? 'Only the site owner can add pictures.' : (j.message || 'The picture server said no (' + r.status + ').'));
          return j;
        });
      });
    }
    // phone photos are big: draw them at most 1200 px wide/high and save as WebP (or JPEG where WebP is not supported)
    function shrink(file) {
      if (file.type === 'image/gif' && file.size <= 1048576) return Promise.resolve(file);
      return new Promise(function (res, rej) {
        var url = URL.createObjectURL(file), im = new Image();
        im.onload = function () {
          var k = Math.min(1, 1200 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
          c.width = Math.max(1, Math.round(im.naturalWidth * k)); c.height = Math.max(1, Math.round(im.naturalHeight * k));
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
          var tryQ = function (type, q) {
            c.toBlob(function (b) {
              if (!b) return rej(new Error('This picture cannot be read. Try a JPG or PNG.'));
              if (type === 'image/webp' && b.type !== 'image/webp') return tryQ('image/jpeg', .85);
              if (b.size > 1000000 && q > .45) return tryQ(type, q - .15);
              if (b.size > 1048576) return rej(new Error('The picture is still over 1 MB. Try a smaller one.'));
              res(b);
            }, type, q);
          };
          tryQ('image/webp', .82);
        };
        im.onerror = function () { URL.revokeObjectURL(url); rej(new Error('This file is not a picture the browser can open.')); };
        im.src = url;
      });
    }
  };
})();

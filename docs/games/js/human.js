// Cloudflare Turnstile: the "are you human?" check before a guest sign-in. Only used when config.js has a site key.
// Mode "Managed": most people never see anything; if Cloudflare is unsure, one checkbox pops up.
const SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const FAIL = 'The human check did not load. Turn off blockers for this page and try again, or log in with Discord.';
let loading = null;

function load() {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return loading ??= new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = SRC; s.async = true;
    s.onload = () => (window.turnstile ? res(window.turnstile) : rej(new Error(FAIL)));
    s.onerror = () => { loading = null; s.remove(); rej(new Error(FAIL)); };
    document.head.append(s);
  });
}

export async function humanToken(siteKey) {
  const ts = await load();
  return new Promise((resolve, reject) => {
    const wrap = document.createElement('div');
    wrap.className = 'ts-wrap';
    wrap.innerHTML = '<div class="ts-card" role="dialog" aria-modal="true" aria-label="Quick human check"><p><b>Quick check</b><br>Tick the box to show you are not a bot.</p><div class="ts-box"></div><button type="button" class="btn sm">Cancel</button></div>';
    document.body.append(wrap);
    let id = null, done = false;
    const finish = (fn, v) => {
      if (done) return; done = true; clearTimeout(timer);
      try { if (id !== null) ts.remove(id); } catch {}
      wrap.remove(); fn(v);
    };
    const timer = setTimeout(() => { if (!wrap.classList.contains('show')) finish(reject, new Error(FAIL)); }, 30000);
    wrap.querySelector('button').onclick = () => finish(reject, new Error('Check cancelled.'));
    id = ts.render(wrap.querySelector('.ts-box'), {
      sitekey: siteKey, action: 'guest', appearance: 'interaction-only',
      callback: (t) => finish(resolve, t),
      'before-interactive-callback': () => wrap.classList.add('show'),
      'error-callback': () => finish(reject, new Error(FAIL)),
      'expired-callback': () => finish(reject, new Error('The check expired, try again.')),
      'timeout-callback': () => finish(reject, new Error('The check timed out, try again.')),
    });
  });
}

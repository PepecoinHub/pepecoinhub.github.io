// Tips and airdrops in the room chat. The site never holds or sends coins: it only shows addresses,
// and players send PEP from their own wallets. Only players logged in with Discord can save a PEP address.
import { $, h, toast } from './common.js';
import qrcode from '../vendor/qrcode-generator-1.4.4.js';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const fmt = (n) => String(+(+n).toFixed(8));

// PEP addresses start with P, have 34 characters and carry a checksum (base58check), so typos are caught here
export async function validAddress(a) {
  if (!/^P[1-9A-HJ-NP-Za-km-z]{33}$/.test(a)) return false;
  let n = 0n;
  for (const c of a) n = n * 58n + BigInt(B58.indexOf(c));
  const bytes = new Uint8Array(25);
  for (let i = 24; i >= 0; i--) { bytes[i] = Number(n & 255n); n >>= 8n; }
  if (n !== 0n || !crypto?.subtle) return n === 0n;
  const h1 = await crypto.subtle.digest('SHA-256', bytes.slice(0, 21));
  const h2 = new Uint8Array(await crypto.subtle.digest('SHA-256', h1));
  return h2.slice(0, 4).every((b, i) => b === bytes[21 + i]);
}

function dialog(...children) {
  const dlg = h('dialog', { class: 'card tipdlg' }, h('form', { method: 'dialog', class: 'stack' }, ...children));
  document.body.append(dlg);
  dlg.addEventListener('close', () => dlg.remove());
  dlg.showModal();
  return dlg;
}
const copyBtn = (text, label = 'Copy') => h('button', { type: 'button', class: 'btn sm', onclick: async () => {
  try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy did not work, select the text instead', 'bad'); }
} }, label);

// "/tip nick 200", "!tip @nick 200 pep", "u/nick 200 pepe", "/airdrop 100 pep 20s", "/help"
export function parseCommand(text) {
  const t = text.trim();
  let m = /^[/!]tip\s+@?(\S+)(?:\s+(\d+(?:[.,]\d+)?))?\s*(?:pepe?)?$/i.exec(t) || /^u\/(\S+)\s+(\d+(?:[.,]\d+)?)\s*(?:pepe?)?$/i.exec(t);
  if (m) return { type: 'tip', nick: m[1], amount: m[2] ? +m[2].replace(',', '.') : null };
  m = /^[/!]airdrop\s+(\d+(?:[.,]\d+)?)\s*(?:pepe?)?(?:\s+(\d+)\s*s?)?$/i.exec(t);
  if (m) return { type: 'airdrop', amount: +m[1].replace(',', '.'), seconds: m[2] ? +m[2] : 20 };
  if (/^[/!](tip|airdrop)\b/i.test(t)) return { type: 'help' };
  if (/^[/!]help$/i.test(t)) return { type: 'help' };
  return null;
}
export const HELP = 'Commands: /tip nick 200 (send a tip from your own wallet) · /airdrop 100 20s (share 100 PEP between everyone who clicks Claim within 20 seconds; you pay them from your wallet).';

// your own PEP address (Discord players only)
export async function walletDialog(be, { onSaved } = {}) {
  let w;
  try { w = await be.rpc('gry_wallet_get'); } catch (e) { return toast(e.message, 'bad'); }
  if (!w.verified) {
    dialog(h('h2', {}, 'PEP address for tips'), h('p', {}, 'Only players logged in with Discord can receive tips and join airdrops, so nobody can pretend to be you.'),
      h('div', { class: 'row' }, h('button', { class: 'btn', value: 'close' }, 'OK')));
    return;
  }
  const inp = h('input', { type: 'text', id: 'pep-addr', value: w.address || '', placeholder: 'P…', autocomplete: 'off', spellcheck: false, maxlength: 34 });
  const dlg = dialog(h('h2', {}, 'Your PEP address'),
    h('p', { class: 'small muted' }, 'Other players see it when they tip you, and airdrop starters see it when you claim. Use a receiving address from your own wallet. You can change or remove it any time.'),
    h('div', {}, h('label', { for: 'pep-addr' }, 'PEP address (starts with P)'), inp),
    h('div', { class: 'row', style: 'margin-top:10px' },
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const a = inp.value.trim();
        if (a && !(await validAddress(a))) return toast('That is not a valid PEP address. Check it for typos.', 'bad');
        try { await be.rpc('gry_wallet_set', { p_address: a }); toast(a ? 'Address saved' : 'Address removed', 'good'); dlg.close(); onSaved?.(a); }
        catch (e) { toast(e.message, 'bad'); }
      } }, 'Save'),
      w.address ? h('button', { type: 'button', class: 'btn', onclick: () => { inp.value = ''; } }, 'Clear') : null,
      h('button', { class: 'btn', value: 'close' }, 'Cancel')));
}

export async function openTip(be, code, nick, amount) {
  let info;
  try { info = await be.rpc('gry_tip_info', { p_code: code, p_nick: nick }); } catch (e) { return toast(e.message, 'bad'); }
  if (info.self) return walletDialog(be);
  if (!info.address) {
    dialog(h('h2', {}, 'Tip ' + info.nick),
      h('p', {}, info.verified ? `${info.nick} has not added a PEP address yet.` : `${info.nick} is playing as a guest. Only players logged in with Discord can receive tips.`),
      h('div', { class: 'row' }, h('button', { class: 'btn', value: 'close' }, 'OK')));
    return;
  }
  const amt = h('input', { type: 'number', id: 'tip-amt', min: 0, step: 'any', value: amount ?? 100, style: 'width:140px' });
  const q = qrcode(0, 'M'); q.addData(info.address); q.make();
  const qr = h('div', { class: 'tipqr', 'aria-label': 'QR code of the address' }); qr.innerHTML = q.createSvgTag(4, 2);
  const dlg = dialog(h('h2', {}, 'Tip ' + info.nick),
    h('div', { class: 'tiprow' }, qr, h('div', { class: 'stack', style: 'gap:8px;min-width:0' },
      h('div', {}, h('label', { for: 'tip-amt' }, 'Amount (PEP)'), amt),
      h('div', {}, h('label', {}, 'Their PEP address'), h('code', { class: 'tipaddr' }, info.address)),
      h('div', { class: 'row' }, copyBtn(info.address, 'Copy address'), h('button', { type: 'button', class: 'btn sm', onclick: () => navigator.clipboard?.writeText(fmt(amt.value || 0)).then(() => toast('Copied')) }, 'Copy amount')))),
    h('p', { class: 'small muted', style: 'margin:0' }, 'Send the PEP from your own wallet (scan the QR code or paste the address). The site never touches your coins. When you are done, let the room know.'),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn primary', onclick: async () => {
        const v = +amt.value;
        if (!(v > 0)) return toast('Enter the amount you sent', 'bad');
        try { await be.rpc('gry_tip_announce', { p_code: code, p_nick: info.nick, p_amount: v }); dlg.close(); }
        catch (e) { toast(e.message, 'bad'); }
      } }, 'Done, I sent it'),
      h('button', { class: 'btn', value: 'close' }, 'Close')));
}

export async function startAirdrop(be, code, amount, seconds) {
  try { await be.rpc('gry_airdrop_start', { p_code: code, p_amount: amount, p_seconds: seconds }); }
  catch (e) { toast(e.message, 'bad'); }
}

export async function claimAirdrop(be, code, after) {
  try { await be.rpc('gry_airdrop_claim', { p_code: code }); after?.(); }
  catch (e) {
    if (/address/i.test(e.message)) {
      toast(e.message, 'bad');
      walletDialog(be, { onSaved: (a) => { if (a) claimAirdrop(be, code, after); } });
    } else toast(e.message, 'bad');
  }
}

export function payoutDialog(ad) {
  const list = ad.payout || [], n = list.length;
  const share = n ? Math.floor((+ad.amount / n) * 1e8) / 1e8 : 0;
  const lines = list.map((x) => `${x.address} ${fmt(share)}`).join('\n');
  const core = 'sendmany "" "' + JSON.stringify(Object.fromEntries(list.map((x) => [x.address, +fmt(share)]))).replace(/"/g, '\\"') + '"';
  dialog(h('h2', {}, 'Airdrop payout'),
    n ? h('p', {}, `${fmt(ad.amount)} PEP split between ${n} player${n === 1 ? '' : 's'}: `, h('b', {}, fmt(share) + ' PEP each'), '. Send it from your own wallet.')
      : h('p', {}, 'Nobody claimed this airdrop, so there is nothing to send.'),
    n ? h('div', { class: 'payout' }, list.map((x) => h('div', { class: 'payrow' }, h('b', {}, x.nick), h('code', {}, x.address), h('span', { class: 'mono' }, fmt(share))))) : null,
    n ? h('div', { class: 'row' }, copyBtn(lines, 'Copy list (address amount)'), copyBtn(core, 'Copy for Pepecoin Core console')) : null,
    n ? h('p', { class: 'small muted', style: 'margin:0' }, 'In Pepecoin Core: Window → Console, paste the copied command and press Enter. It sends everyone their share in one transaction (network fee added). Check the list first. Very small amounts may be rejected by the network.') : null,
    h('div', { class: 'row' }, h('button', { class: 'btn', value: 'close' }, 'Close')));
}

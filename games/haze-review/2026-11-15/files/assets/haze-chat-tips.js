import {validateAddress, parseCoinAmount, formatBaseUnits, ASSETS} from '../wallet-core.js';

const ORIGIN = 'https://hazewallet.com';
const KEYS = ['haze-tip', 'asset', 'address', 'amount', 'recipient', 'platform', 'note', 'reaction', 'intent', 'sender', 'expires'];
const HUB_ORIGIN = 'https://pepecoinhub.com';
export const TIP_REACTIONS = Object.freeze({heart: '💚', applause: '👏', rocket: '🚀'});
const invalid = () => new Error('This tip link is invalid. Ask for a new link.');

function label(value, limit) {
  if (typeof value !== 'string' || value.length > limit || /[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(value)) throw invalid();
  return value.trim();
}

// Public payment details only. This request grants no signing authority and
// neither a chat handle nor a display name proves ownership of an address.
export async function createChatTip(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !KEYS.slice(1).includes(key))) throw invalid();
  const {asset = 'PEP', address, amount = '10', recipient = '', platform = '', note = '', reaction = 'heart'} = input;
  if (!Object.hasOwn(ASSETS, asset) || !['PEP', 'DOGE', 'LTC', 'BTC'].includes(asset) ||
      typeof address !== 'string' || address.length > 100 || !await validateAddress(address, asset) ||
      typeof amount !== 'string' || amount.length > 40 || amount !== amount.trim() || !Object.hasOwn(TIP_REACTIONS, reaction)) throw invalid();
  const linked = ['intent','sender','expires'].some(key=>Object.hasOwn(input,key));
  if (linked && (asset !== 'PEP' || typeof input.intent !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(input.intent) ||
      typeof input.sender !== 'string' || input.sender.length>100 || !await validateAddress(input.sender, 'PEP') || input.sender === address ||
      typeof input.expires !== 'string' || input.expires.length!==24 || !Number.isFinite(Date.parse(input.expires)) || new Date(input.expires).toISOString()!==input.expires ||
      Date.parse(input.expires)<=Date.now() || Date.parse(input.expires)>Date.now()+1860000)) throw invalid();
  const normalized = Object.freeze({asset, address, amount: formatBaseUnits(parseCoinAmount(amount)),
    recipient: label(recipient, 60), platform: label(platform, 60), note: label(note, 160), reaction,
    ...(linked ? {intent: input.intent, sender: input.sender, expires: input.expires} : {})});
  const params = new URLSearchParams({'haze-tip': '1', ...normalized});
  const fragment = '#' + params;
  return Object.freeze({...normalized, fragment, url: ORIGIN + '/assets/tip.html' + fragment,
    walletUrl: ORIGIN + '/widget.html?standalone=1' + fragment});
}

// PepecoinHub is the sole receipt recipient. No URL-supplied callback is read.
// This announces submission, including ambiguous relay outcomes; it never
// asserts settlement. The recipient must independently verify the transaction.
export function notifyChatTipSubmission(tip, payment, frame = globalThis.window) {
  const target=frame?.opener||(frame?.parent&&frame.parent!==frame?frame.parent:null);
  if (!tip?.intent || tip.asset !== 'PEP' || !target || !payment ||
      !/^[a-f0-9]{64}$/.test(payment.txid) || payment.address !== tip.address ||
      payment.sender !== tip.sender || payment.amount !== parseCoinAmount(tip.amount)) return false;
  target.postMessage({type: 'haze:tip-submitted', version: 1, intent: tip.intent,
    txid: payment.txid}, HUB_ORIGIN);
  return true;
}

export async function readChatTip(fragment) {
  if (typeof fragment !== 'string' || fragment.length > 4096) throw invalid();
  const params = new URLSearchParams(fragment.replace(/^#/, ''));
  if (params.get('haze-tip') !== '1' || [...params.keys()].some(key => !KEYS.includes(key) || params.getAll(key).length !== 1)) throw invalid();
  const input = Object.fromEntries(params); delete input['haze-tip'];
  if (!Object.hasOwn(input, 'asset') || !Object.hasOwn(input, 'address') || !Object.hasOwn(input, 'amount')) throw invalid();
  return createChatTip(input);
}

// Consume a URL handoff once, after the wallet is available. A failed or stale
// view never consumes it; reopening the drawer cannot repeat the handoff.
export function createChatTipHandoff(fragment) {
  const candidate = typeof fragment === 'string' && new URLSearchParams(fragment.replace(/^#/, '')).has('haze-tip');
  const pending = candidate ? readChatTip(fragment).catch(() => null) : Promise.resolve(null);
  let consumed = false;
  return Object.freeze({async take(isCurrent = () => true) {
    const tip = await pending;
    if (consumed || !tip || !isCurrent()) return null;
    consumed = true;
    return tip;
  }});
}

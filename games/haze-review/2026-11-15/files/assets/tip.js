import {readChatTip, createChatTip} from './haze-chat-tips.js';
import {ASSETS} from '../wallet-core.js';

const $ = id => document.getElementById(id);
const PRESETS = {PEP: ['1', '10', '100', '1000'], DOGE: ['1', '5', '10', '25'], LTC: ['0.001', '0.01', '0.05', '0.1'], BTC: ['0.00001', '0.0001', '0.0005', '0.001']};
let generation = 0;

async function paint() {
  const current = ++generation;
  $('tip-form').hidden = true; $('tip-empty').hidden = true; $('tip-error').textContent = '';
  $('tip-continue').disabled = false; $('note-status').textContent = '';
  try {
    const tip = await readChatTip(location.hash);
    if (current !== generation) return;
    let reaction = tip.reaction;
    $('tip-title').textContent = tip.recipient ? 'Tip ' + tip.recipient : 'Send a little appreciation';
    $('tip-status').textContent = tip.platform ? 'A tip link shared for ' + tip.platform + '.' : 'Send directly to the receiving wallet below.';
    $('tip-asset').textContent = tip.asset; $('tip-amount').value = tip.amount; $('tip-note').value = tip.note;
    $('tip-network').textContent = ASSETS[tip.asset].name + ' network' + (tip.asset === 'PEP' ? ' · Native PEP' : '');
    $('tip-address').textContent = tip.address;
    const presetButtons = PRESETS[tip.asset].map(amount => {
      const button = document.createElement('button'); button.type = 'button'; button.textContent = amount;
      button.onclick = () => { $('tip-amount').value = amount; updatePresets(); };
      return button;
    });
    function updatePresets() {
      presetButtons.forEach(button => button.setAttribute('aria-pressed', String(button.textContent === $('tip-amount').value)));
      $('tip-error').textContent = '';
    }
    $('presets').replaceChildren(...presetButtons); $('tip-amount').oninput = updatePresets; updatePresets();
    document.querySelectorAll('[data-reaction]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.reaction === reaction));
      button.onclick = () => {
        reaction = button.dataset.reaction;
        document.querySelectorAll('[data-reaction]').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
      };
    });
    $('tip-form').onsubmit = async event => {
      event.preventDefault(); $('tip-error').textContent = ''; $('tip-continue').disabled = true;
      try {
        const updated = await createChatTip({asset: tip.asset, address: tip.address, recipient: tip.recipient, platform: tip.platform,
          amount: $('tip-amount').value, note: $('tip-note').value, reaction,
          ...(tip.intent ? {intent: tip.intent, sender: tip.sender, expires: tip.expires} : {})});
        if (current !== generation) return;
        // The destination remains this Haze origin, including local previews.
        const destination = new URL('/widget.html?standalone=1', location.origin); destination.hash = updated.fragment;
        location.assign(destination.href);
      } catch (error) { if (current === generation) { $('tip-error').textContent = error.message; $('tip-continue').disabled = false; } }
    };
    $('tip-form').hidden = false;
    if (tip.intent) {
      // The platform freezes payment terms and the note/reaction with its intent.
      $('tip-amount').readOnly = true; $('tip-note').readOnly = true;
      presetButtons.forEach(button => {button.disabled = true;});
      document.querySelectorAll('[data-reaction]').forEach(button => {button.disabled = true;});
      $('note-status').textContent = 'Use your linked Haze wallet. Haze shares the submitted transaction ID with PepecoinHub so it can check the payment.';
    } else {
      $('tip-amount').readOnly = false; $('tip-note').readOnly = false;
      document.querySelectorAll('[data-reaction]').forEach(button => {button.disabled = false;});
    }
  } catch {
    if (current !== generation) return;
    $('tip-title').textContent = 'Let’s start with a tip link';
    $('tip-status').textContent = 'This link is missing valid payment details.';
    $('tip-empty').hidden = false;
  }
}

window.addEventListener('hashchange', () => void paint());
void paint();

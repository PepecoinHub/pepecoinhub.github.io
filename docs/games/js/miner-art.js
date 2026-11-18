// Pepe Miner artwork: machine icons and stage backgrounds, drawn as inline SVG (no image files).
// Parts with class "fan", "led", "led2", "glow", "flow", "steam", "twinkle", "orbit", "bob" or "ripple" are animated in miner.css.
(() => {
  'use strict';
  const fan = (cx, cy, r, blade = '#8fd694') =>
    `<g class="fan"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1a222b"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r * 0.92}" fill="none" stroke="#2f3a45" stroke-width="1.2"/>`
    + `<path d="M${cx} ${cy}L${cx} ${cy - r * 0.8}M${cx} ${cy}L${cx + r * 0.7} ${cy + r * 0.42}M${cx} ${cy}L${cx - r * 0.7} ${cy + r * 0.42}" stroke="${blade}" stroke-width="${Math.max(1.2, r * 0.32)}" stroke-linecap="round"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#d5dde4"/></g>`;

  // a lily pad: an ellipse with a notch cut towards the right
  const pad = (x, y, rx, ry, fill) => {
    const a = 0.32, p = (t) => `${(x + rx * Math.cos(t)).toFixed(1)} ${(y + ry * Math.sin(t)).toFixed(1)}`;
    return `<path d="M${x} ${y}L${p(-a)}A${rx} ${ry} 0 1 0 ${p(a)}Z" fill="${fill}"/>`;
  };

  // tiny frog silhouette for scenes (brand anchor, not a clutter badge)
  const frog = (x, y, s = 1, fill = '#2f9e4f') =>
    `<g transform="translate(${x} ${y}) scale(${s})">`
    + `<ellipse cx="0" cy="2" rx="7" ry="5.5" fill="${fill}"/>`
    + `<circle cx="-3.2" cy="-1.5" r="2.4" fill="${fill}"/><circle cx="3.2" cy="-1.5" r="2.4" fill="${fill}"/>`
    + `<circle cx="-3.2" cy="-1.8" r="0.9" fill="#1a2a18"/><circle cx="3.2" cy="-1.8" r="0.9" fill="#1a2a18"/>`
    + `<ellipse cx="-5.5" cy="5" rx="2.2" ry="1.2" fill="${fill}"/><ellipse cx="5.5" cy="5" rx="2.2" ry="1.2" fill="${fill}"/>`
    + `</g>`;

  const ICONS = {
    laptop: `<rect x="8" y="8" width="32" height="22" rx="2.5" fill="#24303c"/><rect x="10.5" y="10.5" width="27" height="17" rx="1" fill="#0d2818"/>
      <rect x="10.5" y="10.5" width="27" height="17" rx="1" fill="#8ff0a4" opacity=".85"/>
      <path class="flow" d="M14 16h12M14 19.5h16M14 23h9" stroke="#16532a" stroke-width="1.7" stroke-linecap="round"/>
      <circle class="led" cx="34" cy="14" r="1.1" fill="#3fd46b"/>
      <path d="M3 31h42l-3.5 6.5H6.5z" fill="#6b7885"/><rect x="19" y="32.2" width="10" height="1.8" rx=".9" fill="#c9d2da"/>
      <path d="M36 6l1.5 3h-3z" fill="#f6bb60"/>`,
    pc: `<rect x="2" y="9" width="26" height="19" rx="2" fill="#24303c"/><rect x="4.5" y="11.5" width="21" height="14" rx="1" fill="#0a2030"/>
      <rect x="4.5" y="11.5" width="21" height="14" rx="1" fill="#7fd0ff" opacity=".75"/>
      <path d="M9 22l4-4 3 3 5-6" stroke="#1d5f8a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="13" y="28" width="4" height="5" fill="#6b7885"/><rect x="8" y="33" width="14" height="2.6" rx="1.3" fill="#6b7885"/>
      <rect x="30" y="6" width="16" height="32" rx="2" fill="#3a4552"/><rect x="32" y="8" width="12" height="10" rx="1" fill="#2b3440"/>
      ${fan(38, 16, 4.8)}
      <circle class="led" cx="38" cy="28" r="1.4" fill="#ff6bd6"/><circle class="led2" cx="38" cy="32" r="1.1" fill="#3fd46b"/>
      <rect x="33.5" y="35" width="9" height="1.6" rx=".8" fill="#6b7885"/>`,
    rig: `<path d="M7 36V12M41 36V12M5 12h38" stroke="#9aa6b1" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <rect x="3" y="36" width="42" height="3.5" rx="1.2" fill="#6b7885"/>
      <rect x="9" y="14" width="9.5" height="19" rx="1.5" fill="#24303c"/><rect x="19.5" y="14" width="9.5" height="19" rx="1.5" fill="#24303c"/><rect x="30" y="14" width="9.5" height="19" rx="1.5" fill="#24303c"/>
      ${fan(13.8, 23.5, 3.4)}${fan(24.2, 23.5, 3.4)}${fan(34.8, 23.5, 3.4)}
      <path d="M14 33.5v2M24 33.5v2M35 33.5v2" stroke="#f6bb60" stroke-width="1.5"/>
      <path class="glow" d="M10 10h28" stroke="#ffe9a8" stroke-width="2" opacity=".35"/>`,
    asic: `<rect x="4" y="11" width="40" height="26" rx="3" fill="#c9d2da"/><rect x="4" y="11" width="40" height="6" rx="2.5" fill="#8a96a0"/>
      <rect x="6" y="18" width="36" height="17" rx="1.5" fill="#aeb8c1"/>
      ${fan(15, 27, 6.4, '#8a96a0')}${fan(33, 27, 6.4, '#8a96a0')}
      <circle class="led" cx="21" cy="14.2" r="1.3" fill="#3fd46b"/><circle class="led2" cx="25.5" cy="14.2" r="1.3" fill="#f6bb60"/>
      <rect x="30" y="13.4" width="10" height="1.6" rx=".8" fill="#4a5662"/>
      <path d="M8 38h32" stroke="#2f9e4f" stroke-width="2" stroke-linecap="round"/>`,
    garage: `<path d="M2 23L24 8l22 15v17H2z" fill="#b07a45"/><path d="M2 23L24 8l22 15" fill="none" stroke="#7a522a" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="9" y="23" width="30" height="17" fill="#1c242e"/><rect class="glow" x="9" y="23" width="30" height="17" fill="#ffd36b" opacity=".32"/>
      <rect x="9" y="23" width="30" height="6" fill="#9aa6b1"/><path d="M9 25h30M9 27h30" stroke="#7d8892" stroke-width=".9"/>
      <rect x="12" y="32" width="10" height="8" rx="1" fill="#c9d2da"/><rect x="25" y="32" width="10" height="8" rx="1" fill="#c9d2da"/>
      <circle class="led" cx="17" cy="34.5" r="1.1" fill="#3fd46b"/><circle class="led2" cx="30" cy="34.5" r="1.1" fill="#3fd46b"/>
      <path d="M20 12h8v-3h-8z" fill="#2f9e4f"/><text x="24" y="11" text-anchor="middle" font-size="5" font-family="Ubuntu,sans-serif" font-weight="700" fill="#fff">P</text>`,
    farm: `<path d="M1 21l7-9h32l7 9z" fill="#3a4552"/><rect x="1" y="21" width="46" height="18" rx="1" fill="#6b7885"/>
      <rect class="win" x="5" y="25" width="7" height="5.5" rx=".8" fill="#ffd36b"/><rect class="win" x="15" y="25" width="7" height="5.5" rx=".8" fill="#ffd36b"/>
      <rect class="win" x="26" y="25" width="7" height="5.5" rx=".8" fill="#ffd36b"/><rect class="win" x="36" y="25" width="7" height="5.5" rx=".8" fill="#ffd36b"/>
      <rect x="21" y="30" width="6" height="9" fill="#24303c"/>${fan(12, 13.5, 3, '#c9d2da')}${fan(24, 13.5, 3, '#c9d2da')}${fan(36, 13.5, 3, '#c9d2da')}
      <path d="M0 40h48" stroke="#2f9e4f" stroke-width="2.2" stroke-linecap="round"/>`,
    plant: `<g class="steam"><circle cx="14" cy="8" r="3.8" fill="#eef2f5"/><circle cx="19" cy="5.5" r="3.1" fill="#eef2f5"/><circle cx="10.5" cy="4.8" r="2.5" fill="#eef2f5"/></g>
      <path d="M5 39c2.8-9 2.8-18 0-26h17c-2.8 8-2.8 17 0 26z" fill="#c9d2da"/><path d="M6 31h15" stroke="#2f9e4f" stroke-width="2.6"/>
      <rect x="25" y="22" width="20" height="17" rx="1.2" fill="#6b7885"/><rect x="28" y="26" width="5" height="5" fill="#ffd36b"/><rect x="36" y="26" width="5" height="5" fill="#ffd36b"/>
      <path class="glow" d="M37 3l-7.5 12h6l-3.2 9 9.5-13.5h-6l3.2-7.5z" fill="#f6bb60"/>
      ${frog(40, 40, 0.55, '#3fae5d')}`,
    dc: `<rect x="8" y="4" width="32" height="35" rx="2.5" fill="#24303c"/><rect x="8" y="4" width="32" height="5" rx="2" fill="#3a4552"/>
      <g fill="#3fd46b"><circle class="led" cx="14" cy="14" r="1.25"/><circle class="led2" cx="21" cy="14" r="1.25" fill="#7fd0ff"/><circle class="led" cx="28" cy="14" r="1.25"/><circle class="led2" cx="35" cy="14" r="1.25"/>
      <circle class="led2" cx="14" cy="21" r="1.25" fill="#7fd0ff"/><circle class="led" cx="21" cy="21" r="1.25"/><circle class="led2" cx="28" cy="21" r="1.25"/><circle class="led" cx="35" cy="21" r="1.25" fill="#7fd0ff"/>
      <circle class="led" cx="14" cy="28" r="1.25"/><circle class="led2" cx="21" cy="28" r="1.25"/><circle class="led" cx="28" cy="28" r="1.25" fill="#7fd0ff"/><circle class="led2" cx="35" cy="28" r="1.25"/></g>
      <rect x="20" y="32" width="8" height="7" fill="#4a5662"/><path d="M3 40h42" stroke="#2f9e4f" stroke-width="2.4" stroke-linecap="round"/>
      <path class="glow" d="M10 4h28" stroke="#8ff0a4" stroke-width="2" opacity=".25"/>`,
    hydro: `<path d="M2 39V9h16v30z" fill="#7b6650"/><path d="M2 9h16v5H2z" fill="#2f9e4f"/>
      <rect x="16" y="11" width="9" height="23" fill="#5fb6ea"/><path class="flow" d="M18.5 12v21M22.5 12v21" stroke="#d6f0ff" stroke-width="1.4" stroke-dasharray="3 4"/>
      <ellipse cx="25" cy="37" rx="21" ry="3.8" fill="#5fb6ea"/><ellipse class="ripple" cx="25" cy="37" rx="14" ry="2.2" fill="none" stroke="#d6f0ff" stroke-width="1" opacity=".5"/>
      <rect x="29" y="24" width="15" height="12" rx="1" fill="#c9d2da"/>
      ${fan(36.5, 20, 5, '#5fb6ea')}<path class="glow" d="M34 28l-2.2 3.8h2.8l-1.2 3.2 4.4-4.8h-2.8l1.6-2.2z" fill="#f6bb60"/>`,
    moon: `<circle class="twinkle" cx="7" cy="7" r="1.1" fill="#ffe9a8"/><circle class="twinkle t2" cx="41" cy="11" r="1" fill="#ffe9a8"/><circle class="twinkle" cx="28" cy="5" r=".7" fill="#ffe9a8"/>
      <path d="M0 36c10-5 38-5 48 0v6H0z" fill="#9aa6b1"/><ellipse cx="10" cy="37.5" rx="3.2" ry="1.1" fill="#7d8892"/><ellipse cx="38" cy="38.5" rx="2.8" ry="1" fill="#7d8892"/>
      <path d="M11 34a13.5 13.5 0 0126 0z" fill="#dfe6ec"/><path d="M24 20v14M16.5 25c2.2 2.6 2.2 6.2 1.6 8.8M31.5 25c-2.2 2.6-2.2 6.2-1.6 8.8" stroke="#9aa6b1" stroke-width="1.1" fill="none"/>
      <path d="M37 20l6.5-5.5" stroke="#6b7885" stroke-width="1.4"/><path d="M40 12a5.2 5.2 0 006.2 5.2z" fill="#c9d2da"/><circle class="led" cx="43.2" cy="14.2" r="1.2" fill="#e0533d"/>
      ${frog(24, 30, 0.45, '#3fae5d')}`,
    pond: `<ellipse cx="24" cy="30" rx="21" ry="11" fill="#3d8fb5"/><ellipse cx="24" cy="30" rx="21" ry="11" fill="none" stroke="#2c6f8d" stroke-width="1.2"/>
      <ellipse class="ripple" cx="24" cy="30" rx="12" ry="5" fill="none" stroke="#8fd6ef" stroke-width="1" opacity=".45"/>
      <path d="M13 27L24 33L35 26M24 33l-2 6" stroke="#ffd36b" stroke-width=".9" fill="none" stroke-dasharray="2 2"/>
      ${pad(13, 27, 5.2, 3.3, '#2f9e4f')}${pad(35, 26, 5.2, 3.3, '#2f9e4f')}${pad(24, 33, 5.2, 3.3, '#3fae5d')}
      <circle class="led" cx="13" cy="26.2" r="1.35" fill="#8ff0a4"/><circle class="led2" cx="35" cy="25.2" r="1.35" fill="#8ff0a4"/><circle class="led" cx="24" cy="32.2" r="1.35" fill="#8ff0a4"/>
      <circle class="twinkle" cx="9" cy="9" r="1.1" fill="#ffe9a8"/><path d="M33 11a6.2 6.2 0 108.2 8.2a7.2 7.2 0 01-8.2-8.2z" fill="#ffe9a8"/>
      ${frog(24, 22, 0.5)}`,
    mars: `<circle cx="22" cy="26" r="15.5" fill="#d9663f"/><path d="M7.5 21.5c6.5 2.2 19 2.2 29.5-2.2M8.8 31.5c7.5 2.2 18 2.2 26.5-1.2" stroke="#b44d2c" stroke-width="2.1" fill="none"/>
      <circle cx="16.5" cy="19.5" r="2.5" fill="#b44d2c"/><circle cx="28.5" cy="32.5" r="1.9" fill="#b44d2c"/>
      <g class="orbit"><circle cx="22" cy="26" r="21.5" fill="none"/><g><rect x="38.5" y="5.5" width="5.5" height="3.2" rx=".6" fill="#c9d2da"/><path d="M35.2 7.1h3.3M44 7.1h3.3" stroke="#7fd0ff" stroke-width="2"/><circle class="led" cx="41.2" cy="7.1" r="1" fill="#e0533d"/></g></g>
      ${frog(22, 26, 0.4, '#6bb56e')}`,
  };
  const icon = (id, size = 48) => `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">${ICONS[id] || ''}</svg>`;

  // ---------- stage backgrounds, 400 x 300 ----------
  const stars = (n, seed, h = 150, color = '#fff6d5') => {
    let s = seed, out = '';
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) out += `<circle class="twinkle${i % 3 ? '' : ' t2'}" cx="${(r() * 400).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.6 + r() * 1.3).toFixed(2)}" fill="${color}"/>`;
    return out;
  };
  const sky = (id, a, b, c) => {
    const mid = c ? `<stop offset=".55" stop-color="${c}"/>` : '';
    return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/>${mid}<stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#${id})"/>`;
  };
  const dust = (seed, n = 18) => {
    let s = seed, out = '';
    const r = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let i = 0; i < n; i++) {
      out += `<circle class="dust" cx="${(r() * 400).toFixed(1)}" cy="${(120 + r() * 160).toFixed(1)}" r="${(0.8 + r() * 1.6).toFixed(2)}" fill="#ffe9a8" opacity="${(0.15 + r() * 0.35).toFixed(2)}"/>`;
    }
    return out;
  };

  const SCENES = {
    room: `${sky('g-room', '#f3e7cf', '#d9c7a4', '#e8d7b6')}
      <rect x="0" y="0" width="400" height="300" fill="#000" opacity=".04"/>
      <rect x="28" y="34" width="118" height="102" rx="6" fill="#6e4e30"/><rect x="36" y="42" width="102" height="86" rx="3" fill="#152238"/>
      ${stars(16, 7, 80).replace(/cx="(\d+(\.\d+)?)"/g, (m, x) => `cx="${(48 + (+x) * 0.22).toFixed(1)}"`).replace(/cy="(\d+(\.\d+)?)"/g, (m, y) => `cy="${(50 + (+y) * 0.85).toFixed(1)}"`)}
      <path d="M112 58a13 13 0 1015 17a15 15 0 01-15-17z" fill="#ffe9a8"/><path d="M87 42v86M36 85h102" stroke="#6e4e30" stroke-width="4"/>
      <rect x="258" y="28" width="78" height="58" rx="3" fill="#fbf6ea" stroke="#c9b48e" stroke-width="3"/><circle cx="297" cy="57" r="18" fill="#269B4D"/><text x="297" y="65" text-anchor="middle" font-family="Ubuntu, sans-serif" font-weight="700" font-size="22" fill="#fff">P</text>
      <rect x="0" y="222" width="400" height="78" fill="#b07e4f"/><path d="M0 242h400M0 264h400M0 286h400" stroke="#96683c" stroke-width="2"/>
      <rect x="248" y="168" width="148" height="12" rx="2" fill="#7a5634"/><rect x="260" y="180" width="9" height="48" fill="#7a5634"/><rect x="372" y="180" width="9" height="48" fill="#7a5634"/>
      <path d="M354 168l-9-32h-13" stroke="#24303c" stroke-width="3.2" fill="none"/><path d="M322 130h24l-6.5 11h-11z" fill="#f6bb60"/><path class="glow" d="M326 141l-15 28h48l-15-28z" fill="#ffe9a8" opacity=".5"/>
      <rect x="16" y="188" width="34" height="36" rx="4" fill="#c1693c"/><path d="M33 188c-15-22-4-38 0-42c4 4 15 20 0 42z" fill="#2f9e4f"/><path d="M33 188c-21-8-26-23-23-29c8 0 21 11 23 29zM33 188c21-8 26-23 23-29c-8 0-21 11-23 29z" fill="#3fae5d"/>
      ${dust(11, 12)}${frog(210, 210, 1.1, '#3fae5d')}`,
    garage: `${sky('g-gar', '#cfd1cb', '#a8aaa3', '#bcbeb8')}
      <rect x="0" y="0" width="400" height="22" fill="#8f918a"/><path d="M200 22v36" stroke="#24303c" stroke-width="2.4"/><circle class="glow" cx="200" cy="68" r="38" fill="#ffe9a8" opacity=".4"/><circle cx="200" cy="66" r="10" fill="#ffe9a8"/>
      <rect x="16" y="58" width="96" height="9" fill="#7a522a"/><rect x="16" y="118" width="96" height="9" fill="#7a522a"/>
      <rect x="24" y="38" width="24" height="20" rx="2" fill="#e0533d"/><rect x="54" y="42" width="18" height="16" rx="2" fill="#2f9e4f"/><rect x="78" y="46" width="26" height="12" rx="2" fill="#6b7885"/>
      <rect x="24" y="96" width="32" height="22" rx="2" fill="#c9d2da"/><circle class="led" cx="30" cy="102" r="1.7" fill="#3fd46b"/><rect x="62" y="96" width="32" height="22" rx="2" fill="#c9d2da"/><circle class="led2" cx="68" cy="102" r="1.7" fill="#3fd46b"/>
      <rect x="286" y="34" width="98" height="128" rx="3" fill="#9aa6b1"/><path d="M286 60h98M286 86h98M286 112h98M286 138h98" stroke="#7d8892" stroke-width="3.2"/>
      <circle class="led" cx="300" cy="48" r="2" fill="#3fd46b"/><circle class="led2" cx="312" cy="48" r="2" fill="#f6bb60"/>
      <rect x="0" y="228" width="400" height="72" fill="#81837e"/><path d="M0 228h400" stroke="#6a6c67" stroke-width="3"/>
      <path d="M36 300c32-42 96-54 148-66s128-8 196 12" stroke="#24303c" stroke-width="4.5" fill="none"/><path d="M56 300c42-32 126-44 210-32" stroke="#e0533d" stroke-width="3.2" fill="none"/>
      <rect x="310" y="196" width="60" height="38" rx="3" fill="#e0533d"/><rect x="310" y="196" width="60" height="10" rx="3" fill="#b44d2c"/>
      ${dust(22, 14)}${frog(140, 210, 0.9, '#3fae5d')}`,
    farm: `${sky('g-farm', '#ffd59a', '#f08a52', '#f7b06a')}
      <circle cx="318" cy="88" r="38" fill="#ffe9a8" opacity=".92"/><circle class="glow" cx="318" cy="88" r="52" fill="#ffe9a8" opacity=".2"/>
      <path d="M0 168c62-32 134-36 206-16s142 12 194-10v158H0z" fill="#7fbf6a"/><path d="M0 198c84-22 166-20 248-4s112 8 152-8v114H0z" fill="#5fa654"/>
      <path d="M28 116v84M112 108v86M196 114v78M280 106v88M360 112v84" stroke="#5b4636" stroke-width="3.2"/><path d="M28 122C70 138 70 138 112 114M112 114c42 16 42 16 84 8M196 120c42 12 42 12 84-6M280 112c42 14 42 14 80 8" stroke="#24303c" stroke-width="1.4" fill="none"/>
      <g><path d="M38 206l16-16h92l16 16z" fill="#3a4552"/><rect x="38" y="206" width="124" height="48" fill="#6b7885"/>
      <rect class="win" x="50" y="218" width="18" height="13" fill="#ffd36b"/><rect class="win" x="78" y="218" width="18" height="13" fill="#ffd36b"/><rect class="win" x="106" y="218" width="18" height="13" fill="#ffd36b"/><rect class="win" x="134" y="218" width="18" height="13" fill="#ffd36b"/></g>
      <g><path d="M230 212l14-14h110l14 14z" fill="#3a4552"/><rect x="230" y="212" width="138" height="44" fill="#6b7885"/>
      <rect class="win" x="242" y="222" width="18" height="13" fill="#ffd36b"/><rect class="win" x="270" y="222" width="18" height="13" fill="#ffd36b"/><rect class="win" x="312" y="222" width="18" height="13" fill="#ffd36b"/><rect class="win" x="340" y="222" width="18" height="13" fill="#ffd36b"/></g>
      <rect x="0" y="258" width="400" height="42" fill="#4f8f46"/>
      ${dust(33, 10)}${frog(190, 250, 1, '#2f9e4f')}`,
    swamp: `${sky('g-sw', '#9fd6c4', '#4e968c', '#6fafa4')}
      <g class="steam"><circle cx="304" cy="40" r="22" fill="#f2f5f4" opacity=".9"/><circle cx="328" cy="26" r="17" fill="#f2f5f4" opacity=".85"/><circle cx="286" cy="24" r="14" fill="#f2f5f4" opacity=".8"/></g>
      <path d="M268 168c6-36 6-72 0-108h64c-6 36-6 72 0 108z" fill="#dfe6ec"/><path d="M270 136h60" stroke="#2f9e4f" stroke-width="9"/>
      <rect x="338" y="106" width="56" height="64" fill="#8a96a0"/><path class="glow" d="M366 80l-17 28h13l-7.5 22 22-30h-13l8.5-20z" fill="#f6bb60"/>
      <path d="M0 156c52-12 124-10 176 0s144 8 224-2v146H0z" fill="#4f8a5c"/><rect x="0" y="192" width="400" height="108" fill="#3f7f78"/>
      <path d="M0 208c42 5 84-5 126 0s84 7 126 0s104-7 148 3" stroke="#5fa79e" stroke-width="2.2" fill="none"/>
      ${pad(44, 236, 22, 9, '#2f9e4f')}${pad(152, 260, 26, 10, '#3fae5d')}${pad(332, 248, 24, 9, '#2f9e4f')}
      <ellipse class="ripple" cx="200" cy="230" rx="40" ry="8" fill="none" stroke="#8fd6c8" stroke-width="1.2" opacity=".4"/>
      <path d="M12 192c2-32 4-52 0-72M22 192c4-26 8-42 10-58M378 192c-2-28-6-46-2-66M388 192c2-22 4-38 0-52" stroke="#2c6b3a" stroke-width="3.2" fill="none"/>
      <ellipse cx="28" cy="128" rx="3.2" ry="10" fill="#6b4a2a"/><ellipse cx="376" cy="132" rx="3.2" ry="10" fill="#6b4a2a"/>
      ${stars(12, 21, 190, '#fff4a0').replace(/<circle /g, '<circle opacity=".9" ')}
      ${frog(90, 228, 0.95)}${frog(280, 255, 0.7, '#3fae5d')}`,
    falls: `${sky('g-fa', '#a8dbff', '#eef8ff', '#c8e9ff')}
      <path d="M0 138l62-72 52 52 62-84 72 94 62-62 90 92v142H0z" fill="#8eabc0"/><path d="M148 38l22-3 16 20-20-7z" fill="#fff"/>
      <path d="M0 300V116h156l12 184z" fill="#7b6650"/><path d="M0 116h156v15H0z" fill="#3fae5d"/>
      <rect x="152" y="120" width="54" height="164" fill="#5fb6ea"/><path class="flow" d="M162 120v164M178 120v164M194 120v164" stroke="#e3f5ff" stroke-width="3.2" stroke-dasharray="12 14"/>
      <path d="M118 300c12-32 44-44 86-44s94 14 196 8v36z" fill="#5fb6ea"/><path class="flow" d="M148 278c44-7 86-7 128 0s84 5 124-2" stroke="#e3f5ff" stroke-width="2.2" fill="none" stroke-dasharray="10 12"/>
      <path d="M238 236h124v-48h-124z" fill="#dfe6ec"/><path d="M232 188l68-28 68 28z" fill="#8a96a0"/><rect x="264" y="206" width="20" height="20" fill="#ffd36b"/><rect x="320" y="206" width="20" height="20" fill="#ffd36b"/>
      <path d="M218 166l-16 36h32zM374 156l-18 42h36zM394 172l-14 32h28z" fill="#2f9e4f"/><path d="M218 202v12M374 198v12M394 204v10" stroke="#6b4a2a" stroke-width="3.2"/>
      ${dust(44, 10)}${frog(100, 250, 0.85)}`,
    moon: `${sky('g-mo', '#050812', '#1a2440', '#0c1428')}${stars(52, 5, 200)}
      <circle cx="320" cy="68" r="34" fill="#3a7bd5"/><circle class="glow" cx="320" cy="68" r="48" fill="#3a7bd5" opacity=".18"/>
      <path d="M300 52c11 5 16 16 9 25s5 16 14 11M330 42c-2 11 9 16 16 14M320 98c7-7 16-5 23-12" stroke="#3fae5d" stroke-width="7.5" fill="none" stroke-linecap="round"/>
      <path d="M0 210c74-28 166-32 238-16s114 10 162-2v108H0z" fill="#9aa6b1"/><path d="M0 244c94-16 206-14 400 4v52H0z" fill="#b6c0c9"/>
      <ellipse cx="78" cy="258" rx="28" ry="7" fill="#8a96a0"/><ellipse cx="304" cy="272" rx="36" ry="8" fill="#8a96a0"/><ellipse cx="188" cy="228" rx="16" ry="4.5" fill="#8a96a0"/>
      <path d="M260 232a44 44 0 0188 0z" fill="#dfe6ec"/><path d="M304 188v44M274 206c7 9 7 20 5 28M334 206c-7 9-7 20-5 28" stroke="#9aa6b1" stroke-width="2.2" fill="none"/>
      <path d="M46 226v-44" stroke="#6b7885" stroke-width="3.2"/><path d="M30 170a20 20 0 0032 22z" fill="#c9d2da"/><circle class="led" cx="54" cy="180" r="3.2" fill="#e0533d"/>
      ${frog(304, 220, 0.7, '#3fae5d')}`,
    pond: `${sky('g-po', '#071628', '#1c3d62', '#0f2744')}${stars(40, 13, 155)}
      <path d="M56 48a26 26 0 1032 32a30 30 0 01-32-32z" fill="#ffe9a8"/><circle class="glow" cx="78" cy="70" r="36" fill="#ffe9a8" opacity=".12"/>
      <path d="M0 146c84-16 156-14 208-6s134 12 192-2v162H0z" fill="#122c46"/><ellipse cx="200" cy="228" rx="236" ry="74" fill="#1b4a6e"/>
      <ellipse class="ripple" cx="200" cy="228" rx="90" ry="22" fill="none" stroke="#5fb6ea" stroke-width="1.4" opacity=".35"/>
      <ellipse cx="72" cy="210" rx="11" ry="32" fill="#ffe9a8" opacity=".16"/>
      ${[[58, 196], [138, 246], [228, 210], [318, 244], [368, 202], [108, 276], [268, 280], [188, 258]].map(([x, y], i) =>
        `${pad(x, y, 21, 7.5, i % 2 ? '#3fae5d' : '#2f9e4f')}<circle class="${i % 2 ? 'led2' : 'led'}" cx="${x}" cy="${y - 2}" r="3.2" fill="#8ff0a4"/>`).join('')}
      <path d="M58 194L138 244L228 208L318 242L368 200M138 244L108 274M228 208L188 256L268 278" stroke="#ffd36b" stroke-width="1.5" fill="none" stroke-dasharray="4 5" opacity=".75"/>
      ${frog(200, 200, 1.05)}${frog(320, 230, 0.7, '#3fae5d')}`,
    mars: `${sky('g-ma', '#f4b78a', '#d45f30', '#e88855')}
      <circle cx="78" cy="56" r="11" fill="#c9a58a"/><circle cx="324" cy="36" r="7" fill="#d8bba3"/>
      <path d="M0 166c64-26 136-30 208-12s144 14 192-4v150H0z" fill="#c4562f"/><path d="M0 218c104-28 228-26 400-4v86H0z" fill="#d9663f"/>
      <ellipse cx="304" cy="262" rx="44" ry="9" fill="#b44d2c"/><ellipse cx="68" cy="248" rx="24" ry="5.5" fill="#b44d2c"/>
      <path d="M176 222a42 42 0 0184 0z" fill="#efe6dc"/><path d="M218 180v42" stroke="#c9b8a8" stroke-width="2.2"/><rect x="196" y="206" width="14" height="12" fill="#7fd0ff"/>
      <path d="M302 222v-54" stroke="#6b7885" stroke-width="3.2"/><path d="M286 160a20 20 0 0030 22z" fill="#efe6dc"/><circle class="led" cx="310" cy="168" r="3.2" fill="#3fd46b"/>
      <path d="M96 228h54l7-14h-68z" fill="#8a96a0"/><circle cx="106" cy="232" r="6.5" fill="#24303c"/><circle cx="142" cy="232" r="6.5" fill="#24303c"/>
      ${dust(55, 12)}${frog(218, 210, 0.65, '#6bb56e')}`,
  };
  // which stage a mine gets, by the most advanced machine owned
  const SCENE_FOR = { laptop: 'room', pc: 'room', rig: 'room', asic: 'garage', garage: 'garage', farm: 'farm', plant: 'swamp', dc: 'swamp', hydro: 'falls', moon: 'moon', pond: 'pond', mars: 'mars' };
  // the first stage (room) is the owner's picture, the others are drawn above
  const PICTURE_SCENES = { room: 'img/miner/scene-room.webp' };
  const scene = (id) => PICTURE_SCENES[id] ? `<img src="${PICTURE_SCENES[id]}" alt="" class="scene-pic">` : `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${SCENES[id] || SCENES.room}</svg>`;

  window.MINER_ART = { icon, scene, SCENE_FOR };
})();

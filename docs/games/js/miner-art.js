// Pepe Miner artwork: machine icons and stage backgrounds, drawn as inline SVG (no image files).
// Parts with class "fan", "led", "led2", "glow", "flow", "steam", "twinkle" or "orbit" are animated in miner.css.
(() => {
  'use strict';
  const fan = (cx, cy, r, blade = '#8fd694') =>
    `<g class="fan"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#1f2730"/>`
    + `<path d="M${cx} ${cy}L${cx} ${cy - r * 0.8}M${cx} ${cy}L${cx + r * 0.7} ${cy + r * 0.42}M${cx} ${cy}L${cx - r * 0.7} ${cy + r * 0.42}" stroke="${blade}" stroke-width="${Math.max(1.2, r * 0.32)}" stroke-linecap="round"/>`
    + `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#c9d2da"/></g>`;

  // a lily pad: an ellipse with a notch cut towards the right
  const pad = (x, y, rx, ry, fill) => {
    const a = 0.32, p = (t) => `${(x + rx * Math.cos(t)).toFixed(1)} ${(y + ry * Math.sin(t)).toFixed(1)}`;
    return `<path d="M${x} ${y}L${p(-a)}A${rx} ${ry} 0 1 0 ${p(a)}Z" fill="${fill}"/>`;
  };

  const ICONS = {
    laptop: `<rect x="9" y="9" width="30" height="21" rx="2.5" fill="#2b3440"/><rect x="11.5" y="11.5" width="25" height="16" rx="1" fill="#8ff0a4"/>
      <path class="flow" d="M14 16h12M14 19.5h16M14 23h9" stroke="#1d6b35" stroke-width="1.7" stroke-linecap="round"/>
      <path d="M4 31h40l-3.5 6H7.5z" fill="#6b7885"/><rect x="19" y="32" width="10" height="1.8" rx=".9" fill="#c9d2da"/>`,
    pc: `<rect x="3" y="10" width="25" height="18" rx="2" fill="#2b3440"/><rect x="5.5" y="12.5" width="20" height="13" rx="1" fill="#7fd0ff"/>
      <path d="M9 22l4-4 3 3 5-6" stroke="#1d5f8a" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <rect x="13.5" y="28" width="4" height="5" fill="#6b7885"/><rect x="8.5" y="33" width="14" height="2.6" rx="1.3" fill="#6b7885"/>
      <rect x="30" y="7" width="15" height="31" rx="2" fill="#3a4552"/>${fan(37.5, 16, 4.6)}
      <circle class="led" cx="37.5" cy="27.5" r="1.4" fill="#ff6bd6"/><rect x="33.5" y="31.5" width="8" height="1.6" rx=".8" fill="#6b7885"/>`,
    rig: `<path d="M7 35V13M41 35V13M6 13h36" stroke="#8a96a0" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <rect x="4" y="35" width="40" height="3.5" rx="1.2" fill="#6b7885"/>
      <rect x="9.5" y="15.5" width="9" height="18" rx="1.5" fill="#2b3440"/><rect x="19.5" y="15.5" width="9" height="18" rx="1.5" fill="#2b3440"/><rect x="29.5" y="15.5" width="9" height="18" rx="1.5" fill="#2b3440"/>
      ${fan(14, 24.5, 3.3)}${fan(24, 24.5, 3.3)}${fan(34, 24.5, 3.3)}
      <path d="M14 33.5v1.5M24 33.5v1.5M34 33.5v1.5" stroke="#f6bb60" stroke-width="1.4"/>`,
    asic: `<rect x="5" y="12" width="38" height="25" rx="3" fill="#c9d2da"/><rect x="5" y="12" width="38" height="5.5" rx="2.5" fill="#9aa6b1"/>
      ${fan(15, 27.5, 6.2, '#9aa6b1')}${fan(33, 27.5, 6.2, '#9aa6b1')}
      <circle class="led" cx="21" cy="14.8" r="1.2" fill="#3fd46b"/><circle class="led2" cx="25" cy="14.8" r="1.2" fill="#f6bb60"/><rect x="29" y="14" width="10" height="1.6" rx=".8" fill="#6b7885"/>`,
    garage: `<path d="M3 23L24 9l21 14v16H3z" fill="#b07a45"/><path d="M3 23L24 9l21 14" fill="none" stroke="#7a522a" stroke-width="2.6" stroke-linejoin="round"/>
      <rect x="10" y="23" width="28" height="16" fill="#232a33"/><rect class="glow" x="10" y="23" width="28" height="16" fill="#ffd36b" opacity=".35"/>
      <rect x="10" y="23" width="28" height="6" fill="#9aa6b1"/><path d="M10 25h28M10 27h28" stroke="#7d8892" stroke-width=".9"/>
      <rect x="13" y="32" width="9" height="7" rx="1" fill="#c9d2da"/><rect x="25" y="32" width="9" height="7" rx="1" fill="#c9d2da"/>
      <circle class="led" cx="17.5" cy="34" r="1" fill="#3fd46b"/><circle class="led2" cx="29.5" cy="34" r="1" fill="#3fd46b"/>`,
    farm: `<path d="M2 21l6-8h32l6 8z" fill="#4a5662"/><rect x="2" y="21" width="44" height="17" rx="1" fill="#6b7885"/>
      <rect class="win" x="6" y="25" width="6" height="5" rx=".8" fill="#ffd36b"/><rect class="win" x="15" y="25" width="6" height="5" rx=".8" fill="#ffd36b"/>
      <rect class="win" x="27" y="25" width="6" height="5" rx=".8" fill="#ffd36b"/><rect class="win" x="36" y="25" width="6" height="5" rx=".8" fill="#ffd36b"/>
      <rect x="21.5" y="30" width="5" height="8" fill="#2b3440"/>${fan(14, 14.5, 2.8, '#c9d2da')}${fan(24, 14.5, 2.8, '#c9d2da')}${fan(34, 14.5, 2.8, '#c9d2da')}`,
    plant: `<g class="steam"><circle cx="14" cy="9" r="3.6" fill="#eef2f5"/><circle cx="18.5" cy="6.5" r="3" fill="#eef2f5"/><circle cx="11" cy="5.5" r="2.4" fill="#eef2f5"/></g>
      <path d="M6 39c2.6-8.5 2.6-17 0-25h16c-2.6 8-2.6 16.5 0 25z" fill="#c9d2da"/><path d="M6.8 31h14.4" stroke="#2f9e4f" stroke-width="2.4"/>
      <rect x="25" y="23" width="19" height="16" rx="1" fill="#6b7885"/><rect x="28" y="27" width="4" height="4" fill="#ffd36b"/><rect x="36" y="27" width="4" height="4" fill="#ffd36b"/>
      <path class="glow" d="M36.5 4l-7 11h5.5l-3 8.5 9-12.5h-5.5l3.5-7z" fill="#f6bb60"/>`,
    dc: `<rect x="9" y="5" width="30" height="34" rx="2.5" fill="#2b3440"/><rect x="9" y="5" width="30" height="4" rx="2" fill="#3a4552"/>
      <g fill="#3fd46b"><circle class="led" cx="15" cy="14" r="1.2"/><circle class="led2" cx="21" cy="14" r="1.2" fill="#7fd0ff"/><circle class="led" cx="27" cy="14" r="1.2"/><circle class="led2" cx="33" cy="14" r="1.2"/>
      <circle class="led2" cx="15" cy="20" r="1.2" fill="#7fd0ff"/><circle class="led" cx="21" cy="20" r="1.2"/><circle class="led2" cx="27" cy="20" r="1.2"/><circle class="led" cx="33" cy="20" r="1.2" fill="#7fd0ff"/>
      <circle class="led" cx="15" cy="26" r="1.2"/><circle class="led2" cx="21" cy="26" r="1.2"/><circle class="led" cx="27" cy="26" r="1.2" fill="#7fd0ff"/><circle class="led2" cx="33" cy="26" r="1.2"/></g>
      <rect x="20" y="31" width="8" height="8" fill="#4a5662"/><path d="M4 39h40" stroke="#2f9e4f" stroke-width="2.4" stroke-linecap="round"/>`,
    hydro: `<path d="M3 39V10h15v29z" fill="#7b6650"/><path d="M3 10h15v5H3z" fill="#2f9e4f"/>
      <rect x="17" y="12" width="8" height="22" fill="#5fb6ea"/><path class="flow" d="M19 13v20M22.5 13v20" stroke="#d6f0ff" stroke-width="1.3" stroke-dasharray="3 4"/>
      <ellipse cx="25" cy="37" rx="20" ry="3.5" fill="#5fb6ea"/><rect x="29" y="25" width="14" height="11" rx="1" fill="#c9d2da"/>
      ${fan(36, 21, 4.8, '#5fb6ea')}<path class="glow" d="M33 29l-2 3.5h2.5l-1 3 4-4.5h-2.5l1.5-2z" fill="#f6bb60"/>`,
    moon: `<circle class="twinkle" cx="8" cy="8" r="1" fill="#ffe9a8"/><circle class="twinkle" cx="40" cy="12" r=".9" fill="#ffe9a8"/>
      <path d="M1 36c9-4.5 37-4.5 46 0v5H1z" fill="#9aa6b1"/><ellipse cx="11" cy="37.5" rx="3" ry="1" fill="#7d8892"/><ellipse cx="37" cy="38.5" rx="2.5" ry=".9" fill="#7d8892"/>
      <path d="M11 34a13 13 0 0126 0z" fill="#dfe6ec"/><path d="M24 21v13M17 25.5c2 2.5 2 6 1.5 8.5M31 25.5c-2 2.5-2 6-1.5 8.5" stroke="#9aa6b1" stroke-width="1" fill="none"/>
      <path d="M36 21l6-5" stroke="#6b7885" stroke-width="1.3"/><path d="M39 13a5 5 0 006 5z" fill="#c9d2da"/><circle class="led" cx="42" cy="15" r="1.1" fill="#e0533d"/>`,
    pond: `<ellipse cx="24" cy="30" rx="21" ry="11" fill="#3d8fb5"/><ellipse cx="24" cy="30" rx="21" ry="11" fill="none" stroke="#2c6f8d" stroke-width="1.2"/>
      <path d="M13 27L24 33L35 26M24 33l-2 6" stroke="#ffd36b" stroke-width=".9" fill="none" stroke-dasharray="2 2"/>
      ${pad(13, 27, 5, 3.2, '#2f9e4f')}${pad(35, 26, 5, 3.2, '#2f9e4f')}${pad(24, 33, 5, 3.2, '#3fae5d')}
      <circle class="led" cx="13" cy="26.5" r="1.3" fill="#8ff0a4"/><circle class="led2" cx="35" cy="25.5" r="1.3" fill="#8ff0a4"/><circle class="led" cx="24" cy="32.5" r="1.3" fill="#8ff0a4"/>
      <circle class="twinkle" cx="9" cy="10" r="1" fill="#ffe9a8"/><path d="M33 12a6 6 0 108 8a7 7 0 01-8-8z" fill="#ffe9a8"/>`,
    mars: `<circle cx="22" cy="26" r="15" fill="#d9663f"/><path d="M8 22c6 2 18 2 28-2M9.5 31c7 2 17 2 25-1" stroke="#b44d2c" stroke-width="2" fill="none"/>
      <circle cx="17" cy="20" r="2.4" fill="#b44d2c"/><circle cx="28" cy="32" r="1.8" fill="#b44d2c"/>
      <g class="orbit"><circle cx="22" cy="26" r="21" fill="none"/><g><rect x="38" y="6" width="5" height="3" rx=".6" fill="#c9d2da"/><path d="M35 7.5h3M43 7.5h3" stroke="#7fd0ff" stroke-width="2"/><circle class="led" cx="40.5" cy="7.5" r=".9" fill="#e0533d"/></g></g>`,
  };
  const icon = (id, size = 48) => `<svg viewBox="0 0 48 48" width="${size}" height="${size}" aria-hidden="true" focusable="false">${ICONS[id] || ''}</svg>`;

  // ---------- stage backgrounds, 400 x 300 ----------
  const stars = (n, seed, h = 150, color = '#fff6d5') => {
    let s = seed, out = '';
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < n; i++) out += `<circle class="twinkle${i % 3 ? '' : ' t2'}" cx="${(r() * 400).toFixed(1)}" cy="${(r() * h).toFixed(1)}" r="${(0.6 + r() * 1.3).toFixed(2)}" fill="${color}"/>`;
    return out;
  };
  const sky = (id, a, b) => `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="400" height="300" fill="url(#${id})"/>`;

  const SCENES = {
    room: `${sky('g-room', '#efe4cc', '#e2d3b4')}
      <rect x="34" y="40" width="110" height="96" rx="6" fill="#7a5a3a"/><rect x="42" y="48" width="94" height="80" rx="3" fill="#1d2b45"/>
      ${stars(14, 7, 80).replace(/cx="(\d+(\.\d+)?)"/g, (m, x) => `cx="${(48 + (+x) * 0.22).toFixed(1)}"`).replace(/cy="(\d+(\.\d+)?)"/g, (m, y) => `cy="${(54 + (+y) * 0.8).toFixed(1)}"`)}
      <path d="M114 62a12 12 0 1014 16a14 14 0 01-14-16z" fill="#ffe9a8"/><path d="M89 48v80M42 88h94" stroke="#7a5a3a" stroke-width="4"/>
      <rect x="262" y="34" width="70" height="52" rx="3" fill="#fbf6ea" stroke="#c9b48e" stroke-width="3"/><circle cx="297" cy="60" r="17" fill="#2f9e4f"/><text x="297" y="67" text-anchor="middle" font-family="Ubuntu, sans-serif" font-weight="700" font-size="20" fill="#fff">P</text>
      <rect x="0" y="228" width="400" height="72" fill="#b98a5a"/><path d="M0 248h400M0 270h400M0 290h400" stroke="#a87a4c" stroke-width="2"/>
      <rect x="250" y="176" width="140" height="10" rx="2" fill="#8a6440"/><rect x="262" y="186" width="8" height="46" fill="#8a6440"/><rect x="370" y="186" width="8" height="46" fill="#8a6440"/>
      <path d="M352 176l-8-30h-12" stroke="#2b3440" stroke-width="3" fill="none"/><path d="M326 140h22l-6 10h-10z" fill="#f6bb60"/><path class="glow" d="M329 150l-14 26h44l-14-26z" fill="#ffe9a8" opacity=".45"/>
      <rect x="20" y="196" width="30" height="34" rx="4" fill="#c1693c"/><path d="M35 196c-14-20-4-36 0-40c4 4 14 20 0 40z" fill="#2f9e4f"/><path d="M35 196c-20-8-24-22-22-28c8 0 20 10 22 28zM35 196c20-8 24-22 22-28c-8 0-20 10-22 28z" fill="#3fae5d"/>`,
    garage: `${sky('g-gar', '#c8cac4', '#b3b5ae')}
      <rect x="0" y="0" width="400" height="20" fill="#9a9c95"/><path d="M200 20v34" stroke="#2b3440" stroke-width="2"/><circle class="glow" cx="200" cy="62" r="34" fill="#ffe9a8" opacity=".35"/><circle cx="200" cy="60" r="9" fill="#ffe9a8"/>
      <rect x="18" y="60" width="90" height="8" fill="#7a522a"/><rect x="18" y="118" width="90" height="8" fill="#7a522a"/>
      <rect x="26" y="40" width="22" height="20" rx="2" fill="#e0533d"/><rect x="56" y="44" width="16" height="16" rx="2" fill="#2f9e4f"/><rect x="78" y="48" width="24" height="12" rx="2" fill="#6b7885"/>
      <rect x="26" y="98" width="30" height="20" rx="2" fill="#c9d2da"/><circle class="led" cx="31" cy="103" r="1.6" fill="#3fd46b"/><rect x="62" y="98" width="30" height="20" rx="2" fill="#c9d2da"/><circle class="led2" cx="67" cy="103" r="1.6" fill="#3fd46b"/>
      <rect x="290" y="40" width="92" height="120" rx="3" fill="#9aa6b1"/><path d="M290 64h92M290 88h92M290 112h92M290 136h92" stroke="#7d8892" stroke-width="3"/>
      <rect x="0" y="232" width="400" height="68" fill="#8d8f8a"/><path d="M0 232h400" stroke="#777973" stroke-width="3"/>
      <path d="M40 300c30-40 90-50 140-62s120-6 190 10" stroke="#2b3440" stroke-width="4" fill="none"/><path d="M60 300c40-30 120-40 200-30" stroke="#e0533d" stroke-width="3" fill="none"/>
      <rect x="312" y="200" width="56" height="36" rx="3" fill="#e0533d"/><rect x="312" y="200" width="56" height="9" rx="3" fill="#b44d2c"/>`,
    farm: `${sky('g-farm', '#ffd59a', '#f7a46b')}
      <circle cx="320" cy="96" r="34" fill="#ffe9a8" opacity=".9"/>
      <path d="M0 170c60-30 130-34 200-16s140 10 200-12v158H0z" fill="#7fbf6a"/><path d="M0 200c80-20 160-18 240-4s110 6 160-8v112H0z" fill="#5fa654"/>
      <path d="M30 120v80M110 112v82M190 118v74M270 110v84M350 116v80" stroke="#5b4636" stroke-width="3"/><path d="M30 126C70 140 70 140 110 118M110 118c40 14 40 14 80 6M190 124c40 10 40 10 80-8M270 116c40 12 40 12 80 6" stroke="#2b3440" stroke-width="1.3" fill="none"/>
      <g><path d="M40 208l14-14h86l14 14z" fill="#4a5662"/><rect x="40" y="208" width="114" height="44" fill="#6b7885"/>
      <rect class="win" x="50" y="220" width="16" height="12" fill="#ffd36b"/><rect class="win" x="76" y="220" width="16" height="12" fill="#ffd36b"/><rect class="win" x="102" y="220" width="16" height="12" fill="#ffd36b"/><rect class="win" x="128" y="220" width="16" height="12" fill="#ffd36b"/></g>
      <g><path d="M232 214l12-12h104l12 12z" fill="#4a5662"/><rect x="232" y="214" width="128" height="40" fill="#6b7885"/>
      <rect class="win" x="242" y="224" width="16" height="12" fill="#ffd36b"/><rect class="win" x="268" y="224" width="16" height="12" fill="#ffd36b"/><rect class="win" x="308" y="224" width="16" height="12" fill="#ffd36b"/><rect class="win" x="334" y="224" width="16" height="12" fill="#ffd36b"/></g>
      <rect x="0" y="262" width="400" height="38" fill="#4f8f46"/>`,
    swamp: `${sky('g-sw', '#a8dccb', '#5fa79e')}
      <g class="steam"><circle cx="300" cy="44" r="20" fill="#f2f5f4" opacity=".9"/><circle cx="322" cy="30" r="16" fill="#f2f5f4" opacity=".85"/><circle cx="282" cy="28" r="13" fill="#f2f5f4" opacity=".8"/></g>
      <path d="M268 170c6-34 6-70 0-104h60c-6 34-6 70 0 104z" fill="#dfe6ec"/><path d="M270 140h56" stroke="#2f9e4f" stroke-width="8"/>
      <rect x="336" y="110" width="54" height="60" fill="#8a96a0"/><path class="glow" d="M364 84l-16 26h12l-7 20 20-28h-12l8-18z" fill="#f6bb60"/>
      <path d="M0 160c50-10 120-8 170 0s140 6 230-4v144H0z" fill="#4f8a5c"/><rect x="0" y="196" width="400" height="104" fill="#3f7f78"/>
      <path d="M0 212c40 4 80-4 120 0s80 6 120 0s100-6 160 2" stroke="#5fa79e" stroke-width="2" fill="none"/>
      ${pad(46, 238, 20, 8, '#2f9e4f')}${pad(150, 262, 24, 9, '#3fae5d')}${pad(330, 250, 22, 8, '#2f9e4f')}
      <path d="M14 196c2-30 4-50 0-70M22 196c4-24 8-40 10-56M380 196c-2-26-6-44-2-64M388 196c2-20 4-36 0-50" stroke="#2c6b3a" stroke-width="3" fill="none"/>
      <ellipse cx="30" cy="132" rx="3" ry="9" fill="#6b4a2a"/><ellipse cx="377" cy="136" rx="3" ry="9" fill="#6b4a2a"/>
      ${stars(10, 21, 190, '#fff4a0').replace(/<circle /g, '<circle opacity=".9" ')}`,
    falls: `${sky('g-fa', '#bfe6ff', '#e9f6ff')}
      <path d="M0 140l60-70 50 50 60-80 70 90 60-60 100 90v180H0z" fill="#9ab3c4"/><path d="M150 42l20-2 14 18-18-6z" fill="#fff"/>
      <path d="M0 300V120h150l10 180z" fill="#7b6650"/><path d="M0 120h150v14H0z" fill="#3fae5d"/>
      <rect x="146" y="124" width="50" height="160" fill="#5fb6ea"/><path class="flow" d="M156 124v160M170 124v160M184 124v160" stroke="#e3f5ff" stroke-width="3" stroke-dasharray="12 14"/>
      <path d="M120 300c10-30 40-40 80-40s90 12 200 6v34z" fill="#5fb6ea"/><path class="flow" d="M150 280c40-6 80-6 120 0s80 4 130-2" stroke="#e3f5ff" stroke-width="2" fill="none" stroke-dasharray="10 12"/>
      <path d="M240 240h120v-46h-120z" fill="#dfe6ec"/><path d="M234 194l66-26 66 26z" fill="#8a96a0"/><rect x="262" y="210" width="18" height="18" fill="#ffd36b"/><rect x="316" y="210" width="18" height="18" fill="#ffd36b"/>
      <path d="M220 170l-14 34h28zM372 160l-16 40h32zM392 176l-12 30h24z" fill="#2f9e4f"/><path d="M220 204v10M372 200v10M392 206v8" stroke="#6b4a2a" stroke-width="3"/>`,
    moon: `${sky('g-mo', '#060a18', '#151d36')}${stars(46, 5, 190)}
      <circle cx="318" cy="70" r="30" fill="#3a7bd5"/><path d="M300 56c10 4 14 14 8 22s4 14 12 10M326 46c-2 10 8 14 14 12M318 96c6-6 14-4 20-10" stroke="#3fae5d" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M0 214c70-26 160-30 230-16s110 8 170-4v106H0z" fill="#9aa6b1"/><path d="M0 248c90-14 200-12 400 2v50H0z" fill="#b6c0c9"/>
      <ellipse cx="80" cy="262" rx="26" ry="6" fill="#8a96a0"/><ellipse cx="300" cy="276" rx="34" ry="7" fill="#8a96a0"/><ellipse cx="190" cy="232" rx="14" ry="4" fill="#8a96a0"/>
      <path d="M262 236a42 42 0 0184 0z" fill="#dfe6ec"/><path d="M304 194v42M276 210c6 8 6 18 4 26M332 210c-6 8-6 18-4 26" stroke="#9aa6b1" stroke-width="2" fill="none"/>
      <path d="M48 230v-40" stroke="#6b7885" stroke-width="3"/><path d="M34 178a18 18 0 0028 20z" fill="#c9d2da"/><circle class="led" cx="56" cy="186" r="3" fill="#e0533d"/>`,
    pond: `${sky('g-po', '#0b1a33', '#1c3558')}${stars(36, 13, 150)}
      <path d="M58 52a24 24 0 1030 30a28 28 0 01-30-30z" fill="#ffe9a8"/>
      <path d="M0 150c80-14 150-12 200-6s130 10 200-4v160H0z" fill="#16324f"/><ellipse cx="200" cy="232" rx="230" ry="70" fill="#1f4e74"/>
<ellipse cx="74" cy="214" rx="10" ry="30" fill="#ffe9a8" opacity=".15"/>
      ${[[60, 200], [140, 250], [230, 214], [320, 248], [370, 206], [110, 280], [270, 284], [190, 262]].map(([x, y], i) =>
        `${pad(x, y, 20, 7, i % 2 ? '#3fae5d' : '#2f9e4f')}<circle class="${i % 2 ? 'led2' : 'led'}" cx="${x}" cy="${y - 2}" r="3" fill="#8ff0a4"/>`).join('')}
      <path d="M60 198L140 248L230 212L320 246L370 204M140 248L110 278M230 212L190 260L270 282" stroke="#ffd36b" stroke-width="1.4" fill="none" stroke-dasharray="4 5" opacity=".7"/>`,
    mars: `${sky('g-ma', '#f2b07a', '#e07a4a')}
      <circle cx="80" cy="60" r="10" fill="#c9a58a"/><circle cx="320" cy="40" r="6" fill="#d8bba3"/>
      <path d="M0 170c60-24 130-28 200-12s140 12 200-6v148H0z" fill="#c4562f"/><path d="M0 222c100-26 220-24 400-6v84H0z" fill="#d9663f"/>
      <ellipse cx="300" cy="266" rx="40" ry="8" fill="#b44d2c"/><ellipse cx="70" cy="252" rx="22" ry="5" fill="#b44d2c"/>
      <path d="M180 226a40 40 0 0180 0z" fill="#efe6dc"/><path d="M220 186v40" stroke="#c9b8a8" stroke-width="2"/><rect x="200" y="210" width="12" height="10" fill="#7fd0ff"/>
      <path d="M300 226v-50" stroke="#6b7885" stroke-width="3"/><path d="M286 168a18 18 0 0028 20z" fill="#efe6dc"/><circle class="led" cx="308" cy="174" r="3" fill="#3fd46b"/>
      <path d="M100 232h50l6-12h-62z" fill="#8a96a0"/><circle cx="108" cy="236" r="6" fill="#2b3440"/><circle cx="142" cy="236" r="6" fill="#2b3440"/>`,
  };
  // which stage a mine gets, by the most advanced machine owned
  const SCENE_FOR = { laptop: 'room', pc: 'room', rig: 'room', asic: 'garage', garage: 'garage', farm: 'farm', plant: 'swamp', dc: 'swamp', hydro: 'falls', moon: 'moon', pond: 'pond', mars: 'mars' };
  // the first stage (room) is the owner's picture, the others are drawn above
  const PICTURE_SCENES = { room: 'img/miner/scene-room.webp' };
  const scene = (id) => PICTURE_SCENES[id] ? `<img src="${PICTURE_SCENES[id]}" alt="" class="scene-pic">` : `<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${SCENES[id] || SCENES.room}</svg>`;

  window.MINER_ART = { icon, scene, SCENE_FOR };
})();

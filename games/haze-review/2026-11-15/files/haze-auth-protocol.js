// Shared, dependency-free sign-in protocol. This never creates a transaction.
export const AUTH_VERSION = 'haze-auth-v1';
export const AUTH_NETWORK = 'pepecoin-mainnet';
export const AUTH_PURPOSE = 'Sign in to TokenPrinter Lagoon';
export const HUB_ORIGIN = 'https://pepecoinhub.com';
export const HUB_PURPOSE = 'Link Haze Wallet to PepecoinHub';
export const AUTH_MAX_TTL_MS = 300_000;
export const AUTH_CLOCK_SKEW_MS = 30_000;
export const AUTH_CHALLENGE_FIELDS = Object.freeze(['version', 'audience', 'nonce', 'issuedAt', 'expiresAt', 'network', 'purpose']);
const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function failure(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function exactOrigin(value) {
  if (typeof value !== 'string' || value.length > 2048) throw failure('invalid_haze_challenge', 'The sign-in origin is invalid.');
  let url;
  try { url = new URL(value); } catch { throw failure('invalid_haze_challenge', 'The sign-in origin is invalid.'); }
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.origin !== value || url.username || url.password || (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback))) {
    throw failure('invalid_haze_challenge', 'Sign-in requires an exact HTTPS or local loopback origin.');
  }
  return value;
}

function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    throw failure('invalid_haze_challenge', 'The sign-in time is invalid.');
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== value) throw failure('invalid_haze_challenge', 'The sign-in time is invalid.');
  return parsed;
}

function challengeShape(challenge) {
  if (!challenge || typeof challenge !== 'object' || Array.isArray(challenge)) throw failure('invalid_haze_challenge', 'The sign-in request is invalid.');
  const keys = Reflect.ownKeys(challenge);
  if (keys.length !== AUTH_CHALLENGE_FIELDS.length || keys.some(key => !AUTH_CHALLENGE_FIELDS.includes(key))) {
    throw failure('invalid_haze_challenge', 'The sign-in request contains unsupported fields.');
  }
  const purpose = challenge.audience === HUB_ORIGIN ? HUB_PURPOSE : AUTH_PURPOSE;
  if (challenge.version !== AUTH_VERSION || challenge.network !== AUTH_NETWORK || challenge.purpose !== purpose || typeof challenge.nonce !== 'string' || !/^[0-9a-f]{64}$/.test(challenge.nonce)) {
    throw failure('invalid_haze_challenge', 'The sign-in request does not match this protocol.');
  }
  exactOrigin(challenge.audience);
  const issued = timestamp(challenge.issuedAt);
  const expires = timestamp(challenge.expiresAt);
  if (expires <= issued || expires - issued > AUTH_MAX_TTL_MS) throw failure('invalid_haze_challenge', 'The sign-in request lifetime is invalid.');
  return Object.freeze(Object.fromEntries(AUTH_CHALLENGE_FIELDS.map(key => [key, challenge[key]])));
}

export function validateChallenge(challenge, { origin, now = Date.now() } = {}) {
  const value = challengeShape(challenge);
  if (value.audience !== exactOrigin(origin)) throw failure('haze_audience_mismatch', 'This sign-in request belongs to another site.');
  if (!Number.isSafeInteger(now)) throw failure('invalid_haze_challenge', 'The sign-in clock is invalid.');
  if (Date.parse(value.issuedAt) > now + AUTH_CLOCK_SKEW_MS) throw failure('invalid_haze_challenge', 'The sign-in request was issued in the future.');
  if (Date.parse(value.expiresAt) <= now) throw failure('haze_challenge_expired', 'This sign-in request has expired. Start again.');
  return value;
}

function addressShape(address) {
  // Shape/version only. Signer and verifier independently derive the full
  // Base58Check address from the public key, including its checksum.
  if (typeof address !== 'string' || !/^P[1-9A-HJ-NP-Za-km-z]{33}$/.test(address)) throw failure('invalid_haze_address', 'A Pepecoin mainnet P2PKH address is required.');
  let number = 0n;
  for (const char of address) number = number * 58n + BigInt(BASE58.indexOf(char));
  const bytes = [];
  while (number > 0n) { bytes.unshift(Number(number & 255n)); number >>= 8n; }
  if (bytes.length !== 25 || bytes[0] !== 0x38) throw failure('invalid_haze_address', 'A Pepecoin mainnet P2PKH address is required.');
  return address;
}

export function authMessage(challenge, address) {
  // Formatting is independent of the current clock so all runtimes sign the
  // same bytes. Call validateChallenge with the trusted caller origin first.
  const value = challengeShape(challenge);
  addressShape(address);
  return [
    value.purpose === HUB_PURPOSE ? 'PepecoinHub wallet link' : 'TokenPrinter Lagoon sign-in',
    '',
    value.purpose,
    '',
    `Audience: ${value.audience}`,
    `Address: ${address}`,
    `Network: ${AUTH_NETWORK}`,
    `Nonce: ${value.nonce}`,
    `Issued at: ${value.issuedAt}`,
    `Expires at: ${value.expiresAt}`,
    `Version: ${AUTH_VERSION}`,
    '',
    'This signature only proves control of this address. It does not authorize a transaction.',
  ].join('\n');
}

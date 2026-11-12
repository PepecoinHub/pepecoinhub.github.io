// flip-verify: the endpoint Flipsuite (Flippy) calls for a PondOS custom quest task.
// Docs: https://docs.flipsuite.xyz/quests/tasks/custom
//
// Flipsuite POSTs { community, quest, task, user: { discord: { id }, wallets: [...] } } with our secret in the
// Authorization header. We answer 200 = "yes, earned it" (Flipsuite pays from the reward wallet) or
// 400 + message = "no" (the message is shown to the fren). Must answer within 30 s.
//
// Which stamp a quest checks comes from the URL: .../functions/v1/flip-verify?badge=pond_pioneer
// Only stamps listed in ALLOWED can be used, so a wrong URL can never pay out for something we did not plan.
//
// Settings (Supabase > Edge Functions > flip-verify):
//   - secret FLIP_SECRET = the same long random string you paste in the Flipsuite quest task
//   - "Verify JWT" OFF (Flipsuite does not send a Supabase login; our own secret protects the endpoint)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

const ALLOWED: Record<string, string> = {
  pond_pioneer: 'Pond Pioneer',
};

const SECRET = Deno.env.get('FLIP_SECRET') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

// constant-time compare, so the secret cannot be guessed letter by letter from response times
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { message: 'POST only.' });

  // Flipsuite's docs do not say whether a "Bearer " prefix is added, so accept both, but match exactly.
  const auth = (req.headers.get('authorization') ?? '').trim().replace(/^Bearer\s+/i, '');
  if (SECRET.length < 24 || !same(auth, SECRET)) return json(401, { message: 'Bad secret.' });

  const badge = new URL(req.url).searchParams.get('badge') ?? '';
  const name = ALLOWED[badge];
  if (!name) return json(400, { message: 'This quest is not set up correctly. Ping Byl on Discord.' });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { message: 'Bad request.' }); }

  const discordId = String(body?.user?.discord?.id ?? '');
  if (!/^\d{15,22}$/.test(discordId)) {
    return json(400, { message: 'Link your Discord account in Flipsuite first.' });
  }

  const r = await fetch(SB_URL + '/rest/v1/rpc/flip_has_badge', {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_discord_id: discordId, p_badge: badge }),
  });
  if (!r.ok) {
    console.error('flip_has_badge failed', r.status, await r.text());
    return json(400, { message: 'PondOS could not check right now. Try again in a minute.' });
  }
  const s = await r.json();

  if (!s?.linked) {
    return json(400, { message: 'Log on to PondOS with this Discord account first: pepecoinhub.com/meme' });
  }
  if (!s?.has) {
    return json(400, { message: `No ${name} stamp in your PondOS passport yet.` });
  }

  const wallet = (Array.isArray(body?.user?.wallets) ? body.user.wallets : [])
    .find((w: any) => w?.chain === 'Pepecoin');
  console.log('ok', badge, discordId, body?.quest?.id ?? '');
  return json(200, { verificationData: { badge, earnedAt: s.earned_at, pep: wallet?.address ?? null } });
});

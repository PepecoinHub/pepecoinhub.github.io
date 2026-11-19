// push-send (handler part; index.ts is GENERATED from webpush.mjs + this file by scripts/build_push_function.py)
// sends PondOS notifications (mentions, Byl's @everyone, a new Gazette issue, challenges).
// See games/supabase/update_push.sql for the whole picture and functions/push-send/README.md for setup.
//
// The database rings this function (pg_net) with our own secret every time it queues a note. The function
// takes the waiting notes (push_take), encrypts each one for each subscribed device and hands it to that
// device's push service, then reports devices that are gone (push_report).
//
// Settings (Supabase > Edge Functions > push-send > Secrets):
//   PUSH_SECRET        long random text, the same as games.push_config.fn_secret
//   VAPID_PUBLIC_KEY   public push key (the same as games.push_config.vapid_public)
//   VAPID_PRIVATE_KEY  PRIVATE push key: only here, never in the database, the site or a chat
//   "Verify JWT" OFF (the database does not send a Supabase login; PUSH_SECRET protects the endpoint)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

const SECRET = Deno.env.get('PUSH_SECRET') ?? '';
const VAPID = {
  publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
  privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
  subject: 'https://pepecoinhub.com/meme/',
};
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function same(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  if (x.length !== y.length) return false;
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
async function rpc(name: string, args: unknown) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + name, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(name + ' ' + r.status + ' ' + (await r.text()).slice(0, 200));
  return r.json();
}

type Sub = { endpoint: string; p256dh: string; auth: string };
type Job = { id: number; kind: string; note: Record<string, string>; to: Sub[] };

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST only' });
  if (SECRET.length < 24 || !same(req.headers.get('x-push-secret') ?? '', SECRET)) return json(401, { error: 'bad secret' });
  if (!VAPID.publicKey || !VAPID.privateKey) return json(500, { error: 'VAPID keys are not set' });

  let sent = 0;
  const gone: string[] = [], failed: string[] = [];
  // a few rounds, so a burst (e.g. 3 mentions at once) goes out in one ring
  for (let round = 0; round < 5; round++) {
    const jobs: Job[] = await rpc('push_take', { p_limit: 20 });
    if (!jobs.length) break;
    for (const job of jobs) {
      const subs = job.to.filter((s) => allowedEndpoint(s.endpoint));
      // 10 devices at a time: fast, but gentle with the push services
      for (let i = 0; i < subs.length; i += 10) {
        await Promise.all(subs.slice(i, i + 10).map(async (s) => {
          try {
            const st = await sendPush(s, job.note, { ...VAPID, urgency: job.kind === 'mention' ? 'high' : 'normal' });
            if (st === 404 || st === 410) gone.push(s.endpoint);
            else if (st >= 400) failed.push(s.endpoint);
            else sent++;
          } catch {
            failed.push(s.endpoint);
          }
        }));
      }
    }
  }
  if (gone.length || failed.length) await rpc('push_report', { p_gone: gone, p_failed: failed });
  return json(200, { sent, gone: gone.length, failed: failed.length });
});

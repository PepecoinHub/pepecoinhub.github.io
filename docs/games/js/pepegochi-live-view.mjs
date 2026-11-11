// PEPEGOCHI.EXE, the real game: everything the live window shows, without the DOM, so tests can play it.
//
// It talks to the server through one function, rpc(name, args) -> Promise<full state> (backend.rpc in the browser,
// a fake in tests). The server owns time, needs and growth (games/PEPEGOCHI_API.md): this file only shows the last
// full state, moved on by the time that passed since the server sent it. Every response is a full state, so there
// is no extra read after an action, no polling and no Realtime.
import { buildView, COPY, ACTION_NAME, msOf } from './pepegochi-beta-view.mjs';

export const SIGNIN_RE = /Discord sign-in required|not authenticated|JWT|Not signed in|permission denied/i;
export const LIVE_COPY = {
  signinTitle: 'PEPEGOCHI.EXE needs Discord',
  signinText: 'Your frog lives on the server and belongs to your Discord account, so it is the same frog on every device. Log on with Discord to adopt one.',
  loading: 'Opening PEPEGOCHI.EXE…',
  hatched: 'Crack! It hatched. Say hi to your tadpole.',
  offline:'The pond server can\'t be reached right now. Your frog is fine; try again in a minute.',
};
// re-read the state when the tab comes back after this long (the API: "after a long break")
export const STALE_MS = 5 * 6e4;

export class LiveGame {
  constructor({ rpc, clock = () => Date.now() } = {}) {
    this.rpc = rpc;
    this.clock = clock;
    this.last = null;        // last full state
    this.serverAt = 0;       // its server_now (ms)
    this.localAt = 0;        // our clock when it arrived
    this.signin = false;
    this.error = '';
    this.message = '';
    this.letterOpen = false;
    this.busy = false;
    this.room = null;
    this.roomError = '';
  }
  get now() { return this.serverAt + (this.clock() - this.localAt); }
  get stale() { return !this.last || this.clock() - this.localAt > STALE_MS; }

  async call(name, args = {}) {
    this.busy = true;
    try {
      const v = await this.rpc(name, args);
      this.last = v; this.serverAt = msOf(v.server_now); this.localAt = this.clock();
      this.signin = false; this.error = '';
      return { ok: true, value: v };
    } catch (e) {
      const m = (e && e.message) || String(e);
      if (SIGNIN_RE.test(m)) { this.signin = true; return { ok: false, error: m }; }
      if (e && e.offline) this.error = LIVE_COPY.offline;
      return { ok: false, error: m };
    } finally { this.busy = false; }
  }
  refresh() { return this.call('gry_pepegochi_state'); }

  async adopt(name) {
    const r = await this.call('gry_pepegochi_adopt', { p_name: String(name || '').trim() });
    if (!r.ok) this.message = r.error;
    else if (r.value.adopt_result === 'read_the_letter_first') this.message = COPY.readFirst;
    else if (r.value.adopt_result === 'adopted') { this.message = r.value.pet.generation > 1 ? COPY.readopted : COPY.adopted; this.letterOpen = false; }
    else this.message = '';
    return r;
  }
  async act(kind) {
    const before = this.last && this.last.pet ? this.last.pet.stage : null;
    const r = await this.call('gry_pepegochi_action', { p_action: kind });
    if (!r.ok) this.message = r.error;
    else if (r.value.action_result === 'moved_out') this.message = COPY.departed;
    else if (before === 'egg' && r.value.pet && r.value.pet.stage !== 'egg') this.message = LIVE_COPY.hatched;
    else this.message = ACTION_NAME[kind] ? `${ACTION_NAME[kind]}: done.` : '';
    return r;
  }
  async readLetter() {
    const r = await this.call('gry_pepegochi_letter_read');
    this.letterOpen = r.ok && r.value.pet?.status === 'departed';
    this.message = this.letterOpen ? COPY.afterLetter : (r.ok ? '' : r.error);
    return r;
  }
  closeLetter() { this.letterOpen = false; }

  // ---------- the room (update_pepegochi_room_v1.sql): the account's decorations and where they stand ----------
  async roomCall(name, args = {}) {
    try {
      this.room = await this.rpc(name, args);
      this.roomError = '';
      return true;
    } catch (e) {
      const m = (e && e.message) || String(e);
      if (/ROOM_REVISION_CONFLICT/.test(m)) { await this.loadRoom(); this.roomError = 'The room changed in another tab. Here it is now.'; }
      else this.roomError = m;
      return false;
    }
  }
  // read the room; the first time a frog is home, unpack the starter furniture
  async loadRoom() {
    const ok = await this.roomCall('gry_pepegochi_room_state');
    const p = this.last && this.last.pet;
    if (ok && this.room && !this.room.initialized && p && p.status !== 'departed') await this.roomCall('gry_pepegochi_room_initialize');
    return this.room;
  }
  place(instanceId, slotId) { return this.roomCall('gry_pepegochi_room_place', { p_item_instance_id: instanceId, p_slot_id: slotId, p_expected_revision: this.room.revision }); }
  unplace(slotId) { return this.roomCall('gry_pepegochi_room_unplace', { p_slot_id: slotId, p_expected_revision: this.room.revision }); }
  // slot -> item_id, for the room picture (null: not loaded, the window shows the starter room)
  placements() {
    if (!this.room || !this.room.initialized) return null;
    const byId = Object.fromEntries(this.room.inventory.map(i => [i.item_instance_id, i.item_id]));
    return Object.fromEntries(this.room.placements.map(p => [p.slot_id, byId[p.item_instance_id]]).filter(x => x[1]));
  }
  // what the Decorate panel lists: every owned item, where it stands, and the slots it fits
  decor() {
    if (!this.room || !this.room.initialized) return null;
    const at = Object.fromEntries(this.room.placements.map(p => [p.item_instance_id, p.slot_id]));
    const label = Object.fromEntries(this.room.slots.map(s => [s.slot_id, s.label]));
    return this.room.inventory.map(i => ({
      id: i.item_instance_id, item: i.item_id, name: i.display_name, slot: at[i.item_instance_id] || null,
      slotLabel: at[i.item_instance_id] ? label[at[i.item_instance_id]] : 'In the box',
      fits: this.room.slots.filter(s => s.allowed_categories.includes(i.category)).map(s => ({ id: s.slot_id, label: s.label })),
    }));
  }

  view() {
    if (this.signin) return { mode: 'signin', signin: { title: LIVE_COPY.signinTitle, text: LIVE_COPY.signinText } };
    if (!this.last) return { mode: 'loading', message: this.error || LIVE_COPY.loading };
    const v = buildView(this.last, this.now, { message: this.error || this.message, letterOpen: this.letterOpen, live: true });
    if (v.pet && v.pet.stage === 'egg') v.pet.statusText = 'An egg! Give it its first care and it hatches.';
    return v;
  }
}

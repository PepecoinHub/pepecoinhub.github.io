import type { KV } from '../src/server/arena.js';

// In-memory stand-in for Devvit Redis. Every call yields once so concurrent
// requests interleave the way they do against a real network store.
export class FakeKV implements KV {
  strings = new Map<string, string>();
  hashes = new Map<string, Map<string, string>>();
  zsets = new Map<string, Map<string, number>>();

  private h(key: string) {
    let m = this.hashes.get(key);
    if (!m) this.hashes.set(key, (m = new Map()));
    return m;
  }
  private z(key: string) {
    let m = this.zsets.get(key);
    if (!m) this.zsets.set(key, (m = new Map()));
    return m;
  }
  private tick = () => new Promise<void>((r) => setImmediate(r));

  async get(key: string) { await this.tick(); return this.strings.get(key); }
  async set(key: string, value: string) { await this.tick(); this.strings.set(key, value); return 'OK'; }
  async hGet(key: string, field: string) { await this.tick(); return this.hashes.get(key)?.get(field); }
  async hGetAll(key: string) { await this.tick(); return Object.fromEntries(this.hashes.get(key) ?? []); }
  async hMGet(key: string, fields: string[]) { await this.tick(); return fields.map((f) => this.hashes.get(key)?.get(f) ?? null); }
  async hSet(key: string, fv: { [f: string]: string }) { await this.tick(); for (const [f, v] of Object.entries(fv)) this.h(key).set(f, v); return Object.keys(fv).length; }
  async hSetNX(key: string, field: string, value: string) {
    await this.tick();
    const m = this.h(key);
    if (m.has(field)) return 0;
    m.set(field, value);
    return 1;
  }
  async hIncrBy(key: string, field: string, n: number) { await this.tick(); const m = this.h(key); const v = Number(m.get(field) ?? 0) + n; m.set(field, String(v)); return v; }
  async hDel(key: string, fields: string[]) { await this.tick(); let n = 0; for (const f of fields) if (this.hashes.get(key)?.delete(f)) n++; return n; }
  async zAdd(key: string, ...members: { member: string; score: number }[]) { await this.tick(); let n = 0; for (const m of members) { if (!this.z(key).has(m.member)) n++; this.z(key).set(m.member, m.score); } return n; }
  async zRem(key: string, members: string[]) { await this.tick(); let n = 0; for (const m of members) if (this.zsets.get(key)?.delete(m)) n++; return n; }
  async zIncrBy(key: string, member: string, n: number) { await this.tick(); const m = this.z(key); const v = (m.get(member) ?? 0) + n; m.set(member, v); return v; }
  async zRange(key: string, start: number | string, stop: number | string, o?: { by: 'rank' | 'score' | 'lex'; reverse?: boolean }) {
    await this.tick();
    const rows = [...(this.zsets.get(key) ?? [])].map(([member, score]) => ({ member, score })).sort((a, b) => a.score - b.score || a.member.localeCompare(b.member));
    if (o?.reverse) rows.reverse();
    return rows.slice(Number(start), Number(stop) + 1);
  }
  async expire() { await this.tick(); }

  zsetSize(key: string) { return this.zsets.get(key)?.size ?? 0; }
}

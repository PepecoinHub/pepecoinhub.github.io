import type { KV } from './rounds.js';

/**
 * Puts every key under a prefix that a moderator can change. A reset just switches to a new,
 * empty prefix, so there is nothing to enumerate or delete. The old data is left unused.
 * An empty prefix (the default) keeps the keys exactly as they were.
 */
export function withEpoch(raw: KV, getPrefix: () => Promise<string>): KV {
  const k = async (key: string) => (await getPrefix()) + key;
  return {
    get: async (key) => raw.get(await k(key)),
    set: async (key, value) => raw.set(await k(key), value),
    hGet: async (key, field) => raw.hGet(await k(key), field),
    hGetAll: async (key) => raw.hGetAll(await k(key)),
    hMGet: async (key, fields) => raw.hMGet(await k(key), fields),
    hSet: async (key, fv) => raw.hSet(await k(key), fv),
    hSetNX: async (key, field, value) => raw.hSetNX(await k(key), field, value),
    hIncrBy: async (key, field, n) => raw.hIncrBy(await k(key), field, n),
    hDel: async (key, fields) => raw.hDel(await k(key), fields),
    hLen: async (key) => raw.hLen(await k(key)),
    zIncrBy: async (key, member, n) => raw.zIncrBy(await k(key), member, n),
    zScore: async (key, member) => raw.zScore(await k(key), member),
    zCard: async (key) => raw.zCard(await k(key)),
    zRank: async (key, member) => raw.zRank(await k(key), member),
    zRange: async (key, start, stop, options) => raw.zRange(await k(key), start, stop, options),
  };
}

/** Reads the prefix from storage at most every few seconds. */
export function cachedPrefix(read: () => Promise<string | undefined>, ttlMs = 3000) {
  let value = '';
  let at = 0;
  return {
    get: async () => {
      if (Date.now() - at > ttlMs) {
        value = (await read()) ?? '';
        at = Date.now();
      }
      return value;
    },
    set: (v: string) => {
      value = v;
      at = Date.now();
    },
  };
}

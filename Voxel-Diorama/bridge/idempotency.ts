// Idempotency-key ledger for write requests proxied to Paperclip.
//
// Contract: repeat requests carrying the same key must hit upstream at most
// once and reproduce the first response. Connection-level failures (no
// upstream response at all) are never cached — they don't count as "the
// first result", so a retry with the same key must still reach upstream.

export interface CachedResponse {
  status: number;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_MAX_ENTRIES = 500;

interface DoneEntry {
  response: CachedResponse;
  at: number;
}

export class IdempotencyStore {
  private pending = new Map<string, Promise<CachedResponse>>();
  private done = new Map<string, DoneEntry>();
  private ttlMs: number;
  private maxEntries: number;

  constructor(ttlMs = DEFAULT_TTL_MS, maxEntries = DEFAULT_MAX_ENTRIES) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  /** Existing result/in-flight wait for `key`, or undefined if this is a new key. */
  claim(key: string): Promise<CachedResponse> | undefined {
    const cached = this.done.get(key);
    if (cached) {
      if (Date.now() - cached.at > this.ttlMs) {
        this.done.delete(key);
      } else {
        return Promise.resolve(cached.response);
      }
    }
    return this.pending.get(key);
  }

  /** Registers `key` as in-flight. Caller must settle exactly once. */
  begin(key: string): { resolve(r: CachedResponse): void; reject(e: unknown): void } {
    let resolveFn!: (r: CachedResponse) => void;
    let rejectFn!: (e: unknown) => void;
    const wait = new Promise<CachedResponse>((res, rej) => {
      resolveFn = res;
      rejectFn = rej;
    });
    // Rejections only matter to concurrent claimers; without this, a reject
    // with no waiter trips Node's unhandledRejection guard.
    wait.catch(() => {});
    this.pending.set(key, wait);
    return {
      resolve: (r) => {
        this.done.set(key, { response: r, at: Date.now() });
        // ponytail: `done` is a Map, so insertion order == iteration order —
        // evicting `.keys().next()` on overflow is a plain TTL+max-entries
        // cap, not a real LRU. Upgrade only if reused outside this dev proxy.
        if (this.done.size > this.maxEntries) {
          const oldestKey = this.done.keys().next().value;
          if (oldestKey !== undefined) this.done.delete(oldestKey);
        }
        this.pending.delete(key);
        resolveFn(r);
      },
      reject: (e) => {
        this.pending.delete(key);
        rejectFn(e);
      },
    };
  }
}

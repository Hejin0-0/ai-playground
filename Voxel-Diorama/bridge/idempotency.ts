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

export class IdempotencyStore {
  private pending = new Map<string, Promise<CachedResponse>>();
  private done = new Map<string, CachedResponse>();

  /** Existing result/in-flight wait for `key`, or undefined if this is a new key. */
  claim(key: string): Promise<CachedResponse> | undefined {
    const cached = this.done.get(key);
    if (cached) return Promise.resolve(cached);
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
        this.done.set(key, r);
        this.pending.delete(key);
        resolveFn(r);
      },
      // ponytail: no eviction/TTL on `done` — this store lives only as long
      // as the dev server process; add eviction if it's ever reused elsewhere.
      reject: (e) => {
        this.pending.delete(key);
        rejectFn(e);
      },
    };
  }
}

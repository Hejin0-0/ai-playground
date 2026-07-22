import assert from "node:assert/strict";
import { IdempotencyStore, type CachedResponse } from "./idempotency.ts";

async function repeatKeyReplaysFirstResultAndCallsUpstreamOnce() {
  const store = new IdempotencyStore();
  let upstreamCalls = 0;

  async function handle(key: string): Promise<CachedResponse> {
    const existing = store.claim(key);
    if (existing) return existing;
    const settle = store.begin(key);
    upstreamCalls++;
    const response: CachedResponse = { status: 201, headers: {}, body: Buffer.from("created") };
    settle.resolve(response);
    return response;
  }

  const first = await handle("key-a");
  const second = await handle("key-a");
  assert.equal(upstreamCalls, 1);
  assert.equal(second.body.toString(), first.body.toString());
  assert.equal(second.status, 201);
}

async function concurrentDuplicatesDedupeToOneUpstreamCall() {
  const store = new IdempotencyStore();
  let upstreamCalls = 0;

  async function handle(key: string): Promise<CachedResponse> {
    const existing = store.claim(key);
    if (existing) return existing;
    const settle = store.begin(key);
    upstreamCalls++;
    await new Promise((r) => setTimeout(r, 10));
    const response: CachedResponse = { status: 200, headers: {}, body: Buffer.from("ok") };
    settle.resolve(response);
    return response;
  }

  const [a, b, c] = await Promise.all([handle("key-b"), handle("key-b"), handle("key-b")]);
  assert.equal(upstreamCalls, 1);
  assert.equal(a.body.toString(), "ok");
  assert.equal(b.body.toString(), "ok");
  assert.equal(c.body.toString(), "ok");
}

async function connectionFailureIsNotCachedAndAllowsRetry() {
  const store = new IdempotencyStore();
  let upstreamCalls = 0;

  async function handleFailingThenSucceeding(key: string): Promise<CachedResponse> {
    const existing = store.claim(key);
    if (existing) return existing;
    const settle = store.begin(key);
    upstreamCalls++;
    if (upstreamCalls === 1) {
      const err = new Error("upstream_unreachable");
      settle.reject(err);
      throw err;
    }
    const response: CachedResponse = { status: 200, headers: {}, body: Buffer.from("second try ok") };
    settle.resolve(response);
    return response;
  }

  await assert.rejects(() => handleFailingThenSucceeding("key-c"));
  const retried = await handleFailingThenSucceeding("key-c");
  assert.equal(upstreamCalls, 2, "a connection failure must not block a real retry");
  assert.equal(retried.body.toString(), "second try ok");
}

async function differentKeysAreIndependent() {
  const store = new IdempotencyStore();
  assert.equal(store.claim("x"), undefined);
  const settle = store.begin("x");
  settle.resolve({ status: 200, headers: {}, body: Buffer.from("x") });
  assert.equal(store.claim("y"), undefined);
}

await repeatKeyReplaysFirstResultAndCallsUpstreamOnce();
await concurrentDuplicatesDedupeToOneUpstreamCall();
await connectionFailureIsNotCachedAndAllowsRetry();
await differentKeysAreIndependent();
console.log("idempotency.test.ts: all checks passed");

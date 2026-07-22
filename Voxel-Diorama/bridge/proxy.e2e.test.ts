// End-to-end coverage for the Vite<->Paperclip proxy contract (PLAN.md §4.2).
// Runs a real mock upstream + a real Vite dev server (via `vite`'s `createServer`,
// loading the committed vite.config.ts for the primary scenarios) and drives it
// with real HTTP requests. Store-only unit coverage lives in idempotency.test.ts;
// this file exists because a store mock alone can't catch native-proxy wiring
// regressions (host bind, timeout config, Origin/key enforcement order).

import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { paperclipProxy } from "./paperclipProxy.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

function request(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: options.method ?? "GET", headers: options.headers },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }),
        );
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}

// Grabs a port and immediately frees it — used both to pin each test's dev
// server to a real (collision-free) port instead of Vite's 5173 auto-scan,
// and to build a target guaranteed to refuse connections.
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (!addr || typeof addr === "string") return reject(new Error("no port"));
      srv.close(() => resolve(addr.port));
    });
  });
}

function startMockUpstream(): Promise<{ url: string; counts: Record<string, number>; close(): Promise<void> }> {
  const counts: Record<string, number> = {};
  const server = http.createServer((req, res) => {
    const pathname = (req.url ?? "/").split("?")[0];
    if (pathname === "/slow") {
      setTimeout(() => res.writeHead(200).end("slow ok"), 2000);
      return;
    }
    counts[pathname] = (counts[pathname] ?? 0) + 1;
    const body = JSON.stringify({ path: pathname, method: req.method, query: req.url, count: counts[pathname] });
    res.writeHead(req.method === "GET" ? 200 : 201, { "content-type": "application/json" }).end(body);
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") throw new Error("no port");
      resolve({
        url: `http://127.0.0.1:${addr.port}`,
        counts,
        close: () => new Promise((r) => server.close(() => r())),
      });
    });
  });
}

async function primaryScenarios() {
  const upstream = await startMockUpstream();
  const prevTarget = process.env.PAPERCLIP_PROXY_TARGET;
  process.env.PAPERCLIP_PROXY_TARGET = upstream.url;

  const server = await createViteServer({
    root: ROOT,
    configFile: path.join(ROOT, "vite.config.ts"),
    server: { port: await freePort(), strictPort: true },
  });
  await server.listen();
  process.env.PAPERCLIP_PROXY_TARGET = prevTarget;

  try {
    // #4 — vite.config.ts binds the dev server to 127.0.0.1 explicitly.
    assert.equal(server.config.server.host, "127.0.0.1", "server.host must be pinned to 127.0.0.1");

    const addr = server.httpServer?.address();
    if (!addr || typeof addr === "string") throw new Error("dev server has no address");
    const base = `http://127.0.0.1:${addr.port}`;
    const origin = base;

    // Query preservation through Vite's native proxy (reads, no idempotency involved).
    const read = await request(`${base}/api/tasks?status=open`);
    assert.equal(read.status, 200);
    const readBody = JSON.parse(read.body);
    assert.equal(readBody.method, "GET");
    assert.equal(readBody.query, "/api/tasks?status=open");

    // #2 — write without Idempotency-Key is rejected at the boundary, upstream untouched.
    const beforeNoKey = upstream.counts["/api/tasks"] ?? 0;
    const noKey = await request(`${base}/api/tasks`, { method: "POST", headers: { origin } });
    assert.equal(noKey.status, 400);
    assert.equal(upstream.counts["/api/tasks"] ?? 0, beforeNoKey, "upstream must not be called without a key");

    // #3 — cross-origin write is rejected, upstream untouched.
    const beforeCrossOrigin = upstream.counts["/api/tasks"] ?? 0;
    const crossOrigin = await request(`${base}/api/tasks`, {
      method: "POST",
      headers: { origin: "http://evil.example", "idempotency-key": "k1" },
    });
    assert.equal(crossOrigin.status, 403);
    assert.equal(
      upstream.counts["/api/tasks"] ?? 0,
      beforeCrossOrigin,
      "upstream must not be called for a cross-origin write",
    );

    // Idempotency: repeat key on the same endpoint hits upstream once and replays.
    const beforeRepeat = upstream.counts["/api/tasks"] ?? 0;
    const first = await request(`${base}/api/tasks`, {
      method: "POST",
      headers: { origin, "idempotency-key": "shared-key" },
    });
    const second = await request(`${base}/api/tasks`, {
      method: "POST",
      headers: { origin, "idempotency-key": "shared-key" },
    });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(second.body, first.body, "repeat key must replay the first response verbatim");
    assert.equal(
      (upstream.counts["/api/tasks"] ?? 0) - beforeRepeat,
      1,
      "upstream must be called exactly once for a repeated key",
    );

    // #6 — same key value reused against a different endpoint must not replay /tasks's response.
    const other = await request(`${base}/api/other`, {
      method: "POST",
      headers: { origin, "idempotency-key": "shared-key" },
    });
    assert.equal(other.status, 201);
    assert.notEqual(other.body, first.body, "same key on a different path must not replay the other path's response");
    assert.equal(upstream.counts["/api/other"], 1, "the different-path request must still reach upstream");

    // #3(err) — connection failure must not become a 2xx. Uses a standalone
    // dev server (inline plugin config, not the shared vite.config.ts) so it
    // doesn't contend with `server` for the default port.
    const deadPort = await freePort();
    const deadServer = await createViteServer({
      root: ROOT,
      configFile: false,
      server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
      plugins: [paperclipProxy({ prefix: "/api", target: `http://127.0.0.1:${deadPort}` })],
    });
    await deadServer.listen();
    try {
      const deadAddr = deadServer.httpServer?.address();
      if (!deadAddr || typeof deadAddr === "string") throw new Error("no address");
      const deadBase = `http://127.0.0.1:${deadAddr.port}`;
      const refused = await request(`${deadBase}/api/tasks`, {
        method: "POST",
        headers: { origin: deadBase, "idempotency-key": "k-refused" },
      });
      assert.ok(refused.status >= 500, `connection failure must not report success, got ${refused.status}`);
      assert.notEqual(refused.status, 200);
    } finally {
      await deadServer.close();
    }
  } finally {
    await server.close();
    await upstream.close();
  }
}

// #1 — native-proxy path (reads / keyless — here exercised via a keyed write's
// upstream leg, which shares the same `proxyTimeout` wiring) must not hang forever.
async function upstreamTimeoutReturns504() {
  const slowUpstream = http.createServer((_req, res) => {
    setTimeout(() => res.writeHead(200).end("too slow"), 2000);
  });
  await new Promise<void>((resolve) => slowUpstream.listen(0, "127.0.0.1", resolve));
  const addr = slowUpstream.address();
  if (!addr || typeof addr === "string") throw new Error("no address");

  const server = await createViteServer({
    root: ROOT,
    configFile: false,
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [paperclipProxy({ prefix: "/api", target: `http://127.0.0.1:${addr.port}`, timeoutMs: 200 })],
  });
  await server.listen();
  try {
    const devAddr = server.httpServer?.address();
    if (!devAddr || typeof devAddr === "string") throw new Error("no address");
    const base = `http://127.0.0.1:${devAddr.port}`;

    // Keyed write: goes through our own forwardToUpstream() timeout.
    const writeStarted = Date.now();
    const writeRes = await request(`${base}/api/slow`, {
      method: "POST",
      headers: { origin: base, "idempotency-key": "slow-key" },
    });
    const writeElapsed = Date.now() - writeStarted;
    assert.equal(writeRes.status, 504);
    assert.ok(writeElapsed < 2000, `write path must not wait for the full upstream delay, took ${writeElapsed}ms`);

    // Read: goes through Vite's native `server.proxy`, exercising the new proxyTimeout config.
    const readStarted = Date.now();
    const readRes = await request(`${base}/api/slow`);
    const readElapsed = Date.now() - readStarted;
    assert.equal(readRes.status, 504, "native-proxy reads must also honor the timeout, not hang");
    assert.ok(readElapsed < 2000, `native-proxy path must not wait for the full upstream delay, took ${readElapsed}ms`);
  } finally {
    await server.close();
    await new Promise((r) => slowUpstream.close(r));
  }
}

// VOX-17 QA rejection #1 — Origin must match scheme+host+port as a full
// tuple, not just host. A same-host Origin with the wrong scheme (e.g.
// `https://` against a plain-http dev server) must still be rejected.
async function crossSchemeOriginIsRejectedDespiteMatchingHost() {
  const upstream = await startMockUpstream();
  const server = await createViteServer({
    root: ROOT,
    configFile: false,
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [paperclipProxy({ prefix: "/api", target: upstream.url })],
  });
  await server.listen();
  try {
    const addr = server.httpServer?.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const base = `http://127.0.0.1:${addr.port}`;
    const spoofedOrigin = `https://127.0.0.1:${addr.port}`; // same host:port, wrong scheme

    const beforeCount = upstream.counts["/api/tasks"] ?? 0;
    const res = await request(`${base}/api/tasks`, {
      method: "POST",
      headers: { origin: spoofedOrigin, "idempotency-key": "scheme-mismatch" },
    });
    assert.equal(res.status, 403, `same-host but wrong-scheme Origin must be rejected, got ${res.status}`);
    assert.equal(upstream.counts["/api/tasks"] ?? 0, beforeCount, "upstream must not be called for a scheme mismatch");
  } finally {
    await server.close();
    await upstream.close();
  }
}

// VOX-17 QA rejection #2 — ledger key must be collision-proof under
// arbitrary path/key content, not a delimited string concatenation.
// path=/api/collision-a::b + key=c must not collide with
// path=/api/collision-a + key=b::c.
async function ledgerKeyEncodingPreventsPathKeyCollision() {
  const upstream = await startMockUpstream();
  const server = await createViteServer({
    root: ROOT,
    configFile: false,
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [paperclipProxy({ prefix: "/api", target: upstream.url })],
  });
  await server.listen();
  try {
    const addr = server.httpServer?.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const base = `http://127.0.0.1:${addr.port}`;
    const origin = base;

    const first = await request(`${base}/api/collision-a::b`, {
      method: "POST",
      headers: { origin, "idempotency-key": "c" },
    });
    const second = await request(`${base}/api/collision-a`, {
      method: "POST",
      headers: { origin, "idempotency-key": "b::c" },
    });

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.notEqual(
      second.body,
      first.body,
      "colliding delimited keys must not replay each other's cached response",
    );
    assert.equal(upstream.counts["/api/collision-a"], 1, "the second, distinct (path,key) pair must still reach upstream");
  } finally {
    await server.close();
    await upstream.close();
  }
}

// VOX-17 QA rejection #3 — a write whose declared Content-Length never
// arrives must not leave its idempotency key permanently claimed. It must
// fail within the configured deadline, and a fresh request with the same
// key must then be free to reach upstream.
async function partialBodyReleasesPendingClaimInsteadOfHangingForever() {
  const upstream = await startMockUpstream();
  const server = await createViteServer({
    root: ROOT,
    configFile: false,
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [paperclipProxy({ prefix: "/api", target: upstream.url, timeoutMs: 200 })],
  });
  await server.listen();
  try {
    const addr = server.httpServer?.address();
    if (!addr || typeof addr === "string") throw new Error("no address");
    const base = `http://127.0.0.1:${addr.port}`;

    const partial = await new Promise<Reply>((resolve, reject) => {
      const req = http.request(
        `${base}/api/tasks`,
        {
          method: "POST",
          headers: {
            origin: base,
            "idempotency-key": "partial-key",
            "content-type": "application/json",
            "content-length": "100",
          },
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(c));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString() }));
        },
      );
      req.on("error", reject);
      req.write(Buffer.from('{"partial":true'));
      // Deliberately never call req.end() — declared 100 bytes, sent fewer.
    });
    assert.ok(
      partial.status >= 400,
      `a body that never completes must fail within the deadline, not hang forever, got ${partial.status}`,
    );

    const retry = await request(`${base}/api/tasks`, {
      method: "POST",
      headers: { origin: base, "idempotency-key": "partial-key" },
    });
    assert.equal(
      retry.status,
      201,
      "same key retried after a partial-body failure must still reach upstream, not be stuck behind a stale pending claim",
    );
  } finally {
    await server.close();
    await upstream.close();
  }
}

await primaryScenarios();
await upstreamTimeoutReturns504();
await crossSchemeOriginIsRejectedDespiteMatchingHost();
await ledgerKeyEncodingPreventsPathKeyCollision();
await partialBodyReleasesPendingClaimInsteadOfHangingForever();
console.log("proxy.e2e.test.ts: all checks passed");

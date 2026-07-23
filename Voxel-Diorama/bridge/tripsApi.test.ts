import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { createServer as createViteServer, type ViteDevServer } from "vite";
import { WorldStateStore, type FsOps } from "../src/state/worldStateStore.ts";
import { tripsApi } from "./tripsApi.ts";

interface Reply {
  status: number;
  body: string;
}

function request(url: string, key: string, body: string): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: "POST",
        headers: {
          origin: new URL(url).origin,
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "idempotency-key": key,
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
      },
    );
    req.on("error", reject);
    req.end(body);
  });
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") return reject(new Error("no port"));
      server.close(() => resolve(address.port));
    });
  });
}

async function startPaperclip() {
  const payloads: unknown[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      payloads.push(JSON.parse(Buffer.concat(chunks).toString()));
      res.writeHead(201, { "content-type": "application/json" }).end(
        JSON.stringify({ id: `issue-${payloads.length}`, identifier: `VOX-${payloads.length}` }),
      );
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return {
    url: `http://127.0.0.1:${address.port}`,
    payloads,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

async function startApi(target: string, store: WorldStateStore): Promise<{ base: string; server: ViteDevServer }> {
  const server = await createViteServer({
    configFile: false,
    optimizeDeps: { noDiscovery: true },
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [tripsApi({ target, companyId: "company-1", store })],
  });
  await server.listen();
  const address = server.httpServer?.address();
  if (!address || typeof address === "string") throw new Error("no address");
  return { base: `http://127.0.0.1:${address.port}`, server };
}

async function withTempDir(run: (dir: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "trips-api-"));
  try {
    await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function validRequestCreatesOneRootAndPersistsOneTrip() {
  await withTempDir(async (dir) => {
    const paperclip = await startPaperclip();
    const file = path.join(dir, "world-state.json");
    let mainCommits = 0;
    const rename: FsOps["rename"] = async (from, to) => {
      if (to === file) mainCommits += 1;
      await fs.rename(from, to);
    };
    const store = new WorldStateStore(file, { rename });
    const api = await startApi(paperclip.url, store);

    try {
      const first = await request(`${api.base}/api/trips`, "trip-key", JSON.stringify({ title: "첫 여행" }));
      const replay = await request(
        `${api.base}/api/trips`,
        "trip-key",
        JSON.stringify({ title: "무시되어야 할 다른 본문" }),
      );

      assert.equal(first.status, 201);
      assert.deepEqual(replay, first, "the same key must replay the first status and body");
      assert.equal(paperclip.payloads.length, 1, "Paperclip must receive exactly one root issue");
      assert.deepEqual(paperclip.payloads[0], {
        title: "첫 여행",
        status: "backlog",
        priority: "medium",
        idempotencyKey: "trip:trip-key",
      });
      assert.equal(mainCommits, 1, "one accepted trip must commit world-state exactly once");

      const trip = JSON.parse(first.body);
      const restartedState = await new WorldStateStore(file).load();
      assert.deepEqual(restartedState?.activeTrip, trip, "a restarted store must load the created trip");
      assert.equal(trip.id, "issue-1");
      assert.equal(trip.rootIssueId, "issue-1");
      assert.equal(trip.themeId, "base");
      assert.equal(trip.active, true);
      assert.ok(!Number.isNaN(Date.parse(trip.startedAt)), "startedAt must be an ISO date");
    } finally {
      await api.server.close();
      await paperclip.close();
    }
  });
}

async function fourXxResponsesLeaveWorldStateByteIdentical() {
  await withTempDir(async (dir) => {
    const paperclip = await startPaperclip();
    const file = path.join(dir, "world-state.json");
    const initial = '{\n  "schemaVersion": 1,\n  "activeTrip": null,\n  "lifetimeScore": 0,\n  "archives": []\n}';
    await fs.writeFile(file, initial, "utf8");
    const api = await startApi(paperclip.url, new WorldStateStore(file));

    try {
      const invalid = await request(`${api.base}/api/trips`, "invalid-key", '{"title":');
      assert.equal(invalid.status, 400);
      assert.deepEqual(JSON.parse(invalid.body), {
        error: "invalid_request",
        message: "body must be JSON with a non-empty title",
      });
      assert.equal(await fs.readFile(file, "utf8"), initial);
      assert.equal(paperclip.payloads.length, 0);
    } finally {
      await api.server.close();
      await paperclip.close();
    }
  });
}

async function concurrentStartsStillCreateOnlyOneActiveTrip() {
  await withTempDir(async (dir) => {
    const paperclip = await startPaperclip();
    const file = path.join(dir, "world-state.json");
    const api = await startApi(paperclip.url, new WorldStateStore(file));

    try {
      const replies = await Promise.all([
        request(`${api.base}/api/trips`, "concurrent-a", JSON.stringify({ title: "A" })),
        request(`${api.base}/api/trips`, "concurrent-b", JSON.stringify({ title: "B" })),
      ]);
      assert.deepEqual(replies.map(({ status }) => status).sort(), [201, 409]);
      assert.equal(paperclip.payloads.length, 1, "the active-trip check and creation must be serialized");

      const before = await fs.readFile(file, "utf8");
      const conflict = await request(`${api.base}/api/trips`, "another-key", JSON.stringify({ title: "C" }));
      assert.equal(conflict.status, 409);
      assert.equal(await fs.readFile(file, "utf8"), before, "409 must not mutate world-state");
    } finally {
      await api.server.close();
      await paperclip.close();
    }
  });
}

await validRequestCreatesOneRootAndPersistsOneTrip();
await fourXxResponsesLeaveWorldStateByteIdentical();
await concurrentStartsStillCreateOnlyOneActiveTrip();
console.log("tripsApi.test.ts: all checks passed");

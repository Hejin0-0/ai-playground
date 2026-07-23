import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import { paperclipProxy } from "./paperclipProxy.ts";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

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

function request(
  url: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {},
) {
  return new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(url, { method: options.method, headers: options.headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
    });
    req.on("error", reject);
    req.end(options.body);
  });
}

async function bodyOf(req: http.IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}

async function reviewMapsToTheLinkedPendingApproval() {
  const calls: Array<{ method: string; path: string; body: string }> = [];
  const upstream = http.createServer(async (req, res) => {
    const requestBody = await bodyOf(req);
    const requestPath = req.url ?? "/";
    calls.push({ method: req.method ?? "", path: requestPath, body: requestBody });

    const issueMatch = requestPath.match(/^\/api\/issues\/([^/]+)\/approvals$/);
    if (req.method === "GET" && issueMatch) {
      const issueId = issueMatch[1];
      if (issueId === "no-approval") {
        res.writeHead(200, { "content-type": "application/json" }).end("[]");
        return;
      }
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(JSON.stringify([{ id: `approval-${issueId}`, status: "pending" }]));
      return;
    }

    const decisionMatch = requestPath.match(/^\/api\/approvals\/([^/]+)\/(approve|reject)$/);
    if (req.method === "POST" && decisionMatch) {
      res
        .writeHead(200, { "content-type": "application/json" })
        .end(
          JSON.stringify({
            id: decisionMatch[1],
            type: "request_board_approval",
            status: decisionMatch[2] === "approve" ? "approved" : "rejected",
            decisionNote: JSON.parse(requestBody).decisionNote,
            createdAt: "2026-07-23T03:50:30.452Z",
          }),
        );
      return;
    }

    res.writeHead(404, { "content-type": "application/json" }).end('{"message":"unexpected upstream path"}');
  });
  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.address();
  if (!upstreamAddress || typeof upstreamAddress === "string") throw new Error("no upstream address");

  const vite = await createViteServer({
    root: ROOT,
    optimizeDeps: { noDiscovery: true },
    configFile: false,
    server: { host: "127.0.0.1", port: await freePort(), strictPort: true },
    plugins: [
      paperclipProxy({
        prefix: "/api",
        target: `http://127.0.0.1:${upstreamAddress.port}`,
      }),
    ],
  });
  await vite.listen();

  try {
    const address = vite.httpServer?.address();
    if (!address || typeof address === "string") throw new Error("no Vite address");
    const base = `http://127.0.0.1:${address.port}`;
    const headers = {
      origin: base,
      "content-type": "application/json",
      "idempotency-key": "reject-once",
    };
    const body = JSON.stringify({ decision: "reject", reason: "테스트가 실패했습니다." });

    const first = await request(`${base}/api/tasks/task-14/review`, { method: "POST", headers, body });
    const duplicate = await request(`${base}/api/tasks/task-14/review`, { method: "POST", headers, body });
    assert.equal(first.status, 200);
    assert.equal(duplicate.body, first.body);
    assert.deepEqual(JSON.parse(first.body), {
      id: "approval-task-14",
      type: "request_board_approval",
      status: "rejected",
      decisionNote: "테스트가 실패했습니다.",
      createdAt: "2026-07-23T03:50:30.452Z",
    });
    assert.equal(
      calls.filter(({ path }) => path === "/api/issues/task-14/approvals").length,
      1,
      "중복 검수 요청은 approval 조회도 한 번만 수행해야 합니다.",
    );
    const rejectionCalls = calls.filter(({ path }) => path === "/api/approvals/approval-task-14/reject");
    assert.equal(rejectionCalls.length, 1);
    assert.deepEqual(JSON.parse(rejectionCalls[0]?.body ?? ""), {
      decisionNote: "테스트가 실패했습니다.",
    });
    assert.equal(calls.some(({ path }) => path === "/api/tasks/task-14/review"), false);

    const approved = await request(`${base}/api/tasks/task-15/review`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "approve-once" },
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.equal(approved.status, 200);
    assert.equal(calls.filter(({ path }) => path === "/api/approvals/approval-task-15/approve").length, 1);

    const missingReason = await request(`${base}/api/tasks/task-16/review`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "missing-reason" },
      body: JSON.stringify({ decision: "reject", reason: "   " }),
    });
    assert.equal(missingReason.status, 400);
    assert.equal(calls.some(({ path }) => path === "/api/issues/task-16/approvals"), false);

    const noApproval = await request(`${base}/api/tasks/no-approval/review`, {
      method: "POST",
      headers: { ...headers, "idempotency-key": "no-approval" },
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.equal(noApproval.status, 409);
    assert.match(noApproval.body, /linked_pending_approval_not_found/);
  } finally {
    await vite.close();
    await new Promise<void>((resolve) => upstream.close(() => resolve()));
  }
}

await reviewMapsToTheLinkedPendingApproval();
console.log("reviewProxy.e2e.test.ts: all checks passed");

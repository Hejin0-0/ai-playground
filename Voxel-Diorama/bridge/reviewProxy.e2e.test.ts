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

// A stateful upstream stub, not canned per-path responses: real Paperclip
// state (issue status, approval status) mutates as calls come in, and later
// calls in the same scenario observe those mutations. This is deliberate —
// VOX-26's first attempt shipped tests where every assertion was evaluated
// against a single fixed response, so a proxy that no-ops the state change
// but echoes back a plausible-looking body still passed. Round-tripping
// through a second GET/second decision is what catches that class of bug.
interface StubIssue {
  id: string;
  companyId: string;
  status: string;
}
interface StubApproval {
  id: string;
  issueId: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  decisionNote: string | null;
}

function createStubUpstream(opts: { issues: StubIssue[]; failIssuePatch?: Set<string> }) {
  const calls: Array<{ method: string; path: string; body: string }> = [];
  const issues = new Map(opts.issues.map((issue) => [issue.id, { ...issue }]));
  const approvals = new Map<string, StubApproval>();
  let nextApprovalId = 1;

  const server = http.createServer(async (req, res) => {
    const requestBody = await bodyOf(req);
    const requestPath = req.url ?? "/";
    calls.push({ method: req.method ?? "", path: requestPath, body: requestBody });

    const json = (status: number, value: unknown) =>
      res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(value));

    const listMatch = requestPath.match(/^\/api\/issues\/([^/]+)\/approvals$/);
    if (req.method === "GET" && listMatch) {
      const issueId = listMatch[1];
      const linked = [...approvals.values()].filter((a) => a.issueId === issueId);
      return json(200, linked);
    }

    const issueMatch = requestPath.match(/^\/api\/issues\/([^/]+)$/);
    if (req.method === "GET" && issueMatch) {
      const issue = issues.get(issueMatch[1]);
      if (!issue) return json(404, { message: "no such issue" });
      return json(200, issue);
    }
    if (req.method === "PATCH" && issueMatch) {
      const issueId = issueMatch[1];
      const issue = issues.get(issueId);
      if (!issue) return json(404, { message: "no such issue" });
      if (opts.failIssuePatch?.has(issueId)) {
        return json(500, { message: "simulated upstream failure patching issue status" });
      }
      const patch = JSON.parse(requestBody) as { status?: string };
      if (patch.status) issue.status = patch.status;
      return json(200, issue);
    }

    const createMatch = requestPath.match(/^\/api\/companies\/([^/]+)\/approvals$/);
    if (req.method === "POST" && createMatch) {
      const payload = JSON.parse(requestBody) as { type?: string; payload?: unknown; issueIds?: string[] };
      if (payload.type !== "request_board_approval" || !payload.payload) {
        return json(400, { message: "invalid governance approval request" });
      }
      const issueId = payload.issueIds?.[0];
      const id = `created-approval-${nextApprovalId++}`;
      const approval: StubApproval = { id, issueId: issueId ?? "", status: "pending", decisionNote: null };
      approvals.set(id, approval);
      return json(201, approval);
    }

    const decisionMatch = requestPath.match(/^\/api\/approvals\/([^/]+)\/(approve|reject|request-revision)$/);
    if (req.method === "POST" && decisionMatch) {
      const [, approvalId, action] = decisionMatch;
      const approval = approvals.get(approvalId);
      if (!approval) return json(404, { message: "no such approval" });
      const decisionBody = JSON.parse(requestBody) as { decisionNote?: string | null };
      approval.status =
        action === "approve" ? "approved" : action === "reject" ? "rejected" : "revision_requested";
      approval.decisionNote = decisionBody.decisionNote ?? null;
      return json(200, {
        id: approval.id,
        type: "request_board_approval",
        status: approval.status,
        decisionNote: approval.decisionNote,
        createdAt: "2026-07-23T03:50:30.452Z",
      });
    }

    res.writeHead(404, { "content-type": "application/json" }).end('{"message":"unexpected upstream path"}');
  });

  return { server, calls, issues, approvals };
}

async function withProxy<T>(
  upstream: ReturnType<typeof createStubUpstream>,
  fn: (base: string) => Promise<T>,
): Promise<T> {
  await new Promise<void>((resolve) => upstream.server.listen(0, "127.0.0.1", resolve));
  const upstreamAddress = upstream.server.address();
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
    return await fn(`http://127.0.0.1:${address.port}`);
  } finally {
    await vite.close();
    await new Promise<void>((resolve) => upstream.server.close(() => resolve()));
  }
}

function reviewHeaders(base: string, idempotencyKey: string) {
  return {
    origin: base,
    "content-type": "application/json",
    "idempotency-key": idempotencyKey,
  };
}

// C1 + C4: an issue in_review with zero linked approvals must not 409 —
// it must create the missing governance approval (companyId derived from
// GET /api/issues/{id}, not a config knob) and carry the decision through.
// Verified across the round trip: the approval actually exists upstream
// afterward and the issue's status actually changed, not just that the
// immediate HTTP response body looked right.
async function c1CreatesApprovalWhenNoneLinked() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-c1", companyId: "company-77", status: "in_review" }],
  });
  await withProxy(upstream, async (base) => {
    const headers = reviewHeaders(base, "c1-approve");
    const res = await request(`${base}/api/tasks/task-c1/review`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.body}`);
    assert.notEqual(JSON.parse(res.body).status, undefined);

    const createCalls = upstream.calls.filter((c) => c.path === "/api/companies/company-77/approvals");
    assert.equal(createCalls.length, 1, "must create exactly one governance approval, derived from the issue's companyId");
    assert.deepEqual(JSON.parse(createCalls[0].body).issueIds, ["task-c1"]);

    // Round trip: re-fetch upstream state instead of trusting the cached response body.
    const created = [...upstream.approvals.values()].find((a) => a.issueId === "task-c1");
    assert.ok(created, "approval must actually exist upstream after the call, not just in the response");
    assert.equal(created?.status, "approved");
    assert.equal(upstream.issues.get("task-c1")?.status, "done", "issue must actually transition upstream");
  });
}

// C2: a pre-existing pending approval must be reused, not duplicated —
// checked by asserting the create endpoint was never called and only one
// approval exists for the issue after the decision.
async function c2ReusesExistingPendingApproval() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-c2", companyId: "company-1", status: "in_review" }],
  });
  upstream.approvals.set("approval-c2", {
    id: "approval-c2",
    issueId: "task-c2",
    status: "pending",
    decisionNote: null,
  });
  await withProxy(upstream, async (base) => {
    const headers = reviewHeaders(base, "c2-reject");
    const res = await request(`${base}/api/tasks/task-c2/review`, {
      method: "POST",
      headers,
      body: JSON.stringify({ decision: "reject", reason: "재작업 필요" }),
    });
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.body}`);

    const createCalls = upstream.calls.filter((c) => c.path.match(/^\/api\/companies\/.+\/approvals$/));
    assert.equal(createCalls.length, 0, "an existing pending approval must be reused, never re-created");
    assert.equal(
      [...upstream.approvals.values()].filter((a) => a.issueId === "task-c2").length,
      1,
      "no duplicate approval should exist for the issue",
    );
    assert.equal(upstream.approvals.get("approval-c2")?.status, "rejected");
    assert.equal(upstream.issues.get("task-c2")?.status, "todo");
  });
}

// C3: approve -> done, reject -> todo, request_changes -> no transition at
// all (no PATCH call issued). Each checked against actual upstream issue
// state after the round trip, and request_changes is checked by asserting
// the issue's status is untouched from its pre-decision value.
async function c3StatusTransitionsMatchDecision() {
  const upstream = createStubUpstream({
    issues: [
      { id: "task-c3-approve", companyId: "company-1", status: "in_review" },
      { id: "task-c3-reject", companyId: "company-1", status: "in_review" },
      { id: "task-c3-changes", companyId: "company-1", status: "in_review" },
    ],
  });
  await withProxy(upstream, async (base) => {
    await request(`${base}/api/tasks/task-c3-approve/review`, {
      method: "POST",
      headers: reviewHeaders(base, "c3-approve"),
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.equal(upstream.issues.get("task-c3-approve")?.status, "done");

    await request(`${base}/api/tasks/task-c3-reject/review`, {
      method: "POST",
      headers: reviewHeaders(base, "c3-reject"),
      body: JSON.stringify({ decision: "reject", reason: "완료 조건 미충족" }),
    });
    assert.equal(upstream.issues.get("task-c3-reject")?.status, "todo");

    const changesRes = await request(`${base}/api/tasks/task-c3-changes/review`, {
      method: "POST",
      headers: reviewHeaders(base, "c3-changes"),
      body: JSON.stringify({ decision: "request_changes", reason: "마이너 조정 필요" }),
    });
    assert.equal(changesRes.status, 200);
    assert.equal(
      upstream.issues.get("task-c3-changes")?.status,
      "in_review",
      "request_changes must not transition issue status — it keeps the PlacementAttempt open (§3.4 규칙 6)",
    );
    const patchCalls = upstream.calls.filter(
      (c) => c.method === "PATCH" && c.path === "/api/issues/task-c3-changes",
    );
    assert.equal(patchCalls.length, 0, "request_changes must never issue a status PATCH");
  });
}

// C5: replaces the old "409 is correct" assertion — the same "no approval
// linked" scenario the old test used to prove 409 now must resolve to a
// completed decision instead.
async function c5NoLongerReturns409ForUnlinkedIssue() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-c5", companyId: "company-9", status: "in_review" }],
  });
  await withProxy(upstream, async (base) => {
    const res = await request(`${base}/api/tasks/task-c5/review`, {
      method: "POST",
      headers: reviewHeaders(base, "c5-approve"),
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.notEqual(res.status, 409, "linked_pending_approval_not_found must no longer be reachable via this path");
    assert.equal(res.status, 200, `expected 200, got ${res.status}: ${res.body}`);
  });
}

// C6: if the decision succeeds upstream but the follow-up status PATCH
// fails, the proxy must not silently answer 200 — that would tell the game
// the building/ruin was placed when Paperclip's real state still disagrees.
async function c6TransitionFailureIsNotSwallowed() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-c6", companyId: "company-1", status: "in_review" }],
    failIssuePatch: new Set(["task-c6"]),
  });
  await withProxy(upstream, async (base) => {
    const res = await request(`${base}/api/tasks/task-c6/review`, {
      method: "POST",
      headers: reviewHeaders(base, "c6-approve"),
      body: JSON.stringify({ decision: "approve", reason: "" }),
    });
    assert.notEqual(res.status, 200, "a failed status transition must not be reported as success");
    assert.match(res.body, /issue_transition_failed/);

    // The decision itself must still be visible upstream — this is a
    // reporting failure, not a rollback, so the approval really is approved.
    const approval = [...upstream.approvals.values()].find((a) => a.issueId === "task-c6");
    assert.equal(approval?.status, "approved");
    assert.equal(upstream.issues.get("task-c6")?.status, "in_review", "issue status was never actually able to transition");
  });
}

// Original idempotency-replay coverage, kept as-is but against the stateful
// stub: a repeated idempotency key must hit upstream at most once.
async function idempotentReplayHitsUpstreamOnce() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-14", companyId: "company-1", status: "in_review" }],
  });
  upstream.approvals.set("approval-task-14", {
    id: "approval-task-14",
    issueId: "task-14",
    status: "pending",
    decisionNote: null,
  });
  await withProxy(upstream, async (base) => {
    const headers = reviewHeaders(base, "reject-once");
    const body = JSON.stringify({ decision: "reject", reason: "테스트가 실패했습니다." });

    const first = await request(`${base}/api/tasks/task-14/review`, { method: "POST", headers, body });
    const duplicate = await request(`${base}/api/tasks/task-14/review`, { method: "POST", headers, body });
    assert.equal(first.status, 200);
    assert.equal(duplicate.body, first.body);
    assert.equal(
      upstream.calls.filter(({ path }) => path === "/api/issues/task-14/approvals").length,
      1,
      "중복 검수 요청은 approval 조회도 한 번만 수행해야 합니다.",
    );
    const rejectionCalls = upstream.calls.filter(({ path }) => path === "/api/approvals/approval-task-14/reject");
    assert.equal(rejectionCalls.length, 1);
    assert.deepEqual(JSON.parse(rejectionCalls[0]?.body ?? ""), {
      decisionNote: "테스트가 실패했습니다.",
    });
    assert.equal(upstream.calls.some(({ path }) => path === "/api/tasks/task-14/review"), false);
    const patchCalls = upstream.calls.filter((c) => c.method === "PATCH" && c.path === "/api/issues/task-14");
    assert.equal(patchCalls.length, 1, "the duplicate request must replay the cached response, not re-run the PATCH");
  });
}

async function missingReasonIsRejectedBeforeTouchingUpstream() {
  const upstream = createStubUpstream({
    issues: [{ id: "task-16", companyId: "company-1", status: "in_review" }],
  });
  await withProxy(upstream, async (base) => {
    const missingReason = await request(`${base}/api/tasks/task-16/review`, {
      method: "POST",
      headers: reviewHeaders(base, "missing-reason"),
      body: JSON.stringify({ decision: "reject", reason: "   " }),
    });
    assert.equal(missingReason.status, 400);
    assert.equal(upstream.calls.some(({ path }) => path === "/api/issues/task-16/approvals"), false);
  });
}

const scenarios: Array<[string, () => Promise<void>]> = [
  ["C1 creates approval when none linked", c1CreatesApprovalWhenNoneLinked],
  ["C2 reuses existing pending approval", c2ReusesExistingPendingApproval],
  ["C3 status transitions match decision", c3StatusTransitionsMatchDecision],
  ["C5 no longer returns 409 for unlinked issue", c5NoLongerReturns409ForUnlinkedIssue],
  ["C6 transition failure is not swallowed", c6TransitionFailureIsNotSwallowed],
  ["idempotent replay hits upstream once", idempotentReplayHitsUpstreamOnce],
  ["missing reason rejected before touching upstream", missingReasonIsRejectedBeforeTouchingUpstream],
];

for (const [name, run] of scenarios) {
  await run();
  console.log(`reviewProxy.e2e.test.ts: ${name} passed`);
}
console.log("reviewProxy.e2e.test.ts: all checks passed");

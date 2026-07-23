import assert from "node:assert/strict";
import {
  createEvidenceSubmitter,
  createReviewSubmitter,
  loadTaskEvidence,
  mergeEvidenceComment,
  type EvidenceComment,
} from "./review.ts";

function json(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const comment: EvidenceComment = {
  id: "comment-1",
  body: "커밋 0f09c14\n테스트 통과",
  authorType: "agent",
  createdAt: "2026-07-23T03:50:30.452Z",
};

async function evidenceAndMetadataLoadTogether() {
  const requested: string[] = [];
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    if (url.endsWith("/comments")) return json([comment]);
    if (url.endsWith("/runs")) {
      return json([
        {
          runId: "run-1",
          status: "succeeded",
          adapterType: "codex_local",
          startedAt: "2026-07-23T03:13:09.457Z",
          finishedAt: "2026-07-23T03:52:17.461Z",
        },
      ]);
    }
    if (url.endsWith("/cost-summary")) {
      return json({
        costCents: 0,
        inputTokens: 6120,
        cachedInputTokens: 171264,
        outputTokens: 1200,
        runCount: 3,
        runtimeMs: 2646644,
      });
    }
    if (url.endsWith("/approvals")) {
      return json([
        {
          id: "approval-1",
          type: "request_board_approval",
          status: "pending",
          decisionNote: null,
          createdAt: "2026-07-23T03:50:30.452Z",
        },
      ]);
    }
    throw new Error(`unexpected URL: ${url}`);
  };

  const evidence = await loadTaskEvidence(fetcher, "issue/14");
  assert.deepEqual(requested.sort(), [
    "/api/issues/issue%2F14/approvals",
    "/api/issues/issue%2F14/comments",
    "/api/issues/issue%2F14/cost-summary",
    "/api/issues/issue%2F14/runs",
  ]);
  assert.equal(evidence.comments[0]?.body, comment.body);
  assert.equal(evidence.runs[0]?.status, "succeeded");
  assert.equal(evidence.cost.inputTokens, 6120);
  assert.equal(evidence.approvals[0]?.status, "pending");
}

async function emptyEvidenceIsDistinctFromLoadFailure() {
  const emptyFetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/cost-summary")) {
      return json({
        costCents: 0,
        inputTokens: 0,
        outputTokens: 0,
        runCount: 0,
        runtimeMs: 0,
      });
    }
    return json([]);
  };
  const empty = await loadTaskEvidence(emptyFetcher, "issue-14");
  assert.deepEqual(empty.comments, []);
  assert.deepEqual(empty.runs, []);

  const failingFetcher = async (input: string | URL | Request) => {
    if (String(input).endsWith("/comments")) return json({ message: "Paperclip 오프라인" }, 503);
    return emptyFetcher(input);
  };
  await assert.rejects(
    () => loadTaskEvidence(failingFetcher, "issue-14"),
    /Paperclip 요청 실패 \(503\): Paperclip 오프라인/,
  );
}

async function evidenceSubmissionIsSingleAndRetrySafe() {
  let finish!: (response: Response) => void;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const fetcher = (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return new Promise<Response>((resolve) => {
      finish = resolve;
    });
  };
  const submitter = createEvidenceSubmitter(fetcher, "issue-14", () => "evidence-key");

  const first = submitter.submit("  커밋과 테스트 증거  ");
  const duplicate = submitter.submit("  커밋과 테스트 증거  ");
  assert.equal(first, duplicate, "동일한 진행 중 제출은 하나의 요청을 공유해야 합니다.");
  assert.equal(calls.length, 1);
  finish(json(comment, 201));
  const result = await first;
  assert.equal(result.ok, true);
  assert.equal(calls[0]?.url, "/api/issues/issue-14/comments");
  assert.equal(new Headers(calls[0]?.init?.headers).get("Idempotency-Key"), "evidence-key");
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), { body: "커밋과 테스트 증거" });
  assert.deepEqual(mergeEvidenceComment([comment], comment), [comment], "같은 댓글은 화면에 중복 반영하면 안 됩니다.");

  const keys: string[] = [];
  let attempt = 0;
  const retrying = createEvidenceSubmitter(
    async (_input, init) => {
      keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
      attempt += 1;
      if (attempt === 1) throw new Error("일시 오류");
      return json(comment, 201);
    },
    "issue-14",
    () => "stable-retry-key",
  );
  await assert.rejects(() => retrying.submit("재시도할 증거"), /일시 오류/);
  const retried = await retrying.submit("재시도할 증거");
  assert.equal(retried.ok, true);
  assert.deepEqual(keys, ["stable-retry-key", "stable-retry-key"]);
}

async function reviewRejectRequiresReasonAndRetriesWithOneKey() {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let attempt = 0;
  const submitter = createReviewSubmitter(
    async (input, init) => {
      calls.push({ url: String(input), init });
      attempt += 1;
      if (attempt === 1) throw new Error("브리지 일시 오류");
      return json({
        id: "approval-1",
        type: "request_board_approval",
        status: "rejected",
        decisionNote: "테스트 실패",
        createdAt: "2026-07-23T03:50:30.452Z",
      });
    },
    "issue-14",
    () => "review-key",
  );

  const invalid = await submitter.submit({ decision: "reject", reason: "   " });
  assert.deepEqual(invalid, { ok: false, error: "반려 사유를 입력하세요." });
  assert.equal(calls.length, 0, "반려 사유가 없으면 네트워크 요청을 보내면 안 됩니다.");

  await assert.rejects(
    () => submitter.submit({ decision: "reject", reason: "  테스트 실패  " }),
    /브리지 일시 오류/,
  );
  const retried = await submitter.submit({ decision: "reject", reason: "  테스트 실패  " });
  assert.equal(retried.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(
    calls.map(({ init }) => new Headers(init?.headers).get("Idempotency-Key")),
    ["review-key", "review-key"],
  );
  assert.equal(calls[1]?.url, "/api/tasks/issue-14/review");
  assert.deepEqual(JSON.parse(String(calls[1]?.init?.body)), {
    decision: "reject",
    reason: "테스트 실패",
  });
}

await evidenceAndMetadataLoadTogether();
await emptyEvidenceIsDistinctFromLoadFailure();
await evidenceSubmissionIsSingleAndRetrySafe();
await reviewRejectRequiresReasonAndRetriesWithOneKey();
console.log("review.test.ts: all checks passed");

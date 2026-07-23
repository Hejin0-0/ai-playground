export interface EvidenceComment {
  id: string;
  body: string;
  authorType: string;
  createdAt: string;
}

export interface EvidenceRun {
  runId: string;
  status: string;
  adapterType: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface CostSummary {
  costCents: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  runCount: number;
  runtimeMs: number;
}

export const APPROVAL_STATUSES = [
  "pending",
  "revision_requested",
  "approved",
  "rejected",
  "cancelled",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export interface TaskApproval {
  id: string;
  type: string;
  status: ApprovalStatus;
  decisionNote: string | null;
  createdAt: string;
}

export interface TaskEvidence {
  comments: EvidenceComment[];
  runs: EvidenceRun[];
  cost: CostSummary;
  approvals: TaskApproval[];
}

export type ReviewDecision = "approve" | "reject";
export interface ReviewRequest {
  decision: ReviewDecision;
  reason: string;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type EvidenceSubmitResult = { ok: true; comment: EvidenceComment } | { ok: false; error: string };
type ReviewSubmitResult = { ok: true; approval: TaskApproval } | { ok: false; error: string };

function issuePath(issueId: string, resource: string) {
  return `/api/issues/${encodeURIComponent(issueId)}/${resource}`;
}

async function expectJson(responseRequest: Response | Promise<Response>): Promise<unknown> {
  const response = await responseRequest;
  const data = await response.json().catch(() => undefined);
  if (!response.ok) {
    const detail =
      data && typeof data === "object" && "message" in data && typeof data.message === "string"
        ? `: ${data.message}`
        : "";
    throw new Error(`Paperclip 요청 실패 (${response.status})${detail}`);
  }
  return data;
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object") throw new Error(`${label} 응답 형식이 올바르지 않습니다.`);
  return value as Record<string, unknown>;
}

function parseComment(value: unknown): EvidenceComment {
  const item = record(value, "Paperclip 댓글");
  if (
    typeof item.id !== "string" ||
    typeof item.body !== "string" ||
    typeof item.authorType !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    throw new Error("Paperclip 댓글 응답 형식이 올바르지 않습니다.");
  }
  return {
    id: item.id,
    body: item.body,
    authorType: item.authorType,
    createdAt: item.createdAt,
  };
}

function parseRun(value: unknown): EvidenceRun {
  const item = record(value, "Paperclip 실행");
  if (
    typeof item.runId !== "string" ||
    typeof item.status !== "string" ||
    typeof item.adapterType !== "string" ||
    !(typeof item.startedAt === "string" || item.startedAt === null) ||
    !(typeof item.finishedAt === "string" || item.finishedAt === null)
  ) {
    throw new Error("Paperclip 실행 응답 형식이 올바르지 않습니다.");
  }
  return {
    runId: item.runId,
    status: item.status,
    adapterType: item.adapterType,
    startedAt: item.startedAt,
    finishedAt: item.finishedAt,
  };
}

function numberField(item: Record<string, unknown>, key: string, fallback?: number) {
  const value = item[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (fallback !== undefined && value === undefined) return fallback;
  throw new Error("Paperclip 비용 응답 형식이 올바르지 않습니다.");
}

function parseCost(value: unknown): CostSummary {
  const item = record(value, "Paperclip 비용");
  return {
    costCents: numberField(item, "costCents"),
    inputTokens: numberField(item, "inputTokens"),
    cachedInputTokens: numberField(item, "cachedInputTokens", 0),
    outputTokens: numberField(item, "outputTokens"),
    runCount: numberField(item, "runCount"),
    runtimeMs: numberField(item, "runtimeMs"),
  };
}

function parseApproval(value: unknown): TaskApproval {
  const item = record(value, "Paperclip 승인");
  if (
    typeof item.id !== "string" ||
    typeof item.type !== "string" ||
    !APPROVAL_STATUSES.includes(item.status as ApprovalStatus) ||
    !(typeof item.decisionNote === "string" || item.decisionNote === null) ||
    typeof item.createdAt !== "string"
  ) {
    throw new Error("Paperclip 승인 응답 형식이 올바르지 않습니다.");
  }
  return {
    id: item.id,
    type: item.type,
    status: item.status as ApprovalStatus,
    decisionNote: item.decisionNote,
    createdAt: item.createdAt,
  };
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T, label: string): T[] {
  if (!Array.isArray(value)) throw new Error(`${label} 목록 형식이 올바르지 않습니다.`);
  return value.map(parser);
}

export async function loadTaskEvidence(fetcher: Fetcher, issueId: string): Promise<TaskEvidence> {
  const [comments, runs, cost, approvals] = await Promise.all([
    expectJson(fetcher(issuePath(issueId, "comments"))),
    expectJson(fetcher(issuePath(issueId, "runs"))),
    expectJson(fetcher(issuePath(issueId, "cost-summary"))),
    expectJson(fetcher(issuePath(issueId, "approvals"))),
  ]);
  return {
    comments: parseArray(comments, parseComment, "Paperclip 댓글"),
    runs: parseArray(runs, parseRun, "Paperclip 실행"),
    cost: parseCost(cost),
    approvals: parseArray(approvals, parseApproval, "Paperclip 승인"),
  };
}

export function createEvidenceSubmitter(
  fetcher: Fetcher,
  issueId: string,
  makeKey: () => string = () => crypto.randomUUID(),
) {
  let retry: { fingerprint: string; key: string } | undefined;
  let inFlight: { fingerprint: string; promise: Promise<EvidenceSubmitResult> } | undefined;

  return {
    submit(body: string): Promise<EvidenceSubmitResult> {
      const normalized = body.trim();
      if (!normalized) return Promise.resolve({ ok: false, error: "증거를 입력하세요." });
      const fingerprint = normalized;
      if (inFlight) {
        if (inFlight.fingerprint === fingerprint) return inFlight.promise;
        return Promise.reject(new Error("다른 증거 제출이 진행 중입니다."));
      }
      if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: makeKey() };
      const key = retry.key;
      const request = (async (): Promise<EvidenceSubmitResult> => {
        const data = await expectJson(
          await fetcher(issuePath(issueId, "comments"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
            body: JSON.stringify({ body: normalized }),
          }),
        );
        const comment = parseComment(data);
        if (retry?.fingerprint === fingerprint) retry = undefined;
        return { ok: true, comment };
      })();
      const active = { fingerprint, promise: request };
      inFlight = active;
      request.then(
        () => {
          if (inFlight === active) inFlight = undefined;
        },
        () => {
          if (inFlight === active) inFlight = undefined;
        },
      );
      return request;
    },
  };
}

export function createReviewSubmitter(
  fetcher: Fetcher,
  issueId: string,
  makeKey: () => string = () => crypto.randomUUID(),
) {
  let retry: { fingerprint: string; key: string } | undefined;
  let inFlight: { fingerprint: string; promise: Promise<ReviewSubmitResult> } | undefined;

  return {
    submit(review: ReviewRequest): Promise<ReviewSubmitResult> {
      const requestBody = { decision: review.decision, reason: review.reason.trim() };
      if (requestBody.decision === "reject" && !requestBody.reason) {
        return Promise.resolve({ ok: false, error: "반려 사유를 입력하세요." });
      }
      const fingerprint = JSON.stringify(requestBody);
      if (inFlight) {
        if (inFlight.fingerprint === fingerprint) return inFlight.promise;
        return Promise.reject(new Error("다른 검수 결정이 진행 중입니다."));
      }
      if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: makeKey() };
      const key = retry.key;
      const request = (async (): Promise<ReviewSubmitResult> => {
        const data = await expectJson(
          await fetcher(`/api/tasks/${encodeURIComponent(issueId)}/review`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": key,
            },
            body: JSON.stringify(requestBody),
          }),
        );
        const approval = parseApproval(data);
        if (retry?.fingerprint === fingerprint) retry = undefined;
        return { ok: true, approval };
      })();
      const active = { fingerprint, promise: request };
      inFlight = active;
      request.then(
        () => {
          if (inFlight === active) inFlight = undefined;
        },
        () => {
          if (inFlight === active) inFlight = undefined;
        },
      );
      return request;
    },
  };
}

export function mergeEvidenceComment(comments: EvidenceComment[], submitted: EvidenceComment) {
  return [submitted, ...comments.filter((comment) => comment.id !== submitted.id)];
}

export function mergeApproval(approvals: TaskApproval[], updated: TaskApproval) {
  return [updated, ...approvals.filter((approval) => approval.id !== updated.id)];
}

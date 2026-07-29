import { APPROVAL_STATUSES, type ApprovalStatus } from "./review.ts";

export const TASK_PRIORITIES = ["critical", "high", "medium", "low"] as const;
export const TASK_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
] as const;

export type TaskPriority = (typeof TASK_PRIORITIES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

// One ruin per permanently-rejected approval record (VOX-26 / D9). attemptNumber is
// this rejection's 1-based position among the issue's rejections, in decision order —
// the live/open attempt (building or in-progress work) is 1 + ruins.length.
export interface TaskRuin {
  approvalId: string;
  attemptNumber: number;
  decisionNote: string | null;
  createdAt: string;
}

export interface TaskRuinHistory {
  attemptNumber: number;
  ruins: TaskRuin[];
}

export interface TaskProjection {
  id: string;
  parentId: string | null;
  identifier: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
  completedAt: string | null;
  approved: boolean | null;
  ruinHistory: TaskRuinHistory | null;
  assigneeAgentId?: string | null;
}

export type Task = TaskProjection;

export interface TaskDraft {
  title: string;
  priority: TaskPriority | "";
}

export interface TaskFieldErrors {
  title?: string;
  priority?: string;
}

type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type SubmitResult = { ok: true; task: Task } | { ok: false; errors: TaskFieldErrors };

function taskPath(companyId: string) {
  return `/api/companies/${encodeURIComponent(companyId)}/issues`;
}

function parseTask(value: unknown): Task {
  if (!value || typeof value !== "object") throw new Error("Paperclip 업무 응답 형식이 올바르지 않습니다.");
  const task = value as Record<string, unknown>;
  if (
    typeof task.id !== "string" ||
    !(task.parentId === null || typeof task.parentId === "string") ||
    typeof task.identifier !== "string" ||
    typeof task.title !== "string" ||
    !TASK_STATUSES.includes(task.status as TaskStatus) ||
    !(task.priority === null || TASK_PRIORITIES.includes(task.priority as TaskPriority)) ||
    !(task.completedAt === null || typeof task.completedAt === "string")
  ) {
    throw new Error("Paperclip 업무 응답 형식이 올바르지 않습니다.");
  }
  const assigneeAgentId = task.assigneeAgentId;
  if (!(assigneeAgentId === undefined || assigneeAgentId === null || typeof assigneeAgentId === "string")) {
    throw new Error("Paperclip 업무 응답 형식이 올바르지 않습니다.");
  }
  return {
    id: task.id,
    parentId: task.parentId,
    identifier: task.identifier,
    title: task.title,
    status: task.status as TaskStatus,
    priority: task.priority as TaskPriority | null,
    completedAt: task.completedAt,
    approved: null,
    ruinHistory: null,
    ...(assigneeAgentId === undefined ? {} : { assigneeAgentId }),
  };
}

async function expectJson(response: Response): Promise<unknown> {
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

interface ApprovalOutcome {
  approved: boolean;
  ruinHistory: TaskRuinHistory;
}

// VOX-26: the approvals list is the only source of attempt history (PAPERCLIP-RECON.md
// confirms rejected/revision_requested records are preserved forever) — do not add a
// second fetch here, pull both the "is it currently approved" flag and the permanent
// ruin list out of this one response.
async function fetchApprovalOutcome(fetcher: Fetcher, issueId: string): Promise<ApprovalOutcome> {
  const data = await expectJson(await fetcher(`/api/issues/${encodeURIComponent(issueId)}/approvals`));
  if (!Array.isArray(data)) throw new Error("Paperclip 승인 목록 형식이 올바르지 않습니다.");
  const parsed: Array<{ id: string; status: ApprovalStatus; decisionNote: string | null; at: number; createdAt: string }> = [];
  for (const value of data) {
    if (
      !value ||
      typeof value !== "object" ||
      !APPROVAL_STATUSES.includes((value as { status?: unknown }).status as ApprovalStatus) ||
      typeof (value as { createdAt?: unknown }).createdAt !== "string" ||
      !(
        (value as { decisionNote?: unknown }).decisionNote === null ||
        typeof (value as { decisionNote?: unknown }).decisionNote === "string"
      )
    ) {
      throw new Error("Paperclip 승인 응답 형식이 올바르지 않습니다.");
    }
    const approval = value as { status: ApprovalStatus; createdAt: string; decisionNote: string | null; id?: unknown };
    const parsedAt = Date.parse(approval.createdAt);
    parsed.push({
      id: typeof approval.id === "string" ? approval.id : "",
      status: approval.status,
      decisionNote: approval.decisionNote,
      at: Number.isNaN(parsedAt) ? -Infinity : parsedAt,
      createdAt: approval.createdAt,
    });
  }

  // Only the most recent decision counts: a withdrawn/cancelled approval must not
  // leave a stale earlier "approved" record standing (D4 is a human-only gate).
  let latest: { status: ApprovalStatus; at: number; id: string } | undefined;
  for (const approval of parsed) {
    if (!latest || approval.at > latest.at || (approval.at === latest.at && approval.id > latest.id)) {
      latest = approval;
    }
  }

  // D9 rule 3/6: only a `rejected` record turns an attempt into a permanent ruin.
  // `revision_requested`/`cancelled`/`pending` leave the open attempt untouched.
  const ruins: TaskRuin[] = parsed
    .filter((approval) => approval.status === "rejected")
    .sort((a, b) => (a.at !== b.at ? a.at - b.at : (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)))
    .map((approval, index) => ({
      approvalId: approval.id,
      attemptNumber: index + 1,
      decisionNote: approval.decisionNote,
      createdAt: approval.createdAt,
    }));

  return {
    approved: latest?.status === "approved",
    ruinHistory: { attemptNumber: ruins.length + 1, ruins },
  };
}

export async function listTasks(
  fetcher: Fetcher,
  companyId: string,
  approvalRootIssueId?: string,
): Promise<Task[]> {
  const data = await expectJson(await fetcher(taskPath(companyId)));
  if (!Array.isArray(data)) throw new Error("Paperclip 업무 목록 형식이 올바르지 않습니다.");
  const unique = new Map<string, { task: Task; fingerprint: string }>();
  for (const task of data.map(parseTask)) {
    const fingerprint = JSON.stringify([
      task.parentId,
      task.identifier,
      task.title,
      task.status,
      task.priority,
      task.completedAt,
    ]);
    const existing = unique.get(task.id);
    if (existing && existing.fingerprint !== fingerprint) {
      throw new Error("Paperclip 업무 목록에 충돌하는 중복 ID가 있습니다.");
    }
    unique.set(task.id, { task, fingerprint });
  }
  // ponytail: one GET per active-trip task; batch when Paperclip exposes bulk issue approvals.
  // Scoped to every direct child, not just `done` ones: a rejected task's ruin (D9) must
  // stay visible while it's reworked back through todo/in_progress/backlog, before it is
  // ever `done` again.
  return Promise.all(
    [...unique.values()].map(async ({ task }) => {
      if (!approvalRootIssueId || task.parentId !== approvalRootIssueId) return task;
      const { approved, ruinHistory } = await fetchApprovalOutcome(fetcher, task.id);
      return { ...task, approved, ruinHistory };
    }),
  );
}

function validateDraft(draft: TaskDraft): TaskFieldErrors {
  const errors: TaskFieldErrors = {};
  if (!draft.title.trim()) errors.title = "제목을 입력하세요.";
  if (!TASK_PRIORITIES.includes(draft.priority as TaskPriority)) {
    errors.priority = "우선순위를 선택하세요.";
  }
  return errors;
}

export function createTaskSubmitter(
  fetcher: Fetcher,
  companyId: string,
  makeKey: () => string = () => crypto.randomUUID(),
) {
  let retry: { fingerprint: string; key: string } | undefined;
  let inFlight: { fingerprint: string; promise: Promise<SubmitResult> } | undefined;

  return {
    submit(draft: TaskDraft, parentId: string): Promise<SubmitResult> {
      const errors = validateDraft(draft);
      if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors });
      if (!parentId) return Promise.reject(new Error("활성 여행을 먼저 시작하세요."));
      const payload = {
        title: draft.title.trim(),
        priority: draft.priority as TaskPriority,
        parentId,
      };
      const fingerprint = JSON.stringify(payload);
      if (inFlight) {
        if (inFlight.fingerprint === fingerprint) return inFlight.promise;
        return Promise.reject(new Error("다른 업무 생성이 진행 중입니다."));
      }

      if (retry?.fingerprint !== fingerprint) retry = { fingerprint, key: makeKey() };
      const key = retry.key;
      const request = (async (): Promise<SubmitResult> => {
        const data = await expectJson(await fetcher(taskPath(companyId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            ...payload,
            status: "backlog",
            idempotencyKey: key,
          }),
        }));
        const task = parseTask(data);
        if (retry?.fingerprint === fingerprint) retry = undefined;
        return { ok: true, task };
      })();

      const activeRequest = { fingerprint, promise: request };
      inFlight = activeRequest;
      request.then(
        () => {
          if (inFlight === activeRequest) inFlight = undefined;
        },
        () => {
          if (inFlight === activeRequest) inFlight = undefined;
        },
      );
      return request;
    },
  };
}

export function createTaskListCommitGate() {
  let revision = 0;
  return {
    beginLoad() {
      const loadRevision = ++revision;
      return () => loadRevision === revision;
    },
    invalidate() {
      revision += 1;
    },
  };
}

export function mergeCreatedTask(tasks: Task[], created: Task): Task[] {
  return [created, ...tasks.filter((task) => task.id !== created.id)];
}

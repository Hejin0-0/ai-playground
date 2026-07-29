import assert from "node:assert/strict";
import {
  createTaskListCommitGate,
  createTaskSubmitter,
  listTasks,
  mergeCreatedTask,
  type Task,
} from "./tasks.ts";

const existing: Task = {
  id: "issue-1",
  parentId: "trip-root",
  identifier: "VOX-12",
  title: "World state",
  status: "done",
  priority: "high",
  completedAt: "2026-07-27T01:00:00.000Z",
  approved: null,
  ruinHistory: null,
};

async function listUsesTheCompanyProxyAndParsesTasks() {
  let requested = "";
  const tasks = await listTasks(async (input) => {
    requested = String(input);
    return Response.json([existing, existing]);
  }, "company/a");

  assert.equal(requested, "/api/companies/company%2Fa/issues");
  assert.deepEqual(tasks, [existing]);
}

async function listPreservesTheAssignedAgentForTheTaskCard() {
  const [task] = await listTasks(async () => Response.json([{ ...existing, assigneeAgentId: "codex-dev" }]), "company-a");
  assert.equal(task?.assigneeAgentId, "codex-dev", "C1: the existing issue projection must retain the assigned employee");
}

async function listCarriesApprovalEvidenceForEveryDirectChildOfTheActiveTrip() {
  // VOX-26: a rejected task's ruin must stay visible even while its current status is
  // no longer `done` (it may be back in todo/in_progress being reworked), so approval
  // history is fetched for every direct child of the trip root, not only `done` ones.
  const directApproved = { ...existing, id: "approved" };
  const directUnapproved = { ...existing, id: "unapproved" };
  const reworking = { ...existing, id: "reworking", status: "todo", completedAt: null };
  const grandchild = { ...existing, id: "grandchild", parentId: "approved" };
  const requests: string[] = [];

  const tasks = await listTasks(async (input) => {
    const path = String(input);
    requests.push(path);
    if (path.endsWith("/issues")) {
      return Response.json([directApproved, directUnapproved, reworking, grandchild]);
    }
    if (path === "/api/issues/approved/approvals") {
      return Response.json([
        { id: "approval-1", status: "approved", decisionNote: null, createdAt: "2026-07-27T01:00:00.000Z" },
      ]);
    }
    if (path === "/api/issues/unapproved/approvals") {
      return Response.json([
        {
          id: "approval-2",
          status: "rejected",
          decisionNote: "카메라 각도가 D15 위반",
          createdAt: "2026-07-27T01:00:00.000Z",
        },
      ]);
    }
    if (path === "/api/issues/reworking/approvals") {
      return Response.json([]);
    }
    return Response.json({ message: "unexpected path" }, { status: 404 });
  }, "company-1", "trip-root");

  assert.deepEqual(
    tasks.map(({ id, approved, ruinHistory }) => ({ id, approved, ruinHistory })),
    [
      { id: "approved", approved: true, ruinHistory: { attemptNumber: 1, ruins: [] } },
      {
        id: "unapproved",
        approved: false,
        ruinHistory: {
          attemptNumber: 2,
          ruins: [
            {
              approvalId: "approval-2",
              attemptNumber: 1,
              decisionNote: "카메라 각도가 D15 위반",
              createdAt: "2026-07-27T01:00:00.000Z",
            },
          ],
        },
      },
      { id: "reworking", approved: false, ruinHistory: { attemptNumber: 1, ruins: [] } },
      { id: "grandchild", approved: null, ruinHistory: null },
    ],
  );
  assert.deepEqual(requests, [
    "/api/companies/company-1/issues",
    "/api/issues/approved/approvals",
    "/api/issues/unapproved/approvals",
    "/api/issues/reworking/approvals",
  ]);
}

async function rejectedAttemptNumbersFollowDecisionOrderNotResponseOrder() {
  // C1: attemptNumber = 1 + count of `rejected` records; revision_requested/cancelled/
  // pending never increment it, and the ruin list is ordered by when the rejection
  // happened, not by array position in the API response (shuffled below).
  const task = { ...existing, id: "reworked-twice" };

  const tasks = await listTasks(async (input) => {
    const path = String(input);
    if (path.endsWith("/issues")) return Response.json([task]);
    if (path === "/api/issues/reworked-twice/approvals") {
      return Response.json([
        { id: "rr", status: "revision_requested", decisionNote: "사소한 수정", createdAt: "2026-07-27T05:00:00.000Z" },
        { id: "second-reject", status: "rejected", decisionNote: "두번째 반려", createdAt: "2026-07-27T03:00:00.000Z" },
        { id: "cancel", status: "cancelled", decisionNote: null, createdAt: "2026-07-27T04:00:00.000Z" },
        { id: "first-reject", status: "rejected", decisionNote: "첫번째 반려", createdAt: "2026-07-27T01:00:00.000Z" },
      ]);
    }
    return Response.json({ message: "unexpected path" }, { status: 404 });
  }, "company-1", "trip-root");

  assert.deepEqual(tasks[0]?.ruinHistory, {
    attemptNumber: 3,
    ruins: [
      { approvalId: "first-reject", attemptNumber: 1, decisionNote: "첫번째 반려", createdAt: "2026-07-27T01:00:00.000Z" },
      { approvalId: "second-reject", attemptNumber: 2, decisionNote: "두번째 반려", createdAt: "2026-07-27T03:00:00.000Z" },
    ],
  });
}

async function onlyTheLatestApprovalDecisionKeepsABuilding() {
  // R1 regression: a stale "approved" record must not revive a building that a
  // later cancellation withdrew; and a later approval must override an earlier reject.
  // Response order is shuffled to prove the decision is chosen by createdAt, not array order.
  const withdrawn = { ...existing, id: "withdrawn" };
  const reApproved = { ...existing, id: "re-approved" };

  const tasks = await listTasks(async (input) => {
    const path = String(input);
    if (path.endsWith("/issues")) return Response.json([withdrawn, reApproved]);
    if (path === "/api/issues/withdrawn/approvals") {
      return Response.json([
        { id: "w-new", status: "cancelled", decisionNote: null, createdAt: "2026-07-27T02:00:00.000Z" },
        { id: "w-old", status: "approved", decisionNote: null, createdAt: "2026-07-27T01:00:00.000Z" },
      ]);
    }
    if (path === "/api/issues/re-approved/approvals") {
      return Response.json([
        { id: "r-old", status: "rejected", decisionNote: "초기 반려", createdAt: "2026-07-27T01:00:00.000Z" },
        { id: "r-new", status: "approved", decisionNote: null, createdAt: "2026-07-27T02:00:00.000Z" },
      ]);
    }
    return Response.json({ message: "unexpected path" }, { status: 404 });
  }, "company-1", "trip-root");

  assert.deepEqual(
    tasks.map(({ id, approved }) => ({ id, approved })),
    [
      { id: "withdrawn", approved: false },
      { id: "re-approved", approved: true },
    ],
    "only the most recent approval decision may keep a building",
  );
}

async function approvalListRejectsRecordsMissingACreatedAt() {
  await assert.rejects(
    () =>
      listTasks(async (input) => {
        const path = String(input);
        if (path.endsWith("/issues")) return Response.json([{ ...existing, id: "issue-x" }]);
        return Response.json([{ id: "a", status: "approved" }]);
      }, "company-1", "trip-root"),
    /승인 응답 형식/,
  );
}

async function listRejectsTasksWithoutAParentField() {
  await assert.rejects(
    () => listTasks(async () => Response.json([{ ...existing, parentId: undefined }]), "company-1"),
    /응답 형식/,
  );
}

async function listRejectsConflictingDuplicateIds() {
  const conflict = { ...existing, priority: "low" };
  await assert.rejects(
    () => listTasks(async () => Response.json([existing, conflict]), "company-1"),
    /중복/,
  );
  await assert.rejects(
    () => listTasks(async () => Response.json([conflict, existing]), "company-1"),
    /중복/,
  );
}

async function invalidDraftShowsFieldErrorsWithoutARequest() {
  let requests = 0;
  const submitter = createTaskSubmitter(async () => {
    requests += 1;
    return Response.json({});
  }, "company-1", () => "key-invalid");

  const result = await submitter.submit({ title: "   ", priority: "" }, "trip-root");

  assert.equal(requests, 0);
  assert.deepEqual(result, {
    ok: false,
    errors: {
      title: "제목을 입력하세요.",
      priority: "우선순위를 선택하세요.",
    },
  });
}

async function taskCreationRequiresAnActiveTripRoot() {
  const submitter = createTaskSubmitter(async () => Response.json(existing), "company-1");
  await assert.rejects(
    () => submitter.submit({ title: "고아 업무", priority: "medium" }),
    /활성 여행/,
  );
}

async function validDraftSendsOneRequestAndReturnsTheCreatedTask() {
  let requests = 0;
  let requestInit: RequestInit | undefined;
  const created: Task = {
    id: "issue-2",
    parentId: "trip-root",
    identifier: "VOX-13",
    title: "Astryx 화면",
    status: "backlog",
    priority: "medium",
    completedAt: null,
    approved: null,
    ruinHistory: null,
  };
  const submitter = createTaskSubmitter(async (_input, init) => {
    requests += 1;
    requestInit = init;
    return Response.json(created, { status: 201 });
  }, "company-1", () => "key-create");

  const [first, duplicate] = await Promise.all([
    submitter.submit({ title: "  Astryx 화면  ", priority: "medium" }, "trip-root"),
    submitter.submit({ title: "  Astryx 화면  ", priority: "medium" }, "trip-root"),
  ]);

  assert.equal(requests, 1, "concurrent submits must share one request");
  assert.deepEqual(first, { ok: true, task: created });
  assert.deepEqual(duplicate, first);
  assert.equal(new Headers(requestInit?.headers).get("Idempotency-Key"), "key-create");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    title: "Astryx 화면",
    status: "backlog",
    priority: "medium",
    parentId: "trip-root",
    idempotencyKey: "key-create",
  });
}

async function failedRetryReusesItsIdempotencyKey() {
  const keys: string[] = [];
  const generatedKeys = ["stable-retry-key", "duplicate-risk-key"];
  let requests = 0;
  const submitter = createTaskSubmitter(async (_input, init) => {
    requests += 1;
    keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    if (requests === 1) throw new Error("connection lost");
    return Response.json(existing, { status: 201 });
  }, "company-1", () => generatedKeys.shift() ?? "unexpected");

  await assert.rejects(() => submitter.submit({ title: " 재시도 ", priority: "low" }, "trip-root"));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const retried = await submitter.submit({ title: "재시도", priority: "low" }, "trip-root");

  assert.deepEqual(keys, ["stable-retry-key", "stable-retry-key"]);
  assert.deepEqual(retried, { ok: true, task: existing });
}

async function changedDraftAfterFailureGetsANewIdempotencyKey() {
  const keys = ["key-a", "key-b"];
  const sentKeys: string[] = [];
  let requests = 0;
  const submitter = createTaskSubmitter(async (_input, init) => {
    sentKeys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    requests += 1;
    if (requests === 1) throw new Error("connection lost");
    return Response.json(existing, { status: 201 });
  }, "company-1", () => keys.shift() ?? "unexpected");

  await assert.rejects(() => submitter.submit({ title: "업무 A", priority: "low" }, "trip-root"));
  await submitter.submit({ title: "업무 B", priority: "low" }, "trip-root");

  assert.deepEqual(sentKeys, ["key-a", "key-b"]);
}

async function differentConcurrentDraftIsNotSilentlyCoalesced() {
  let finishRequest: ((response: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => {
    finishRequest = resolve;
  });
  const submitter = createTaskSubmitter(() => response, "company-1", () => "key-create");

  const first = submitter.submit({ title: "업무 A", priority: "medium" }, "trip-root");
  await assert.rejects(
    () => submitter.submit({ title: "업무 B", priority: "medium" }, "trip-root"),
    /다른 업무 생성이 진행 중입니다/,
  );
  finishRequest?.(Response.json(existing, { status: 201 }));
  await first;
}

function createdTaskInvalidatesAnOlderListCommit() {
  const gate = createTaskListCommitGate();
  const shouldCommitOldLoad = gate.beginLoad();

  gate.invalidate();

  assert.equal(shouldCommitOldLoad(), false);
  assert.equal(gate.beginLoad()(), true);
}

function mergeKeepsARepeatedSuccessToOneVisibleTask() {
  assert.deepEqual(mergeCreatedTask([existing], existing), [existing]);

  const created = { ...existing, id: "issue-2", identifier: "VOX-13" };
  assert.deepEqual(mergeCreatedTask([existing], created), [created, existing]);
}

await listUsesTheCompanyProxyAndParsesTasks();
await listPreservesTheAssignedAgentForTheTaskCard();
await listCarriesApprovalEvidenceForEveryDirectChildOfTheActiveTrip();
await rejectedAttemptNumbersFollowDecisionOrderNotResponseOrder();
await onlyTheLatestApprovalDecisionKeepsABuilding();
await approvalListRejectsRecordsMissingACreatedAt();
await listRejectsTasksWithoutAParentField();
await listRejectsConflictingDuplicateIds();
await invalidDraftShowsFieldErrorsWithoutARequest();
await taskCreationRequiresAnActiveTripRoot();
await validDraftSendsOneRequestAndReturnsTheCreatedTask();
await failedRetryReusesItsIdempotencyKey();
await changedDraftAfterFailureGetsANewIdempotencyKey();
await differentConcurrentDraftIsNotSilentlyCoalesced();
createdTaskInvalidatesAnOlderListCommit();
mergeKeepsARepeatedSuccessToOneVisibleTask();
console.log("tasks.test.ts: all checks passed");

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
  identifier: "VOX-12",
  title: "World state",
  status: "done",
  priority: "high",
};

async function listUsesTheCompanyProxyAndParsesTasks() {
  let requested = "";
  const tasks = await listTasks(async (input) => {
    requested = String(input);
    return Response.json([existing]);
  }, "company/a");

  assert.equal(requested, "/api/companies/company%2Fa/issues");
  assert.deepEqual(tasks, [existing]);
}

async function invalidDraftShowsFieldErrorsWithoutARequest() {
  let requests = 0;
  const submitter = createTaskSubmitter(async () => {
    requests += 1;
    return Response.json({});
  }, "company-1", () => "key-invalid");

  const result = await submitter.submit({ title: "   ", priority: "" });

  assert.equal(requests, 0);
  assert.deepEqual(result, {
    ok: false,
    errors: {
      title: "제목을 입력하세요.",
      priority: "우선순위를 선택하세요.",
    },
  });
}

async function validDraftSendsOneRequestAndReturnsTheCreatedTask() {
  let requests = 0;
  let requestInit: RequestInit | undefined;
  const created: Task = {
    id: "issue-2",
    identifier: "VOX-13",
    title: "Astryx 화면",
    status: "backlog",
    priority: "medium",
  };
  const submitter = createTaskSubmitter(async (_input, init) => {
    requests += 1;
    requestInit = init;
    return Response.json(created, { status: 201 });
  }, "company-1", () => "key-create");

  const [first, duplicate] = await Promise.all([
    submitter.submit({ title: "  Astryx 화면  ", priority: "medium" }),
    submitter.submit({ title: "  Astryx 화면  ", priority: "medium" }),
  ]);

  assert.equal(requests, 1, "concurrent submits must share one request");
  assert.deepEqual(first, { ok: true, task: created });
  assert.deepEqual(duplicate, first);
  assert.equal(new Headers(requestInit?.headers).get("Idempotency-Key"), "key-create");
  assert.deepEqual(JSON.parse(String(requestInit?.body)), {
    title: "Astryx 화면",
    status: "backlog",
    priority: "medium",
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

  await assert.rejects(() => submitter.submit({ title: " 재시도 ", priority: "low" }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  const retried = await submitter.submit({ title: "재시도", priority: "low" });

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

  await assert.rejects(() => submitter.submit({ title: "업무 A", priority: "low" }));
  await submitter.submit({ title: "업무 B", priority: "low" });

  assert.deepEqual(sentKeys, ["key-a", "key-b"]);
}

async function differentConcurrentDraftIsNotSilentlyCoalesced() {
  let finishRequest: ((response: Response) => void) | undefined;
  const response = new Promise<Response>((resolve) => {
    finishRequest = resolve;
  });
  const submitter = createTaskSubmitter(() => response, "company-1", () => "key-create");

  const first = submitter.submit({ title: "업무 A", priority: "medium" });
  await assert.rejects(
    () => submitter.submit({ title: "업무 B", priority: "medium" }),
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
await invalidDraftShowsFieldErrorsWithoutARequest();
await validDraftSendsOneRequestAndReturnsTheCreatedTask();
await failedRetryReusesItsIdempotencyKey();
await changedDraftAfterFailureGetsANewIdempotencyKey();
await differentConcurrentDraftIsNotSilentlyCoalesced();
createdTaskInvalidatesAnOlderListCommit();
mergeKeepsARepeatedSuccessToOneVisibleTask();
console.log("tasks.test.ts: all checks passed");

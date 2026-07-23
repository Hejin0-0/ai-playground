import assert from "node:assert/strict";
import {
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
  let requests = 0;
  const submitter = createTaskSubmitter(async (_input, init) => {
    requests += 1;
    keys.push(new Headers(init?.headers).get("Idempotency-Key") ?? "");
    if (requests === 1) throw new Error("connection lost");
    return Response.json(existing, { status: 201 });
  }, "company-1", () => "stable-retry-key");

  await assert.rejects(() => submitter.submit({ title: "재시도", priority: "low" }));
  const retried = await submitter.submit({ title: "재시도", priority: "low" });

  assert.deepEqual(keys, ["stable-retry-key", "stable-retry-key"]);
  assert.deepEqual(retried, { ok: true, task: existing });
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
mergeKeepsARepeatedSuccessToOneVisibleTask();
console.log("tasks.test.ts: all checks passed");

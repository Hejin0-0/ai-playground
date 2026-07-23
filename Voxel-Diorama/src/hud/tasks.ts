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

export interface Task {
  id: string;
  identifier: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority | null;
}

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
    typeof task.identifier !== "string" ||
    typeof task.title !== "string" ||
    !TASK_STATUSES.includes(task.status as TaskStatus) ||
    !(task.priority === null || TASK_PRIORITIES.includes(task.priority as TaskPriority))
  ) {
    throw new Error("Paperclip 업무 응답 형식이 올바르지 않습니다.");
  }
  return task as unknown as Task;
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

export async function listTasks(fetcher: Fetcher, companyId: string): Promise<Task[]> {
  const data = await expectJson(await fetcher(taskPath(companyId)));
  if (!Array.isArray(data)) throw new Error("Paperclip 업무 목록 형식이 올바르지 않습니다.");
  return data.map(parseTask);
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
  let retryKey: string | undefined;
  let inFlight: Promise<SubmitResult> | undefined;

  return {
    submit(draft: TaskDraft): Promise<SubmitResult> {
      const errors = validateDraft(draft);
      if (Object.keys(errors).length) return Promise.resolve({ ok: false, errors });
      if (inFlight) return inFlight;

      retryKey ??= makeKey();
      const key = retryKey;
      const request = (async (): Promise<SubmitResult> => {
        const data = await expectJson(await fetcher(taskPath(companyId), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": key,
          },
          body: JSON.stringify({
            title: draft.title.trim(),
            status: "backlog",
            priority: draft.priority,
            idempotencyKey: key,
          }),
        }));
        const task = parseTask(data);
        retryKey = undefined;
        return { ok: true, task };
      })();

      inFlight = request;
      request.then(
        () => {
          inFlight = undefined;
        },
        () => {
          inFlight = undefined;
        },
      );
      return request;
    },

    reset() {
      if (!inFlight) retryKey = undefined;
    },
  };
}

export function mergeCreatedTask(tasks: Task[], created: Task): Task[] {
  return [created, ...tasks.filter((task) => task.id !== created.id)];
}

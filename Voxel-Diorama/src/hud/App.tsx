import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ReviewPanel } from "./ReviewPanel.tsx";
import {
  createTaskListCommitGate,
  createTaskSubmitter,
  listTasks,
  mergeCreatedTask,
  type Task,
  type TaskDraft,
  type TaskFieldErrors,
  type TaskPriority,
  type TaskStatus,
} from "./tasks.ts";

const STATUS_LABELS: Record<TaskStatus, string> = {
  backlog: "백로그",
  todo: "할 일",
  in_progress: "진행 중",
  in_review: "검수 중",
  done: "완료",
  blocked: "차단됨",
  cancelled: "취소됨",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_OPTIONS: SelectorOptionData[] = Object.entries(PRIORITY_LABELS).map(([value, label]) => ({
  value,
  label,
}));

const STATUS_VARIANTS: Record<TaskStatus, BadgeVariant> = {
  backlog: "neutral",
  todo: "info",
  in_progress: "blue",
  in_review: "warning",
  done: "success",
  blocked: "error",
  cancelled: "neutral",
};

const PRIORITY_VARIANTS: Record<TaskPriority, BadgeVariant> = {
  critical: "error",
  high: "warning",
  medium: "info",
  low: "neutral",
};

export type TaskListState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; tasks: Task[] };

export function TaskList({
  state,
  onRetry,
  selectedTaskId,
  onSelect,
}: {
  state: TaskListState;
  onRetry: () => void;
  selectedTaskId?: string | null;
  onSelect?: (task: Task) => void;
}) {
  if (state.kind === "loading") {
    return (
      <Card>
        <div className="state-panel" role="status" aria-live="polite" aria-busy="true">
          <p>업무를 불러오는 중…</p>
          {[0, 1, 2].map((index) => (
            <Skeleton key={index} width="100%" height={48} radius={2} index={index} />
          ))}
        </div>
      </Card>
    );
  }

  if (state.kind === "error") {
    return (
      <Card variant="red">
        <div className="state-panel" role="alert">
          <strong>업무를 불러오지 못했습니다.</strong>
          <p>{state.message}</p>
          <Button label="다시 시도" onClick={onRetry} />
        </div>
      </Card>
    );
  }

  if (state.tasks.length === 0) {
    return (
      <Card>
        <div className="state-panel" role="status">
          <strong>등록된 업무가 없습니다.</strong>
          <p>오른쪽 발주 양식에서 첫 업무를 만드세요.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card padding={0}>
      <div className="task-table-wrap">
        <table className="task-table">
          <caption className="visually-hidden">Paperclip 업무 목록</caption>
          <thead>
            <tr>
              <th scope="col">식별자</th>
              <th scope="col">제목</th>
              <th scope="col">상태</th>
              <th scope="col">우선순위</th>
            </tr>
          </thead>
          <tbody>
            {state.tasks.map((task) => (
              <tr key={task.id} aria-selected={onSelect ? task.id === selectedTaskId : undefined}>
                <td className="task-id">{task.identifier}</td>
                <td>
                  {onSelect ? (
                    <button className="task-title-button" type="button" onClick={() => onSelect(task)}>
                      {task.title}
                    </button>
                  ) : (
                    task.title
                  )}
                </td>
                <td>
                  <Badge variant={STATUS_VARIANTS[task.status]} label={STATUS_LABELS[task.status]} />
                </td>
                <td>
                  {task.priority ? (
                    <Badge variant={PRIORITY_VARIANTS[task.priority]} label={PRIORITY_LABELS[task.priority]} />
                  ) : (
                    "미지정"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function App({ companyId }: { companyId: string }) {
  const [listState, setListState] = useState<TaskListState>({ kind: "loading" });
  const [draft, setDraft] = useState<TaskDraft>({ title: "", priority: "" });
  const [fieldErrors, setFieldErrors] = useState<TaskFieldErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [createdMessage, setCreatedMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const submitter = useMemo(() => createTaskSubmitter(fetch, companyId), [companyId]);
  const listCommitGate = useMemo(createTaskListCommitGate, []);

  const load = useCallback(async () => {
    const shouldCommit = listCommitGate.beginLoad();
    setListState({ kind: "loading" });
    if (!companyId) {
      if (shouldCommit()) {
        setListState({ kind: "error", message: "PAPERCLIP_COMPANY_ID가 설정되지 않았습니다." });
      }
      return;
    }
    try {
      const tasks = await listTasks(fetch, companyId);
      if (shouldCommit()) {
        setSelectedTaskId((current) => (tasks.some((task) => task.id === current) ? current : null));
        setListState({ kind: "ready", tasks });
      }
    } catch (error) {
      if (shouldCommit()) {
        setListState({ kind: "error", message: error instanceof Error ? error.message : "알 수 없는 오류" });
      }
    }
  }, [companyId, listCommitGate]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeDraft(next: TaskDraft) {
    setDraft(next);
    setFieldErrors({});
    setSubmitError("");
    setCreatedMessage("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitError("");
    setCreatedMessage("");
    try {
      const result = await submitter.submit(draft);
      if (!result.ok) {
        setFieldErrors(result.errors);
        return;
      }
      listCommitGate.invalidate();
      setListState((current) => ({
        kind: "ready",
        tasks: mergeCreatedTask(current.kind === "ready" ? current.tasks : [], result.task),
      }));
      setDraft({ title: "", priority: "" });
      setFieldErrors({});
      setCreatedMessage(`${result.task.identifier} 업무를 만들었습니다.`);
      setSelectedTaskId(result.task.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "업무 생성에 실패했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const selectedTask =
    listState.kind === "ready" ? listState.tasks.find((task) => task.id === selectedTaskId) : undefined;

  return (
    <AppShell
      variant="surface"
      height="auto"
      contentPadding={4}
      mobileNav={false}
      topNav={
        <header className="app-header">
          <div>
            <span className="eyebrow">VOXEL-DIORAMA / OPERATIONS</span>
            <strong>AI Workforce Island</strong>
          </div>
          <Badge variant="success" label="Paperclip proxy" />
        </header>
      }
    >
      <div className="page">
        <header className="page-heading">
          <div>
            <p className="eyebrow">PHASE 2 · 2D BOOTSTRAP</p>
            <h1>업무 운영</h1>
            <p>Paperclip의 실제 업무를 확인하고 결과물 업무를 발주·검수합니다.</p>
          </div>
          <Button label="목록 새로고침" variant="ghost" onClick={() => void load()} />
        </header>

        <div className="workspace">
          <section aria-labelledby="task-list-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">LIVE PROJECTION</p>
                <h2 id="task-list-heading">업무 목록</h2>
              </div>
              {listState.kind === "ready" && <span>{listState.tasks.length}건</span>}
            </div>
            <TaskList
              state={listState}
              onRetry={() => void load()}
              selectedTaskId={selectedTaskId}
              onSelect={(task) => setSelectedTaskId(task.id)}
            />
            {selectedTask && <ReviewPanel key={selectedTask.id} task={selectedTask} onTaskRefresh={load} />}
          </section>

          <aside aria-labelledby="create-task-heading">
            <Card>
              <form className="create-form" noValidate onSubmit={submit}>
                <div>
                  <p className="eyebrow">NEW COMMISSION</p>
                  <h2 id="create-task-heading">새 업무 발주</h2>
                  <p>제목과 우선순위는 필수입니다.</p>
                </div>

                <TextInput
                  label="제목"
                  value={draft.title}
                  onChange={(title) => changeDraft({ ...draft, title })}
                  placeholder="완료 결과가 드러나는 제목"
                  isRequired
                  width="100%"
                  status={fieldErrors.title ? { type: "error", message: fieldErrors.title } : undefined}
                  isDisabled={isSubmitting}
                />

                <Selector
                  label="우선순위"
                  value={draft.priority || undefined}
                  onChange={(priority) => changeDraft({ ...draft, priority: priority as TaskPriority })}
                  options={PRIORITY_OPTIONS}
                  placeholder="우선순위 선택"
                  isRequired
                  width="100%"
                  status={fieldErrors.priority ? { type: "error", message: fieldErrors.priority } : undefined}
                  isDisabled={isSubmitting}
                />

                {submitError && (
                  <p className="form-message error" role="alert">
                    {submitError}
                  </p>
                )}
                {createdMessage && (
                  <p className="form-message success" role="status">
                    {createdMessage}
                  </p>
                )}

                <Button
                  label="업무 만들기"
                  type="submit"
                  variant="primary"
                  width="100%"
                  isLoading={isSubmitting}
                  isDisabled={isSubmitting}
                />
              </form>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

import { AppShell } from "@astryxdesign/core/AppShell";
import { Badge, type BadgeVariant } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Selector, type SelectorOptionData } from "@astryxdesign/core/Selector";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TextInput } from "@astryxdesign/core/TextInput";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { projectIsland, totalScore } from "../island/buildings.ts";
import { Island } from "../island/Island.tsx";
import { useActiveTrip } from "../state/useActiveTrip.ts";
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
  | { kind: "ready"; tasks: Task[]; stale?: boolean };

// A failed background poll must surface, never freeze silently: flag the last good
// list as stale so the operator sees the projection stopped updating.
export function markListStale(state: TaskListState): TaskListState {
  return state.kind === "ready" && !state.stale ? { ...state, stale: true } : state;
}

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

  const staleBanner = state.stale ? (
    <div className="form-message error" role="alert">
      실시간 갱신이 중단되었습니다 — 표시된 섬·목록은 마지막으로 성공한 조회 시점이며 최신이 아닐 수 있습니다.
    </div>
  ) : null;

  if (state.tasks.length === 0) {
    return (
      <>
        {staleBanner}
        <Card>
          <div className="state-panel" role="status">
            <strong>등록된 업무가 없습니다.</strong>
            <p>오른쪽 발주 양식에서 첫 업무를 만드세요.</p>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
    {staleBanner}
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
    </>
  );
}

// D10: "섬별 + 평생 누적" score display. Phase 4's trip archive (TripArchive) doesn't
// exist yet and only one trip is ever active (§3.5), so there is nothing archived to
// add — lifetime score is derived the same way as the island score (totalScore over
// buildings only, VOX-26 §0: no separate persistence) and will pick up prior trips'
// totals once Phase 4 adds an archive to read from.
export function LifetimeScore({ score }: { score: number }) {
  return (
    <div className="lifetime-score" role="status" aria-live="polite">
      <span>평생 누적 점수</span>
      <strong>{score}점</strong>
    </div>
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
  const activeTrip = useActiveTrip();
  const rootIssueId = activeTrip?.rootIssueId;
  const submitter = useMemo(() => createTaskSubmitter(fetch, companyId), [companyId]);
  const listCommitGate = useMemo(createTaskListCommitGate, []);
  const listLoadRef = useRef<Promise<void> | null>(null);

  const load = useCallback((background = false) => {
    if (listLoadRef.current) return listLoadRef.current;
    const request = (async () => {
      const shouldCommit = listCommitGate.beginLoad();
      if (!background) setListState({ kind: "loading" });
      if (!companyId) {
        if (shouldCommit() && !background) {
          setListState({ kind: "error", message: "PAPERCLIP_COMPANY_ID가 설정되지 않았습니다." });
        }
        return;
      }
      try {
        const tasks = await listTasks(fetch, companyId, rootIssueId);
        if (shouldCommit()) {
          setSelectedTaskId((current) => (tasks.some((task) => task.id === current) ? current : null));
          setListState({ kind: "ready", tasks });
        }
      } catch (error) {
        if (!shouldCommit()) return;
        if (background) {
          // Do not swallow poll failures: flag the last good projection as stale.
          setListState(markListStale);
        } else {
          setListState({ kind: "error", message: error instanceof Error ? error.message : "알 수 없는 오류" });
        }
      }
    })();
    listLoadRef.current = request;
    void request.finally(() => {
      if (listLoadRef.current === request) listLoadRef.current = null;
    });
    return request;
  }, [companyId, listCommitGate, rootIssueId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") await load(true);
      if (!cancelled) timer = setTimeout(poll, 5_000);
    };
    timer = setTimeout(poll, 5_000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
      if (!activeTrip) throw new Error("활성 여행을 먼저 시작하세요.");
      const result = await submitter.submit(draft, activeTrip.rootIssueId);
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

  const lifetimeScore =
    activeTrip && listState.kind === "ready"
      ? totalScore(projectIsland(listState.tasks, activeTrip.rootIssueId).buildings)
      : 0;

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
          <LifetimeScore score={lifetimeScore} />
          <Button label="목록 새로고침" variant="ghost" onClick={() => void load()} />
        </header>

        <section aria-labelledby="island-heading" className="island-section">
          <div className="section-heading">
            <div>
              <p className="eyebrow">PHASE 3 · ISOMETRIC ISLAND</p>
              <h2 id="island-heading">여행 섬</h2>
            </div>
            {activeTrip && <span>진행 중</span>}
          </div>
          <Island activeTrip={activeTrip} tasks={listState.kind === "ready" ? listState.tasks : []} />
        </section>

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
                  isDisabled={isSubmitting || !activeTrip}
                />
              </form>
            </Card>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

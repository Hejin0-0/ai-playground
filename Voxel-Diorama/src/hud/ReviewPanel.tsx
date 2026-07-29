import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { MetadataList, MetadataListItem } from "@astryxdesign/core/MetadataList";
import { Skeleton } from "@astryxdesign/core/Skeleton";
import { TextArea } from "@astryxdesign/core/TextArea";
import { Timestamp } from "@astryxdesign/core/Timestamp";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  createEvidenceSubmitter,
  createReviewSubmitter,
  loadTaskEvidence,
  approvalForAttempt,
  mergeApproval,
  mergeEvidenceComment,
  type ReviewDecision,
  type ReviewRequest,
  type TaskEvidence,
} from "./review.ts";
import type { Task } from "./tasks.ts";

type EvidenceState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ready"; evidence: TaskEvidence };

const STATUS_LABELS = {
  backlog: "백로그",
  todo: "할 일",
  in_progress: "진행 중",
  in_review: "검수 중",
  done: "완료",
  blocked: "차단됨",
  cancelled: "취소됨",
} as const;

const APPROVAL_LABELS = {
  pending: "승인 대기",
  revision_requested: "수정 요청됨",
  approved: "승인됨",
  rejected: "반려됨",
  cancelled: "취소됨",
} as const;

function formatNumber(value: number) {
  return new Intl.NumberFormat("ko-KR").format(value);
}

function formatRuntime(milliseconds: number) {
  const seconds = Math.round(milliseconds / 1000);
  if (seconds < 60) return `${seconds}초`;
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

function authorLabel(authorType: string) {
  if (authorType === "user") return "인간 CEO";
  if (authorType === "agent") return "AI 직원";
  return authorType;
}

export function attemptDecision(task: Task, attemptNumber: number) {
  const ruin = task.ruinHistory?.ruins.find((entry) => entry.attemptNumber === attemptNumber);
  if (ruin) return { label: "반려됨", decisionNote: ruin.decisionNote };
  return { label: task.approved ? "승인됨" : "검수 기록 대기", decisionNote: null };
}

export function ReviewPanel({
  task,
  attemptNumber,
  readOnly = false,
  onTaskRefresh,
}: {
  task: Task;
  attemptNumber: number;
  readOnly?: boolean;
  onTaskRefresh: () => Promise<void>;
}) {
  const [loadRevision, setLoadRevision] = useState(0);
  const [state, setState] = useState<EvidenceState>({ kind: "loading" });
  const [evidenceBody, setEvidenceBody] = useState("");
  const [evidenceError, setEvidenceError] = useState("");
  const [evidenceMessage, setEvidenceMessage] = useState("");
  const [isSubmittingEvidence, setIsSubmittingEvidence] = useState(false);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");
  const [retryReview, setRetryReview] = useState<ReviewRequest | null>(null);
  const [reviewingDecision, setReviewingDecision] = useState<ReviewDecision | null>(null);
  const isReviewing = reviewingDecision !== null;
  const evidenceSubmitter = useMemo(() => createEvidenceSubmitter(fetch, task.id), [task.id]);
  const reviewSubmitter = useMemo(() => createReviewSubmitter(fetch, task.id), [task.id]);
  const activeApproval =
    state.kind === "ready"
      ? state.evidence.approvals.find(({ status }) => status === "pending" || status === "revision_requested")
      : undefined;
  const selectedApproval =
    state.kind === "ready" ? approvalForAttempt(task, attemptNumber, state.evidence.approvals) : undefined;
  const decision = attemptDecision(task, attemptNumber);

  useEffect(() => {
    let cancelled = false;
    setState({ kind: "loading" });
    setEvidenceBody("");
    setEvidenceError("");
    setEvidenceMessage("");
    setReviewReason("");
    setReviewError("");
    setReviewMessage("");
    setRetryReview(null);

    void loadTaskEvidence(fetch, task.id).then(
      (evidence) => {
        if (!cancelled) setState({ kind: "ready", evidence });
      },
      (error) => {
        if (!cancelled) {
          setState({
            kind: "error",
            message: error instanceof Error ? error.message : "증거를 불러오지 못했습니다.",
          });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [loadRevision, task.id]);

  async function submitEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingEvidence(true);
    setEvidenceError("");
    setEvidenceMessage("");
    try {
      const result = await evidenceSubmitter.submit(evidenceBody);
      if (!result.ok) {
        setEvidenceError(result.error);
        return;
      }
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              evidence: {
                ...current.evidence,
                comments: mergeEvidenceComment(current.evidence.comments, result.comment),
              },
            }
          : current,
      );
      setEvidenceBody("");
      setEvidenceMessage("증거를 한 번 반영했습니다.");
    } catch (error) {
      setEvidenceError(error instanceof Error ? error.message : "증거 제출에 실패했습니다.");
    } finally {
      setIsSubmittingEvidence(false);
    }
  }

  async function review(request: ReviewRequest) {
    setReviewingDecision(request.decision);
    setReviewError("");
    setReviewMessage("");
    try {
      const result = await reviewSubmitter.submit(request);
      if (!result.ok) {
        setReviewError(result.error);
        setRetryReview(null);
        return;
      }
      setState((current) =>
        current.kind === "ready"
          ? {
              kind: "ready",
              evidence: {
                ...current.evidence,
                approvals: mergeApproval(current.evidence.approvals, result.approval),
              },
            }
          : current,
      );
      setRetryReview(null);
      setReviewMessage(request.decision === "approve" ? "승인 결정을 반영했습니다." : "반려 결정을 반영했습니다.");
      await onTaskRefresh();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "검수 결정에 실패했습니다.");
      setRetryReview(request);
    } finally {
      setReviewingDecision(null);
    }
  }

  return (
    <Card>
      <div className="review-panel">
        <header className="review-header">
          <div>
            <p className="eyebrow">EVIDENCE &amp; REVIEW</p>
            <h2>{task.identifier} 상세</h2>
            <p>{task.title}</p>
            <p>담당 직원 · {task.assigneeAgentId ?? "미배정"}</p>
            <p>시도 {attemptNumber} · {decision.label}</p>
            {decision.decisionNote && <p>반려 사유 · {decision.decisionNote}</p>}
          </div>
          <Badge variant={task.status === "in_review" ? "warning" : "neutral"} label={STATUS_LABELS[task.status]} />
        </header>

        {state.kind === "loading" && (
          <div className="state-panel" role="status" aria-live="polite" aria-busy="true">
            <p>증거와 검수 상태를 불러오는 중…</p>
            <Skeleton width="100%" height={96} radius={2} />
            <Skeleton width="100%" height={144} radius={2} index={1} />
          </div>
        )}

        {state.kind === "error" && (
          <div className="state-panel inline-error" role="alert">
            <strong>증거를 불러오지 못했습니다.</strong>
            <p>{state.message}</p>
            <Button label="증거 다시 불러오기" onClick={() => setLoadRevision((value) => value + 1)} />
          </div>
        )}

        {state.kind === "ready" && (
          <>
            <MetadataList columns="multi" label={{ position: "top" }}>
              <MetadataListItem label="실행">{formatNumber(state.evidence.cost.runCount)}회</MetadataListItem>
              <MetadataListItem label="입력 토큰">
                {formatNumber(state.evidence.cost.inputTokens)}
              </MetadataListItem>
              <MetadataListItem label="캐시 토큰">
                {formatNumber(state.evidence.cost.cachedInputTokens)}
              </MetadataListItem>
              <MetadataListItem label="출력 토큰">
                {formatNumber(state.evidence.cost.outputTokens)}
              </MetadataListItem>
              <MetadataListItem label="런타임">{formatRuntime(state.evidence.cost.runtimeMs)}</MetadataListItem>
              <MetadataListItem label="비용">${(state.evidence.cost.costCents / 100).toFixed(2)}</MetadataListItem>
            </MetadataList>

            <section className="panel-subsection" aria-labelledby="evidence-record-heading">
              <div className="subsection-heading">
                <h3 id="evidence-record-heading">증거 기록</h3>
                <span>{state.evidence.comments.length}건</span>
              </div>
              {state.evidence.comments.length === 0 ? (
                <p className="empty-note" role="status">
                  제출된 증거가 없습니다.
                </p>
              ) : (
                <div className="evidence-list">
                  {state.evidence.comments.map((comment) => (
                    <article className="evidence-item" key={comment.id}>
                      <header>
                        <strong>{authorLabel(comment.authorType)}</strong>
                        <Timestamp value={comment.createdAt} format="system_date_time" />
                      </header>
                      <p>{comment.body}</p>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel-subsection" aria-labelledby="run-record-heading">
              <div className="subsection-heading">
                <h3 id="run-record-heading">실행 기록</h3>
                <span>{state.evidence.runs.length}건</span>
              </div>
              {state.evidence.runs.length === 0 ? (
                <p className="empty-note" role="status">
                  기록된 실행이 없습니다.
                </p>
              ) : (
                <ul className="run-list">
                  {state.evidence.runs.map((run) => (
                    <li key={run.runId}>
                      <div>
                        <strong>{run.status}</strong>
                        <span>
                          {run.adapterType} · {run.runId.slice(0, 8)}
                        </span>
                      </div>
                      {run.startedAt && <Timestamp value={run.startedAt} format="system_date_time" />}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {!readOnly && <section className="panel-subsection" aria-labelledby="submit-evidence-heading">
              <form className="panel-form" onSubmit={submitEvidence} noValidate>
                <h3 id="submit-evidence-heading">증거 제출</h3>
                <TextArea
                  label="검수자가 확인할 변경·커밋·테스트·위험"
                  value={evidenceBody}
                  onChange={(body) => {
                    setEvidenceBody(body);
                    setEvidenceError("");
                    setEvidenceMessage("");
                  }}
                  rows={5}
                  isRequired
                  width="100%"
                  isDisabled={isSubmittingEvidence}
                  status={evidenceError ? { type: "error", message: evidenceError } : undefined}
                />
                {evidenceMessage && (
                  <p className="form-message success" role="status">
                    {evidenceMessage}
                  </p>
                )}
                <Button
                  label="증거 제출"
                  type="submit"
                  variant="primary"
                  isLoading={isSubmittingEvidence}
                  isDisabled={isSubmittingEvidence}
                />
              </form>
            </section>}

            {!readOnly && <section className="panel-subsection" aria-labelledby="review-decision-heading" aria-busy={isReviewing}>
              <div className="subsection-heading">
                <h3 id="review-decision-heading">인간 검수 결정</h3>
                {selectedApproval && (
                  <Badge
                    variant={
                      selectedApproval.status === "approved"
                        ? "success"
                        : selectedApproval.status === "rejected"
                          ? "error"
                          : "warning"
                    }
                    label={APPROVAL_LABELS[selectedApproval.status]}
                  />
                )}
              </div>
              {selectedApproval?.decisionNote && <p>검수 기록 · {selectedApproval.decisionNote}</p>}
              {!activeApproval && (
                <p className="empty-note">
                  연결된 대기 승인이 없습니다. Paperclip에서 이 업무에 approval이 연결되면 결정할 수 있습니다.
                </p>
              )}
              <TextArea
                label="검수 메모"
                description="반려할 때는 사유가 필수입니다."
                value={reviewReason}
                onChange={(reason) => {
                  setReviewReason(reason);
                  setReviewError("");
                  setReviewMessage("");
                  setRetryReview(null);
                }}
                rows={3}
                width="100%"
                isDisabled={!activeApproval || isReviewing}
              />
              <div className="review-actions">
                <Button
                  label="승인"
                  variant="primary"
                  onClick={() => void review({ decision: "approve", reason: reviewReason })}
                  isLoading={reviewingDecision === "approve"}
                  isDisabled={!activeApproval || isReviewing}
                />
                <Button
                  label="반려"
                  variant="destructive"
                  onClick={() => void review({ decision: "reject", reason: reviewReason })}
                  isLoading={reviewingDecision === "reject"}
                  isDisabled={!activeApproval || isReviewing}
                />
              </div>
              {reviewError && (
                <div className="retry-message" role="alert">
                  <p>{reviewError}</p>
                  {retryReview && (
                    <Button
                      label={`${retryReview.decision === "approve" ? "승인" : "반려"} 다시 시도`}
                      onClick={() => void review(retryReview)}
                      isLoading={isReviewing}
                      isDisabled={isReviewing}
                    />
                  )}
                </div>
              )}
              {reviewMessage && (
                <p className="form-message success" role="status">
                  {reviewMessage}
                </p>
              )}
            </section>}
          </>
        )}
      </div>
    </Card>
  );
}

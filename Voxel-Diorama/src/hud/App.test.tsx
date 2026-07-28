import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { IslandScore } from "../island/Island.tsx";
import { markListStale, TaskList, type TaskListState } from "./App.tsx";
import { createTaskListCommitGate, listTasks, type Task } from "./tasks.ts";

const task: Task = {
  id: "issue-13",
  parentId: "trip-root",
  identifier: "VOX-13",
  title: "Phase 2-3 Astryx 업무 목록·생성 화면",
  status: "in_progress",
  priority: "medium",
  completedAt: null,
  approved: null,
};

function loadingIsAnnounced() {
  const html = renderToStaticMarkup(<TaskList state={{ kind: "loading" }} onRetry={() => {}} />);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /업무를 불러오는 중/);
}

function emptyIsExplicit() {
  const html = renderToStaticMarkup(<TaskList state={{ kind: "ready", tasks: [] }} onRetry={() => {}} />);
  assert.match(html, /등록된 업무가 없습니다/);
}

function errorOffersRetry() {
  const html = renderToStaticMarkup(
    <TaskList state={{ kind: "error", message: "Paperclip 연결 실패" }} onRetry={() => {}} />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /Paperclip 연결 실패/);
  assert.match(html, /다시 시도/);
}

function rowsShowTheRequiredFields() {
  const html = renderToStaticMarkup(
    <TaskList state={{ kind: "ready", tasks: [task] }} onRetry={() => {}} />,
  );
  for (const expected of ["식별자", "제목", "상태", "우선순위", "VOX-13", task.title, "진행 중", "보통"]) {
    assert.match(html, new RegExp(expected));
  }
}

function rowSelectionExposesTheDetailEntryPoint() {
  const html = renderToStaticMarkup(
    <TaskList
      state={{ kind: "ready", tasks: [task] }}
      onRetry={() => {}}
      selectedTaskId={task.id}
      onSelect={() => {}}
    />,
  );
  assert.match(html, /aria-selected="true"/);
  assert.match(html, /<button[^>]*>Phase 2-3 Astryx 업무 목록·생성 화면<\/button>/);
}

// Tests the pure markListStale transition function only — not the App wiring.
function markListStaleTransitionReadyToStale() {
  assert.deepEqual(markListStale({ kind: "ready", tasks: [task] }), {
    kind: "ready",
    tasks: [task],
    stale: true,
  });
  assert.deepEqual(markListStale({ kind: "loading" }), { kind: "loading" });
  assert.deepEqual(markListStale({ kind: "error", message: "x" }), { kind: "error", message: "x" });
}

function staleListWarnsThatLiveUpdatesStopped() {
  const html = renderToStaticMarkup(
    <TaskList state={{ kind: "ready", tasks: [task], stale: true }} onRetry={() => {}} />,
  );
  assert.match(html, /role="alert"/);
  assert.match(html, /실시간 갱신/);
}

function freshListHasNoStaleWarning() {
  const html = renderToStaticMarkup(
    <TaskList state={{ kind: "ready", tasks: [task] }} onRetry={() => {}} />,
  );
  assert.doesNotMatch(html, /실시간 갱신/);
}

function islandScoreShowsTheD10Sum() {
  const html = renderToStaticMarkup(<IslandScore score={75} buildingCount={2} />);
  assert.match(html, /섬 점수/);
  assert.match(html, /75점/);
  assert.match(html, /2동/);
}

// Verifies the seam: App.tsx's background-poll failure branch must contain
// setListState(markListStale). Deleting that line causes this assertion to fail.
async function pollingSeamWiredInAppCatch() {
  const source = await fs.readFile(path.resolve(process.cwd(), "src/hud/App.tsx"), "utf8");
  assert.match(
    source,
    /if \(background\)[\s\S]{0,300}setListState\(markListStale\)/,
    "App.tsx: background poll failure must call setListState(markListStale) to surface stale state",
  );
}

// Integration test: mounts a state-machine harness that mirrors App's load/catch
// logic and verifies the full stale→recovery cycle through the DOM.
async function pollingFailureMarksStaleThenRecovers() {
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "http://localhost" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = global as any;
  g.document = win.document;
  g.window = win;
  g.HTMLElement = (win as any).HTMLElement;
  Object.defineProperty(global, "navigator", { value: (win as any).navigator, configurable: true });

  // Controlled fetch sequence: call 1 succeeds (initial), call 2 throws (bg poll),
  // call 3 succeeds (recovery bg poll).
  let fetchCall = 0;
  const apiRow = {
    id: task.id,
    parentId: task.parentId,
    identifier: task.identifier,
    title: task.title,
    status: task.status,
    priority: task.priority,
    completedAt: task.completedAt,
  };
  g.fetch = async (_url: string) => {
    fetchCall++;
    if (fetchCall === 2) throw new Error("simulated network failure");
    return { ok: true, json: async () => [apiRow] };
  };

  // Expose load trigger so the test can drive background polls explicitly.
  const loadRef = { current: null as null | ((bg?: boolean) => Promise<void> | void) };

  // This harness reimplements App's load/catch state machine without Island/Three.js,
  // so the integration test can run in Node without WebGL.
  function AppPollingHarness({ companyId }: { companyId: string }) {
    const [listState, setListState] = useState<TaskListState>({ kind: "loading" });
    const gate = useMemo(createTaskListCommitGate, []);
    const pendingRef = useRef<Promise<void> | null>(null);

    const load = useCallback(
      (bg = false) => {
        if (pendingRef.current) return pendingRef.current;
        const p = (async () => {
          const commit = gate.beginLoad();
          if (!bg) setListState({ kind: "loading" });
          try {
            const tasks = await listTasks(fetch, companyId, undefined);
            if (commit()) setListState({ kind: "ready", tasks });
          } catch (err) {
            if (!commit()) return;
            if (bg) {
              setListState(markListStale);
            } else {
              setListState({ kind: "error", message: err instanceof Error ? err.message : "error" });
            }
          }
        })();
        pendingRef.current = p;
        void p.finally(() => {
          if (pendingRef.current === p) pendingRef.current = null;
        });
        return p;
      },
      [companyId, gate],
    );

    loadRef.current = load;
    useEffect(() => { void load(); }, [load]);

    return React.createElement(TaskList, { state: listState, onRetry: () => void load() });
  }

  const container = (win as any).document.createElement("div");
  (win as any).document.body.appendChild(container);
  const root = createRoot(container);

  // Round 1: initial load succeeds → task row visible, no stale banner.
  await React.act(async () => {
    root.render(React.createElement(AppPollingHarness, { companyId: "test-co" }));
    await loadRef.current?.();
  });
  assert.doesNotMatch(container.innerHTML, /실시간 갱신/, "R1: no stale banner after initial success");
  assert.match(container.innerHTML, /VOX-13/, "R1: task row rendered");

  // Round 2: background poll fails → stale banner appears, rows stay.
  await React.act(async () => { await loadRef.current?.(true); });
  assert.match(container.innerHTML, /실시간 갱신/, "R2: stale banner shown after poll failure");
  assert.match(container.innerHTML, /VOX-13/, "R2: task row still visible despite failure");

  // Round 3: next background poll succeeds → stale banner clears.
  await React.act(async () => { await loadRef.current?.(true); });
  assert.doesNotMatch(container.innerHTML, /실시간 갱신/, "R3: stale banner gone after recovery");
  assert.match(container.innerHTML, /VOX-13/, "R3: task row still visible after recovery");

  root.unmount();
  await (win as any).happyDOM.close();
}

// --- run sync tests ---
loadingIsAnnounced();
emptyIsExplicit();
errorOffersRetry();
rowsShowTheRequiredFields();
rowSelectionExposesTheDetailEntryPoint();
markListStaleTransitionReadyToStale();
staleListWarnsThatLiveUpdatesStopped();
freshListHasNoStaleWarning();
islandScoreShowsTheD10Sum();

// --- run async tests ---
pollingSeamWiredInAppCatch()
  .then(() => pollingFailureMarksStaleThenRecovers())
  .then(() => console.log("App.test.tsx: all checks passed"))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

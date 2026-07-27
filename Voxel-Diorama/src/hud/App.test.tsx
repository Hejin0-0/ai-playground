import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { IslandScore } from "../island/Island.tsx";
import { TaskList } from "./App.tsx";
import type { Task } from "./tasks.ts";

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

function islandScoreShowsTheD10Sum() {
  const html = renderToStaticMarkup(<IslandScore score={75} buildingCount={2} />);
  assert.match(html, /섬 점수/);
  assert.match(html, /75점/);
  assert.match(html, /2동/);
}

loadingIsAnnounced();
emptyIsExplicit();
errorOffersRetry();
rowsShowTheRequiredFields();
rowSelectionExposesTheDetailEntryPoint();
islandScoreShowsTheD10Sum();
console.log("App.test.tsx: all checks passed");

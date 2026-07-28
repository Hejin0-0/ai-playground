import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  BUILDING_KINDS,
  priorityScore,
  projectBuildings,
  projectIsland,
  totalScore,
} from "./buildings.ts";

const tasks = [
  {
    id: "trip-root",
    parentId: null,
    status: "done",
    priority: "medium",
    completedAt: null,
    approved: null,
  },
  {
    id: "issue-b",
    parentId: "trip-root",
    status: "done",
    priority: "critical",
    completedAt: "2026-07-27T01:00:00.000Z",
    approved: true,
  },
  {
    id: "issue-a",
    parentId: "trip-root",
    status: "done",
    priority: "medium",
    completedAt: "2026-07-27T02:00:00.000Z",
    approved: true,
  },
  {
    id: "issue-a",
    parentId: "trip-root",
    status: "done",
    priority: "low",
    completedAt: "2026-07-27T02:00:00.000Z",
    approved: true,
  },
  {
    id: "direct-done",
    parentId: "trip-root",
    status: "done",
    priority: "high",
    completedAt: "2026-07-27T03:00:00.000Z",
    approved: false,
  },
  {
    id: "approval-unknown",
    parentId: "trip-root",
    status: "done",
    priority: "medium",
    completedAt: "2026-07-27T03:30:00.000Z",
    approved: null,
  },
  {
    id: "no-priority",
    parentId: "trip-root",
    status: "done",
    priority: null,
    completedAt: "2026-07-27T04:00:00.000Z",
    approved: true,
  },
  {
    id: "pending",
    parentId: "trip-root",
    status: "in_review",
    priority: "high",
    completedAt: null,
    approved: null,
  },
  {
    id: "grandchild",
    parentId: "issue-a",
    status: "done",
    priority: "high",
    completedAt: "2026-07-27T03:00:00.000Z",
    approved: true,
  },
  {
    id: "other-trip",
    parentId: "another-root",
    status: "done",
    priority: "high",
    completedAt: "2026-07-27T04:00:00.000Z",
    approved: true,
  },
] as const;

const projection = projectIsland(tasks, "trip-root");
const buildings = projection.buildings;

assert.deepEqual(
  buildings.map(({ issueId }) => issueId),
  ["issue-b", "issue-a"],
  "only done tasks directly below the active trip become buildings",
);
assert.deepEqual(
  buildings.map(({ plot }) => plot),
  [{ x: 0, z: 0 }, { x: 1, z: 0 }],
  "plots must start at the centre and move out in a deterministic spiral",
);
assert.ok(buildings.every(({ kind }) => BUILDING_KINDS.includes(kind)));
assert.deepEqual(buildings.map(({ attemptNumber }) => attemptNumber), [1, 1]);
assert.deepEqual(buildings.map(({ score }) => score), [60, 15]);
assert.equal(totalScore(buildings), 75);
assert.deepEqual(
  ["low", "medium", "high", "critical"].map(priorityScore),
  [15, 30, 45, 60],
  "D10 priority scores must stay fixed",
);
assert.deepEqual(
  projection.adjustments.map(({ issueId }) => issueId),
  ["direct-done", "approval-unknown", "no-priority"],
  "unreviewed or unprioritized done tasks become adjustment markers, not buildings",
);
assert.equal(totalScore(buildings), 75, "adjustment markers must not contribute points");

assert.deepEqual(
  projectBuildings([...tasks].reverse(), "trip-root"),
  buildings,
  "poll response order must not move or change buildings",
);
assert.deepEqual(
  projectBuildings(tasks.filter(({ id }) => id !== "issue-a"), "trip-root")[0]?.plot,
  buildings[0]?.plot,
  "a later completion must not move an existing building",
);

const offsetOrder = projectBuildings(
  [
    {
      id: "earlier-with-offset",
      parentId: "trip-root",
      status: "done",
      priority: "medium",
      completedAt: "2026-07-27T10:00:00+09:00",
      approved: true,
    },
    {
      id: "later-in-utc",
      parentId: "trip-root",
      status: "done",
      priority: "medium",
      completedAt: "2026-07-27T02:00:00Z",
      approved: true,
    },
  ],
  "trip-root",
);
assert.deepEqual(
  offsetOrder.map(({ issueId, plot }) => ({ issueId, plot })),
  [
    { issueId: "earlier-with-offset", plot: { x: 0, z: 0 } },
    { issueId: "later-in-utc", plot: { x: 1, z: 0 } },
  ],
  "completedAt offsets must be normalized before assigning the central plot",
);

const invalidTimeOrder = projectBuildings(
  [
    {
      id: "invalid-b",
      parentId: "trip-root",
      status: "done",
      priority: "medium",
      completedAt: "invalid",
      approved: true,
    },
    {
      id: "invalid-a",
      parentId: "trip-root",
      status: "done",
      priority: "medium",
      completedAt: "also-invalid",
      approved: true,
    },
  ],
  "trip-root",
);
assert.deepEqual(
  invalidTimeOrder,
  projectBuildings(
    [
      {
        id: "invalid-a",
        parentId: "trip-root",
        status: "done",
        priority: "medium",
        completedAt: "also-invalid",
        approved: true,
      },
      {
        id: "invalid-b",
        parentId: "trip-root",
        status: "done",
        priority: "medium",
        completedAt: "invalid",
        approved: true,
      },
    ],
    "trip-root",
  ),
  "invalid completion times must still have response-order-independent placement",
);

const moduleUrl = new URL("./buildings.ts", import.meta.url).href;
const freshProcessScript = [
  `import { projectBuildings } from ${JSON.stringify(moduleUrl)};`,
  `console.log(JSON.stringify(projectBuildings(${JSON.stringify(tasks)}, "trip-root")));`,
].join("\n");
const projectInFreshProcess = () =>
  execFileSync(process.execPath, ["--input-type=module", "--eval", freshProcessScript], {
    encoding: "utf8",
  }).trim();

assert.equal(
  projectInFreshProcess(),
  projectInFreshProcess(),
  "separate app processes must calculate byte-identical placements",
);

// VOX-26 §3.4 rules 3/6, D9: ruin preservation + rework re-plotting + score exclusion.
const reworkTasks = [
  ...tasks,
  {
    // Rejected twice, then approved on the third submission: one live building plus
    // two permanent ruins must coexist for the same issue (C1, C2).
    id: "reworked",
    parentId: "trip-root",
    status: "done",
    priority: "high",
    completedAt: "2026-07-27T05:00:00.000Z",
    approved: true,
    ruinHistory: {
      attemptNumber: 3,
      ruins: [
        { approvalId: "appr-r1", attemptNumber: 1, decisionNote: "1차 반려", createdAt: "2026-07-27T01:30:00.000Z" },
        { approvalId: "appr-r2", attemptNumber: 2, decisionNote: "2차 반려", createdAt: "2026-07-27T03:15:00.000Z" },
      ],
    },
  },
  {
    // C6: cancelled after one rejection — the progress marker goes away but the ruin
    // from the earlier rejection must not.
    id: "abandoned",
    parentId: "trip-root",
    status: "cancelled",
    priority: "medium",
    completedAt: null,
    approved: false,
    ruinHistory: {
      attemptNumber: 2,
      ruins: [{ approvalId: "appr-a1", attemptNumber: 1, decisionNote: "포기", createdAt: "2026-07-27T02:30:00.000Z" }],
    },
  },
  {
    // Rejected once, currently back in `todo` for rework — not `done`, so its ruin must
    // still show up purely from approval history (C2's "server is the source" premise).
    id: "midrework",
    parentId: "trip-root",
    status: "todo",
    priority: "low",
    completedAt: null,
    approved: false,
    ruinHistory: {
      attemptNumber: 2,
      ruins: [{ approvalId: "appr-m1", attemptNumber: 1, decisionNote: "수정 요망", createdAt: "2026-07-27T04:15:00.000Z" }],
    },
  },
  {
    // C7: latest decision is revision_requested with no prior rejection — no ruin, no
    // plot, the open attempt just stays at 1.
    id: "open-revision",
    parentId: "trip-root",
    status: "in_review",
    priority: "critical",
    completedAt: null,
    approved: false,
    ruinHistory: { attemptNumber: 1, ruins: [] },
  },
] as const;

const reworkProjection = projectIsland(reworkTasks, "trip-root");

assert.deepEqual(
  reworkProjection.buildings.map(({ issueId, attemptNumber, score }) => ({ issueId, attemptNumber, score })),
  [
    { issueId: "issue-b", attemptNumber: 1, score: 60 },
    { issueId: "issue-a", attemptNumber: 1, score: 15 },
    { issueId: "reworked", attemptNumber: 3, score: 45 },
  ],
  "C1: attemptNumber = 1 + rejected-record count, not a hardcoded 1",
);

assert.deepEqual(
  reworkProjection.ruins.map(({ issueId, attemptNumber, decisionNote }) => ({ issueId, attemptNumber, decisionNote })),
  [
    { issueId: "reworked", attemptNumber: 1, decisionNote: "1차 반려" },
    { issueId: "abandoned", attemptNumber: 1, decisionNote: "포기" },
    { issueId: "reworked", attemptNumber: 2, decisionNote: "2차 반려" },
    { issueId: "midrework", attemptNumber: 1, decisionNote: "수정 요망" },
  ],
  "C2/C6/C7: one ruin per rejected record regardless of current status, ordered by rejection time; revision_requested alone makes none",
);

assert.ok(
  reworkProjection.ruins.every((ruin) => !("score" in ruin)),
  "C4: ruins carry no score field at all",
);
assert.equal(
  totalScore(reworkProjection.buildings),
  60 + 15 + 45,
  "C4: only buildings contribute to score — ruins and non-done rework stay at 0",
);

const reworkPlotKeys = [
  ...reworkProjection.buildings.map(({ plot }) => `${plot.x},${plot.z}`),
  ...reworkProjection.adjustments.map(({ plot }) => `${plot.x},${plot.z}`),
  ...reworkProjection.ruins.map(({ plot }) => `${plot.x},${plot.z}`),
];
assert.equal(
  new Set(reworkPlotKeys).size,
  reworkPlotKeys.length,
  "C3: buildings, adjustments and ruins never share a plot",
);

const reworkedBuildingPlot = reworkProjection.buildings.find((building) => building.issueId === "reworked")?.plot;
assert.ok(
  reworkProjection.ruins
    .filter((ruin) => ruin.issueId === "reworked")
    .every((ruin) => !(ruin.plot.x === reworkedBuildingPlot?.x && ruin.plot.z === reworkedBuildingPlot?.z)),
  "C3: a reworked, now-approved building must not reuse its own earlier ruin's plot",
);

const reworkModuleScript = [
  `import { projectIsland } from ${JSON.stringify(moduleUrl)};`,
  `console.log(JSON.stringify(projectIsland(${JSON.stringify(reworkTasks)}, "trip-root")));`,
].join("\n");
const projectReworkInFreshProcess = () =>
  execFileSync(process.execPath, ["--input-type=module", "--eval", reworkModuleScript], {
    encoding: "utf8",
  }).trim();

assert.equal(
  projectReworkInFreshProcess(),
  projectReworkInFreshProcess(),
  "C5: repeated polling/app restarts must reproduce identical ruins, buildings and plots",
);

// VOX-26 retry 2 (CLI Advisor rejection of 67a0f11): C3/D9 are claims about *two
// points in time*, not one snapshot — a single-snapshot assertion cannot catch a ruin
// silently sliding to a new plot as later, unrelated events complete. These compare
// projectIsland across snapshots that model the island growing over time.

// Scenario A: issue X is rejected once, then reworked and approved. The ruin created
// at t2 must sit on the same plot at t3 as it did at t2, and the rework building must
// take a brand-new plot rather than its own ruin's plot.
const rootOnly = [
  {
    id: "solo-root",
    parentId: null,
    status: "done",
    priority: "medium",
    completedAt: null,
    approved: null,
  },
] as const;

const xMidReworkSnapshot = [
  ...rootOnly,
  {
    id: "issue-x",
    parentId: "solo-root",
    status: "todo",
    priority: "high",
    completedAt: null,
    approved: false,
    ruinHistory: {
      attemptNumber: 2,
      ruins: [{ approvalId: "appr-x1", attemptNumber: 1, decisionNote: "1차 반려", createdAt: "2026-07-28T01:00:00.000Z" }],
    },
  },
] as const;

const xReworkedApprovedSnapshot = [
  ...rootOnly,
  {
    id: "issue-x",
    parentId: "solo-root",
    status: "done",
    priority: "high",
    completedAt: "2026-07-28T02:00:00.000Z",
    approved: true,
    ruinHistory: {
      attemptNumber: 2,
      ruins: [{ approvalId: "appr-x1", attemptNumber: 1, decisionNote: "1차 반려", createdAt: "2026-07-28T01:00:00.000Z" }],
    },
  },
] as const;

const t2 = projectIsland(xMidReworkSnapshot, "solo-root");
const t3 = projectIsland(xReworkedApprovedSnapshot, "solo-root");

assert.equal(t2.ruins.length, 1, "sanity: rejection produces exactly one ruin at t2");
assert.deepEqual(
  t3.ruins.find((ruin) => ruin.issueId === "issue-x")?.plot,
  t2.ruins.find((ruin) => ruin.issueId === "issue-x")?.plot,
  "C3/D9: the ruin's plot at t3 (after rework is approved) must be unchanged from t2 (right after rejection) — ruins are permanent",
);
assert.notDeepEqual(
  t3.buildings.find((building) => building.issueId === "issue-x")?.plot,
  t3.ruins.find((ruin) => ruin.issueId === "issue-x")?.plot,
  "§3.4 rule 3: the rework's approved building must land on a new plot, not its own ruin's plot",
);

// Scenario B: once issue X's full history (ruin + rework building) is established,
// an unrelated issue Y completing later must not move X's ruin or building.
const beforeY = projectIsland(xReworkedApprovedSnapshot, "solo-root");
const afterYSnapshot = [
  ...xReworkedApprovedSnapshot,
  {
    id: "issue-y",
    parentId: "solo-root",
    status: "done",
    priority: "medium",
    completedAt: "2026-07-28T03:00:00.000Z",
    approved: true,
  },
] as const;
const afterY = projectIsland(afterYSnapshot, "solo-root");

assert.deepEqual(
  afterY.ruins.find((ruin) => ruin.issueId === "issue-x")?.plot,
  beforeY.ruins.find((ruin) => ruin.issueId === "issue-x")?.plot,
  "D9: an unrelated task (Y) completing later must not move issue X's existing ruin",
);
assert.deepEqual(
  afterY.buildings.find((building) => building.issueId === "issue-x")?.plot,
  beforeY.buildings.find((building) => building.issueId === "issue-x")?.plot,
  "D9/C3: an unrelated task (Y) completing later must not move issue X's existing building",
);
assert.deepEqual(
  afterY.buildings.find((building) => building.issueId === "issue-y")?.plot,
  { x: 1, z: 1 },
  "sanity: Y claims the next free plot in the shared spiral (after X's ruin and building) rather than reusing either",
);

console.log("buildings.test.ts: all checks passed");

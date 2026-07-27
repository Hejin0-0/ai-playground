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
  ["direct-done", "no-priority"],
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

console.log("buildings.test.ts: all checks passed");

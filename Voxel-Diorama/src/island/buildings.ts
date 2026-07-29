import type { TaskPriority, TaskRuinHistory } from "../hud/tasks.ts";

export const BUILDING_KINDS = ["block", "tower", "stepped"] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

interface BuildingTask {
  id: string;
  parentId: string | null;
  status: string;
  priority: TaskPriority | null;
  completedAt: string | null;
  approved: boolean | null;
  ruinHistory?: TaskRuinHistory | null;
}

export interface BuildingProjection {
  issueId: string;
  attemptNumber: number;
  priority: TaskPriority;
  kind: BuildingKind;
  plot: { x: number; z: number };
  score: number;
}

export interface AdjustmentProjection {
  issueId: string;
  attemptNumber: number;
  plot: { x: number; z: number };
}

// D9: a ruin has no score field at all — totalScore() only ever sums BuildingProjection,
// so a rejected attempt structurally cannot contribute points (C4).
export interface RuinProjection {
  issueId: string;
  attemptNumber: number;
  decisionNote: string | null;
  plot: { x: number; z: number };
}

export interface IslandProjection {
  buildings: BuildingProjection[];
  adjustments: AdjustmentProjection[];
  ruins: RuinProjection[];
}

const PRIORITY_SCORES: Record<TaskPriority, number> = {
  low: 15,
  medium: 30,
  high: 45,
  critical: 60,
};

export function priorityScore(priority: TaskPriority): number {
  return PRIORITY_SCORES[priority];
}

function hash(value: string): number {
  let result = 2166136261;
  for (let index = 0; index < value.length; index++) {
    result = Math.imul(result ^ value.charCodeAt(index), 16777619);
  }
  return result >>> 0;
}

function buildingKind(issueId: string, attemptNumber: number): BuildingKind {
  return BUILDING_KINDS[hash(`${issueId}:${attemptNumber}`) % BUILDING_KINDS.length];
}

function spiralPlots(count: number): Array<{ x: number; z: number }> {
  const plots = [{ x: 0, z: 0 }];
  let x = 0;
  let z = 0;
  let dx = 1;
  let dz = 0;

  for (let leg = 1; plots.length < count; leg++) {
    for (let turn = 0; turn < 2 && plots.length < count; turn++) {
      for (let step = 0; step < leg && plots.length < count; step++) {
        x += dx;
        z += dz;
        plots.push({ x, z });
      }
      [dx, dz] = [-dz, dx];
    }
  }
  return plots.slice(0, count);
}

// A single poll response can carry conflicting duplicate entries for the same task id
// (e.g. a stale page mixed with a fresh one). Pick one deterministically by composite
// key so repeated polls never reshuffle placement.
function dedupedByCompositeKey(tasks: BuildingTask[]): BuildingTask[] {
  const sorted = [...tasks].sort((a, b) => {
    const aKey = JSON.stringify([a.id, a.parentId, a.status, a.priority, a.completedAt, a.approved]);
    const bKey = JSON.stringify([b.id, b.parentId, b.status, b.priority, b.completedAt, b.approved]);
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  return sorted.filter((task, index) => index === 0 || task.id !== sorted[index - 1].id);
}

function normalizeTimestamp(value: string | null): number {
  const parsed = Date.parse(value ?? "");
  return Number.isNaN(parsed) ? Infinity : parsed;
}

function directDoneTasks(
  tasks: readonly BuildingTask[],
  rootIssueId: string,
): BuildingTask[] {
  const candidates = tasks.filter((task) => task.parentId === rootIssueId && task.status === "done");
  return dedupedByCompositeKey(candidates).sort((a, b) => {
    const aCompleted = normalizeTimestamp(a.completedAt);
    const bCompleted = normalizeTimestamp(b.completedAt);
    if (aCompleted !== bCompleted) return aCompleted < bCompleted ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

// Ruins are permanent (D9) regardless of the task's *current* status — a rejected task
// may sit in todo/in_progress/backlog/cancelled while it's reworked or abandoned, and
// its ruin must stay on the island the whole time (§3.4 rule 3, C6).
function directChildTasks(tasks: readonly BuildingTask[], rootIssueId: string): BuildingTask[] {
  return dedupedByCompositeKey(tasks.filter((task) => task.parentId === rootIssueId));
}

interface RuinSource {
  issueId: string;
  attemptNumber: number;
  decisionNote: string | null;
  at: number;
  sortId: string;
}

function collectRuins(tasks: readonly BuildingTask[], rootIssueId: string): RuinSource[] {
  const sources = directChildTasks(tasks, rootIssueId).flatMap((task) =>
    (task.ruinHistory?.ruins ?? []).map((ruin) => ({
      issueId: task.id,
      attemptNumber: ruin.attemptNumber,
      decisionNote: ruin.decisionNote,
      at: normalizeTimestamp(ruin.createdAt),
      sortId: `${task.id}:${ruin.attemptNumber}`,
    })),
  );
  return sources.sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    return a.sortId < b.sortId ? -1 : a.sortId > b.sortId ? 1 : 0;
  });
}

interface PlacementEvent {
  key: string;
  at: number;
  sortKey: string;
}

// D8/D9: every building, adjustment and ruin claims a plot from one shared spiral,
// ordered by *when it happened* (completion or rejection time) rather than by which
// array it currently sits in or how many items are ahead of it in a fixed segment.
// A new event is appended to this timeline and — as long as its timestamp is not
// earlier than every existing one, which real server timestamps guarantee — it lands
// after all previously-placed events, so it can only ever claim the next unused plot
// and never shifts one already handed out (§3.4 rule 3, C3). Because a rejection's
// createdAt always precedes its rework's completedAt, the ruin is necessarily placed
// before the rework building, so the rework can never land on its own ruin's plot
// without any extra avoidance logic.
//
// Residual edge case (documented, not defended against): if a later poll surfaces an
// event whose timestamp is *earlier* than an already-assigned event's timestamp, that
// earlier event inserts before it in the sort and shifts everything from that point
// on. This cannot happen from normal approval flow (server timestamps only move
// forward for a given task), so it is left as a known boundary rather than solved with
// speculative clock-skew handling.
function assignPlots(events: readonly PlacementEvent[]): Map<string, { x: number; z: number }> {
  const ordered = [...events].sort((a, b) => {
    if (a.at !== b.at) return a.at < b.at ? -1 : 1;
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });
  const plots = spiralPlots(ordered.length);
  const byKey = new Map<string, { x: number; z: number }>();
  ordered.forEach((event, index) => {
    byKey.set(event.key, plots[index]);
  });
  return byKey;
}

export function projectIsland(
  tasks: readonly BuildingTask[],
  rootIssueId: string,
): IslandProjection {
  const done = directDoneTasks(tasks, rootIssueId);
  const buildable = done.filter(
    (task): task is BuildingTask & { priority: TaskPriority } =>
      task.approved === true && task.priority !== null,
  );
  const adjustments = done.filter(
    (task) => task.approved !== true || task.priority === null,
  );
  const ruinSources = collectRuins(tasks, rootIssueId);

  const plots = assignPlots([
    ...buildable.map((task) => ({
      key: `building:${task.id}`,
      at: normalizeTimestamp(task.completedAt),
      sortKey: task.id,
    })),
    ...adjustments.map((task) => ({
      key: `adjustment:${task.id}`,
      at: normalizeTimestamp(task.completedAt),
      sortKey: task.id,
    })),
    ...ruinSources.map((ruin) => ({
      key: `ruin:${ruin.issueId}:${ruin.attemptNumber}`,
      at: ruin.at,
      sortKey: ruin.sortId,
    })),
  ]);

  return {
    buildings: buildable.map((task) => {
      const attemptNumber = task.ruinHistory?.attemptNumber ?? 1;
      return {
        issueId: task.id,
        attemptNumber,
        priority: task.priority,
        kind: buildingKind(task.id, attemptNumber),
        plot: plots.get(`building:${task.id}`)!,
        score: priorityScore(task.priority),
      };
    }),
    adjustments: adjustments.map((task) => ({
      issueId: task.id,
      attemptNumber: task.ruinHistory?.attemptNumber ?? 1,
      plot: plots.get(`adjustment:${task.id}`)!,
    })),
    ruins: ruinSources.map((ruin) => ({
      issueId: ruin.issueId,
      attemptNumber: ruin.attemptNumber,
      decisionNote: ruin.decisionNote,
      plot: plots.get(`ruin:${ruin.issueId}:${ruin.attemptNumber}`)!,
    })),
  };
}

export function projectBuildings(
  tasks: readonly BuildingTask[],
  rootIssueId: string,
): BuildingProjection[] {
  return projectIsland(tasks, rootIssueId).buildings;
}

export function totalScore(buildings: readonly BuildingProjection[]): number {
  return buildings.reduce((sum, building) => sum + building.score, 0);
}

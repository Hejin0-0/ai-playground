import type { TaskPriority } from "../hud/tasks.ts";

export const BUILDING_KINDS = ["block", "tower", "stepped"] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

interface BuildingTask {
  id: string;
  parentId: string | null;
  status: string;
  priority: TaskPriority | null;
  completedAt: string | null;
  approved: boolean | null;
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
  plot: { x: number; z: number };
}

export interface IslandProjection {
  buildings: BuildingProjection[];
  adjustments: AdjustmentProjection[];
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

function directDoneTasks(
  tasks: readonly BuildingTask[],
  rootIssueId: string,
): BuildingTask[] {
  const candidates = tasks
    .filter((task) => task.parentId === rootIssueId && task.status === "done")
    .sort((a, b) => {
      const aKey = JSON.stringify([a.id, a.parentId, a.status, a.priority, a.completedAt, a.approved]);
      const bKey = JSON.stringify([b.id, b.parentId, b.status, b.priority, b.completedAt, b.approved]);
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
  return candidates
    .filter((task, index) => index === 0 || task.id !== candidates[index - 1].id)
    .sort((a, b) => {
      const parsedA = Date.parse(a.completedAt ?? "");
      const parsedB = Date.parse(b.completedAt ?? "");
      const aCompleted = Number.isNaN(parsedA) ? Infinity : parsedA;
      const bCompleted = Number.isNaN(parsedB) ? Infinity : parsedB;
      if (aCompleted !== bCompleted) return aCompleted < bCompleted ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
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
  const plots = spiralPlots(buildable.length + adjustments.length);

  return {
    buildings: buildable.map((task, index) => {
      // ponytail: P3-2 has first completions only; VOX-26 adds persisted rework attempt numbers.
      const attemptNumber = 1;
      return {
        issueId: task.id,
        attemptNumber,
        priority: task.priority,
        kind: buildingKind(task.id, attemptNumber),
        plot: plots[index],
        score: priorityScore(task.priority),
      };
    }),
    adjustments: adjustments.map((task, index) => ({
      issueId: task.id,
      plot: plots[buildable.length + index],
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

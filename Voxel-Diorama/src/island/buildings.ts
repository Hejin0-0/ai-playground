import type { TaskPriority } from "../hud/tasks.ts";

export const BUILDING_KINDS = ["block", "tower", "stepped"] as const;

export type BuildingKind = (typeof BUILDING_KINDS)[number];

interface BuildingTask {
  id: string;
  parentId: string | null;
  status: string;
  priority: TaskPriority | null;
  completedAt: string | null;
}

export interface BuildingProjection {
  issueId: string;
  attemptNumber: number;
  priority: TaskPriority | null;
  kind: BuildingKind;
  plot: { x: number; z: number };
  score: number;
}

const PRIORITY_SCORES: Record<TaskPriority, number> = {
  low: 15,
  medium: 30,
  high: 45,
  critical: 60,
};

export function priorityScore(priority: TaskPriority | null): number {
  // ponytail: null violates the D10 creation rule; keep it visible but unscored until reconciliation exists.
  return priority ? PRIORITY_SCORES[priority] : 0;
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

export function projectBuildings(
  tasks: readonly BuildingTask[],
  rootIssueId: string,
): BuildingProjection[] {
  const candidates = tasks
    .filter((task) => task.parentId === rootIssueId && task.status === "done")
    .sort((a, b) => {
      const aKey = JSON.stringify([a.id, a.parentId, a.status, a.priority, a.completedAt]);
      const bKey = JSON.stringify([b.id, b.parentId, b.status, b.priority, b.completedAt]);
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
  const done = candidates
    .filter((task, index) => index === 0 || task.id !== candidates[index - 1].id)
    .sort((a, b) => {
      const aCompleted = a.completedAt ?? "";
      const bCompleted = b.completedAt ?? "";
      if (aCompleted !== bCompleted) return aCompleted < bCompleted ? -1 : 1;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  const plots = spiralPlots(done.length);

  return done.map((task, index) => {
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
  });
}

export function totalScore(buildings: readonly BuildingProjection[]): number {
  return buildings.reduce((sum, building) => sum + building.score, 0);
}

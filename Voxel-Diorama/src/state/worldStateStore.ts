// Atomic save/backup for world-state.json (PLAN.md §4.4 / §3.3).
//
// Contract: every save writes to a uniquely-named temp file and atomically
// renames it into place, so a reader never observes partially-written JSON.
// The `.bak` commit happens *before* the main commit: if the bak step fails,
// `filePath` is never touched; if the main step fails, `.bak` already
// correctly holds `filePath`'s pre-call content, and `filePath` itself is
// untouched. A corrupted or unparsable pre-call main is never propagated
// into `.bak` — only the last known-good state is ever backed up.
// save() calls on the same instance are serialized in call order.

import { randomUUID } from "node:crypto";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

export interface WorldStateLike {
  schemaVersion: number;
  [key: string]: unknown;
}

export interface FsOps {
  mkdir(dir: string): Promise<void>;
  readFile(filePath: string): Promise<string>;
  writeFile(filePath: string, data: string): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  unlink(filePath: string): Promise<void>;
}

const realFs: FsOps = {
  mkdir: async (dir) => {
    await fsPromises.mkdir(dir, { recursive: true });
  },
  readFile: (filePath) => fsPromises.readFile(filePath, "utf8"),
  writeFile: (filePath, data) => fsPromises.writeFile(filePath, data, "utf8"),
  rename: (from, to) => fsPromises.rename(from, to),
  unlink: (filePath) => fsPromises.unlink(filePath),
};

function isValidSchemaVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

export class WorldStateStore {
  private readonly filePath: string;
  private readonly bakPath: string;
  private readonly fs: FsOps;
  private queue: Promise<void> = Promise.resolve();

  constructor(filePath: string, fsOverrides: Partial<FsOps> = {}) {
    this.filePath = filePath;
    this.bakPath = `${filePath}.bak`;
    this.fs = { ...realFs, ...fsOverrides };
  }

  /**
   * Persists `state`. On return, `filePath` holds `state` and `.bak` holds
   * whatever valid state `filePath` held immediately before this call (if
   * any). Concurrent calls on the same instance run one at a time, in the
   * order they were made.
   */
  save(state: WorldStateLike): Promise<void> {
    const run = this.queue.then(() => this.saveExclusive(state));
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async saveExclusive(state: WorldStateLike): Promise<void> {
    if (!isValidSchemaVersion(state.schemaVersion)) {
      throw new Error("world state save rejected: schemaVersion must be a positive integer");
    }
    const json = JSON.stringify(state, null, 2);
    await this.fs.mkdir(path.dirname(this.filePath));

    const previousRaw = await this.readRawIfExists(this.filePath);
    if (previousRaw !== undefined && this.parseValid(previousRaw) !== undefined) {
      const bakTmp = `${this.bakPath}.tmp-${randomUUID()}`;
      await this.writeAndRename(bakTmp, this.bakPath, previousRaw);
    }

    const newTmp = `${this.filePath}.tmp-${randomUUID()}`;
    await this.writeAndRename(newTmp, this.filePath, json);
  }

  /**
   * Loads the current state. Falls back to `.bak` if the main file is
   * missing, unreadable, or not valid `WorldStateLike` JSON, and heals the
   * main file from the backup in that case so a future `save()` doesn't
   * back up corrupt content over a good `.bak`.
   */
  async load(): Promise<WorldStateLike | undefined> {
    const main = await this.tryReadValid(this.filePath);
    if (main !== undefined) return main;

    const backupRaw = await this.readRawIfExists(this.bakPath);
    if (backupRaw === undefined) return undefined;
    const backup = this.parseValid(backupRaw);
    if (backup === undefined) return undefined;

    const restoreTmp = `${this.filePath}.tmp-${randomUUID()}`;
    await this.writeAndRename(restoreTmp, this.filePath, backupRaw).catch(() => {});
    return backup;
  }

  /** Reads the current state with backup fallback, without changing either file. */
  async read(): Promise<WorldStateLike | undefined> {
    const main = await this.tryReadValid(this.filePath);
    if (main !== undefined) return main;

    const backupRaw = await this.readRawIfExists(this.bakPath);
    return backupRaw === undefined ? undefined : this.parseValid(backupRaw);
  }

  private async writeAndRename(tmpPath: string, destPath: string, data: string): Promise<void> {
    try {
      await this.fs.writeFile(tmpPath, data);
      await this.fs.rename(tmpPath, destPath);
    } catch (err) {
      await this.fs.unlink(tmpPath).catch(() => {});
      throw err;
    }
  }

  private async tryReadValid(filePath: string): Promise<WorldStateLike | undefined> {
    const raw = await this.readRawIfExists(filePath);
    if (raw === undefined) return undefined;
    return this.parseValid(raw);
  }

  private parseValid(raw: string): WorldStateLike | undefined {
    try {
      const parsed = JSON.parse(raw) as WorldStateLike;
      if (!isValidSchemaVersion(parsed.schemaVersion)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private async readRawIfExists(filePath: string): Promise<string | undefined> {
    try {
      return await this.fs.readFile(filePath);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return undefined;
      throw err;
    }
  }
}

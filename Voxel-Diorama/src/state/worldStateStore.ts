// Atomic save/backup for world-state.json (PLAN.md §4.4 / §3.3).
//
// Contract: every save writes the new state to a temp file and atomically
// renames it into place, so a reader never observes partially-written JSON.
// The main file is replaced first (the only step readers are exposed to),
// then the state it held a moment ago is committed to `<path>.bak` the same
// way — so `.bak` always holds the last state that was itself fully
// committed, never a half-write.

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

export class WorldStateStore {
  private readonly filePath: string;
  private readonly bakPath: string;
  private readonly fs: FsOps;

  constructor(filePath: string, fsOverrides: Partial<FsOps> = {}) {
    this.filePath = filePath;
    this.bakPath = `${filePath}.bak`;
    this.fs = { ...realFs, ...fsOverrides };
  }

  /**
   * Persists `state`. On return, `filePath` holds `state` and `.bak` holds
   * whatever `filePath` held immediately before this call (if anything).
   * On any failure, both files are left exactly as they were — never
   * truncated or half-written — and the error propagates to the caller.
   */
  // ponytail: tmp file names are fixed, not random — fine for this app's
  // single-writer desktop process. Add a uuid suffix if concurrent save()
  // calls on the same store are ever introduced.
  async save(state: WorldStateLike): Promise<void> {
    if (typeof state.schemaVersion !== "number") {
      throw new Error("world state save rejected: schemaVersion is required");
    }
    const json = JSON.stringify(state, null, 2);
    await this.fs.mkdir(path.dirname(this.filePath));

    const previousRaw = await this.readRawIfExists(this.filePath);

    const newTmp = `${this.filePath}.tmp-new`;
    await this.writeAndRename(newTmp, this.filePath, json);

    if (previousRaw !== undefined) {
      const bakTmp = `${this.bakPath}.tmp`;
      await this.writeAndRename(bakTmp, this.bakPath, previousRaw);
    }
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

    const restoreTmp = `${this.filePath}.tmp-restore`;
    await this.writeAndRename(restoreTmp, this.filePath, backupRaw).catch(() => {});
    return backup;
  }

  private async writeAndRename(tmpPath: string, destPath: string, data: string): Promise<void> {
    await this.fs.writeFile(tmpPath, data);
    try {
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
      if (typeof parsed.schemaVersion !== "number") return undefined;
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

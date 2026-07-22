import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { WorldStateStore, type FsOps } from "./worldStateStore.ts";

async function withTmpDir<T>(run: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "world-state-store-"));
  try {
    return await run(dir);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

async function twoSavesLeaveMainAsNewestAndBakAsPrevious() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);

    await store.save({ schemaVersion: 1, tick: 1 });
    await store.save({ schemaVersion: 1, tick: 2 });

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    const bak = JSON.parse(await fs.readFile(`${file}.bak`, "utf8"));
    assert.equal(main.tick, 2, "main must hold the newest saved state");
    assert.equal(bak.tick, 1, "bak must hold the immediately prior state");
  });
}

async function firstSaveHasNoBak() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });
    await assert.rejects(() => fs.readFile(`${file}.bak`, "utf8"));
  });
}

async function saveRejectsMissingSchemaVersion() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    // @ts-expect-error deliberately omitting schemaVersion
    await assert.rejects(() => store.save({ tick: 1 }));
    await assert.rejects(() => fs.readFile(file, "utf8"), "nothing must be written on a rejected save");
  });
}

async function renameFailureIntoMainLeavesPriorMainIntact() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });

    const realRename = fs.rename.bind(fs);
    const failingRename: FsOps["rename"] = async (from, to) => {
      if (to === file) throw new Error("injected rename failure");
      return realRename(from, to);
    };
    const flaky = new WorldStateStore(file, { rename: failingRename });

    await assert.rejects(() => flaky.save({ schemaVersion: 1, tick: 2 }));

    const mainRaw = await fs.readFile(file, "utf8");
    const main = JSON.parse(mainRaw); // must not throw: no partial JSON
    assert.equal(main.tick, 1, "main must be untouched after a failed rename");

    const leftovers = (await fs.readdir(dir)).filter((f) => f.includes(".tmp"));
    assert.deepEqual(leftovers, [], "temp file must be cleaned up after a failed rename");
  });
}

async function writeFailureBeforeAnyRenameLeavesFilesUntouched() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });
    await store.save({ schemaVersion: 1, tick: 2 });

    const failingWrite: FsOps["writeFile"] = async () => {
      throw new Error("injected write failure");
    };
    const flaky = new WorldStateStore(file, { writeFile: failingWrite });

    await assert.rejects(() => flaky.save({ schemaVersion: 1, tick: 3 }));

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    const bak = JSON.parse(await fs.readFile(`${file}.bak`, "utf8"));
    assert.equal(main.tick, 2, "main must be untouched after a failed write");
    assert.equal(bak.tick, 1, "bak must be untouched after a failed write");
  });
}

async function bakRenameFailureStillLeavesMainAndBakFullyValid() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const bakPath = `${file}.bak`;
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });
    await store.save({ schemaVersion: 1, tick: 2 });

    const realRename = fs.rename.bind(fs);
    const failingRename: FsOps["rename"] = async (from, to) => {
      if (to === bakPath) throw new Error("injected bak rename failure");
      return realRename(from, to);
    };
    const flaky = new WorldStateStore(file, { rename: failingRename });

    // The bak-side rename fails, but main was already committed by then —
    // save() surfaces the error, yet main correctly reflects the new state.
    await assert.rejects(() => flaky.save({ schemaVersion: 1, tick: 3 }));

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    const bak = JSON.parse(await fs.readFile(bakPath, "utf8"));
    assert.equal(main.tick, 3, "main commit is independent of the bak step");
    assert.equal(bak.tick, 1, "bak is left at its last fully-committed value, not corrupted");
  });
}

async function restartLoadsIdenticalState() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const first = new WorldStateStore(file);
    await first.save({ schemaVersion: 1, tick: 1 });
    await first.save({ schemaVersion: 1, tick: 2, label: "second" });

    const restarted = new WorldStateStore(file);
    const loaded = await restarted.load();
    assert.deepEqual(loaded, { schemaVersion: 1, tick: 2, label: "second" });
  });
}

async function corruptedMainRecoversFromBak() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });
    await store.save({ schemaVersion: 1, tick: 2 });

    await fs.writeFile(file, "{not valid json", "utf8");

    const loaded = await store.load();
    assert.deepEqual(loaded, { schemaVersion: 1, tick: 1 }, "load() must recover the .bak state");

    const healedMain = JSON.parse(await fs.readFile(file, "utf8"));
    assert.deepEqual(healedMain, { schemaVersion: 1, tick: 1 }, "main must be healed from .bak");
  });
}

async function missingMainAndBakLoadsUndefined() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    assert.equal(await store.load(), undefined);
  });
}

await twoSavesLeaveMainAsNewestAndBakAsPrevious();
await firstSaveHasNoBak();
await saveRejectsMissingSchemaVersion();
await renameFailureIntoMainLeavesPriorMainIntact();
await writeFailureBeforeAnyRenameLeavesFilesUntouched();
await bakRenameFailureStillLeavesMainAndBakFullyValid();
await restartLoadsIdenticalState();
await corruptedMainRecoversFromBak();
await missingMainAndBakLoadsUndefined();
console.log("worldStateStore.test.ts: all checks passed");

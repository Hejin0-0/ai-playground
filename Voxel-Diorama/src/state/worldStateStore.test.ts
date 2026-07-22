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

async function concurrentSavesAreSerialized() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    let inFlight = 0;
    let overlapped = false;
    const realWriteFile = fs.writeFile.bind(fs);
    const trackingWrite: FsOps["writeFile"] = async (filePath, data) => {
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await new Promise((resolve) => setTimeout(resolve, 20));
      await realWriteFile(filePath, data, "utf8");
      inFlight -= 1;
    };
    const store = new WorldStateStore(file, { writeFile: trackingWrite });

    await store.save({ schemaVersion: 1, tick: 0 });
    await Promise.all([
      store.save({ schemaVersion: 1, tick: 1 }),
      store.save({ schemaVersion: 1, tick: 2 }),
    ]);

    assert.equal(overlapped, false, "save() calls must be serialized, never overlapping writes");

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    const bak = JSON.parse(await fs.readFile(`${file}.bak`, "utf8"));
    assert.equal(main.tick, 2, "main must hold the state from the second queued save");
    assert.equal(bak.tick, 1, "bak must hold the state from the first queued save, not be skipped by the race");
  });
}

async function writeFailureMidWriteLeavesNoTmpFile() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });

    const realWriteFile = fs.writeFile.bind(fs);
    const partialThenFailWrite: FsOps["writeFile"] = async (filePath, data) => {
      await realWriteFile(filePath, data.slice(0, 5), "utf8");
      throw new Error("injected mid-write failure");
    };
    const flaky = new WorldStateStore(file, { writeFile: partialThenFailWrite });

    await assert.rejects(() => flaky.save({ schemaVersion: 1, tick: 2 }));

    const leftovers = (await fs.readdir(dir)).filter((f) => f.includes(".tmp"));
    assert.deepEqual(leftovers, [], "partial tmp file must be cleaned up after a failed write");
  });
}

async function saveRejectsInvalidSchemaVersions() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    for (const bad of [NaN, 0, -1, 1.5]) {
      // @ts-expect-error deliberately passing invalid schemaVersion values
      await assert.rejects(() => store.save({ schemaVersion: bad, tick: 1 }), `schemaVersion ${bad} must be rejected`);
    }
    await assert.rejects(() => fs.readFile(file, "utf8"), "nothing must be written when schemaVersion is invalid");
  });
}

async function saveDoesNotOverwriteBakWithCorruptedMain() {
  await withTmpDir(async (dir) => {
    const file = path.join(dir, "world-state.json");
    const store = new WorldStateStore(file);
    await store.save({ schemaVersion: 1, tick: 1 });
    await store.save({ schemaVersion: 1, tick: 2 }); // bak now holds tick:1

    // Corrupt main out-of-band (no load() in between), e.g. an external crash mid-write.
    await fs.writeFile(file, "{not valid json", "utf8");

    await store.save({ schemaVersion: 1, tick: 3 });

    const bak = JSON.parse(await fs.readFile(`${file}.bak`, "utf8"));
    assert.deepEqual(bak, { schemaVersion: 1, tick: 1 }, "bak must keep the last valid state, not the corrupted main");

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    assert.equal(main.tick, 3, "main must still receive the new save");
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

async function bakStepFailureLeavesMainUntouched() {
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

    // The bak commit happens before the main commit, so a failed bak step
    // must never leave main pointing at unintended new content.
    await assert.rejects(() => flaky.save({ schemaVersion: 1, tick: 3 }));

    const main = JSON.parse(await fs.readFile(file, "utf8"));
    const bak = JSON.parse(await fs.readFile(bakPath, "utf8"));
    assert.equal(main.tick, 2, "main must remain untouched when the bak-commit step fails before main is written");
    assert.equal(bak.tick, 1, "bak must remain at its last good value when its own commit step fails");
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
await concurrentSavesAreSerialized();
await writeFailureMidWriteLeavesNoTmpFile();
await saveRejectsInvalidSchemaVersions();
await saveDoesNotOverwriteBakWithCorruptedMain();
await renameFailureIntoMainLeavesPriorMainIntact();
await writeFailureBeforeAnyRenameLeavesFilesUntouched();
await bakStepFailureLeavesMainUntouched();
await restartLoadsIdenticalState();
await corruptedMainRecoversFromBak();
await missingMainAndBakLoadsUndefined();
console.log("worldStateStore.test.ts: all checks passed");

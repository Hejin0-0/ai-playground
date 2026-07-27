import assert from "node:assert/strict";
import { promises as fs } from "node:fs";

const source = await fs.readFile(new URL("./Island.tsx", import.meta.url), "utf8");
const controls = source.match(/<OrbitControls\b[^>]*\/>/s)?.[0] ?? "";

assert.match(controls, /enableRotate=\{false\}/, "island controls must keep the isometric angle fixed");
assert.match(controls, /enablePan=\{true\}/, "island controls must allow panning");
assert.match(controls, /enableZoom=\{true\}/, "island controls must allow zooming");

const index = await fs.readFile(new URL("../../index.html", import.meta.url), "utf8");
assert.match(index, /<link rel="icon" href="\/favicon\.svg"\s*\/>/);
await fs.access(new URL("../../public/favicon.svg", import.meta.url));

const app = await fs.readFile(new URL("../hud/App.tsx", import.meta.url), "utf8");
assert.match(app, /setTimeout\(poll,\s*5_000\)/, "task projection must poll every five seconds without overlap");
assert.match(app, /document\.visibilityState === "visible"/, "task polling must pause while the app is hidden");
assert.match(app, /if \(listLoadRef\.current\) return listLoadRef\.current/, "task loads must share one request");
assert.match(app, /isDisabled=\{isSubmitting \|\| !activeTrip\}/, "task creation must require an active trip");

console.log("Island.test.ts: all checks passed");

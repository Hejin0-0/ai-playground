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

assert.match(source, /AdjustmentMarker/, "done tasks needing reconciliation must render a marker");
assert.match(source, /\[조정 필요\]/, "the reconciliation marker must carry the PLAN label");

assert.match(source, /ruins\.map/, "VOX-26: every projected ruin must be rendered, not just buildings/adjustments");
assert.match(source, /\[폐허 · 시도 \{ruin\.attemptNumber\}\]/, "a ruin must show its own attempt number (D9)");
assert.match(source, /onClick=\{\(event\) => \{[\s\S]*onSelect\?\.\(\{ issueId: ruin\.issueId, attemptNumber: ruin\.attemptNumber \}\)/, "C2: a ruin click must select that exact rejected attempt");
assert.match(source, /onClick=\{\(event\) => \{[\s\S]*onSelect\?\.\(\{ issueId: building\.issueId, attemptNumber: building\.attemptNumber \}\)/, "C1: a building click must select its live attempt");
assert.match(source, /onClick=\{\(event\) => \{[\s\S]*onSelect\?\.\(\{ issueId: marker\.issueId, attemptNumber: marker\.attemptNumber \}\)/, "C1: an adjustment marker click must select its attempt");
assert.match(source, /<FocusCamera selection=\{selected\} plot=\{focusPlot\} \/>/, "C3: selection must focus the island camera");
assert.match(source, /new Vector3\(plot\.x \* PLOT_GAP, 0, plot\.z \* PLOT_GAP\)/, "C3: camera focus must use the clicked plot, not an arbitrary origin");
assert.doesNotMatch(source, /lookAt\s*\(/, "D15: camera focus must never rotate via lookAt");

console.log("Island.test.ts: all checks passed");

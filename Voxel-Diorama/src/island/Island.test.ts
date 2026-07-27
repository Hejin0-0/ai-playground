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

console.log("Island.test.ts: all checks passed");

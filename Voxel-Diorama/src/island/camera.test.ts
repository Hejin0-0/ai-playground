import assert from "node:assert/strict";
import { Vector3 } from "three";
import { translateCameraAndTarget } from "./camera.ts";

const camera = new Vector3(10, 10, 10);
const target = new Vector3(0, 0, 0);
const direction = camera.clone().sub(target);
const destination = new Vector3(2.4, 0, -2.4);

translateCameraAndTarget(camera, target, destination, 0.5);
assert.ok(camera.clone().sub(target).distanceTo(direction) < 1e-12, "C3: first interpolation frame must keep the camera direction");

translateCameraAndTarget(camera, target, destination, 0.5);
assert.ok(camera.clone().sub(target).distanceTo(direction) < 1e-12, "C3: every interpolation frame must keep the camera direction");

translateCameraAndTarget(camera, target, destination, 1);
assert.deepEqual(target, destination, "camera focus must finish at the selected plot");
assert.ok(camera.clone().sub(target).distanceTo(direction) < 1e-12, "C3: the completed focus must keep the camera direction");

console.log("camera.test.ts: all checks passed");

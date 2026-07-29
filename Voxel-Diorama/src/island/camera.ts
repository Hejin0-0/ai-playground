import type { Vector3 } from "three";

// D15: translate both endpoints of the view vector by exactly the same amount.
// That preserves the fixed isometric direction on every interpolation frame.
export function translateCameraAndTarget(
  cameraPosition: Vector3,
  controlTarget: Vector3,
  destination: Vector3,
  amount: number,
) {
  const translation = destination.clone().sub(controlTarget).multiplyScalar(Math.min(1, Math.max(0, amount)));
  cameraPosition.add(translation);
  controlTarget.add(translation);
}

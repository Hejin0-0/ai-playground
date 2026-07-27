import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { ActiveTrip } from "../state/useActiveTrip.ts";

// Phase 3-1 greybox: a flat isometric island rendered from grey primitives.
// Kenney asset swap is a follow-up (PLAN §Phase 3 · D8 greybox-first).
// Fixed isometric orthographic camera at (1,1,1) → 35.26° elevation / 45°
// azimuth, looking at the origin. Pan/zoom are allowed; rotation is not (D15).

const GROUND = "#7d828c";
const PLOT = "#aeb4bf";
const PLOT_COUNT = 4; // 4×4 부지 그리드
const PLOT_GAP = 2.4;

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[PLOT_COUNT * PLOT_GAP + 2, PLOT_COUNT * PLOT_GAP + 2]} />
      <meshStandardMaterial color={GROUND} />
    </mesh>
  );
}

function Plots() {
  const cells = [];
  for (let row = 0; row < PLOT_COUNT; row++) {
    for (let col = 0; col < PLOT_COUNT; col++) {
      const x = (col - (PLOT_COUNT - 1) / 2) * PLOT_GAP;
      const z = (row - (PLOT_COUNT - 1) / 2) * PLOT_GAP;
      cells.push(
        <mesh key={`${row}-${col}`} position={[x, 0.2, z]}>
          <boxGeometry args={[1.6, 0.4, 1.6]} />
          <meshStandardMaterial color={PLOT} />
        </mesh>,
      );
    }
  }
  return <>{cells}</>;
}

export function Island({ activeTrip }: { activeTrip: ActiveTrip | null }) {
  return (
    <div className="island-canvas">
      <Canvas
        orthographic
        camera={{ position: [10, 10, 10], zoom: 34, near: 0.1, far: 100 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.75} />
        <directionalLight position={[6, 12, 4]} intensity={0.9} />
        <OrbitControls enableRotate={false} enablePan={true} enableZoom={true} />
        {activeTrip && (
          <>
            <Ground />
            <Plots />
          </>
        )}
      </Canvas>
      {!activeTrip && (
        <div className="island-empty" role="status">
          <strong>활성 여행이 없습니다.</strong>
          <p>여행을 시작하면 이곳에 섬이 나타납니다.</p>
        </div>
      )}
    </div>
  );
}

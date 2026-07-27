import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { Task } from "../hud/tasks.ts";
import type { ActiveTrip } from "../state/useActiveTrip.ts";
import {
  projectBuildings,
  totalScore,
  type BuildingProjection,
} from "./buildings.ts";

// Phase 3-1 greybox: a flat isometric island rendered from grey primitives.
// Kenney asset swap is a follow-up (PLAN §Phase 3 · D8 greybox-first).
// Fixed isometric orthographic camera at (1,1,1) → 35.26° elevation / 45°
// azimuth, looking at the origin. Pan/zoom are allowed; rotation is not (D15).

const GROUND = "#7d828c";
const PLOT = "#aeb4bf";
const BUILDING = "#5f6672";
const PLOT_GAP = 2.4;

function Ground({ plotCount }: { plotCount: number }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[plotCount * PLOT_GAP + 2, plotCount * PLOT_GAP + 2]} />
      <meshStandardMaterial color={GROUND} />
    </mesh>
  );
}

function Plots({ plotCount }: { plotCount: number }) {
  const cells = [];
  for (let row = 0; row < plotCount; row++) {
    for (let col = 0; col < plotCount; col++) {
      const x = (col - (plotCount - 1) / 2) * PLOT_GAP;
      const z = (row - (plotCount - 1) / 2) * PLOT_GAP;
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

function Building({ building }: { building: BuildingProjection }) {
  const height = 0.8 + building.score / 45;
  return (
    <group
      name={`building-${building.issueId}`}
      position={[building.plot.x * PLOT_GAP, 0.4, building.plot.z * PLOT_GAP]}
    >
      {building.kind === "block" && (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[1.25, height, 1.25]} />
          <meshStandardMaterial color={BUILDING} />
        </mesh>
      )}
      {building.kind === "tower" && (
        <>
          <mesh position={[0, 0.25, 0]}>
            <boxGeometry args={[1.4, 0.5, 1.4]} />
            <meshStandardMaterial color={BUILDING} />
          </mesh>
          <mesh position={[0, 0.5 + height / 2, 0]}>
            <boxGeometry args={[0.75, height, 0.75]} />
            <meshStandardMaterial color={BUILDING} />
          </mesh>
        </>
      )}
      {building.kind === "stepped" && (
        <>
          {[1.4, 1, 0.6].map((size, index) => (
            <mesh key={size} position={[0, 0.25 + index * 0.5, 0]}>
              <boxGeometry args={[size, 0.5, size]} />
              <meshStandardMaterial color={BUILDING} />
            </mesh>
          ))}
        </>
      )}
    </group>
  );
}

export function IslandScore({ score, buildingCount }: { score: number; buildingCount: number }) {
  return (
    <div className="island-score" role="status" aria-live="polite">
      <span>섬 점수</span>
      <strong>{score}점</strong>
      <small>{buildingCount}동</small>
    </div>
  );
}

export function Island({
  activeTrip,
  tasks,
}: {
  activeTrip: ActiveTrip | null;
  tasks: readonly Task[];
}) {
  const buildings = activeTrip ? projectBuildings(tasks, activeTrip.rootIssueId) : [];
  const radius = buildings.reduce(
    (largest, building) => Math.max(largest, Math.abs(building.plot.x), Math.abs(building.plot.z)),
    2,
  );
  const plotCount = radius * 2 + 1;

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
            <Ground plotCount={plotCount} />
            <Plots plotCount={plotCount} />
            {buildings.map((building) => (
              <Building key={building.issueId} building={building} />
            ))}
          </>
        )}
      </Canvas>
      {activeTrip && <IslandScore score={totalScore(buildings)} buildingCount={buildings.length} />}
      {!activeTrip && (
        <div className="island-empty" role="status">
          <strong>활성 여행이 없습니다.</strong>
          <p>여행을 시작하면 이곳에 섬이 나타납니다.</p>
        </div>
      )}
    </div>
  );
}

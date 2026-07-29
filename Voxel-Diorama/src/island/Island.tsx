// PLAN §4.7 (v0.2+ 이전 예정): Svelte + 순수 Three.js로 옮길 때 이 파일에서
// 갈아끼울 것은 아래 셋뿐이다 — Canvas(렌더러+resize), OrbitControls
// (three/examples에 동일물), Html(three 내장 CSS2DRenderer). 나머지 JSX는
// three 원시 객체라 그대로 옮겨간다. 새 의존성 없이 R3F 2패키지가 빠진다.
import { Html, OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import type { Task } from "../hud/tasks.ts";
import type { ActiveTrip } from "../state/useActiveTrip.ts";
import {
  projectIsland,
  totalScore,
  type AdjustmentProjection,
  type BuildingProjection,
  type RuinProjection,
} from "./buildings.ts";

// Phase 3-1 greybox: a flat isometric island rendered from grey primitives.
// Kenney asset swap is a follow-up (PLAN §Phase 3 · D8 greybox-first).
// Fixed isometric orthographic camera at (1,1,1) → 35.26° elevation / 45°
// azimuth, looking at the origin. Pan/zoom are allowed; rotation is not (D15).

const GROUND = "#7d828c";
const PLOT = "#aeb4bf";
const BUILDING = "#5f6672";
const ADJUSTMENT = "#c8872d";
const RUIN = "#5c4033";
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

function AdjustmentMarker({ marker }: { marker: AdjustmentProjection }) {
  return (
    <group
      name={`adjustment-${marker.issueId}`}
      position={[marker.plot.x * PLOT_GAP, 0.4, marker.plot.z * PLOT_GAP]}
    >
      <mesh position={[0, 0.6, 0]}>
        <boxGeometry args={[0.12, 1.2, 0.12]} />
        <meshStandardMaterial color={ADJUSTMENT} />
      </mesh>
      <mesh position={[0, 1.25, 0]}>
        <boxGeometry args={[1.35, 0.5, 0.12]} />
        <meshStandardMaterial color={ADJUSTMENT} />
      </mesh>
      <Html center position={[0, 1.25, 0.08]}>
        <span className="adjustment-label">[조정 필요]</span>
      </Html>
    </group>
  );
}

// D9: a rejection is a permanent ruin, not a temporary marker — rendered as low, tilted
// rubble (never as tall as a building) so it reads as collapsed rather than in-progress.
function Ruin({ ruin }: { ruin: RuinProjection }) {
  return (
    <group
      name={`ruin-${ruin.issueId}-${ruin.attemptNumber}`}
      position={[ruin.plot.x * PLOT_GAP, 0.4, ruin.plot.z * PLOT_GAP]}
    >
      <mesh position={[-0.25, 0.15, 0.1]} rotation={[0.1, 0.3, 0.35]}>
        <boxGeometry args={[0.6, 0.3, 0.6]} />
        <meshStandardMaterial color={RUIN} />
      </mesh>
      <mesh position={[0.3, 0.1, -0.15]} rotation={[-0.15, -0.2, 0.2]}>
        <boxGeometry args={[0.45, 0.2, 0.45]} />
        <meshStandardMaterial color={RUIN} />
      </mesh>
      <mesh position={[0, 0.35, 0]} rotation={[0.4, 0.1, -0.3]}>
        <boxGeometry args={[0.8, 0.15, 0.3]} />
        <meshStandardMaterial color={RUIN} />
      </mesh>
      <Html center position={[0, 0.9, 0]}>
        <span className="ruin-label">[폐허 · 시도 {ruin.attemptNumber}]</span>
      </Html>
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
  const projection = activeTrip
    ? projectIsland(tasks, activeTrip.rootIssueId)
    : { buildings: [], adjustments: [], ruins: [] };
  const { buildings, adjustments, ruins } = projection;
  const radius = [...buildings, ...adjustments, ...ruins].reduce(
    (largest, item) => Math.max(largest, Math.abs(item.plot.x), Math.abs(item.plot.z)),
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
            {adjustments.map((marker) => (
              <AdjustmentMarker key={marker.issueId} marker={marker} />
            ))}
            {ruins.map((ruin) => (
              <Ruin key={`${ruin.issueId}:${ruin.attemptNumber}`} ruin={ruin} />
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

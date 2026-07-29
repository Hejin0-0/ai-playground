// PLAN §4.7 (v0.2+ 이전 예정): 아래 plugins 배열이 현재 우리의 API 계층 전부다.
// Rust/Axum 서버로 이전하면 이 파일은 순수 프론트엔드 설정만 남고, 여기 있는
// 타입 계약은 serde 구조체 → ts-rs 생성 TS로 단일 출처화된다.
import os from "node:os";
import path from "node:path";
import { defineConfig } from "vite";
import { paperclipProxy } from "./bridge/paperclipProxy.ts";
import { tripsApi } from "./bridge/tripsApi.ts";
import { WorldStateStore } from "./src/state/worldStateStore.ts";

const paperclipTarget = process.env.PAPERCLIP_PROXY_TARGET ?? "http://localhost:3100";
const statePath =
  process.env.VOXEL_DIORAMA_STATE_PATH ??
  path.join(os.homedir(), "Library", "Application Support", "Voxel-Diorama", "world-state.json");

export default defineConfig({
  define: {
    __PAPERCLIP_COMPANY_ID__: JSON.stringify(process.env.PAPERCLIP_COMPANY_ID ?? ""),
  },
  plugins: [
    tripsApi({
      target: paperclipTarget,
      companyId: process.env.PAPERCLIP_COMPANY_ID ?? "",
      projectId: process.env.PAPERCLIP_PROJECT_ID,
      store: new WorldStateStore(statePath),
    }),
    paperclipProxy({
      prefix: "/api",
      target: paperclipTarget,
    }),
  ],
  server: {
    host: "127.0.0.1",
  },
});

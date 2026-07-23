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

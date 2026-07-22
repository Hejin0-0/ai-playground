import { defineConfig } from "vite";
import { paperclipProxy } from "./bridge/paperclipProxy.ts";

export default defineConfig({
  plugins: [
    paperclipProxy({
      prefix: "/api",
      target: process.env.PAPERCLIP_PROXY_TARGET ?? "http://localhost:3100",
    }),
  ],
});

import { defineConfig } from "vite";
import { paperclipProxy } from "./bridge/paperclipProxy.ts";

export default defineConfig({
  define: {
    __PAPERCLIP_COMPANY_ID__: JSON.stringify(process.env.PAPERCLIP_COMPANY_ID ?? ""),
  },
  plugins: [
    paperclipProxy({
      prefix: "/api",
      target: process.env.PAPERCLIP_PROXY_TARGET ?? "http://localhost:3100",
    }),
  ],
  server: {
    host: "127.0.0.1",
  },
});

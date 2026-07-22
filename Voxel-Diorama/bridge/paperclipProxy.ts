import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin, ProxyOptions } from "vite";
import { IdempotencyStore, type CachedResponse } from "./idempotency.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const IDEMPOTENCY_HEADER = "idempotency-key";
const UPSTREAM_TIMEOUT_MS = 10_000;

function sendUpstreamError(res: ServerResponse, status: number, code: string, message: string) {
  const body = JSON.stringify({ error: code, message });
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

// Forwards one request to upstream verbatim (method, path+query, headers, body)
// and buffers the response so it can be replayed for repeat idempotency keys.
function forwardToUpstream(req: IncomingMessage, target: string, body: Buffer): Promise<CachedResponse> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(req.url ?? "/", target);
    const upstreamReq = http.request(
      targetUrl,
      {
        method: req.method,
        headers: { ...req.headers, host: targetUrl.host },
        timeout: UPSTREAM_TIMEOUT_MS,
      },
      (upstreamRes) => {
        const chunks: Buffer[] = [];
        upstreamRes.on("data", (c) => chunks.push(c));
        upstreamRes.on("end", () => {
          resolve({
            status: upstreamRes.statusCode ?? 502,
            headers: upstreamRes.headers,
            body: Buffer.concat(chunks),
          });
        });
        upstreamRes.on("error", reject);
      },
    );
    upstreamReq.on("timeout", () => upstreamReq.destroy(new Error("upstream_timeout")));
    upstreamReq.on("error", reject);
    upstreamReq.end(body);
  });
}

function writeCached(res: ServerResponse, cached: CachedResponse) {
  res.writeHead(cached.status, cached.headers);
  res.end(cached.body);
}

interface PaperclipProxyOptions {
  /** e.g. "/api" — path prefix routed to Paperclip. */
  prefix: string;
  /** e.g. "http://localhost:3100" */
  target: string;
}

/**
 * Vite plugin: same-origin proxy to Paperclip with an idempotency contract
 * for write methods. Reads flow through Vite's native `server.proxy` (method,
 * query, body, and status are preserved by that alone). Writes carrying an
 * Idempotency-Key header are intercepted here so a repeated key hits upstream
 * at most once and replays the first response.
 */
export function paperclipProxy({ prefix, target }: PaperclipProxyOptions): Plugin {
  const store = new IdempotencyStore();

  const proxyErrorHandler = (err: Error, _req: IncomingMessage, res: ServerResponse) => {
    // AggregateError (e.g. ECONNREFUSED via Node's happy-eyeballs connect)
    // carries the useful detail in `.errors`, not `.message`.
    const detail = err.message || (err as AggregateError).errors?.[0]?.message || err.name;
    const timedOut = /timeout/i.test(detail);
    sendUpstreamError(
      res,
      timedOut ? 504 : 502,
      timedOut ? "upstream_timeout" : "upstream_unreachable",
      detail,
    );
  };

  return {
    name: "paperclip-proxy",
    config() {
      return {
        server: {
          proxy: {
            [prefix]: {
              target,
              changeOrigin: true,
              configure(proxy) {
                proxy.on("error", proxyErrorHandler);
              },
            } satisfies ProxyOptions,
          },
        },
      };
    },
    configureServer(server) {
      // Registered directly in the hook body (not returned as a post-hook),
      // so this runs before Vite's own proxy middleware and can short-circuit
      // repeat writes without ever reaching upstream a second time.
      // Mounted at root (not `prefix`) so `req.url` keeps the full original
      // path — Connect's path-prefixed `use()` strips the mount segment,
      // which would forward requests upstream one path segment short.
      server.middlewares.use(async (req, res, next) => {
        const key = req.headers[IDEMPOTENCY_HEADER];
        if (
          !req.url?.startsWith(prefix) ||
          !key ||
          Array.isArray(key) ||
          !req.method ||
          SAFE_METHODS.has(req.method)
        ) {
          return next();
        }

        const existing = store.claim(key);
        if (existing) {
          try {
            writeCached(res, await existing);
          } catch (err) {
            proxyErrorHandler(err as Error, req, res);
          }
          return;
        }

        const settle = store.begin(key);
        try {
          const body = await readBody(req);
          const response = await forwardToUpstream(req, target, body);
          settle.resolve(response);
          writeCached(res, response);
        } catch (err) {
          settle.reject(err);
          proxyErrorHandler(err as Error, req, res);
        }
      });
    },
  };
}

import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { TLSSocket } from "node:tls";
import type { Plugin, ProxyOptions } from "vite";
import { IdempotencyStore, type CachedResponse } from "./idempotency.ts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const IDEMPOTENCY_HEADER = "idempotency-key";
const UPSTREAM_TIMEOUT_MS = 10_000;

function sendUpstreamError(res: ServerResponse, status: number, code: string, message: string) {
  // A client that already disconnected (e.g. the socket died before a
  // proxyTimeout abort was reported) leaves nothing to write to — writing
  // anyway would throw and turn a handled failure into an uncaught one.
  if (res.headersSent || res.writableEnded || res.destroyed) return;
  const body = JSON.stringify({ error: code, message });
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

// Rejects if the body doesn't finish within `timeoutMs` — a client that
// declares a Content-Length it never delivers would otherwise leave `data`
// listeners (and the caller's idempotency claim) attached forever.
export function readBody(req: IncomingMessage, timeoutMs: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const onData = (c: Buffer) => chunks.push(c);
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks));
    };
    const onError = (err: Error) => {
      cleanup();
      reject(err);
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`request_body_timeout: client did not finish sending the body within ${timeoutMs}ms`));
    }, timeoutMs);
    function cleanup() {
      clearTimeout(timer);
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
    }
    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
  });
}

// Same-origin means the full scheme+host+port tuple, not just host — a
// same-host Origin with the wrong scheme is still cross-origin.
// No Origin header is treated as same-origin: only browsers send Origin on
// cross-site fetch/XHR, so a non-browser client (curl, server-to-server)
// has no Origin to spoof and this dev-only proxy trusts its absence rather
// than blocking legitimate non-browser callers.
export function isSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  const scheme = req.socket instanceof TLSSocket ? "https:" : "http:";
  return parsed.protocol === scheme && parsed.host === req.headers.host;
}

// Forwards one request to upstream verbatim (method, path+query, headers, body)
// and buffers the response so it can be replayed for repeat idempotency keys.
function forwardToUpstream(
  req: IncomingMessage,
  target: string,
  body: Buffer,
  timeoutMs: number,
): Promise<CachedResponse> {
  return forwardRequest(
    target,
    {
      method: req.method ?? "GET",
      path: req.url ?? "/",
      headers: req.headers,
      body,
    },
    timeoutMs,
  );
}

interface UpstreamRequest {
  method: string;
  path: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function forwardRequest(target: string, request: UpstreamRequest, timeoutMs: number): Promise<CachedResponse> {
  return new Promise((resolve, reject) => {
    const targetUrl = new URL(request.path, target);
    const headers = { ...request.headers, host: targetUrl.host };
    delete headers["content-length"];
    delete headers["transfer-encoding"];
    if (request.body.length) headers["content-length"] = String(request.body.length);
    const upstreamReq = http.request(
      targetUrl,
      {
        method: request.method,
        headers,
        timeout: timeoutMs,
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
    upstreamReq.end(request.body);
  });
}

function writeCached(res: ServerResponse, cached: CachedResponse) {
  res.writeHead(cached.status, cached.headers);
  res.end(cached.body);
}

function jsonResponse(status: number, code: string, message: string): CachedResponse {
  const body = Buffer.from(JSON.stringify({ error: code, message }));
  return {
    status,
    headers: {
      "content-type": "application/json",
      "content-length": String(body.length),
    },
    body,
  };
}

const REVIEW_PATH = /^\/api\/tasks\/([^/]+)\/review$/;

async function forwardReview(
  req: IncomingMessage,
  target: string,
  body: Buffer,
  timeoutMs: number,
): Promise<CachedResponse> {
  const pathname = new URL(req.url ?? "/", "http://local").pathname;
  const match = pathname.match(REVIEW_PATH);
  if (!match) return forwardToUpstream(req, target, body, timeoutMs);

  let taskId: string;
  let payload: unknown;
  try {
    taskId = decodeURIComponent(match[1]);
    payload = JSON.parse(body.toString());
  } catch {
    return jsonResponse(400, "invalid_review_request", "review body must be valid JSON");
  }

  if (!payload || typeof payload !== "object") {
    return jsonResponse(400, "invalid_review_request", "review body must be an object");
  }
  const input = payload as Record<string, unknown>;
  const decision = input.decision;
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (decision !== "approve" && decision !== "reject" && decision !== "request_changes") {
    return jsonResponse(400, "invalid_review_decision", "decision must be approve, reject, or request_changes");
  }
  if ((decision === "reject" || decision === "request_changes") && !reason) {
    return jsonResponse(400, "review_reason_required", "reject and request_changes require a reason");
  }

  const approvalsResponse = await forwardRequest(
    target,
    {
      method: "GET",
      path: `/api/issues/${encodeURIComponent(taskId)}/approvals`,
      headers: req.headers,
      body: Buffer.alloc(0),
    },
    timeoutMs,
  );
  if (approvalsResponse.status < 200 || approvalsResponse.status >= 300) return approvalsResponse;

  let approvals: unknown;
  try {
    approvals = JSON.parse(approvalsResponse.body.toString());
  } catch {
    return jsonResponse(502, "invalid_upstream_response", "Paperclip returned invalid approval JSON");
  }
  if (!Array.isArray(approvals)) {
    return jsonResponse(502, "invalid_upstream_response", "Paperclip returned an invalid approval list");
  }
  const approval = approvals.find(
    (candidate) =>
      candidate &&
      typeof candidate === "object" &&
      typeof (candidate as Record<string, unknown>).id === "string" &&
      ((candidate as Record<string, unknown>).status === "pending" ||
        (decision !== "request_changes" && (candidate as Record<string, unknown>).status === "revision_requested")),
  ) as Record<string, unknown> | undefined;
  if (!approval) {
    return jsonResponse(
      409,
      "linked_pending_approval_not_found",
      "the task has no linked approval awaiting this decision",
    );
  }

  const action = decision === "request_changes" ? "request-revision" : decision;
  const decisionBody = Buffer.from(JSON.stringify({ decisionNote: reason || null }));
  return forwardRequest(
    target,
    {
      method: "POST",
      path: `/api/approvals/${encodeURIComponent(String(approval.id))}/${action}`,
      headers: { ...req.headers, "content-type": "application/json" },
      body: decisionBody,
    },
    timeoutMs,
  );
}

interface PaperclipProxyOptions {
  /** e.g. "/api" — path prefix routed to Paperclip. */
  prefix: string;
  /** e.g. "http://localhost:3100" */
  target: string;
  /** Upstream response deadline in ms, for both proxy paths. Default 10s. */
  timeoutMs?: number;
}

/**
 * Vite plugin: same-origin proxy to Paperclip with an idempotency contract
 * for write methods. Reads flow through Vite's native `server.proxy` (method,
 * query, body, and status are preserved by that alone). Writes carrying an
 * Idempotency-Key header are intercepted here so a repeated key hits upstream
 * at most once and replays the first response.
 */
export function paperclipProxy({ prefix, target, timeoutMs = UPSTREAM_TIMEOUT_MS }: PaperclipProxyOptions): Plugin {
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
                // Deliberately not using http-proxy's own `proxyTimeout`: its
                // abort() races the incoming client socket's destroyed-state
                // check in createErrorHandler, so on a real timeout it can
                // route to 'econnreset' with the response socket already
                // unwritable — dropping the client to a bare connection
                // reset instead of a clean 504, and throwing uncaught if no
                // 'econnreset' listener is attached. Owning the deadline here
                // lets us write the 504 before touching the socket at all.
                proxy.on("proxyReq", (proxyReq, _req, res) => {
                  const timer = setTimeout(() => {
                    sendUpstreamError(res, 504, "upstream_timeout", `no upstream response within ${timeoutMs}ms`);
                    proxyReq.destroy();
                  }, timeoutMs);
                  proxyReq.once("close", () => clearTimeout(timer));
                });
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
        if (!req.url?.startsWith(prefix) || !req.method || SAFE_METHODS.has(req.method)) {
          return next();
        }

        // Contract §4.2: same-origin only. Everything past this point mutates
        // upstream state, so cross-origin writes are rejected before any
        // other check (including before revealing whether a key is required).
        if (!isSameOrigin(req)) {
          return sendUpstreamError(res, 403, "cross_origin_forbidden", "writes require a same-origin request");
        }

        const rawKey = req.headers[IDEMPOTENCY_HEADER];
        if (!rawKey || Array.isArray(rawKey)) {
          return sendUpstreamError(
            res,
            400,
            "idempotency_key_required",
            `writes require an ${IDEMPOTENCY_HEADER} header`,
          );
        }

        // Composite so the same key value reused across different
        // method/path pairs can't replay one endpoint's cached response for
        // another. JSON-encoded as an array (not delimited string
        // concatenation) so no method/path/key content can forge a
        // collision — string delimiters like "::" are ambiguous when the
        // path or key can itself contain them.
        const key = JSON.stringify([req.method, req.url.split("?")[0], rawKey]);

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
          const body = await readBody(req, timeoutMs);
          const response = await forwardReview(req, target, body, timeoutMs);
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

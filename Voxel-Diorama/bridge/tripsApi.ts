import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import type { WorldStateLike, WorldStateStore } from "../src/state/worldStateStore.ts";
import { IdempotencyStore, type CachedResponse } from "./idempotency.ts";
import { isSameOrigin, readBody } from "./paperclipProxy.ts";

const ROUTE = "/api/trips";
const TIMEOUT_MS = 10_000;

interface TripsApiOptions {
  target: string;
  companyId: string;
  projectId?: string;
  store: Pick<WorldStateStore, "load" | "save">;
  timeoutMs?: number;
}

interface ActiveTrip {
  id: string;
  rootIssueId: string;
  themeId: "base";
  startedAt: string;
  active: true;
}

function json(status: number, value: unknown): CachedResponse {
  const body = Buffer.from(JSON.stringify(value));
  return {
    status,
    headers: {
      "content-type": "application/json",
      "content-length": String(body.length),
    },
    body,
  };
}

function write(res: ServerResponse, response: CachedResponse) {
  res.writeHead(response.status, response.headers);
  res.end(response.body);
}

function parseTitle(body: Buffer): string | undefined {
  try {
    const value = JSON.parse(body.toString()) as { title?: unknown };
    if (!value || typeof value !== "object" || Array.isArray(value) || typeof value.title !== "string") {
      return undefined;
    }
    return value.title.trim() || undefined;
  } catch {
    return undefined;
  }
}

function initialState(): WorldStateLike {
  return {
    schemaVersion: 1,
    activeTrip: null,
    lifetimeScore: 0,
    archives: [],
  };
}

export function tripsApi({
  target,
  companyId,
  projectId,
  store,
  timeoutMs = TIMEOUT_MS,
}: TripsApiOptions): Plugin {
  const idempotency = new IdempotencyStore();
  let queue: Promise<void> = Promise.resolve();

  async function startTrip(body: Promise<Buffer>, key: string): Promise<CachedResponse> {
    const state = (await store.load()) ?? initialState();
    if (state.tripStartIdempotencyKey === key && state.activeTrip != null) {
      return json(201, state.activeTrip);
    }
    if (state.activeTrip != null) {
      return json(409, { error: "active_trip_exists", message: "an active trip already exists" });
    }
    const title = parseTitle(await body);
    if (!title) {
      return json(400, {
        error: "invalid_request",
        message: "body must be JSON with a non-empty title",
      });
    }
    if (!companyId) {
      return json(503, { error: "paperclip_not_configured", message: "PAPERCLIP_COMPANY_ID is required" });
    }

    const upstream = await fetch(
      new URL(`/api/companies/${encodeURIComponent(companyId)}/issues`, target),
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          status: "backlog",
          priority: "medium",
          idempotencyKey: `trip:${key}`,
          ...(projectId ? { projectId } : {}),
        }),
        redirect: "manual",
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    const upstreamBody = Buffer.from(await upstream.arrayBuffer());
    if (!upstream.ok) {
      return {
        status: upstream.status,
        headers: { "content-type": upstream.headers.get("content-type") ?? "application/json" },
        body: upstreamBody,
      };
    }

    let root: { id?: unknown };
    try {
      root = JSON.parse(upstreamBody.toString()) as { id?: unknown };
    } catch {
      return json(502, { error: "invalid_upstream_response", message: "Paperclip returned invalid JSON" });
    }
    if (typeof root.id !== "string" || !root.id) {
      return json(502, { error: "invalid_upstream_response", message: "Paperclip response is missing issue id" });
    }

    const trip: ActiveTrip = {
      id: root.id,
      rootIssueId: root.id,
      themeId: "base",
      startedAt: new Date().toISOString(),
      active: true,
    };
    await store.save({ ...state, activeTrip: trip, tripStartIdempotencyKey: key });
    return json(201, trip);
  }

  return {
    name: "trips-api",
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next) => {
        if (req.method !== "POST" || req.url?.split("?")[0] !== ROUTE) return next();
        if (!isSameOrigin(req)) {
          return write(res, json(403, { error: "cross_origin_forbidden", message: "writes require a same-origin request" }));
        }

        const key = req.headers["idempotency-key"];
        if (!key || Array.isArray(key) || !key.trim() || key.length > 250) {
          return write(res, json(400, {
            error: "idempotency_key_required",
            message: "writes require a valid idempotency-key header",
          }));
        }

        const existing = idempotency.claim(key);
        if (existing) {
          try {
            write(res, await existing);
          } catch {
            write(res, json(500, { error: "trip_start_failed", message: "trip start failed" }));
          }
          return;
        }

        const settle = idempotency.begin(key);
        const body = readBody(req, timeoutMs);
        body.catch(() => {});
        try {
          const run = queue.then(() => startTrip(body, key));
          queue = run.then(
            () => undefined,
            () => undefined,
          );
          const response = await run;
          settle.resolve(response);
          write(res, response);
        } catch (error) {
          settle.reject(error);
          const timedOut = error instanceof Error && /timeout/i.test(`${error.name} ${error.message}`);
          write(res, json(timedOut ? 504 : 500, {
            error: timedOut ? "trip_start_timeout" : "trip_start_failed",
            message: timedOut ? "trip start timed out" : "trip start failed",
          }));
        }
      });
    },
  };
}

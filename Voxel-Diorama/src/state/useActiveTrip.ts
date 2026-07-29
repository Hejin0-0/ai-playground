import { useEffect, useState } from "react";

// Reads the active trip from the bridge's read-only /api/trips (world-state
// projection, no new contract). Polls every 5s while the tab is visible and
// pauses when hidden — PLAN §4.3.

export interface ActiveTrip {
  id: string;
  rootIssueId: string;
  themeId: string;
  startedAt: string;
  active: boolean;
}

const POLL_MS = 5000;

export function useActiveTrip(fetchImpl: typeof fetch = fetch): ActiveTrip | null | undefined {
  const [trip, setTrip] = useState<ActiveTrip | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function tick() {
      try {
        const res = await fetchImpl("/api/trips", { headers: { accept: "application/json" } });
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { activeTrip: ActiveTrip | null };
          setTrip(data.activeTrip ?? null);
        }
      } catch {
        // Paperclip/bridge offline: keep the last known state, retry next tick.
      }
      schedule();
    }

    function schedule() {
      clearTimeout(timer);
      if (!cancelled && document.visibilityState === "visible") {
        timer = setTimeout(tick, POLL_MS);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") void tick();
      else clearTimeout(timer);
    }

    void tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchImpl]);

  return trip;
}

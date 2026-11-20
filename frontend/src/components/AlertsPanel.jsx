import { useMemo } from "react";
import { normalizeSeverity } from "../lib/health.js";

function severityStyles(sev) {
  if (sev === "high") {
    return {
      border: "border-red-500/25",
      bg: "bg-red-500/[0.06]",
      chip: "bg-red-500/15 text-red-200 ring-red-500/30",
    };
  }
  if (sev === "medium") {
    return {
      border: "border-amber-400/25",
      bg: "bg-amber-400/[0.06]",
      chip: "bg-amber-400/15 text-amber-100 ring-amber-400/35",
    };
  }
  return {
    border: "border-zinc-500/25",
    bg: "bg-zinc-500/[0.06]",
    chip: "bg-zinc-600/25 text-zinc-100 ring-zinc-500/25",
  };
}

function severityRank(sev) {
  if (sev === "high") return 0;
  if (sev === "medium") return 1;
  return 2;
}

export default function AlertsPanel({
  alerts,
  severityFilter,
  onSeverityFilter,
  onResetFilters,
  onInspectAlert,
}) {
  const grouped = useMemo(() => {
    const filtered =
      severityFilter === "all"
        ? alerts
        : alerts.filter((a) => normalizeSeverity(a.severity) === severityFilter);

    const map = new Map();
    for (const a of filtered) {
      const sev = normalizeSeverity(a.severity);
      const key = `${sev}|${a.alert_type}|${a.device_id}|${a.message}`;
      const cur = map.get(key);
      const ts = (() => {
        if (a.timestamp != null && Number.isFinite(Number(a.timestamp))) {
          return Number(a.timestamp);
        }
        if (a.created_at) {
          const ms = Date.parse(a.created_at);
          if (!Number.isNaN(ms)) return Math.floor(ms / 1000);
        }
        return Math.floor(Date.now() / 1000);
      })();
      if (!cur) {
        map.set(key, {
          key,
          severity: sev,
          alert_type: a.alert_type,
          device_id: a.device_id,
          message: a.message,
          count: 1,
          latestTs: ts,
        });
      } else {
        cur.count += 1;
        if (ts >= cur.latestTs) cur.latestTs = ts;
      }
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) => {
      const sr = severityRank(a.severity) - severityRank(b.severity);
      if (sr !== 0) return sr;
        return b.latestTs - a.latestTs;
    });
    return rows;
  }, [alerts, severityFilter]);

  const chips = [
    { id: "all", label: "All" },
    { id: "high", label: "High" },
    { id: "medium", label: "Medium" },
    { id: "low", label: "Low" },
  ];

  return (
    <div className="animate-fadeIn flex h-full min-h-[320px] flex-col rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Alerts</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Grouped repeats · critical floats to the top
          </p>
        </div>
        <button
          type="button"
          onClick={onResetFilters}
          className="text-xs text-zinc-500 transition hover:text-zinc-300"
        >
          Reset filters
        </button>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSeverityFilter(c.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold ring-1 transition ${
              severityFilter === c.id
                ? "bg-white text-zinc-950 ring-white"
                : "bg-black/30 text-zinc-400 ring-white/10 hover:text-white"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto pr-1">
        {grouped.length === 0 && (
          <p className="py-12 text-center text-sm text-zinc-600">
            No alerts match this filter.
          </p>
        )}
        {grouped.map((g) => {
          const sev = g.severity;
          const st = severityStyles(sev);
          return (
            <div
              key={g.key}
              className={`rounded-xl border px-4 py-3 text-sm transition ${st.border} ${st.bg}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${st.chip}`}
                >
                  {sev}
                </span>
                <span className="rounded-full bg-black/30 px-2 py-0.5 text-[10px] font-semibold text-zinc-200 ring-1 ring-white/10">
                  ×{g.count}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-zinc-400">
                  {g.alert_type?.replace(/_/g, " ") || "alert"}
                </span>
                <span className="text-zinc-600">·</span>
                <span className="text-xs font-medium text-zinc-200">{g.device_id}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{g.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled
                  title="Backend action not wired yet"
                  className="rounded-lg border border-white/10 bg-black/30 px-3 py-1 text-[11px] font-semibold text-zinc-500"
                >
                  Ignore alert
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onInspectAlert?.({
                      alert_type: g.alert_type,
                      device_id: g.device_id,
                      severity: g.severity,
                    })
                  }
                  className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold text-zinc-100 hover:bg-white/10"
                >
                  Highlight signal
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

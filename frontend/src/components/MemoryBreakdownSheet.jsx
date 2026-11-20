import { useMemo } from "react";

export default function MemoryBreakdownSheet({ open, onClose, observation }) {
  const rows = useMemo(() => {
    const proc = observation?.processes || {};
    const topCpu = proc.top_cpu || [];
    const topMem = proc.top_memory || [];
    const map = new Map();
    for (const r of topCpu) {
      map.set(r.pid, { ...r });
    }
    for (const r of topMem) {
      const cur = map.get(r.pid) || { pid: r.pid, name: r.name };
      map.set(r.pid, {
        ...cur,
        pid: r.pid,
        name: r.name ?? cur.name,
        cpu_percent: r.cpu_percent ?? cur.cpu_percent ?? 0,
        memory_percent: r.memory_percent ?? cur.memory_percent ?? 0,
      });
    }
    return Array.from(map.values()).sort(
      (a, b) => (b.memory_percent || 0) - (a.memory_percent || 0),
    );
  }, [observation]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm transition animate-in fade-in duration-200"
        aria-label="Close memory breakdown"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-md animate-in slide-in-from-right border-l border-white/10 bg-zinc-950/95 p-6 shadow-2xl duration-300">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Breakdown
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Memory contributors
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              Based on the latest process snapshot for this device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:border-white/20"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 140px)" }}>
          {rows.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-600">
              No memory breakdown available yet.
            </p>
          )}
          {rows.map((r) => (
            <div
              key={r.pid}
              className="rounded-xl border border-white/[0.06] bg-black/35 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-zinc-100">
                  {r.name}
                </p>
                <span className="shrink-0 text-xs tabular-nums text-emerald-300">
                  {(r.memory_percent ?? 0).toFixed(1)}%
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400/70 to-teal-400/70"
                  style={{
                    width: `${Math.min(100, Number(r.memory_percent) || 0)}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500">
                PID {r.pid} · CPU {(r.cpu_percent ?? 0).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

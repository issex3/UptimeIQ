import { useMemo, useState } from "react";

export default function ProcessTable({ observation, searchQuery = "" }) {
  const proc = observation?.processes || {};
  const topCpu = proc.top_cpu || [];
  const topMem = proc.top_memory || [];
  const newcomers = proc.new_processes || [];
  const hasProcLists = topCpu.length > 0 || topMem.length > 0;

  const [sortKey, setSortKey] = useState("cpu"); // cpu | memory

  const merged = useMemo(() => {
    const map = new Map();
    for (const row of topCpu) {
      map.set(row.pid, { ...row });
    }
    for (const row of topMem) {
      const cur = map.get(row.pid) || { pid: row.pid, name: row.name };
      map.set(row.pid, {
        ...cur,
        pid: row.pid,
        name: row.name ?? cur.name,
        cpu_percent: row.cpu_percent ?? cur.cpu_percent ?? 0,
        memory_percent: row.memory_percent ?? cur.memory_percent ?? 0,
      });
    }
    const rows = Array.from(map.values());
    rows.sort((a, b) =>
      sortKey === "cpu"
        ? (b.cpu_percent || 0) - (a.cpu_percent || 0)
        : (b.memory_percent || 0) - (a.memory_percent || 0),
    );
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => String(r.name || "").toLowerCase().includes(q))
      : rows;
    return filtered.slice(0, 14);
  }, [topCpu, topMem, sortKey, searchQuery]);

  return (
    <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Processes</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Top workloads · newest launches surfaced separately
          </p>
        </div>
        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
          {[
            { id: "cpu", label: "Sort CPU" },
            { id: "memory", label: "Sort memory" },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSortKey(t.id)}
              className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                sortKey === t.id
                  ? "bg-white text-zinc-950"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {newcomers.length > 0 && (
        <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs text-blue-100/90">
          <span className="font-semibold text-blue-200">New processes · </span>
          {newcomers.map((p) => `${p.name} (${p.pid})`).join(" · ")}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-1 text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Process</th>
              <th className="px-3 py-2 font-medium">PID</th>
              <th className="px-3 py-2 font-medium text-right">CPU %</th>
              <th className="px-3 py-2 font-medium text-right">Mem %</th>
              <th className="px-3 py-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {merged.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-10 text-center text-sm leading-relaxed text-zinc-500"
                >
                  {!observation && (
                    <>
                      No <span className="font-mono text-zinc-400">observation</span>{" "}
                      payload yet — ensure the upgraded agent is running and sending{" "}
                      <span className="font-mono text-zinc-400">observation</span> over
                      the WebSocket.
                    </>
                  )}
                  {observation && !hasProcLists && (
                    <>
                      Process lists are empty (host may restrict{" "}
                      <span className="font-mono text-zinc-400">psutil</span>, or sampler
                      returned no rows).
                    </>
                  )}
                  {observation && hasProcLists && searchQuery.trim() && (
                    <>No processes match “{searchQuery.trim()}”. Try clearing search.</>
                  )}
                </td>
              </tr>
            )}
            {merged.map((p) => (
              <tr
                key={p.pid}
                className="rounded-xl bg-white/[0.02] text-zinc-200 ring-1 ring-white/[0.04]"
              >
                <td className="max-w-[220px] truncate px-3 py-2 font-medium">
                  {p.name || "—"}
                </td>
                <td className="px-3 py-2 text-zinc-400">{p.pid}</td>
                <td className="px-3 py-2 text-right tabular-nums text-sky-300">
                  {(p.cpu_percent ?? 0).toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-emerald-300">
                  {(p.memory_percent ?? 0).toFixed(1)}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    disabled
                    title="Requires backend approval workflow"
                    className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[10px] font-semibold text-zinc-600"
                  >
                    Kill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

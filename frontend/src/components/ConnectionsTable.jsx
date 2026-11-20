export default function ConnectionsTable({ observation }) {
  const net = observation?.network || {};
  const rows = net.connections_sample || [];
  const total = net.connection_count ?? rows.length;
  const external = net.external_connection_count ?? 0;
  const latency = net.latency_ms;
  const loss = net.packet_loss_percent;

  return (
    <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Network intelligence</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            Sampled sockets · totals computed host-wide
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300">
            Total · <span className="font-semibold text-white">{total}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300">
            External ·{" "}
            <span className="font-semibold text-amber-200">{external}</span>
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300">
            Latency ·{" "}
            <span className="font-semibold text-sky-200">
              {latency != null ? `${latency.toFixed(1)} ms` : "—"}
            </span>
          </span>
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-zinc-300">
            Loss ·{" "}
            <span className="font-semibold text-violet-200">
              {loss != null ? `${loss.toFixed(1)}%` : "—"}
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-separate border-spacing-y-1 text-left text-xs">
          <thead>
            <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
              <th className="px-3 py-2 font-medium">Local</th>
              <th className="px-3 py-2 font-medium">Remote</th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={3}
                  className="px-3 py-10 text-center text-zinc-500"
                >
                  No connection samples yet (permissions may limit visibility).
                </td>
              </tr>
            )}
            {rows.map((r, idx) => (
              <tr
                key={`${r.local}-${r.remote}-${idx}`}
                className="rounded-xl bg-white/[0.02] text-zinc-200 ring-1 ring-white/[0.04]"
              >
                <td className="max-w-[240px] truncate px-3 py-2 font-mono text-[11px] text-zinc-300">
                  {r.local}
                </td>
                <td className="max-w-[260px] truncate px-3 py-2 font-mono text-[11px] text-zinc-300">
                  {r.remote}
                </td>
                <td className="px-3 py-2 text-zinc-400">{r.status || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

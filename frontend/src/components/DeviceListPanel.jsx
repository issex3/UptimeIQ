import { formatTimeAgo } from "../lib/formatTime.js";

function Dot({ level }) {
  const cls =
    level === "critical"
      ? "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.55)]"
      : level === "warning"
        ? "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.45)]"
        : "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.35)]";
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />;
}

export default function DeviceListPanel({ devices, selected, onSelect, meta }) {
  return (
    <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Devices</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">Fleet posture</p>
        </div>
      </div>
      <ul className="space-y-2">
        {devices.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-600">
            No devices yet.
          </li>
        )}
        {devices.map((id) => {
          const m = meta[id] || {};
          const active = id === selected;
          const unhealthy = m.level === "critical" || m.level === "warning";
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  active
                    ? "border-white/20 bg-white/[0.08]"
                    : unhealthy
                      ? "border-white/10 bg-red-500/[0.04] hover:border-white/15"
                      : "border-white/[0.06] bg-black/25 hover:border-white/12"
                }`}
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Dot level={m.level || "healthy"} />
                  <span className="truncate text-xs font-medium text-zinc-100">
                    {id}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
                  {m.lastSeenTs ? formatTimeAgo(m.lastSeenTs) : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

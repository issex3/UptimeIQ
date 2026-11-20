import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function fmtBytes(v) {
  if (v == null) return "—";
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GB`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MB`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} KB`;
  return `${Math.round(v)} B`;
}

export default function DiskPanel({ observation, chartData }) {
  const disk = observation?.disk || {};
  const parts = disk.partitions || [];

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
        <div className="mb-4">
          <h3 className="text-sm font-medium text-zinc-300">Disk usage</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Mounted partitions</p>
        </div>
        <div className="space-y-3">
          {parts.length === 0 && (
            <p className="py-10 text-center text-sm text-zinc-500">
              No partition telemetry yet.
            </p>
          )}
          {parts.map((p) => (
            <div
              key={p.mountpoint}
              className="rounded-xl border border-white/[0.06] bg-black/30 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-zinc-200">
                    {p.mountpoint}
                  </p>
                  <p className="mt-0.5 text-[10px] text-zinc-500">
                    {p.fstype || "unknown"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-white">
                    {(p.percent ?? 0).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-zinc-500">
                    {fmtBytes(p.used_bytes)} / {fmtBytes(p.total_bytes)}
                  </p>
                </div>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-400/80 to-sky-400/80"
                  style={{ width: `${Math.min(100, p.percent || 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-300">Disk activity</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Read/write deltas per interval</p>
          </div>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="t"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={fmtBytes}
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                contentStyle={{
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "12px",
                  fontSize: "12px",
                }}
                formatter={(value, name) => [fmtBytes(value), name]}
              />
              <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
              <Line
                type="monotone"
                dataKey="diskRead"
                name="Read Δ"
                stroke="#34d399"
                strokeWidth={2}
                dot={false}
                animationDuration={400}
              />
              <Line
                type="monotone"
                dataKey="diskWrite"
                name="Write Δ"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                animationDuration={400}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

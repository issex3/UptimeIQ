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
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} GB`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)} MB`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(2)} KB`;
  return `${Math.round(v)} B`;
}

export default function NetworkThroughput({ data }) {
  return (
    <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-300">Network throughput</h3>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Δ / interval
        </span>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              dataKey="netIn"
              name="In"
              stroke="#38bdf8"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={400}
            />
            <Line
              type="monotone"
              dataKey="netOut"
              name="Out"
              stroke="#a78bfa"
              strokeWidth={2}
              dot={false}
              isAnimationActive
              animationDuration={400}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

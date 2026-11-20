import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const PALETTE = ["#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#f472b6", "#38bdf8"];

function buildSlices(rows, valueKey, labelKey = "name") {
  if (!rows?.length) return [];
  const sorted = [...rows].sort(
    (a, b) => (Number(b[valueKey]) || 0) - (Number(a[valueKey]) || 0),
  );
  const top = sorted.slice(0, 5);
  const rest = sorted.slice(5);
  const other = rest.reduce((s, r) => s + (Number(r[valueKey]) || 0), 0);
  const out = top.map((r) => ({
    name: String(r[labelKey] || r.name || "process"),
    value: Math.max(0, Number(r[valueKey]) || 0),
  }));
  if (other > 0.05) out.push({ name: "Other", value: other });
  return out;
}

export default function ProcessDistribution({ observation }) {
  const proc = observation?.processes || {};
  const cpuSlices = buildSlices(proc.top_cpu || [], "cpu_percent");
  const memSlices = buildSlices(proc.top_memory || [], "memory_percent");

  const mkChart = (title, data, kind) => (
    <div className="rounded-2xl border border-white/[0.06] bg-black/25 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-xs font-medium text-zinc-300">{title}</h4>
        <span className="text-[10px] uppercase tracking-wider text-zinc-600">
          Top workloads
        </span>
      </div>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={54}
              outerRadius={76}
              paddingAngle={2}
              stroke="transparent"
              isAnimationActive
              animationDuration={450}
            >
              {data.map((_, i) => (
                <Cell
                  key={`${kind}-${i}`}
                  fill={PALETTE[i % PALETTE.length]}
                  opacity={0.92}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              formatter={(v, name) => [`${Number(v).toFixed(1)}%`, name]}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", color: "#a1a1aa" }}
              formatter={(value) => (
                <span className="text-zinc-400">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  if (!cpuSlices.length && !memSlices.length) {
    return (
      <div className="rounded-2xl border border-white/[0.06] bg-surface-raised/40 p-6 text-center text-sm text-zinc-600">
        Process distribution appears once snapshots arrive.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mkChart("CPU share (top processes)", cpuSlices, "cpu")}
      {mkChart("Memory share (top processes)", memSlices, "mem")}
    </div>
  );
}

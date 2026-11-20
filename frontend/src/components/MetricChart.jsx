import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export default function MetricChart({
  title,
  dataKey,
  data,
  color,
  unit = "%",
  formatter,
  peak,
  trendGlyph,
  hint,
  onOpen,
  active,
}) {
  const fmt = formatter || ((v) => `${v?.toFixed?.(1) ?? v}${unit}`);

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (!onOpen) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`animate-fadeIn rounded-2xl border bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md transition ${
        active
          ? "border-blue-400/35 ring-2 ring-blue-500/25"
          : "border-white/[0.06]"
      } ${onOpen ? "cursor-pointer hover:border-white/15 hover:bg-surface-raised/75" : ""}`}
    >
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">{title}</h3>
          {(hint || peak != null || trendGlyph) && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
              {peak != null && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-medium text-zinc-300 ring-1 ring-white/10">
                  Peak {fmt(peak)}
                </span>
              )}
              {trendGlyph && (
                <span className="rounded-full bg-white/5 px-2 py-0.5 font-semibold text-zinc-200 ring-1 ring-white/10">
                  Trend {trendGlyph}
                </span>
              )}
              {hint && <span className="text-zinc-500">{hint}</span>}
            </div>
          )}
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Live
        </span>
      </div>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 6" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="t"
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fill: "#71717a", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#18181b",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "12px",
                fontSize: "12px",
              }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(value) => [fmt(value), title]}
            />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={color}
              strokeWidth={2}
              fill={`url(#g-${dataKey})`}
              isAnimationActive
              animationDuration={400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {onOpen && (
        <p className="mt-2 text-[10px] text-zinc-600">
          Click chart for a shortcut · investigate deeper below.
        </p>
      )}
    </div>
  );
}

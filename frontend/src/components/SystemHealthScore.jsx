export default function SystemHealthScore({ score, status, label, explanation }) {
  const ring =
    status === "critical"
      ? "from-red-500/50 to-red-600/20 ring-red-500/25"
      : status === "warning"
        ? "from-amber-400/40 to-amber-600/15 ring-amber-400/25"
        : "from-emerald-400/35 to-emerald-700/15 ring-emerald-400/25";

  const chip =
    status === "critical"
      ? "bg-red-500/15 text-red-200 ring-red-500/35"
      : status === "warning"
        ? "bg-amber-500/15 text-amber-100 ring-amber-400/35"
        : "bg-emerald-500/15 text-emerald-100 ring-emerald-400/35";

  return (
    <div
      className={`animate-fadeIn relative overflow-hidden rounded-3xl bg-gradient-to-br p-6 shadow-soft ring-1 ${ring} backdrop-blur-md`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full bg-black/35 ring-1 ring-white/10">
            <span className="text-3xl font-semibold tracking-tight text-white">
              {score}
            </span>
            <span className="absolute bottom-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              score
            </span>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              System health
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-white">{label}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1 ${chip}`}
              >
                {status}
              </span>
            </div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
              {explanation}
            </p>
          </div>
        </div>
        <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-4 py-3 text-xs text-zinc-500">
          <p className="font-medium text-zinc-400">At a glance</p>
          <p className="mt-1 leading-relaxed">
            Answers: what&apos;s happening, what changed, and what needs attention —
            without dense dashboards.
          </p>
        </div>
      </div>
    </div>
  );
}

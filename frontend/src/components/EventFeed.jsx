import { formatClock } from "../lib/formatTime.js";

const KIND_STYLES = {
  alert: "text-red-200/90 ring-red-500/25 bg-red-500/10",
  process: "text-sky-200/90 ring-sky-500/25 bg-sky-500/10",
  network: "text-violet-200/90 ring-violet-500/25 bg-violet-500/10",
  cpu: "text-amber-200/90 ring-amber-400/25 bg-amber-500/10",
  memory: "text-emerald-200/90 ring-emerald-500/25 bg-emerald-500/10",
  system: "text-zinc-200 ring-white/10 bg-white/5",
};

export default function EventFeed({ events }) {
  return (
    <div className="animate-fadeIn flex max-h-[380px] flex-col rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-3 shrink-0">
        <h3 className="text-sm font-medium text-zinc-300">Event timeline</h3>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Alerts, launches, spikes — newest first
        </p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {events.length === 0 && (
          <p className="py-10 text-center text-sm text-zinc-600">
            Waiting for live events…
          </p>
        )}
        {events.map((e) => (
          <div
            key={e.id}
            className="rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2.5"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${
                  KIND_STYLES[e.kind] || KIND_STYLES.system
                }`}
              >
                {e.kind}
              </span>
              <span className="text-[10px] text-zinc-500">
                {formatClock(e.ts)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-zinc-300">{e.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

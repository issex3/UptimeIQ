import { formatTimeAgo } from "../lib/formatTime.js";

export default function RecentChanges({ items }) {
  return (
    <div className="animate-fadeIn rounded-2xl border border-white/[0.06] bg-surface-raised/60 p-5 shadow-soft backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-zinc-300">Recent changes</h3>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Behavioral shifts detected on this device
          </p>
        </div>
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
          Live
        </span>
      </div>
      <ul className="space-y-3">
        {items.length === 0 && (
          <li className="py-8 text-center text-sm text-zinc-600">
            No notable changes in the current window.
          </li>
        )}
        {items.map((it) => (
          <li
            key={it.id}
            className="flex items-start justify-between gap-3 rounded-xl border border-white/[0.05] bg-black/25 px-3 py-2.5 transition hover:border-white/10"
          >
            <p className="text-xs leading-snug text-zinc-200">{it.message}</p>
            <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
              {formatTimeAgo(it.ts)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

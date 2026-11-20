import { useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

const LEVEL_STYLE = {
  calm: "text-teal-300 ring-teal-500/30 bg-teal-500/10",
  watch: "text-sky-200 ring-sky-500/30 bg-sky-500/10",
  elevated: "text-amber-200 ring-amber-500/30 bg-amber-500/10",
  critical: "text-rose-200 ring-rose-500/30 bg-rose-500/10",
};

export default function RiskPanel({ deviceId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setData(null);
      return undefined;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch(`/risk/${encodeURIComponent(deviceId)}`);
        if (!cancelled) setData(res);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Risk assessment failed");
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [deviceId]);

  if (!deviceId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 text-sm text-zinc-500">
        Select a device to assess early-warning risk.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
            Predictive signals
          </p>
          <h3 className="mt-1 text-lg font-semibold text-white">Failure risk</h3>
        </div>
        {data ? (
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              LEVEL_STYLE[data.risk_level] || LEVEL_STYLE.watch
            }`}
          >
            {data.risk_level} · {data.risk_score}
          </div>
        ) : null}
      </div>

      {loading && !data ? (
        <p className="mt-4 text-sm text-zinc-500">Assessing…</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-400">{error}</p> : null}

      {data ? (
        <>
          <p className="mt-3 text-xs leading-relaxed text-zinc-500">
            {data.disclaimer}
          </p>
          <ul className="mt-4 space-y-3">
            {(data.signals || []).length === 0 ? (
              <li className="text-sm text-zinc-400">
                No elevated trajectories in the last {data.lookback_hours}h
                ({data.bucket_count} minute buckets).
              </li>
            ) : (
              data.signals.map((s) => (
                <li
                  key={`${s.kind}-${s.title}`}
                  className="border-t border-white/10 pt-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-zinc-100">{s.title}</p>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                      {s.severity}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-400">
                    {s.detail}
                  </p>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

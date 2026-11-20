import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../lib/api.js";

const ACTIONS = [
  { id: "restart_service", label: "Restart service" },
  { id: "restart_container", label: "Restart container" },
];

export default function RemediationPanel({ deviceId }) {
  const [items, setItems] = useState([]);
  const [actionType, setActionType] = useState("restart_service");
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!deviceId) {
      setItems([]);
      return;
    }
    try {
      const rows = await apiFetch(
        `/remediation?device_id=${encodeURIComponent(deviceId)}&limit=12`,
      );
      setItems(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load remediations");
    }
  }, [deviceId]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  async function propose() {
    if (!deviceId || !target.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch("/remediation/propose", {
        method: "POST",
        body: JSON.stringify({
          device_id: deviceId,
          action_type: actionType,
          target: target.trim(),
          reason: reason.trim() || "Manual remediation from dashboard",
          evidence: { source: "dashboard" },
        }),
      });
      setTarget("");
      setReason("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Propose failed");
    } finally {
      setBusy(false);
    }
  }

  async function approve(id) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/remediation/${id}/approve`, {
        method: "POST",
        body: JSON.stringify({ execute_now: true }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    } finally {
      setBusy(false);
    }
  }

  async function verify(id) {
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/remediation/${id}/verify`, { method: "POST" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verify failed");
    } finally {
      setBusy(false);
    }
  }

  if (!deviceId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5 text-sm text-zinc-500">
        Select a device to propose allowlisted remediations.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/40 p-5">
      <p className="text-[11px] uppercase tracking-[0.2em] text-zinc-500">
        Controlled remediation
      </p>
      <h3 className="mt-1 text-lg font-semibold text-white">Allowlisted actions</h3>
      <p className="mt-2 text-xs leading-relaxed text-zinc-500">
        Only <code className="text-zinc-300">restart_service</code> and{" "}
        <code className="text-zinc-300">restart_container</code>. No arbitrary
        shell. Flow: propose → approve → agent execute → verify → audit.
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <select
          value={actionType}
          onChange={(e) => setActionType(e.target.value)}
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100"
        >
          {ACTIONS.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <input
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder={
            actionType === "restart_container" ? "container name" : "service name"
          }
          className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500/40"
        />
      </div>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-teal-500/40"
      />
      <button
        type="button"
        disabled={busy || !target.trim()}
        onClick={propose}
        className="mt-3 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-40"
      >
        Propose action
      </button>

      {error ? <p className="mt-3 text-xs text-red-400">{error}</p> : null}

      <ul className="mt-5 space-y-3">
        {items.length === 0 ? (
          <li className="text-sm text-zinc-500">No remediation history yet.</li>
        ) : (
          items.map((item) => (
            <li
              key={item.id}
              className="border-t border-white/10 pt-3 text-sm text-zinc-300"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-zinc-100">
                  #{item.id} {item.action_type} → {item.target}
                </p>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {item.status}
                </span>
              </div>
              <p className="mt-1 text-xs text-zinc-500">{item.reason}</p>
              {item.result_message ? (
                <p className="mt-1 text-xs text-zinc-400">{item.result_message}</p>
              ) : null}
              <div className="mt-2 flex gap-2">
                {item.status === "proposed" || item.status === "failed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => approve(item.id)}
                    className="rounded-md border border-teal-400/30 px-2 py-1 text-[11px] text-teal-200 hover:bg-teal-400/10"
                  >
                    Approve & execute
                  </button>
                ) : null}
                {item.status === "executed" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => verify(item.id)}
                    className="rounded-md border border-white/15 px-2 py-1 text-[11px] text-zinc-300 hover:bg-white/5"
                  >
                    Verify
                  </button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

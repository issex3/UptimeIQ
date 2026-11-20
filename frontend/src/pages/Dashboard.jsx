import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AlertsPanel from "../components/AlertsPanel.jsx";
import ConnectionsTable from "../components/ConnectionsTable.jsx";
import DeviceListPanel from "../components/DeviceListPanel.jsx";
import DiskPanel from "../components/DiskPanel.jsx";
import EventFeed from "../components/EventFeed.jsx";
import MemoryBreakdownSheet from "../components/MemoryBreakdownSheet.jsx";
import MetricChart from "../components/MetricChart.jsx";
import NetworkThroughput from "../components/NetworkThroughput.jsx";
import ProcessDistribution from "../components/ProcessDistribution.jsx";
import ProcessTable from "../components/ProcessTable.jsx";
import RecentChanges from "../components/RecentChanges.jsx";
import RemediationPanel from "../components/RemediationPanel.jsx";
import RiskPanel from "../components/RiskPanel.jsx";
import SetupWalkthrough, {
  isSetupComplete,
} from "../components/SetupWalkthrough.jsx";
import SystemHealthScore from "../components/SystemHealthScore.jsx";
import { apiFetch, getToken, setToken, wsMetricsUrl } from "../lib/api.js";
import { formatTimeAgo } from "../lib/formatTime.js";
import {
  computeHealthScore,
  deviceTrafficLight,
  normalizeSeverity,
} from "../lib/health.js";
import {
  filterByAge,
  seriesPeak,
  seriesTrend,
  trendGlyph,
} from "../lib/metricsInsights.js";

const LIVE_CAP = 160;
const LONG_CAP = 900;

function enrichFromObservation(base, observation) {
  const obs = observation || null;
  const disk = obs?.disk || {};
  const net = obs?.network || {};
  return {
    ...base,
    observation: obs,
    diskRead: disk.read_bytes_delta ?? null,
    diskWrite: disk.write_bytes_delta ?? null,
    latency_ms: net.latency_ms ?? null,
    connection_count: net.connection_count ?? null,
  };
}

function rowToPoint(r) {
  const base = {
    t: new Date(r.timestamp * 1000).toLocaleTimeString(),
    ts: r.timestamp,
    cpu: r.cpu,
    memory: r.memory,
    netIn: r.network_in,
    netOut: r.network_out,
    device_id: r.device_id,
  };
  return enrichFromObservation(base, r.observation);
}

function uid() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
}

function worstSeverityForDevice(alerts, deviceId) {
  let worst = "low";
  for (const a of alerts) {
    if (a.device_id !== deviceId) continue;
    const s = normalizeSeverity(a.severity);
    if (s === "high") return "high";
    if (s === "medium") worst = "medium";
  }
  return worst;
}

function mapAlertToHighlight(alertType) {
  const t = String(alertType || "").toLowerCase();
  if (t.includes("cpu")) return "cpu";
  if (t.includes("memory")) return "memory";
  if (t.includes("disk")) return "disk";
  if (t.includes("connection") || t.includes("latency") || t.includes("novel"))
    return "network";
  return null;
}

function detectBehavior(prev, curr) {
  const out = [];
  if (!prev) return out;

  const dCpu = curr.cpu - prev.cpu;
  if (dCpu >= 28) {
    out.push({
      kind: "cpu",
      message: `Large CPU spike · +${dCpu.toFixed(1)} pts`,
      ts: curr.ts,
    });
  } else if (dCpu >= 14) {
    out.push({
      kind: "cpu",
      message: `CPU jumped · +${dCpu.toFixed(1)} pts`,
      ts: curr.ts,
    });
  }

  const dMem = curr.memory - prev.memory;
  if (dMem >= 8) {
    out.push({
      kind: "memory",
      message: `Memory trending up · +${dMem.toFixed(1)} pts`,
      ts: curr.ts,
    });
  }

  const pc = curr.connection_count;
  const pp = prev.connection_count;
  if (pc != null && pp != null) {
    const jump = pc - pp;
    if (jump >= Math.max(12, pp * 0.35)) {
      out.push({
        kind: "network",
        message: `Connection surge · +${jump} (now ${pc})`,
        ts: curr.ts,
      });
    }
  }

  const nw = curr.observation?.processes?.new_processes || [];
  if (nw.length) {
    const names = nw.slice(0, 4).map((p) => `${p.name} (${p.pid})`).join(", ");
    out.push({
      kind: "process",
      message: `New processes · ${names}`,
      ts: curr.ts,
    });
  }

  return out;
}

export default function Dashboard() {
  const navigate = useNavigate();

  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("overview");
  const [byDevice, setByDevice] = useState({});
  const [liveObsByDevice, setLiveObsByDevice] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [wsStatus, setWsStatus] = useState("connecting");

  const [timeRange, setTimeRange] = useState("1h");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [processSearch, setProcessSearch] = useState("");
  const [highlightedMetric, setHighlightedMetric] = useState(null);
  const [memorySheetOpen, setMemorySheetOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState(null);

  const [recentChanges, setRecentChanges] = useState([]);
  const [eventFeed, setEventFeed] = useState([]);
  const [showSetup, setShowSetup] = useState(() => !isSetupComplete());

  const wsRef = useRef(null);
  const selectedRef = useRef(selected);
  const timeRangeRef = useRef(timeRange);
  const lastPointRef = useRef({});
  const feedSeededRef = useRef(false);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    timeRangeRef.current = timeRange;
  }, [timeRange]);

  const appendFeed = useCallback((entry) => {
    setEventFeed((prev) =>
      [{ ...entry, id: entry.id || uid() }, ...prev].slice(0, 140),
    );
  }, []);

  const appendChanges = useCallback((items) => {
    if (!items.length) return;
    setRecentChanges((prev) => {
      const next = [...items.map((it) => ({ ...it, id: uid() })), ...prev];
      return next.slice(0, 10);
    });
  }, []);

  const ingestHistRows = useCallback((hist) => {
    const bucket = {};
    const obsSeed = {};
    /** API returns newest rows first — keep only the first `observation` per device */
    for (const r of hist) {
      const p = rowToPoint(r);
      if (!bucket[p.device_id]) bucket[p.device_id] = [];
      bucket[p.device_id].push(p);
      if (obsSeed[p.device_id] === undefined) {
        obsSeed[p.device_id] = p.observation ?? null;
      }
    }
    const cap = timeRangeRef.current === "24h" ? LONG_CAP : LIVE_CAP;
    Object.keys(bucket).forEach((k) => {
      bucket[k].sort((a, b) => a.ts - b.ts);
      bucket[k] = bucket[k].slice(-cap);
      /** After trimming, newest sample in-window is authoritative for snapshots */
      const tail = bucket[k][bucket[k].length - 1];
      if (tail?.observation) {
        obsSeed[k] = tail.observation;
      }
    });
    setByDevice(bucket);
    setLiveObsByDevice(obsSeed);
    setDevices(Object.keys(bucket).sort());
    setSelected((prev) => prev || Object.keys(bucket).sort()[0] || "");
  }, []);

  const appendPoint = useCallback(
    (msg) => {
      const base = {
        t: new Date(msg.timestamp * 1000).toLocaleTimeString(),
        ts: msg.timestamp,
        cpu: msg.cpu,
        memory: msg.memory,
        netIn: msg.network_in,
        netOut: msg.network_out,
        device_id: msg.device_id,
      };
      const pt = enrichFromObservation(base, msg.observation);

      const cap = timeRangeRef.current === "24h" ? LONG_CAP : LIVE_CAP;

      setByDevice((prev) => {
        const list = prev[pt.device_id] ? [...prev[pt.device_id]] : [];
        list.push(pt);
        while (list.length > cap) list.shift();
        return { ...prev, [pt.device_id]: list };
      });

      setDevices((d) =>
        d.includes(pt.device_id) ? d : [...d, pt.device_id].sort(),
      );

      setLiveObsByDevice((prev) => ({
        ...prev,
        [msg.device_id]: msg.observation || null,
      }));

      const deviceId = msg.device_id;
      const prevPt = lastPointRef.current[deviceId];
      lastPointRef.current[deviceId] = pt;

      if (!prevPt || deviceId !== selectedRef.current) return;

      const signals = detectBehavior(prevPt, pt);
      if (!signals.length) return;

      appendChanges(
        signals.map((s) => ({
          ts: s.ts,
          message: s.message,
        })),
      );

      for (const s of signals) {
        appendFeed({
          ts: s.ts,
          kind: s.kind,
          message: s.message,
          device_id: deviceId,
        });
      }
    },
    [appendChanges, appendFeed],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const lim = timeRange === "24h" ? 3500 : 1400;
        const [hist, al] = await Promise.all([
          apiFetch(`/metrics?limit=${lim}`),
          apiFetch("/alerts"),
        ]);
        if (cancelled) return;
        ingestHistRows(hist);
        setAlerts(al);
      } catch {
        setToken(null);
        navigate("/login", { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, timeRange, ingestHistRows]);

  useEffect(() => {
    if (feedSeededRef.current) return;
    if (!alerts.length) return;
    feedSeededRef.current = true;
    const seed = alerts.slice(0, 60).map((a) => {
      let ts = Number(a.timestamp);
      if (!Number.isFinite(ts) && a.created_at) {
        const ms = Date.parse(a.created_at);
        if (!Number.isNaN(ms)) ts = Math.floor(ms / 1000);
      }
      if (!Number.isFinite(ts)) ts = Math.floor(Date.now() / 1000);
      return {
        id: `seed-${a.id}-${uid()}`,
        ts,
        kind: "alert",
        message: `[${a.device_id}] ${a.message}`,
        device_id: a.device_id,
      };
    });
    setEventFeed((prev) => [...seed, ...prev].slice(0, 160));
  }, [alerts]);

  useEffect(() => {
    let reconnect;
    let closed = false;

    function connect() {
      const token = getToken();
      if (!token) return;
      setWsStatus("connecting");
      const ws = new WebSocket(wsMetricsUrl(token));
      wsRef.current = ws;

      ws.onopen = () => setWsStatus("live");

      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === "metric") {
            appendPoint(msg);
          } else if (msg.type === "alert") {
            const row = {
              id: msg.id,
              device_id: msg.device_id,
              alert_type: msg.alert_type,
              severity: msg.severity || "medium",
              message: msg.message,
              metric_value: msg.metric_value,
              threshold: msg.threshold,
              timestamp: msg.timestamp,
            };
            setAlerts((prev) => [row, ...prev].slice(0, 260));

            const ts = Number(msg.timestamp) || Math.floor(Date.now() / 1000);
            appendFeed({
              ts,
              kind: "alert",
              message: `[${msg.device_id}] ${msg.message}`,
              device_id: msg.device_id,
            });
          }
        } catch {
          /* ignore malformed */
        }
      };

      ws.onerror = () => setWsStatus("error");

      ws.onclose = () => {
        setWsStatus("reconnecting");
        if (!closed) reconnect = window.setTimeout(connect, 1800);
      };
    }

    connect();
    return () => {
      closed = true;
      if (reconnect) clearTimeout(reconnect);
      wsRef.current?.close();
    };
  }, [appendFeed, appendPoint]);

  useEffect(() => {
    if (!selected && devices.length) setSelected(devices[0]);
  }, [devices, selected]);

  const chartDataRaw = useMemo(() => {
    if (!selected) return [];
    return byDevice[selected] || [];
  }, [byDevice, selected]);

  const filteredChartData = useMemo(
    () => filterByAge(chartDataRaw, timeRange),
    [chartDataRaw, timeRange],
  );

  const latest = chartDataRaw[chartDataRaw.length - 1];
  const observation =
    liveObsByDevice[selected] ?? latest?.observation ?? null;

  const deviceAlerts = useMemo(
    () => alerts.filter((a) => a.device_id === selected).slice(0, 24),
    [alerts, selected],
  );

  const health = useMemo(() => {
    return computeHealthScore({
      cpu: latest?.cpu ?? 0,
      memory: latest?.memory ?? 0,
      observation,
      deviceAlerts,
    });
  }, [latest, observation, deviceAlerts]);

  const deviceMeta = useMemo(() => {
    const meta = {};
    for (const id of devices) {
      const series = byDevice[id] || [];
      const last = series[series.length - 1];
      const worst = worstSeverityForDevice(alerts, id);
      const obs = liveObsByDevice[id] || last?.observation;
      meta[id] = {
        lastSeenTs: last?.ts,
        level: deviceTrafficLight({
          cpu: last?.cpu ?? 0,
          memory: last?.memory ?? 0,
          observation: obs,
          worstSeverity: worst,
        }),
      };
    }
    return meta;
  }, [devices, byDevice, alerts, liveObsByDevice]);

  const cpuPeak = useMemo(
    () => seriesPeak(filteredChartData, "cpu"),
    [filteredChartData],
  );
  const memPeak = useMemo(
    () => seriesPeak(filteredChartData, "memory"),
    [filteredChartData],
  );
  const cpuTrend = useMemo(
    () => trendGlyph(seriesTrend(filteredChartData, "cpu")),
    [filteredChartData],
  );
  const memTrend = useMemo(
    () => trendGlyph(seriesTrend(filteredChartData, "memory")),
    [filteredChartData],
  );

  const filteredFeed = useMemo(() => {
    return eventFeed.filter(
      (e) => !e.device_id || e.device_id === selected,
    );
  }, [eventFeed, selected]);

  function logout() {
    setToken(null);
    navigate("/login", { replace: true });
  }

  function scrollToProcesses() {
    setTab("processes");
    requestAnimationFrame(() => {
      document.getElementById("dash-processes")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }

  function onInspectAlert({ alert_type }) {
    const h = mapAlertToHighlight(alert_type);
    setHighlightedMetric(h);
    if (h === "cpu") {
      setTab("overview");
      requestAnimationFrame(() =>
        document.getElementById("dash-metric-cpu")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
    } else if (h === "memory") {
      setTab("overview");
      requestAnimationFrame(() =>
        document.getElementById("dash-metric-memory")?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        }),
      );
    } else if (h === "disk") {
      setTab("disk");
    } else if (h === "network") {
      setTab("network");
    }
    window.setTimeout(() => setHighlightedMetric(null), 4500);
  }

  async function runAiAnalysis() {
    if (!latest) return;
    setAiLoading(true);
    setAiError("");
    try {
      const topAlert = alerts.find((a) => a.device_id === selected);
      const payload = {
        device_id: selected || null,
        cpu: latest.cpu ?? null,
        memory: latest.memory ?? null,
        network_in: latest.netIn ?? null,
        network_out: latest.netOut ?? null,
        timestamp: latest.ts ?? null,
        notes: topAlert?.message || null,
      };
      const res = await apiFetch("/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setAiResult(res);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setAiLoading(false);
    }
  }

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "processes", label: "Processes" },
    { id: "network", label: "Network" },
    { id: "disk", label: "Disk" },
    { id: "intelligence", label: "Intelligence" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      {showSetup ? (
        <SetupWalkthrough
          deviceCount={devices.length}
          onComplete={() => setShowSetup(false)}
        />
      ) : null}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Observability
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
            Live operations
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-500">
            What&apos;s happening, what changed, and what needs attention —
            rendered quietly.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ${
              wsStatus === "live"
                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                : "bg-amber-500/10 text-amber-200 ring-amber-500/30"
            }`}
          >
            {wsStatus === "live" && "Stream connected"}
            {wsStatus === "connecting" && "Connecting…"}
            {wsStatus === "reconnecting" && "Reconnecting…"}
            {wsStatus === "error" && "Stream error"}
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white"
          >
            Log out
          </button>
        </div>
      </header>

      <div className="mb-6">
        <SystemHealthScore
          score={health.score}
          status={health.status}
          label={health.label}
          explanation={health.explanation}
        />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[260px_1fr]">
        <DeviceListPanel
          devices={devices}
          selected={selected}
          onSelect={setSelected}
          meta={deviceMeta}
        />
        <div className="grid gap-4 lg:grid-cols-2">
          <RecentChanges
            items={recentChanges.map((r) => ({
              ...r,
              ts:
                typeof r.ts === "number"
                  ? r.ts
                  : Math.floor(Date.now() / 1000),
            }))}
          />
          <EventFeed events={filteredFeed} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-white/[0.06] bg-black/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Window
          </span>
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-blue-500/25"
          >
            <option value="live">Buffered stream</option>
            <option value="1h">Last hour (approx)</option>
            <option value="24h">Last 24h (approx)</option>
          </select>
        </div>

        <div className="flex min-w-[220px] flex-1 items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Processes
          </span>
          <input
            value={processSearch}
            onChange={(e) => setProcessSearch(e.target.value)}
            placeholder="Search by process name…"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-xs text-white outline-none placeholder:text-zinc-600 focus:ring-2 focus:ring-blue-500/25"
          />
        </div>

        <div className="text-[11px] text-zinc-600">
          Focus ·{" "}
          <span className="font-semibold text-zinc-300">{selected || "—"}</span>
          {latest?.ts ? (
            <>
              {" "}
              · last sample{" "}
              <span className="text-zinc-400">{formatTimeAgo(latest.ts)}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap gap-2 rounded-2xl border border-white/[0.06] bg-black/30 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
              tab === t.id
                ? "bg-white text-zinc-950 shadow-sm"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid gap-6 lg:grid-cols-2">
            <div id="dash-metric-cpu">
              <MetricChart
                title="CPU usage"
                dataKey="cpu"
                data={filteredChartData}
                color="#60a5fa"
                peak={cpuPeak}
                trendGlyph={cpuTrend}
                hint={`Window: ${timeRange}`}
                active={highlightedMetric === "cpu"}
                onOpen={() => {
                  setHighlightedMetric("cpu");
                  scrollToProcesses();
                  window.setTimeout(() => setHighlightedMetric(null), 3500);
                }}
              />
            </div>
            <div id="dash-metric-memory">
              <MetricChart
                title="Memory usage"
                dataKey="memory"
                data={filteredChartData}
                color="#34d399"
                peak={memPeak}
                trendGlyph={memTrend}
                hint={`Window: ${timeRange}`}
                active={highlightedMetric === "memory"}
                onOpen={() => {
                  setHighlightedMetric("memory");
                  setMemorySheetOpen(true);
                  window.setTimeout(() => setHighlightedMetric(null), 3500);
                }}
              />
            </div>
            <div className="lg:col-span-2">
              <NetworkThroughput data={filteredChartData} />
            </div>
          </div>

          <div className="mt-6">
            <ProcessDistribution observation={observation} />
          </div>

          {latest && (
            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-surface-raised/40 px-5 py-4 text-xs text-zinc-400 backdrop-blur-md">
              <span className="text-zinc-500">Latest pulse · </span>
              <span className="text-zinc-200">{selected}</span>
              <span className="text-zinc-600"> · </span>
              <span>
                latency{" "}
                <span className="font-semibold text-zinc-100">
                  {latest.latency_ms != null
                    ? `${latest.latency_ms.toFixed(1)} ms`
                    : "—"}
                </span>
              </span>
              <span className="text-zinc-600"> · </span>
              <span>
                sockets{" "}
                <span className="font-semibold text-zinc-100">
                  {latest.connection_count ?? "—"}
                </span>
              </span>
              <span className="text-zinc-600"> · </span>
              <span>
                uptime{" "}
                <span className="font-semibold text-zinc-100">
                  {observation?.system?.uptime_seconds != null
                    ? `${Math.floor(observation.system.uptime_seconds / 3600)}h`
                    : "—"}
                </span>
              </span>
            </div>
          )}
        </>
      )}

      {tab === "processes" && (
        <div id="dash-processes">
          <ProcessTable observation={observation} searchQuery={processSearch} />
        </div>
      )}

      {tab === "network" && (
        <ConnectionsTable observation={observation} />
      )}

      {tab === "disk" && (
        <DiskPanel observation={observation} chartData={filteredChartData} />
      )}

      {tab === "intelligence" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <RiskPanel deviceId={selected} />
          <RemediationPanel deviceId={selected} />
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <AlertsPanel
          alerts={alerts.filter((a) => a.device_id === selected)}
          severityFilter={severityFilter}
          onSeverityFilter={setSeverityFilter}
          onResetFilters={() => setSeverityFilter("all")}
          onInspectAlert={onInspectAlert}
        />
        <div className="animate-fadeIn rounded-2xl border border-indigo-400/20 bg-gradient-to-b from-indigo-500/10 to-surface-raised/70 p-6 shadow-soft backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-indigo-100">
                AI Analysis
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-zinc-300">
                Analyze the latest snapshot for this device and return a concise
                diagnosis with recommended actions.
              </p>
            </div>
            <button
              type="button"
              onClick={runAiAnalysis}
              disabled={aiLoading || !latest}
              className="rounded-lg border border-indigo-300/30 bg-indigo-400/10 px-3 py-2 text-xs font-semibold text-indigo-100 transition hover:bg-indigo-400/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {aiLoading ? "Analyzing..." : "Analyze current device"}
            </button>
          </div>

          {aiError ? (
            <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {aiError}
            </p>
          ) : null}

          {aiResult ? (
            <div className="mt-4 space-y-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="font-semibold text-zinc-100">Issue</p>
                <p className="mt-1 text-zinc-300">{aiResult.issue || "—"}</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="font-semibold text-zinc-100">Explanation</p>
                <p className="mt-1 text-zinc-300">
                  {aiResult.explanation || "—"}
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="font-semibold text-zinc-100">Solution</p>
                <p className="mt-1 text-zinc-300">
                  {aiResult.solution || "—"}
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-4 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-400">
              No analysis yet. Click <span className="font-semibold text-zinc-200">Analyze current device</span>.
            </p>
          )}
        </div>
      </div>

      <MemoryBreakdownSheet
        open={memorySheetOpen}
        onClose={() => setMemorySheetOpen(false)}
        observation={observation}
      />
    </div>
  );
}

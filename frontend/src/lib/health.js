/** Compute 0–100 health score + narrative from scalar telemetry + alerts. */

function diskMaxPercent(observation) {
  const parts = observation?.disk?.partitions || [];
  if (!parts.length) return null;
  let max = 0;
  for (const p of parts) {
    const v = Number(p.percent);
    if (!Number.isNaN(v)) max = Math.max(max, v);
  }
  return max || null;
}

export function normalizeSeverity(s) {
  const x = String(s || "medium").toLowerCase();
  if (x === "high" || x === "critical") return "high";
  if (x === "low") return "low";
  return "medium";
}

/**
 * @param {object} params
 * @param {number} params.cpu
 * @param {number} params.memory
 * @param {object|null} params.observation
 * @param {object[]} params.deviceAlerts recent alerts for this device (already filtered client-side if needed)
 */
export function computeHealthScore({ cpu, memory, observation, deviceAlerts }) {
  let score = 100;
  const notes = [];

  const penalize = (amount, text) => {
    score -= amount;
    if (text && !notes.includes(text)) notes.push(text);
  };

  if (cpu >= 95) penalize(28, "CPU critically high");
  else if (cpu >= 85) penalize(18, "High CPU usage");
  else if (cpu >= 70) penalize(8, "Elevated CPU");

  if (memory >= 92) penalize(28, "Memory critically high");
  else if (memory >= 80) penalize(18, "High memory usage");
  else if (memory >= 68) penalize(8, "Elevated memory");

  const dmax = diskMaxPercent(observation);
  if (dmax != null) {
    if (dmax >= 95) penalize(22, "Disk nearly full");
    else if (dmax >= 90) penalize(14, "Disk usage high");
    else if (dmax >= 80) penalize(6, "Disk filling");
  }

  let highs = 0;
  let meds = 0;
  let lows = 0;
  for (const a of deviceAlerts || []) {
    const sev = normalizeSeverity(a.severity);
    if (sev === "high") highs += 1;
    else if (sev === "medium") meds += 1;
    else lows += 1;
  }
  if (highs) penalize(Math.min(34, 14 + highs * 7), "Active critical alerts");
  if (meds) penalize(Math.min(18, 6 + meds * 3), "Active warning alerts");
  if (!highs && !meds && lows) penalize(Math.min(10, 3 + lows * 2), "Informational alerts");

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status = "healthy";
  let label = "Healthy";
  if (score < 55) {
    status = "critical";
    label = "Critical";
  } else if (score < 80) {
    status = "warning";
    label = "Warning";
  }

  const explanation =
    notes.slice(0, 3).join(" · ") || "All monitored signals look steady.";

  return { score, status, label, explanation };
}

export function deviceTrafficLight({ cpu, memory, observation, worstSeverity }) {
  const disk = diskMaxPercent(observation);
  if (worstSeverity === "high" || cpu >= 88 || memory >= 88 || (disk != null && disk >= 92))
    return "critical";
  if (worstSeverity === "medium" || cpu >= 72 || memory >= 75 || (disk != null && disk >= 85))
    return "warning";
  return "healthy";
}

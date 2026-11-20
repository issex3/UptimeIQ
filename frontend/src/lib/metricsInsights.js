/** Peak / trend helpers for chart ribbons (client-side window). */

export function filterByAge(points, rangeKey) {
  if (!points?.length) return [];
  if (rangeKey === "live") return points;
  const now = Math.floor(Date.now() / 1000);
  const windows = {
    "1h": 3600,
    "24h": 86400,
  };
  const sec = windows[rangeKey] ?? 3600;
  const cut = now - sec;
  return points.filter((p) => p.ts >= cut);
}

export function seriesPeak(points, key) {
  if (!points?.length) return null;
  let max = -Infinity;
  for (const p of points) {
    const v = Number(p[key]);
    if (!Number.isNaN(v)) max = Math.max(max, v);
  }
  return Number.isFinite(max) ? max : null;
}

export function seriesTrend(points, key) {
  if (!points || points.length < 6) return "flat";
  const mid = Math.floor(points.length / 2);
  const a = points.slice(0, mid);
  const b = points.slice(mid);
  const avg = (arr) =>
    arr.reduce((s, p) => s + Number(p[key] || 0), 0) / Math.max(arr.length, 1);
  const da = avg(a);
  const db = avg(b);
  const delta = db - da;
  if (delta > 3) return "up";
  if (delta < -3) return "down";
  return "flat";
}

export function trendGlyph(t) {
  if (t === "up") return "↑";
  if (t === "down") return "↓";
  return "→";
}

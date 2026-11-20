/** Relative time for feeds (compact). */
export function formatTimeAgo(secondsUnix) {
  if (secondsUnix == null || Number.isNaN(secondsUnix)) return "—";
  const s = Math.max(0, Math.floor(Date.now() / 1000) - Number(secondsUnix));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export function formatClock(secondsUnix) {
  if (secondsUnix == null) return "—";
  return new Date(Number(secondsUnix) * 1000).toLocaleString();
}

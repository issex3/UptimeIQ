const API_BASE = import.meta.env.VITE_API_URL || "";

export function getToken() {
  return localStorage.getItem("access_token");
}

export function setToken(t) {
  if (t) localStorage.setItem("access_token", t);
  else localStorage.removeItem("access_token");
}

export async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401) {
    setToken(null);
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  return res.text();
}

/** Build WebSocket URL for live metrics (dashboard viewers must pass JWT). */
export function wsMetricsUrl(token) {
  const api =
    API_BASE ||
    `${window.location.protocol}//${window.location.hostname}:8000`;
  const wsBase = api
    .replace(/^https:/i, "wss:")
    .replace(/^http:/i, "ws:");
  const q = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${wsBase}/ws/metrics${q}`;
}

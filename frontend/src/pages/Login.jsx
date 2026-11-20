import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch, setToken } from "../lib/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      });
      setToken(data.access_token);
      navigate("/dashboard", { replace: true });
    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div
        className="animate-fadeIn w-full max-w-md rounded-3xl border border-white/10 bg-surface-raised/80 p-10 shadow-soft backdrop-blur-xl"
        style={{ animationDelay: "0.05s" }}
      >
        <div className="mb-6 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
            Demo only
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
            Portfolio MVP auth — not production-ready. Single demo user,
            plaintext credential check.
          </p>
        </div>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500/20 to-sky-500/20 ring-1 ring-white/10">
            <span className="font-display text-sm tracking-tight text-teal-200">
              IQ
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            UptimeIQ
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Sign in to view live infrastructure insight
          </p>
        </div>
        <form onSubmit={onSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Username
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none ring-0 transition focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-zinc-400">
              Password
            </label>
            <input
              type="password"
              className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none transition focus:border-teal-500/50 focus:ring-2 focus:ring-teal-500/20"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-center text-sm text-red-400/90">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-zinc-950 shadow-lg transition hover:bg-zinc-100 disabled:opacity-50"
          >
            {loading ? "Signing in…" : "Continue"}
          </button>
        </form>
        <p className="mt-8 text-center text-xs text-zinc-500">
          Demo user: <span className="text-zinc-300">admin</span> /{" "}
          <span className="text-zinc-300">admin123</span>
        </p>
      </div>
    </div>
  );
}

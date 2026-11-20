import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getToken } from "../lib/api.js";

const SETUP_KEY = "uptimeiq_setup_complete";

export function isSetupComplete() {
  return localStorage.getItem(SETUP_KEY) === "1";
}

export function markSetupComplete() {
  localStorage.setItem(SETUP_KEY, "1");
}

const SLIDES = [
  {
    id: "welcome",
    step: "01",
    title: "Connect your first host",
    body: "UptimeIQ needs a lightweight agent on each machine you want to watch. This takes about a minute.",
  },
  {
    id: "download",
    step: "02",
    title: "Download the agent",
    body: "Grab the agent package for this machine. You must download it before you can continue.",
  },
  {
    id: "run",
    step: "03",
    title: "Run it and go live",
    body: "Unzip the package, open a terminal in that folder, then start the agent with one command.",
  },
];

async function downloadAgentZip() {
  const apiBase = import.meta.env.VITE_API_URL || "";
  const token = getToken();
  const res = await fetch(`${apiBase}/agent/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Download failed");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "uptimeiq-agent.zip";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function SetupWalkthrough({ deviceCount = 0, onComplete }) {
  const [slide, setSlide] = useState(0);
  const [downloaded, setDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  const current = SLIDES[slide];
  const isDownloadSlide = current.id === "download";
  const isRunSlide = current.id === "run";
  const agentLive = deviceCount > 0;

  const canContinue = isDownloadSlide ? downloaded : true;
  const canFinish = agentLive;

  async function onDownload() {
    setError("");
    setDownloading(true);
    try {
      await downloadAgentZip();
      setDownloaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  }

  function next() {
    if (isDownloadSlide && !downloaded) return;
    if (slide < SLIDES.length - 1) setSlide((s) => s + 1);
  }

  function finish() {
    if (!canFinish) return;
    markSetupComplete();
    onComplete?.();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg border border-white/10 bg-[#0a0c10] shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
      >
        <div className="border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-teal-300/80">
              Setup
            </p>
            <p className="text-[11px] text-zinc-500">
              Step {slide + 1} of {SLIDES.length}
            </p>
          </div>
          <div className="mt-4 flex gap-2">
            {SLIDES.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition ${
                  i <= slide ? "bg-teal-400" : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>

        <div className="px-6 py-7">
          <AnimatePresence mode="wait">
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.25 }}
            >
              <p className="font-display text-xs tracking-[0.22em] text-zinc-500">
                {current.step}
              </p>
              <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight text-white">
                {current.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {current.body}
              </p>

              {isDownloadSlide ? (
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={onDownload}
                    disabled={downloading}
                    className="w-full rounded-md bg-teal-400 px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-teal-300 disabled:opacity-60"
                  >
                    {downloading
                      ? "Preparing download…"
                      : downloaded
                        ? "Download again"
                        : "Download uptimeiq-agent.zip"}
                  </button>
                  {downloaded ? (
                    <p className="text-center text-xs font-medium text-teal-300">
                      Downloaded — you can continue
                    </p>
                  ) : (
                    <p className="text-center text-xs text-zinc-500">
                      Continue stays locked until the download starts
                    </p>
                  )}
                  {error ? (
                    <p className="text-center text-xs text-red-400">{error}</p>
                  ) : null}
                </div>
              ) : null}

              {isRunSlide ? (
                <div className="mt-6 space-y-4">
                  <div className="border border-white/10 bg-black/40 px-4 py-3">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                      In the unzipped folder
                    </p>
                    <code className="mt-2 block font-mono text-sm text-teal-200">
                      cd agent-go && go run .
                    </code>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Or run <code className="text-zinc-400">uptimeiq-agent.exe</code> /
                      Python <code className="text-zinc-400">agent/run.py</code>. Leave
                      the terminal open.
                    </p>
                  </div>
                  <div
                    className={`flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${
                      agentLive
                        ? "border-teal-400/30 bg-teal-400/10 text-teal-200"
                        : "border-white/10 bg-white/[0.03] text-zinc-400"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        agentLive ? "animate-pulse bg-teal-400" : "bg-zinc-600"
                      }`}
                    />
                    {agentLive
                      ? `${deviceCount} device${deviceCount === 1 ? "" : "s"} connected`
                      : "Waiting for your agent to connect…"}
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] px-6 py-4">
          <button
            type="button"
            onClick={() => setSlide((s) => Math.max(0, s - 1))}
            disabled={slide === 0}
            className="rounded-md px-3 py-2 text-xs font-medium text-zinc-400 transition hover:text-white disabled:opacity-30"
          >
            Back
          </button>

          {slide < SLIDES.length - 1 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="rounded-md bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              disabled={!canFinish}
              className="rounded-md bg-white px-4 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {canFinish ? "Open dashboard" : "Waiting for agent…"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

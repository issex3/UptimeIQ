import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { getToken } from "../lib/api.js";

const FEATURES = [
  {
    title: "Live telemetry",
    text: "CPU, memory, disk, and network stream into one calm surface. No tab hopping.",
  },
  {
    title: "Process context",
    text: "Trace pressure to the exact process before you restart the wrong service.",
  },
  {
    title: "Smart alerts",
    text: "Severity first alerts with less noise, so the right incident rises first.",
  },
  {
    title: "Fleet view",
    text: "Move across devices with shared health state and consistent diagnostics.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Install the agent",
    text: "Drop a lightweight Go agent on each host. It streams metrics, heartbeats, and can receive allowlisted remediation commands.",
  },
  {
    n: "02",
    title: "Predict pressure early",
    text: "UptimeIQ watches trajectories: disk fill, memory growth, latency decay, recurring alerts. You see hosts trending toward downtime before they fall over.",
  },
  {
    n: "03",
    title: "Remediate with a plan",
    text: "Propose, approve, execute, verify. Only restart_service and restart_container are allowed. Everything is audited.",
  },
];

const PREDICTION_SIGNALS = [
  {
    title: "Disk exhaustion trajectory",
    detail: "Projects hours to full from fill rate so you catch storage failure before writes die.",
  },
  {
    title: "Unusual memory growth",
    detail: "Spots rising memory slopes that often precede OOM kills and restarts.",
  },
  {
    title: "Network deterioration",
    detail: "Compares recent latency to the earlier window to flag degrading paths.",
  },
  {
    title: "Recurring failure patterns",
    detail: "Surfaces alert types that keep firing, common precursors to larger outages.",
  },
];

const REMEDIATION_STEPS = [
  {
    n: "01",
    title: "Detect",
    text: "Alerts and risk signals identify pressure on a host or service.",
  },
  {
    n: "02",
    title: "Propose",
    text: "An allowlisted action is proposed with a reason and evidence trail.",
  },
  {
    n: "03",
    title: "Approve",
    text: "A human approves before anything runs. No silent automation.",
  },
  {
    n: "04",
    title: "Execute",
    text: "The agent runs only restart_service or restart_container.",
  },
  {
    n: "05",
    title: "Verify",
    text: "UptimeIQ checks whether pressure cleared, then records the audit.",
  },
];

const DEVICES = [
  { id: "edge eu 2", status: "healthy", cpu: 28, mem: 54 },
  { id: "api core 1", status: "watch", cpu: 71, mem: 66 },
  { id: "batch west", status: "healthy", cpu: 41, mem: 48 },
  { id: "cache a3", status: "healthy", cpu: 19, mem: 72 },
];

const SIGNALS = [
  { t: "12s", text: "edge eu 2 latency recovered under 25ms", tone: "ok" },
  { t: "41s", text: "memory pressure grouped across 4 hosts", tone: "warn" },
  { t: "2m", text: "agent heartbeat healthy on 1,264 devices", tone: "ok" },
];

function useLiveTick(reduceMotion, ms = 1800) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduceMotion) return undefined;
    const id = setInterval(() => setTick((n) => n + 1), ms);
    return () => clearInterval(id);
  }, [reduceMotion, ms]);
  return tick;
}

function Sparkline({ values, reduceMotion }) {
  const points = useMemo(() => {
    const w = 100;
    const h = 36;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * w;
        const y = h - (v / 100) * h;
        return `${x},${y}`;
      })
      .join(" ");
  }, [values]);

  return (
    <svg viewBox="0 0 100 36" className="h-14 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(45,212,191)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="rgb(45,212,191)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        fill="none"
        stroke="rgb(94,234,212)"
        strokeWidth="1.4"
        points={points}
        initial={false}
        animate={reduceMotion ? undefined : { opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <polygon
        points={`0,36 ${points} 100,36`}
        fill="url(#sparkFill)"
        opacity="0.9"
      />
    </svg>
  );
}

function HeroVisual({ reduceMotion }) {
  const tick = useLiveTick(reduceMotion);
  const series = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => {
        const wave = 48 + Math.sin((i + tick) * 0.45) * 18;
        const pulse = ((i * 7 + tick * 11) % 17) - 8;
        return Math.max(18, Math.min(92, wave + pulse));
      }),
    [tick],
  );

  const health = 89 + (tick % 5);
  const latency = 17 + ((tick * 3) % 11);
  const active = DEVICES[tick % DEVICES.length];

  return (
    <div className="relative isolate w-full overflow-hidden border-y border-white/[0.08] bg-[#05070a]">
      <div className="landing-scanlines pointer-events-none absolute inset-0 opacity-[0.35]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_15%_0%,rgba(45,212,191,0.16),transparent_42%),radial-gradient(ellipse_at_85%_20%,rgba(56,189,248,0.1),transparent_40%),linear-gradient(180deg,transparent,rgba(0,0,0,0.55))]" />

      <div className="relative mx-auto grid max-w-7xl lg:grid-cols-[1.15fr_0.85fr]">
        <div className="border-b border-white/[0.08] p-5 sm:p-8 lg:border-b-0 lg:border-r lg:border-white/[0.08]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-[11px] uppercase tracking-[0.28em] text-teal-300/80">
                Command surface
              </p>
              <p className="mt-1 text-sm text-zinc-400">
                Focused on <span className="text-zinc-200">{active.id}</span>
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-teal-400/20 bg-teal-400/5 px-3 py-1 text-[11px] text-teal-200">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-400" />
              </span>
              Live
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-6">
            {[
              ["Fleet health", `${health}`, ""],
              ["p95 latency", `${latency}`, "ms"],
              ["Open alerts", "2", ""],
            ].map(([label, value, suffix]) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {value}
                  {suffix ? (
                    <span className="ml-1 text-base font-medium text-zinc-500">
                      {suffix}
                    </span>
                  ) : null}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8">
            <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-500">
              <span>Throughput</span>
              <span className="text-teal-300/70">last 60s</span>
            </div>
            <Sparkline values={series} reduceMotion={reduceMotion} />
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {DEVICES.map((d) => {
              const hot = d.id === active.id;
              return (
                <div
                  key={d.id}
                  className={`border px-3 py-2 transition ${
                    hot
                      ? "border-teal-400/35 bg-teal-400/[0.07]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <p className="truncate font-mono text-[11px] text-zinc-300">{d.id}</p>
                  <p
                    className={`mt-1 text-[10px] uppercase tracking-wider ${
                      d.status === "watch" ? "text-amber-300" : "text-teal-300/80"
                    }`}
                  >
                    {d.status}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col justify-between p-5 sm:p-8">
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Signal feed
            </p>
            <ul className="mt-6 space-y-0">
              {SIGNALS.map((s, i) => (
                <motion.li
                  key={s.text}
                  initial={false}
                  animate={
                    reduceMotion
                      ? undefined
                      : { opacity: i === tick % SIGNALS.length ? 1 : 0.55 }
                  }
                  className="flex gap-4 border-t border-white/[0.06] py-4 first:border-t-0 first:pt-0"
                >
                  <span className="w-8 shrink-0 font-mono text-[11px] text-zinc-500">
                    {s.t}
                  </span>
                  <span className="text-sm leading-snug text-zinc-300">{s.text}</span>
                  <span
                    className={`ml-auto mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                      s.tone === "warn" ? "bg-amber-400" : "bg-teal-400"
                    }`}
                  />
                </motion.li>
              ))}
            </ul>
          </div>

          <div className="mt-8 border-t border-white/[0.06] pt-5">
            <p className="text-xs leading-relaxed text-zinc-500">
              Ops, security, and performance share one timeline so triage starts
              from the same picture.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const authed = Boolean(getToken());
  const goApp = () => navigate(authed ? "/dashboard" : "/login");

  return (
    <div className="min-h-full bg-[#05070a] font-sans text-zinc-100">
      <div className="pointer-events-none fixed inset-0 -z-20 bg-[#05070a]" />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(45,212,191,0.14),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(14,165,233,0.08),transparent)]" />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed -left-24 top-24 -z-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl"
        animate={reduceMotion ? undefined : { y: [0, 24, 0], opacity: [0.35, 0.55, 0.35] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none fixed -right-16 top-40 -z-10 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl"
        animate={reduceMotion ? undefined : { y: [0, -20, 0], opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <nav className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05070a]/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="font-display text-sm font-semibold tracking-[0.32em] text-white"
          >
            UptimeIQ
          </Link>
          <div className="hidden items-center gap-8 text-xs text-zinc-400 md:flex">
            <a href="#features" className="transition hover:text-white">
              Features
            </a>
            <a href="#predict" className="transition hover:text-white">
              Prediction
            </a>
            <a href="#remediation" className="transition hover:text-white">
              Remediation
            </a>
            <a href="#how" className="transition hover:text-white">
              How it works
            </a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goApp}
              className="rounded-md px-3 py-2 text-xs font-medium text-zinc-300 transition hover:text-white"
            >
              {authed ? "Dashboard" : "Log in"}
            </button>
            <button
              type="button"
              onClick={goApp}
              className="rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              Get started
            </button>
          </div>
        </div>
      </nav>

      <main>
        <section className="relative">
          <div className="mx-auto max-w-7xl px-4 pb-12 pt-16 sm:px-6 sm:pb-14 sm:pt-20 lg:px-8 lg:pt-24">
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="font-display text-base font-semibold tracking-[0.18em] text-teal-300 sm:text-lg"
            >
              UptimeIQ
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 max-w-4xl font-display text-[2.6rem] font-semibold leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl"
            >
              See the fleet.
              <br />
              <span className="text-zinc-500">Fix what matters.</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.14 }}
              className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg"
            >
              Real time host, process, and network insight, organized so operators
              move from signal to action without the noise.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mt-10 flex flex-wrap items-center gap-3"
            >
              <button
                type="button"
                onClick={goApp}
                className="rounded-md bg-teal-400 px-6 py-3 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_rgba(45,212,191,0.25)] transition hover:bg-teal-300"
              >
                Get started
              </button>
              <a
                href="#how"
                className="rounded-md border border-white/15 px-6 py-3 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:bg-white/[0.03]"
              >
                How it works
              </a>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <HeroVisual reduceMotion={!!reduceMotion} />
          </motion.div>
        </section>

        <section id="features" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Features
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Signal over spectacle.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              A quieter interface for louder systems, built around what you need
              during an incident, not a marketing deck.
            </p>
          </motion.div>

          <div className="mt-14 divide-y divide-white/[0.08] border-y border-white/[0.08]">
            {FEATURES.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="group grid gap-3 py-7 sm:grid-cols-[180px_1fr] sm:gap-10"
              >
                <p className="font-display text-sm tracking-[0.2em] text-teal-400/80 transition group-hover:text-teal-300">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <div>
                  <h3 className="font-display text-xl font-medium text-white sm:text-2xl">
                    {f.title}
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-400">
                    {f.text}
                  </p>
                </div>
              </motion.article>
            ))}
          </div>
        </section>

        <section id="predict" className="border-y border-white/[0.08] bg-[#070a0e]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55 }}
            >
              <p className="font-display text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                Prediction
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                See hosts trending toward downtime.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
                UptimeIQ turns minute level history into early warning risk
                signals: disk fill trajectories, memory growth, latency decay,
                and recurring alert patterns. Intervene before users feel an
                outage.
              </p>
              <div className="mt-8 border border-white/[0.08] bg-black/30 p-5">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                      Example risk posture
                    </p>
                    <p className="mt-2 font-display text-4xl font-semibold text-amber-200">
                      68
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">elevated · api core 1</p>
                  </div>
                  <div className="text-right text-xs text-zinc-400">
                    <p>~11h to disk 95%</p>
                    <p className="mt-1">memory +3.2%/h</p>
                    <p className="mt-1">latency 42 to 91ms</p>
                  </div>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-teal-400 via-amber-300 to-rose-400"
                    initial={{ width: "0%" }}
                    whileInView={{ width: "68%" }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </motion.div>

            <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]">
              {PREDICTION_SIGNALS.map((s, i) => (
                <motion.article
                  key={s.title}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.4 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                  className="py-5"
                >
                  <h3 className="font-display text-lg font-medium text-white">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {s.detail}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section id="remediation" className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.55 }}
            className="max-w-2xl"
          >
            <p className="font-display text-[11px] uppercase tracking-[0.28em] text-zinc-500">
              Remediation plan
            </p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Fix with a safety rail, not a blank shell.
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-zinc-400 sm:text-base">
              When a host is failing, UptimeIQ can propose a controlled action.
              Only two operations are allowlisted:{" "}
              <span className="text-zinc-200">restart_service</span> and{" "}
              <span className="text-zinc-200">restart_container</span>. Everything
              else is rejected.
            </p>
          </motion.div>

          <div className="mt-14 grid gap-3 lg:grid-cols-5">
            {REMEDIATION_STEPS.map((step, i) => (
              <motion.div
                key={step.n}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.35 }}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="border border-white/[0.08] bg-white/[0.02] p-4"
              >
                <p className="font-display text-xs tracking-[0.2em] text-teal-400/90">
                  {step.n}
                </p>
                <h3 className="mt-3 font-display text-base font-medium text-white">
                  {step.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  {step.text}
                </p>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="mt-8 grid gap-4 border border-white/[0.08] bg-[#070a0e] p-5 sm:grid-cols-3"
          >
            {[
              ["Allowed", "restart_service · restart_container"],
              ["Forbidden", "Arbitrary shell / AI run commands"],
              ["Audit", "Propose, approve, execute, verify"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                  {label}
                </p>
                <p className="mt-2 text-sm text-zinc-200">{value}</p>
              </div>
            ))}
          </motion.div>
        </section>

        <section id="how" className="relative overflow-hidden border-y border-white/[0.08] bg-[#070a0e]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(45,212,191,0.06),transparent_55%)]" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.55 }}
              className="max-w-2xl"
            >
              <p className="font-display text-[11px] uppercase tracking-[0.28em] text-zinc-500">
                How it works
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
                Install. Predict. Remediate.
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                One loop from agent install to early downtime warnings to a
                controlled remediation plan, without handing the AI a blank shell.
              </p>
            </motion.div>

            <ol className="relative mt-16 grid gap-10 md:grid-cols-3 md:gap-8">
              <div className="pointer-events-none absolute left-0 right-0 top-4 hidden h-px bg-gradient-to-r from-transparent via-teal-400/30 to-transparent md:block" />
              {STEPS.map((step, i) => (
                <motion.li
                  key={step.n}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.35 }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className="relative"
                >
                  <span className="relative z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-teal-400/40 bg-[#070a0e] font-display text-xs text-teal-300">
                    {step.n}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-medium text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                    {step.text}
                  </p>
                </motion.li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative mx-auto max-w-7xl px-4 py-28 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.6 }}
            className="relative overflow-hidden border border-white/[0.08] bg-gradient-to-br from-teal-400/[0.08] via-transparent to-sky-500/[0.06] px-6 py-16 text-center sm:px-12"
          >
            <div className="pointer-events-none absolute inset-0 landing-scanlines opacity-20" />
            <h2 className="relative font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Open the surface.
              <br />
              <span className="text-zinc-500">Keep the fleet honest.</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-sm text-zinc-400">
              Connect an agent and watch live health, alerts, and process context
              land in one place.
            </p>
            <button
              type="button"
              onClick={goApp}
              className="relative mt-9 rounded-md bg-white px-7 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
            >
              {authed ? "Open dashboard" : "Get started"}
            </button>
          </motion.div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] py-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 text-xs text-zinc-600 sm:px-6 lg:px-8">
          <span className="font-display tracking-[0.14em] text-zinc-500">UptimeIQ</span>
          <span>Live infrastructure insight</span>
        </div>
      </footer>
    </div>
  );
}

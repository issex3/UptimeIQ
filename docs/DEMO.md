# Demo recording script (60–90 seconds)

Use this when recording a Loom / YouTube clip for the README.

## Before you hit record

1. Backend on `:8002`, frontend on `:5173`, Go agent connected  
2. Browser at `http://localhost:5173` (logged out)  
3. Clear `localStorage.removeItem("uptimeiq_setup_complete")` if you want to show setup  
4. Close Slack/email notifications  

## Script

| Time | Say | Show |
|------|-----|------|
| 0:00 | “This is UptimeIQ — live host observability with early-warning signals and allowlisted remediation.” | Landing page |
| 0:08 | “Demo login only — not production auth.” | Login (`admin` / `admin123`) |
| 0:15 | “First-run setup: download the agent package — continue stays locked until download.” | Setup slides 1–2, click download |
| 0:30 | “Run the Go agent; the host appears live.” | Terminal `go run .` + dashboard device list |
| 0:45 | “Alerts and live charts from the stream.” | Overview charts / alerts |
| 1:00 | “Intelligence tab: risk signals are early warnings with an explicit disclaimer — not claimed outage prediction.” | Risk panel |
| 1:15 | “Remediation is allowlisted: restart service or container only — propose, approve, audit.” | Remediation panel |
| 1:30 | “That’s the loop: ingest → detect → warn → act safely.” | End on dashboard |

## After recording

1. Upload to Loom or unlisted YouTube  
2. Paste the URL into the README **Demo video** section  
3. Optional: add 2–3 screenshots under `docs/screenshots/`

## Live demo hosting (optional)

For a public URL:

1. Deploy API + Postgres (Railway / Fly / Render)  
2. Deploy frontend (Vercel / Netlify) with `VITE_API_URL`  
3. Run one always-on demo agent  
4. Put the URL in the README and mark auth as demo-only  

Until then, the recording + local 3-command path is enough for most applications.

# Scope: shipped vs roadmap

Honest inventory for recruiters and reviewers.

## Shipped (demo-ready)

### Ingest & dashboard
- WebSocket metric ingest from agents
- Live dashboard: CPU, memory, network, disk, processes, alerts
- Per-minute aggregates for history
- JWT-gated dashboard WebSocket viewers

### Agents
- **Go agent** (`agent-go/`): metrics, heartbeats, reconnect, short offline buffer, allowlisted remediation execution
- **Python agent** (`agent/`): metrics + rich observation payload (fallback / older path)
- Downloadable agent zip from authenticated `/agent/download`
- First-run setup walkthrough (download gated)

### Detection
- Threshold alerts (CPU, memory, disk, latency)
- Behavioral alerts (spikes, memory trend, connection surge, novel external IPs)

### Early-warning signals (“predictive” — careful meaning)
- Disk fill trajectory → rough ETA to high usage
- Memory growth slope
- Latency deterioration across a lookback window
- Recurring alert patterns (24h)
- Composite risk score with mandatory disclaimer

**Not shipped:** calibrated probability of downtime, models trained on labeled incidents.

### Controlled remediation
- Allowlist: `restart_service`, `restart_container` only
- Propose → approve → dispatch → agent result → verify → audit row
- API rejects non-allowlisted action types

**Not shipped:** unrestricted automation, AI-issued shell, unsupervised production remediations.

## Explicitly out of scope (for now)

- Multi-tenant billing / orgs
- Tailscale (or other overlay) mesh
- Mobile apps
- Full OpenTelemetry / Prometheus replacement
- Claiming “we predict outages accurately”

## How to talk about this in interviews

Good:
> “We built early-warning trajectories from minute aggregates and an allowlisted remediation control plane. Prediction is indicative until we validate against incidents.”

Avoid:
> “The system predicts downtime and auto-heals infrastructure.”

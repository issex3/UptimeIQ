# Monitor agent (Go)

Lightweight distributed agent: metrics, heartbeats, short offline buffer, allowlisted remediation.

## Run

```powershell
$env:AGENT_WS_URL="ws://localhost:8002/ws/metrics"
$env:DEVICE_ID="my-host"
go run .
# or
.\monitor-agent.exe
```

## Env

| Variable | Default | Meaning |
|----------|---------|---------|
| `AGENT_WS_URL` | `ws://localhost:8002/ws/metrics` | Platform WebSocket |
| `DEVICE_ID` | hostname | Device identity |
| `AGENT_INTERVAL` | `3s` | Sample period |
| `AGENT_BACKOFF` | `3s` | Reconnect delay |
| `AGENT_BUFFER` | `12s` | Offline buffer window |

## Remediation allowlist

The agent **only** executes:

- `restart_service` — Windows `Restart-Service` / Linux `systemctl restart`
- `restart_container` — `docker restart <name>`

Targets must match `^[A-Za-z0-9][A-Za-z0-9._-]*$`. No arbitrary shell.

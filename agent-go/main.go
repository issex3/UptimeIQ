package main

import (
	"encoding/json"
	"log"
	"net/url"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/websocket"
)

const agentVersion = "go-0.1.0"

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	wsURL := env("AGENT_WS_URL", "ws://localhost:8002/ws/metrics")
	deviceID := env("DEVICE_ID", hostname())
	interval := durationEnv("AGENT_INTERVAL", 3*time.Second)
	backoff := durationEnv("AGENT_BACKOFF", 3*time.Second)
	bufferSeconds := durationEnv("AGENT_BUFFER", 12*time.Second)
	bufMax := int(bufferSeconds/interval) + 2

	log.Printf("agent-go starting device=%s ws=%s version=%s", deviceID, wsURL, agentVersion)

	buf := NewSampleBuffer(bufMax)
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	for {
		select {
		case <-stop:
			log.Printf("shutdown")
			return
		default:
		}
		err := runSession(wsURL, deviceID, interval, buf)
		if err != nil {
			log.Printf("session ended: %v; reconnect in %s", err, backoff)
		}
		select {
		case <-stop:
			return
		case <-time.After(backoff):
		}
	}
}

func runSession(wsURL, deviceID string, interval time.Duration, buf *SampleBuffer) error {
	u, err := url.Parse(wsURL)
	if err != nil {
		return err
	}
	conn, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
	if err != nil {
		// buffer while offline
		sample, _ := collectSample(deviceID, nil)
		buf.Push(sample)
		return err
	}
	defer conn.Close()
	log.Printf("connected upstream")

	// flush buffered samples
	for _, s := range buf.Drain() {
		if err := conn.WriteJSON(s); err != nil {
			return err
		}
	}

	done := make(chan struct{})
	go func() {
		defer close(done)
		for {
			_, raw, err := conn.ReadMessage()
			if err != nil {
				return
			}
			var msg map[string]any
			if json.Unmarshal(raw, &msg) != nil {
				continue
			}
			if msg["type"] == "remediation_command" {
				action, _ := msg["action"].(string)
				target, _ := msg["target"].(string)
				actionID := msg["action_id"]
				ok, message := runRemediation(action, target)
				_ = conn.WriteJSON(map[string]any{
					"type":      "remediation_result",
					"action_id": actionID,
					"ok":        ok,
					"message":   message,
					"device_id": deviceID,
				})
			}
		}
	}()

	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	hb := time.NewTicker(15 * time.Second)
	defer hb.Stop()

	var prev *netSnapshot
	first, snap := collectSample(deviceID, nil)
	prev = &snap
	if err := conn.WriteJSON(first); err != nil {
		return err
	}
	_ = conn.WriteJSON(map[string]any{
		"type":          "heartbeat",
		"device_id":     deviceID,
		"timestamp":     time.Now().Unix(),
		"agent_version": agentVersion,
	})

	for {
		select {
		case <-done:
			return errClosed
		case <-hb.C:
			if err := conn.WriteJSON(map[string]any{
				"type":          "heartbeat",
				"device_id":     deviceID,
				"timestamp":     time.Now().Unix(),
				"agent_version": agentVersion,
			}); err != nil {
				sample, s := collectSample(deviceID, prev)
				prev = &s
				buf.Push(sample)
				return err
			}
		case <-ticker.C:
			sample, s := collectSample(deviceID, prev)
			prev = &s
			if err := conn.WriteJSON(sample); err != nil {
				buf.Push(sample)
				return err
			}
		}
	}
}

var errClosed = &sessionClosed{}

type sessionClosed struct{}

func (e *sessionClosed) Error() string { return "connection closed" }

func hostname() string {
	h, err := os.Hostname()
	if err != nil || h == "" {
		return "go-agent"
	}
	return h
}

func durationEnv(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		// allow plain seconds
		if secs, err2 := time.ParseDuration(v + "s"); err2 == nil {
			return secs
		}
		return fallback
	}
	return d
}

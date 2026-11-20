package main

import (
	"fmt"
	"os/exec"
	"regexp"
	"runtime"
	"strings"
)

var safeTarget = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)

var allowedActions = map[string]bool{
	"restart_service":   true,
	"restart_container": true,
}

func runRemediation(action, target string) (bool, string) {
	action = strings.TrimSpace(action)
	target = strings.TrimSpace(target)
	if !allowedActions[action] {
		return false, fmt.Sprintf("action %q not allowlisted", action)
	}
	if !safeTarget.MatchString(target) {
		return false, "unsafe target rejected"
	}

	switch action {
	case "restart_service":
		return restartService(target)
	case "restart_container":
		return restartContainer(target)
	default:
		return false, "unsupported action"
	}
}

func restartService(name string) (bool, string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("powershell", "-NoProfile", "-Command",
			fmt.Sprintf("Restart-Service -Name '%s' -Force -ErrorAction Stop", name))
	default:
		cmd = exec.Command("systemctl", "restart", name)
	}
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("restart_service failed: %v (%s)", err, truncate(string(out), 400))
	}
	return true, fmt.Sprintf("service %s restarted", name)
}

func restartContainer(name string) (bool, string) {
	cmd := exec.Command("docker", "restart", name)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return false, fmt.Sprintf("restart_container failed: %v (%s)", err, truncate(string(out), 400))
	}
	return true, fmt.Sprintf("container %s restarted", name)
}

func truncate(s string, n int) string {
	s = strings.TrimSpace(s)
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

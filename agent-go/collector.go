package main

import (
	"time"

	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
)

type netSnapshot struct {
	bytesRecv uint64
	bytesSent uint64
}

func collectSample(deviceID string, prev *netSnapshot) (map[string]any, netSnapshot) {
	cpuPercents, _ := cpu.Percent(0, false)
	cpuVal := 0.0
	if len(cpuPercents) > 0 {
		cpuVal = cpuPercents[0]
	}

	vm, _ := mem.VirtualMemory()
	memVal := 0.0
	if vm != nil {
		memVal = vm.UsedPercent
	}

	counters, _ := net.IOCounters(false)
	cur := netSnapshot{}
	if len(counters) > 0 {
		cur.bytesRecv = counters[0].BytesRecv
		cur.bytesSent = counters[0].BytesSent
	}
	var inDelta, outDelta uint64
	if prev != nil {
		if cur.bytesRecv >= prev.bytesRecv {
			inDelta = cur.bytesRecv - prev.bytesRecv
		}
		if cur.bytesSent >= prev.bytesSent {
			outDelta = cur.bytesSent - prev.bytesSent
		}
	}

	diskMax := 0.0
	parts, _ := disk.Partitions(false)
	partitionObs := make([]map[string]any, 0, len(parts))
	for _, p := range parts {
		u, err := disk.Usage(p.Mountpoint)
		if err != nil || u == nil {
			continue
		}
		if u.UsedPercent > diskMax {
			diskMax = u.UsedPercent
		}
		partitionObs = append(partitionObs, map[string]any{
			"mount":   p.Mountpoint,
			"percent": u.UsedPercent,
		})
	}

	obs := map[string]any{
		"disk": map[string]any{
			"partitions": partitionObs,
		},
		"network": map[string]any{
			"latency_ms":       nil,
			"connection_count": nil,
		},
	}

	sample := map[string]any{
		"type":        "metric",
		"device_id":   deviceID,
		"cpu":         round1(cpuVal),
		"memory":      round1(memVal),
		"network_in":  inDelta,
		"network_out": outDelta,
		"timestamp":   time.Now().Unix(),
		"observation": obs,
	}
	return sample, cur
}

func round1(v float64) float64 {
	return float64(int(v*10+0.5)) / 10
}

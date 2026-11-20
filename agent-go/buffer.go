package main

import "sync"

// SampleBuffer holds recent metric payloads for brief offline periods.
type SampleBuffer struct {
	mu   sync.Mutex
	max  int
	data []map[string]any
}

func NewSampleBuffer(max int) *SampleBuffer {
	if max < 1 {
		max = 8
	}
	return &SampleBuffer{max: max}
}

func (b *SampleBuffer) Push(sample map[string]any) {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.data = append(b.data, sample)
	if len(b.data) > b.max {
		b.data = b.data[len(b.data)-b.max:]
	}
}

func (b *SampleBuffer) Drain() []map[string]any {
	b.mu.Lock()
	defer b.mu.Unlock()
	out := b.data
	b.data = nil
	return out
}

package proxy

import (
	"sync"
	"time"
)

const (
	defaultRefillPerSec = 10.0
	defaultBurst        = 20.0
)

type bucket struct {
	tokens float64
	last   time.Time
}

type Limiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	refill  float64
	burst   float64
}

func NewLimiter() *Limiter {
	return &Limiter{
		buckets: map[string]*bucket{},
		refill:  defaultRefillPerSec,
		burst:   defaultBurst,
	}
}

// Allow consumes one token for the given host. Returns false if the bucket is empty.
func (l *Limiter) Allow(host string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()

	now := time.Now()
	b, ok := l.buckets[host]
	if !ok {
		b = &bucket{tokens: l.burst, last: now}
		l.buckets[host] = b
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * l.refill
	if b.tokens > l.burst {
		b.tokens = l.burst
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

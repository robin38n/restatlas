package proxy_test

import (
	"testing"

	"github.com/robin38n/reqviz/backend/internal/proxy"
)

func TestLimiter_Allow(t *testing.T) {
	// Custom limiter with small burst/refill for fast testing.
	// Note: tokens and last are unexported, but we can test via Allow()
	l := proxy.NewLimiter()
	// Use proxy.NewLimiter() and then we might need to export some fields if we want to override them,
	// or we just use the defaults if they are sensible for tests.
	// Since we are in a separate package, we can't set unexported fields.
	// Let's assume the default NewLimiter() is fine or we add a way to configure it.
	
	host := "example.com"

	// Initial burst (default is 20)
	for i := 0; i < 20; i++ {
		if !l.Allow(host) {
			t.Errorf("expected request %d to be allowed", i+1)
		}
	}

	// Blocked
	if l.Allow(host) {
		t.Error("expected request to be blocked after burst")
	}
}

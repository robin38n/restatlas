package proxy_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/robin38n/reqviz/backend/internal/proxy"
)

func TestExecutor_Execute_HappyPath(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			t.Errorf("expected POST, got %s", r.Method)
		}
		if r.Header.Get("X-Test") != "foo" {
			t.Errorf("expected X-Test: foo, got %s", r.Header.Get("X-Test"))
		}
		if r.Header.Get("User-Agent") != "ReqViz/0.1" {
			t.Errorf("expected default User-Agent, got %s", r.Header.Get("User-Agent"))
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	}))
	defer ts.Close()

	e := proxy.New(http.DefaultClient, nil, nil)
	e.AllowLoopback = true
	// Allow the test server host
	u := ts.URL
	parsedURL, _ := url.Parse(u)
	host := parsedURL.Hostname()

	res, err := e.Execute(context.Background(), proxy.Input{
		Method:       "POST",
		URL:          u,
		Headers:      map[string]string{"X-Test": "foo"},
		Body:         map[string]string{"input": "data"},
		AllowedHosts: []string{host},
	})

	if err != nil {
		t.Fatalf("execute failed: %v", err)
	}

	if res.Status != http.StatusOK {
		t.Errorf("expected 200, got %d", res.Status)
	}

	body, ok := res.Body.(map[string]any)
	if !ok {
		t.Fatalf("expected JSON body, got %T", res.Body)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status=ok, got %v", body["status"])
	}
}

func TestExecutor_Execute_HostNotAllowed(t *testing.T) {
	e := proxy.New(nil, nil, nil)
	_, err := e.Execute(context.Background(), proxy.Input{
		Method:       "GET",
		URL:          "http://google.com/search",
		AllowedHosts: []string{"example.com"},
	})

	if !errors.Is(err, proxy.ErrHostNotAllowed) {
		t.Errorf("expected ErrHostNotAllowed, got %v", err)
	}
}

func TestExecutor_Execute_RateLimited(t *testing.T) {
	limiter := proxy.NewLimiter()
	// Since burst is unexported, we have to rely on Allow() calls to drain it.
	// Default burst is 20.
	host := "example.com"
	for i := 0; i < 20; i++ {
		limiter.Allow(host)
	}

	e := proxy.New(nil, limiter, nil)

	_, err := e.Execute(context.Background(), proxy.Input{
		Method:       "GET",
		URL:          "http://example.com",
		AllowedHosts: []string{"example.com"},
	})

	if !errors.Is(err, proxy.ErrRateLimited) {
		t.Errorf("expected ErrRateLimited, got %v", err)
	}
}

func TestExecutor_Execute_SSRFBlocked(t *testing.T) {
	e := proxy.New(nil, nil, nil)
	// resolveAndValidate will block localhost
	_, err := e.Execute(context.Background(), proxy.Input{
		Method:       "GET",
		URL:          "http://localhost:8080",
		AllowedHosts: []string{"localhost"},
	})

	if !errors.Is(err, proxy.ErrSSRFBlocked) {
		t.Errorf("expected ErrSSRFBlocked, got %v", err)
	}
}

func TestExecutor_Execute_OversizedResponse(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		// Send more than MaxResponseBytes (5MB)
		data := make([]byte, proxy.MaxResponseBytes+100)
		_, _ = w.Write(data)
	}))
	defer ts.Close()

	e := proxy.New(http.DefaultClient, nil, nil)
	e.AllowLoopback = true
	u := ts.URL
	parsedURL, _ := url.Parse(u)
	host := parsedURL.Hostname()

	res, err := e.Execute(context.Background(), proxy.Input{
		Method:       "GET",
		URL:          ts.URL,
		AllowedHosts: []string{host},
	})

	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if res.Status != http.StatusBadGateway {
		t.Errorf("expected 502, got %d", res.Status)
	}
	if !strings.Contains(fmt.Sprint(res.Body), "byte limit") {
		t.Errorf("expected body to mention byte limit, got %v", res.Body)
	}
}

package handler_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/robin38n/reqviz/backend/internal/handler"
)

func TestOriginAllowedMiddleware(t *testing.T) {
	tests := []struct {
		name    string
		origin  string
		referer string
		want    int
	}{
		{"Allowed Origin", "http://localhost:4200", "", http.StatusOK},
		{"Allowed Referer", "", "http://localhost:4200/some/path", http.StatusOK},
		{"Disallowed Origin", "http://malicious.com", "", http.StatusForbidden},
		{"Missing Origin", "", "", http.StatusForbidden},
	}

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	mw := handler.OriginAllowed(next)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/foo", nil)
			if tt.origin != "" {
				req.Header.Set("Origin", tt.origin)
			}
			if tt.referer != "" {
				req.Header.Set("Referer", tt.referer)
			}

			rr := httptest.NewRecorder()
			mw.ServeHTTP(rr, req)

			if rr.Code != tt.want {
				t.Errorf("expected status %d, got %d", tt.want, rr.Code)
			}
		})
	}
}

func TestChain(t *testing.T) {
	order := ""
	mw1 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order += "1"
			next.ServeHTTP(w, r)
		})
	}
	mw2 := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			order += "2"
			next.ServeHTTP(w, r)
		})
	}

	chained := handler.Chain(mw1, mw2)
	h := chained(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))

	h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/", nil))

	if order != "12" {
		t.Errorf("expected order 12, got %s", order)
	}
}

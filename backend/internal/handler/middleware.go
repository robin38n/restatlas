package handler

import (
	"net/http"
	"net/url"
)

var allowedOrigins = map[string]bool{
	"http://localhost:4200": true,
	"http://127.0.0.1:4200": true,
}

func originAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		ref := r.Header.Get("Referer")
		if ref == "" {
			return false
		}
		u, err := url.Parse(ref)
		if err != nil {
			return false
		}
		origin = u.Scheme + "://" + u.Host
	}
	return allowedOrigins[origin]
}

type middleware = func(http.Handler) http.Handler

// Chain composes middlewares so the first argument runs outermost.
func Chain(mws ...middleware) middleware {
	return func(next http.Handler) http.Handler {
		for i := len(mws) - 1; i >= 0; i-- {
			next = mws[i](next)
		}
		return next
	}
}

// OriginAllowed rejects requests with disallowed Origin/Referer with 403.
func OriginAllowed(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !originAllowed(r) {
			writeError(w, http.StatusForbidden, "origin not allowed")
			return
		}
		next.ServeHTTP(w, r)
	})
}

package handler

import (
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"
)

// ----- Origin allowlist ---------------------------------------------------

// allowedOrigins lists frontends permitted to call the proxy. Dev only for
// now; in production this should come from config/env.
var allowedOrigins = map[string]bool{
	"http://localhost:4200": true,
	"http://127.0.0.1:4200": true,
}

// originAllowed checks the Origin header (falling back to Referer) against
// the allowlist. A missing Origin is rejected — the proxy is not meant to
// be called from non-browser clients.
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

// ----- Response header sanitization ---------------------------------------

// allowedRespHeaders is the set of upstream response headers we forward
// to the frontend. Everything else (Set-Cookie, HSTS, WWW-Authenticate,
// CORS headers, etc.) is dropped.
var allowedRespHeaders = map[string]bool{
	"Content-Type":  true,
	"Content-Length": true,
	"Date":          true,
	"Server":        true,
	"Etag":          true,
	"Cache-Control": true,
	"Last-Modified": true,
	"Vary":          true,
}

func sanitizeHeaders(h http.Header) map[string]string {
	out := make(map[string]string, len(allowedRespHeaders))
	for k, vals := range h {
		if allowedRespHeaders[http.CanonicalHeaderKey(k)] {
			out[k] = strings.Join(vals, ", ")
		}
	}
	return out
}

// ----- Content-Type allowlist --------------------------------------------

var allowedRespContentTypePrefixes = []string{
	"application/json",
	"application/xml",
	"application/x-www-form-urlencoded",
	"text/",
}

func contentTypeAllowed(ct string) bool {
	ct = strings.ToLower(strings.TrimSpace(ct))
	if ct == "" {
		// No content-type → assume opaque; allow but caller may treat as text.
		return true
	}
	// Strip params (e.g. "application/json; charset=utf-8")
	if idx := strings.Index(ct, ";"); idx >= 0 {
		ct = strings.TrimSpace(ct[:idx])
	}
	for _, p := range allowedRespContentTypePrefixes {
		if strings.HasPrefix(ct, p) {
			return true
		}
	}
	return false
}

// ----- Numeric / encoded host detection -----------------------------------

var (
	pureDecimalRe = regexp.MustCompile(`^[0-9]+$`)
	hexHostRe     = regexp.MustCompile(`^0[xX][0-9a-fA-F]+$`)
	octalHostRe   = regexp.MustCompile(`^0[0-7]+$`)
)

// isNumericOrEncodedHost rejects hostnames like "2130706433" (decimal),
// "0x7f000001" (hex), or "017700000001" (octal) which net.ParseIP does
// not catch but which DNS / kernel may resolve to loopback.
func isNumericOrEncodedHost(host string) bool {
	host = strings.Trim(host, "[]")
	return pureDecimalRe.MatchString(host) ||
		hexHostRe.MatchString(host) ||
		octalHostRe.MatchString(host)
}

// ----- Public well-known APIs (informational) -----------------------------

// ----- Server host extraction --------------------------------------------

// extractServerHosts pulls hostnames from the OpenAPI `servers` list of a
// raw spec map. Returns a deduplicated, lower-cased slice.
func extractServerHosts(raw map[string]any) []string {
	servers, ok := raw["servers"].([]any)
	if !ok {
		return nil
	}
	seen := map[string]bool{}
	out := []string{}
	for _, s := range servers {
		obj, ok := s.(map[string]any)
		if !ok {
			continue
		}
		urlStr, _ := obj["url"].(string)
		if urlStr == "" {
			continue
		}
		u, err := url.Parse(urlStr)
		if err != nil || u.Host == "" {
			continue
		}
		host := strings.ToLower(u.Hostname())
		if !seen[host] {
			seen[host] = true
			out = append(out, host)
		}
	}
	return out
}

// ----- Per-host token-bucket rate limiter --------------------------------

const (
	rateLimitRefillPerSec = 10.0
	rateLimitBurst        = 20.0
)

type bucket struct {
	tokens float64
	last   time.Time
}

var (
	rateLimiterMu sync.Mutex
	rateLimiters  = map[string]*bucket{}
)

// allowHost consumes one token for the given host. Returns false if the
// bucket is empty (caller should respond 429).
func allowHost(host string) bool {
	rateLimiterMu.Lock()
	defer rateLimiterMu.Unlock()

	now := time.Now()
	b, ok := rateLimiters[host]
	if !ok {
		b = &bucket{tokens: rateLimitBurst, last: now}
		rateLimiters[host] = b
	}
	elapsed := now.Sub(b.last).Seconds()
	b.tokens += elapsed * rateLimitRefillPerSec
	if b.tokens > rateLimitBurst {
		b.tokens = rateLimitBurst
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

// ----- Body cap with overflow detection ----------------------------------

// readBodyWithCap reads up to max+1 bytes. If the source had more, returns
// truncated=true so the caller can fail the request.
func readBodyWithCap(r io.Reader, max int64) ([]byte, bool, error) {
	buf, err := io.ReadAll(io.LimitReader(r, max+1))
	if err != nil {
		return nil, false, err
	}
	if int64(len(buf)) > max {
		return buf[:max], true, nil
	}
	return buf, false, nil
}

// hostInList reports whether host (case-insensitive) is in the list.
func hostInList(host string, list []string) bool {
	host = strings.ToLower(host)
	for _, h := range list {
		if strings.ToLower(h) == host {
			return true
		}
	}
	return false
}


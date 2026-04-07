package proxy

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"
)

const MaxResponseBytes = 5 * 1024 * 1024

var dangerousOutboundHeaders = []string{
	"Host",
	"X-Forwarded-For",
	"X-Forwarded-Host",
	"X-Forwarded-Proto",
	"X-Real-Ip",
	"Cookie",
	"Set-Cookie",
}

var (
	ErrHostNotAllowed = errors.New("host not allowed for this spec")
	ErrRateLimited    = errors.New("rate limit exceeded for host")
	ErrSSRFBlocked    = errors.New("ssrf blocked")
	ErrBadRequest     = errors.New("bad proxy request")
)

type Input struct {
	Method       string
	URL          string
	Headers      map[string]string
	Body         any
	SpecID       string
	Origin       string
	AllowedHosts []string
}

type Result struct {
	Status     int
	Headers    map[string]string
	Body       any
	DurationMs int
}

type Executor struct {
	Client        *http.Client
	Limiter       *Limiter
	Logger        *slog.Logger
	AllowLoopback bool // For testing only
}

func New(client *http.Client, limiter *Limiter, logger *slog.Logger) *Executor {
	if client == nil {
		client = NewSafeClient()
	}
	if limiter == nil {
		limiter = NewLimiter()
	}
	if logger == nil {
		logger = slog.Default()
	}
	return &Executor{Client: client, Limiter: limiter, Logger: logger}
}

// Execute runs the full proxy pipeline: auth, rate limit, SSRF check, and execution.
func (e *Executor) Execute(ctx context.Context, in Input) (Result, error) {
	parsed, err := url.Parse(in.URL)
	if err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrBadRequest, err)
	}
	host := parsed.Hostname()

	if !HostInList(host, in.AllowedHosts) {
		return Result{}, ErrHostNotAllowed
	}
	if !e.Limiter.Allow(host) {
		return Result{}, ErrRateLimited
	}
	if !e.AllowLoopback {
		if _, err := ResolveAndValidate(ctx, host); err != nil {
			return Result{}, fmt.Errorf("%w: %v", ErrSSRFBlocked, err)
		}
	}

	var bodyReader io.Reader
	if in.Body != nil {
		bodyBytes, err := json.Marshal(in.Body)
		if err != nil {
			return Result{}, fmt.Errorf("%w: encode body: %v", ErrBadRequest, err)
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	outReq, err := http.NewRequestWithContext(ctx, in.Method, in.URL, bodyReader)
	if err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrBadRequest, err)
	}

	for k, v := range in.Headers {
		outReq.Header.Set(k, v)
	}
	for _, h := range dangerousOutboundHeaders {
		outReq.Header.Del(h)
	}
	if outReq.Header.Get("User-Agent") == "" {
		outReq.Header.Set("User-Agent", "ReqViz/0.1")
	}
	if bodyReader != nil && outReq.Header.Get("Content-Type") == "" {
		outReq.Header.Set("Content-Type", "application/json")
	}

	start := time.Now()
	resp, err := e.Client.Do(outReq)
	durationMs := int(time.Since(start).Milliseconds())

	if err != nil {
		e.Logger.Warn("proxy",
			"method", in.Method, "host", host, "spec_id", in.SpecID,
			"origin", in.Origin, "duration_ms", durationMs, "error", err.Error())
		return Result{
			Status:     0,
			Headers:    map[string]string{},
			Body:       "Network error: " + err.Error(),
			DurationMs: durationMs,
		}, nil
	}
	defer resp.Body.Close()

	headers := SanitizeHeaders(resp.Header)
	ct := resp.Header.Get("Content-Type")

	if !ContentTypeAllowed(ct) {
		e.Logger.Info("proxy",
			"method", in.Method, "host", host,
			"status", resp.StatusCode, "duration_ms", durationMs,
			"spec_id", in.SpecID, "origin", in.Origin,
			"blocked_content_type", ct)
		return Result{
			Status:     resp.StatusCode,
			Headers:    headers,
			Body:       "<binary or disallowed content-type: " + ct + ">",
			DurationMs: durationMs,
		}, nil
	}

	respBody, truncated, err := ReadBodyWithCap(resp.Body, MaxResponseBytes)
	if err != nil {
		return Result{
			Status:     resp.StatusCode,
			Headers:    headers,
			Body:       "Error reading response body: " + err.Error(),
			DurationMs: durationMs,
		}, nil
	}
	if truncated {
		return Result{
			Status:     http.StatusBadGateway,
			Headers:    headers,
			Body:       fmt.Sprintf("upstream response exceeded %d byte limit", MaxResponseBytes),
			DurationMs: durationMs,
		}, nil
	}

	var parsedBody any
	if err := json.Unmarshal(respBody, &parsedBody); err != nil {
		parsedBody = string(respBody)
	}

	e.Logger.Info("proxy",
		"method", in.Method, "host", host,
		"status", resp.StatusCode, "duration_ms", durationMs,
		"bytes", len(respBody), "spec_id", in.SpecID, "origin", in.Origin)

	return Result{
		Status:     resp.StatusCode,
		Headers:    headers,
		Body:       parsedBody,
		DurationMs: durationMs,
	}, nil
}

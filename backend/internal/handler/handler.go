package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/reqviz/backend/internal/parser"
	"github.com/robin38n/reqviz/backend/internal/store"
)

var proxyClient = newSafeProxyClient()

// dangerousOutboundHeaders are stripped from proxied requests to prevent
// credential leakage and header spoofing.
var dangerousOutboundHeaders = []string{
	"Host",
	"X-Forwarded-For",
	"X-Forwarded-Host",
	"X-Forwarded-Proto",
	"X-Real-Ip",
	"Cookie",
	"Set-Cookie",
}

// Server implements the generated ServerInterface.
type Server struct {
	store *store.SpecStore
}

func NewServer(s *store.SpecStore) *Server {
	return &Server{store: s}
}

// HealthCheck returns a simple status response.
func (s *Server) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// UploadSpec accepts a raw OpenAPI spec as JSON or YAML, validates it,
// extracts metadata, stores it, and returns a SpecSummary.
func (s *Server) UploadSpec(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20)) // 10 MB
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

	// Detect format from body content — more reliable than Content-Type
	// which may be altered by proxies or browser defaults.
	format := detectFormat(body)

	var result *parser.ParseResult
	if format == "JSON" {
		result, err = parser.FromJSON(body)
	} else {
		result, err = parser.FromYAML(body)
	}

	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, s.storeResult(result))
}

// GetSpec retrieves a previously stored spec by ID.
func (s *Server) GetSpec(w http.ResponseWriter, _ *http.Request, id openapi_types.UUID) {
	stored, err := s.store.Get(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, NotFound{strPtr("spec not found")})
		return
	}

	writeJSON(w, http.StatusOK, ParsedSpec{
		Id:  openapi_types.UUID(stored.ID),
		Raw: stored.Raw,
		Summary: SpecSummary{
			Id:            openapi_types.UUID(stored.ID),
			Title:         stored.Title,
			Version:       stored.Version,
			EndpointCount: stored.EndpointCount,
			SchemaCount:   stored.SchemaCount,
			Tags:          &stored.Tags,
			CreatedAt:     &stored.CreatedAt,
		},
	})
}

// ProxyRequest forwards an HTTP request to an external API and returns
// the response. It blocks requests to private/internal IP ranges.
func (s *Server) ProxyRequest(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20) // 1 MB incoming limit

	var req ProxyRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body: "+err.Error())
		return
	}

	if !req.Method.Valid() {
		writeError(w, http.StatusBadRequest, "invalid HTTP method")
		return
	}

	parsed, err := url.Parse(req.Url)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid URL: "+err.Error())
		return
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		writeError(w, http.StatusBadRequest, "only http and https URLs are allowed")
		return
	}

	// Defense-in-depth: pre-flight DNS check for a clear 403 on obvious cases.
	// The safe dialer provides the real protection at connection time.
	if _, err := resolveAndValidate(r.Context(), parsed.Hostname()); err != nil {
		writeError(w, http.StatusForbidden, err.Error())
		return
	}

	var bodyReader io.Reader
	if req.Body != nil {
		bodyBytes, err := json.Marshal(req.Body)
		if err != nil {
			writeError(w, http.StatusBadRequest, "failed to encode request body")
			return
		}
		bodyReader = bytes.NewReader(bodyBytes)
	}

	outReq, err := http.NewRequestWithContext(r.Context(), string(req.Method), req.Url, bodyReader)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to create request: "+err.Error())
		return
	}

	if req.Headers != nil {
		for k, v := range *req.Headers {
			outReq.Header.Set(k, v)
		}
	}

	// Strip dangerous headers after user headers are applied.
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
	resp, err := proxyClient.Do(outReq)
	durationMs := int(time.Since(start).Milliseconds())

	if err != nil {
		writeJSON(w, http.StatusOK, ProxyResponse{
			Status:     0,
			Headers:    map[string]string{},
			Body:       "Network error: " + err.Error(),
			DurationMs: &durationMs,
		})
		return
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(io.LimitReader(resp.Body, 5*1024*1024))
	if err != nil {
		writeJSON(w, http.StatusOK, ProxyResponse{
			Status:     resp.StatusCode,
			Headers:    flattenHeaders(resp.Header),
			Body:       "Error reading response body: " + err.Error(),
			DurationMs: &durationMs,
		})
		return
	}

	var parsedBody any
	if err := json.Unmarshal(respBody, &parsedBody); err != nil {
		parsedBody = string(respBody)
	}

	writeJSON(w, http.StatusOK, ProxyResponse{
		Status:     resp.StatusCode,
		Headers:    flattenHeaders(resp.Header),
		Body:       parsedBody,
		DurationMs: &durationMs,
	})
}

// parseAndStoreSpec validates a raw OpenAPI spec (as a map), extracts
// metadata, stores it, and returns a SpecSummary. Used by LoadDemo where
// the spec is already a Go map.
func (s *Server) parseAndStoreSpec(raw map[string]any) (*SpecSummary, error) {
	rawBytes, err := json.Marshal(raw)
	if err != nil {
		return nil, fmt.Errorf("failed to process spec")
	}

	result, err := parser.FromJSON(rawBytes)
	if err != nil {
		return nil, err
	}

	return s.storeResult(result), nil
}

// storeResult persists a ParseResult and returns the corresponding SpecSummary.
func (s *Server) storeResult(r *parser.ParseResult) *SpecSummary {
	stored := &store.StoredSpec{
		Title:         r.Title,
		Version:       r.Version,
		EndpointCount: r.EndpointCount,
		SchemaCount:   r.SchemaCount,
		Tags:          r.Tags,
		Raw:           r.Raw,
	}
	id := s.store.Save(stored)

	now := time.Now()
	return &SpecSummary{
		Id:            openapi_types.UUID(id),
		Title:         r.Title,
		Version:       r.Version,
		EndpointCount: r.EndpointCount,
		SchemaCount:   r.SchemaCount,
		Tags:          &r.Tags,
		CreatedAt:     &now,
	}
}

// detectFormat guesses whether body is JSON or YAML by checking if the
// trimmed content starts with '{' (JSON object).
func detectFormat(body []byte) string {
	for _, b := range body {
		switch b {
		case ' ', '\t', '\n', '\r':
			continue
		case '{':
			return "JSON"
		default:
			return "YAML"
		}
	}
	return "YAML"
}

func flattenHeaders(h http.Header) map[string]string {
	flat := make(map[string]string, len(h))
	for k, vals := range h {
		flat[k] = strings.Join(vals, ", ")
	}
	return flat
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, ValidationError{Error: &msg})
}

func strPtr(s string) *string {
	return &s
}

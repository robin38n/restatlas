package handler

import (
	"bytes"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/restatlas/backend/internal/store"
)

var proxyClient = &http.Client{Timeout: 30 * time.Second}

type Server struct {
	store *store.SpecStore
}

func NewServer(s *store.SpecStore) *Server {
	return &Server{store: s}
}

func (s *Server) HealthCheck(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) UploadSpec(w http.ResponseWriter, r *http.Request) {
	var raw map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON: "+err.Error())
		return
	}

	// Re-marshal to bytes for kin-openapi validation
	rawBytes, err := json.Marshal(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to process spec")
		return
	}

	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(rawBytes)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid OpenAPI spec: "+err.Error())
		return
	}

	// Extract metadata
	title := "Untitled"
	version := "unknown"
	if doc.Info != nil {
		if doc.Info.Title != "" {
			title = doc.Info.Title
		}
		if doc.Info.Version != "" {
			version = doc.Info.Version
		}
	}

	endpointCount := 0
	if doc.Paths != nil {
		for _, pathItem := range doc.Paths.Map() {
			if pathItem.Get != nil {
				endpointCount++
			}
			if pathItem.Post != nil {
				endpointCount++
			}
			if pathItem.Put != nil {
				endpointCount++
			}
			if pathItem.Patch != nil {
				endpointCount++
			}
			if pathItem.Delete != nil {
				endpointCount++
			}
			if pathItem.Head != nil {
				endpointCount++
			}
			if pathItem.Options != nil {
				endpointCount++
			}
		}
	}

	schemaCount := 0
	if doc.Components != nil {
		schemaCount = len(doc.Components.Schemas)
	}

	var tags []string
	for _, tag := range doc.Tags {
		tags = append(tags, tag.Name)
	}

	stored := &store.StoredSpec{
		Title:         title,
		Version:       version,
		EndpointCount: endpointCount,
		SchemaCount:   schemaCount,
		Tags:          tags,
		Raw:           raw,
	}
	id := s.store.Save(stored)

	now := time.Now()
	writeJSON(w, http.StatusCreated, SpecSummary{
		Id:            openapi_types.UUID(id),
		Title:         title,
		Version:       version,
		EndpointCount: endpointCount,
		SchemaCount:   schemaCount,
		Tags:          &tags,
		CreatedAt:     &now,
	})
}

func (s *Server) GetSpec(w http.ResponseWriter, r *http.Request, id openapi_types.UUID) {
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

func (s *Server) ProxyRequest(w http.ResponseWriter, r *http.Request) {
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

	if isPrivateHost(parsed.Hostname()) {
		writeError(w, http.StatusForbidden, "requests to private/internal addresses are not allowed")
		return
	}

	// Build outgoing request body
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
	if outReq.Header.Get("User-Agent") == "" {
		outReq.Header.Set("User-Agent", "RestAtlas/0.1")
	}
	if bodyReader != nil && outReq.Header.Get("Content-Type") == "" {
		outReq.Header.Set("Content-Type", "application/json")
	}

	start := time.Now()
	resp, err := proxyClient.Do(outReq)
	durationMs := int(time.Since(start).Milliseconds())

	if err != nil {
		// Network error — return consistent shape with status 0
		writeJSON(w, http.StatusOK, ProxyResponse{
			Status:     0,
			Headers:    map[string]string{},
			Body:       "Network error: " + err.Error(),
			DurationMs: &durationMs,
		})
		return
	}
	defer resp.Body.Close()

	// Read response body (capped at 5 MB)
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

	// Try to parse as JSON for structured response
	var parsedBody interface{}
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

func flattenHeaders(h http.Header) map[string]string {
	flat := make(map[string]string, len(h))
	for k, vals := range h {
		flat[k] = strings.Join(vals, ", ")
	}
	return flat
}

func isPrivateHost(host string) bool {
	if host == "localhost" || host == "" {
		return true
	}
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	privateRanges := []string{
		"127.0.0.0/8", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "::1/128",
	}
	for _, cidr := range privateRanges {
		_, network, _ := net.ParseCIDR(cidr)
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
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

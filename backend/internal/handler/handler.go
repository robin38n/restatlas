package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/reqviz/backend/internal/parser"
	"github.com/robin38n/reqviz/backend/internal/proxy"
	"github.com/robin38n/reqviz/backend/internal/store"
)

type Server struct {
	store *store.SpecStore
	proxy *proxy.Executor
}

func NewServer(s *store.SpecStore) *Server {
	return &Server{
		store: s,
		proxy: proxy.New(proxy.NewSafeClient(), proxy.NewLimiter(), slog.Default()),
	}
}

func (s *Server) HealthCheck(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// UploadSpec validates, stores, and returns a SpecSummary for an uploaded OpenAPI spec.
func (s *Server) UploadSpec(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(io.LimitReader(r.Body, 10<<20)) // 10 MB limit
	if err != nil {
		writeError(w, http.StatusBadRequest, "failed to read body")
		return
	}

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
			Approved:      stored.Approved,
			AllowedHosts:  stored.AllowedHosts,
		},
	})
}

// ApproveSpec marks a spec as approved and optionally updates its host allowlist.
func (s *Server) ApproveSpec(w http.ResponseWriter, r *http.Request, id openapi_types.UUID) {
	stored, err := s.store.Get(id)
	if err != nil {
		writeJSON(w, http.StatusNotFound, NotFound{strPtr("spec not found")})
		return
	}

	hosts := stored.AllowedHosts
	if r.Body != nil {
		var req ApproveSpecRequest
		_ = json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&req)
		if req.AllowedHosts != nil && len(*req.AllowedHosts) > 0 {
			hosts = *req.AllowedHosts
		}
	}

	updated, err := s.store.Approve(id, hosts)
	if err != nil {
		writeJSON(w, http.StatusNotFound, NotFound{strPtr("spec not found")})
		return
	}

	writeJSON(w, http.StatusOK, SpecSummary{
		Id:            openapi_types.UUID(updated.ID),
		Title:         updated.Title,
		Version:       updated.Version,
		EndpointCount: updated.EndpointCount,
		SchemaCount:   updated.SchemaCount,
		Tags:          &updated.Tags,
		CreatedAt:     &updated.CreatedAt,
		Approved:      updated.Approved,
		AllowedHosts:  updated.AllowedHosts,
	})
}

var proxyMiddleware = Chain(OriginAllowed)

// ProxyRequest gates and forwards requests via the proxy executor using inline middleware.
func (s *Server) ProxyRequest(w http.ResponseWriter, r *http.Request) {
	proxyMiddleware(http.HandlerFunc(s.proxyRequestCore)).ServeHTTP(w, r)
}

func (s *Server) proxyRequestCore(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)

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
	if err != nil || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		writeError(w, http.StatusBadRequest, "invalid URL: only http and https are allowed")
		return
	}

	stored, err := s.store.Get(req.SpecId)
	if err != nil {
		writeError(w, http.StatusForbidden, "unknown spec")
		return
	}
	if !stored.Approved {
		writeError(w, http.StatusForbidden, "spec not approved — please approve before sending requests")
		return
	}

	res, err := s.proxy.Execute(r.Context(), proxy.Input{
		Method:       string(req.Method),
		URL:          req.Url,
		Headers:      derefHeaders(req.Headers),
		Body:         req.Body,
		SpecID:       req.SpecId.String(),
		Origin:       r.Header.Get("Origin"),
		AllowedHosts: stored.AllowedHosts,
	})

	if err != nil {
		switch {
		case errors.Is(err, proxy.ErrHostNotAllowed):
			writeError(w, http.StatusForbidden, err.Error())
		case errors.Is(err, proxy.ErrRateLimited):
			writeError(w, http.StatusTooManyRequests, err.Error())
		case errors.Is(err, proxy.ErrSSRFBlocked):
			writeError(w, http.StatusForbidden, err.Error())
		default:
			writeError(w, http.StatusInternalServerError, "Proxy internal error: "+err.Error())
		}
		return
	}

	writeJSON(w, http.StatusOK, ProxyResponse{
		Status:     res.Status,
		Headers:    res.Headers,
		Body:       res.Body,
		DurationMs: &res.DurationMs,
	})
}

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

func (s *Server) storeResult(r *parser.ParseResult) *SpecSummary {
	stored := &store.StoredSpec{
		Title:         r.Title,
		Version:       r.Version,
		EndpointCount: r.EndpointCount,
		SchemaCount:   r.SchemaCount,
		Tags:          r.Tags,
		Raw:           r.Raw,
		AllowedHosts:  proxy.ExtractServerHosts(r.Raw),
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
		Approved:      stored.Approved,
		AllowedHosts:  stored.AllowedHosts,
	}
}

// detectFormat guesses JSON/YAML by checking if content starts with '{'.
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

func derefHeaders(h *map[string]string) map[string]string {
	if h == nil {
		return nil
	}
	return *h
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

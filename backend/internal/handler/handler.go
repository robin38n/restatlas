package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/restatlas/backend/internal/store"
)

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
	w.WriteHeader(http.StatusNotImplemented)
	writeJSON(w, http.StatusNotImplemented, map[string]string{"error": "proxy not implemented yet"})
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

package handler

import (
	"net/http"

	"github.com/robin38n/reqviz/backend/internal/handler/demos"
)

type demoEntry struct {
	Slug        string
	Title       string
	Description string
	Spec        map[string]any
}

var demoSpecs = []demoEntry{
	{
		Slug:        "jsonplaceholder",
		Title:       "JSONPlaceholder",
		Description: "Fake REST API for testing — posts, comments, users, todos. Supports all HTTP methods.",
		Spec:        demos.JSONPlaceholderSpec,
	},
	{
		Slug:        "pokeapi",
		Title:       "PokéAPI",
		Description: "Pokémon data API — browse pokemon, types, abilities. Read-only.",
		Spec:        demos.PokeAPISpec,
	},
	{
		Slug:        "dogceo",
		Title:       "Dog CEO",
		Description: "Random dog images by breed. Simple and fun.",
		Spec:        demos.DogCEOSpec,
	},
}

func demoBySlug(slug string) *demoEntry {
	for i := range demoSpecs {
		if demoSpecs[i].Slug == slug {
			return &demoSpecs[i]
		}
	}
	return nil
}

// ListDemos returns metadata for all available demo specs.
func (s *Server) ListDemos(w http.ResponseWriter, _ *http.Request) {
	list := make([]DemoInfo, len(demoSpecs))
	for i, d := range demoSpecs {
		list[i] = DemoInfo{Slug: d.Slug, Title: d.Title, Description: d.Description}
	}
	writeJSON(w, http.StatusOK, list)
}

// GetDemoSpec returns the raw OpenAPI spec JSON for a demo by slug.
func (s *Server) GetDemoSpec(w http.ResponseWriter, _ *http.Request, slug string) {
	entry := demoBySlug(slug)
	if entry == nil {
		writeJSON(w, http.StatusNotFound, NotFound{strPtr("unknown demo: " + slug)})
		return
	}
	writeJSON(w, http.StatusOK, entry.Spec)
}

// LoadDemo parses a demo spec through the shared pipeline and returns a SpecSummary.
func (s *Server) LoadDemo(w http.ResponseWriter, _ *http.Request, slug string) {
	entry := demoBySlug(slug)
	if entry == nil {
		writeJSON(w, http.StatusNotFound, NotFound{strPtr("unknown demo: " + slug)})
		return
	}

	summary, err := s.parseAndStoreSpec(entry.Spec)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "demo spec failed validation: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, summary)
}

package store

import (
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
)

type StoredSpec struct {
	ID            uuid.UUID
	Title         string
	Version       string
	EndpointCount int
	SchemaCount   int
	Tags          []string
	Raw           map[string]interface{}
	CreatedAt     time.Time
}

type SpecStore struct {
	mu    sync.RWMutex
	specs map[uuid.UUID]*StoredSpec
}

func New() *SpecStore {
	return &SpecStore{
		specs: make(map[uuid.UUID]*StoredSpec),
	}
}

func (s *SpecStore) Save(spec *StoredSpec) uuid.UUID {
	s.mu.Lock()
	defer s.mu.Unlock()

	spec.ID = uuid.New()
	spec.CreatedAt = time.Now()
	s.specs[spec.ID] = spec
	return spec.ID
}

func (s *SpecStore) Get(id uuid.UUID) (*StoredSpec, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	spec, ok := s.specs[id]
	if !ok {
		return nil, fmt.Errorf("spec not found: %s", id)
	}
	return spec, nil
}

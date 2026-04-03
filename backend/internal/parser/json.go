package parser

import (
	"encoding/json"
	"fmt"
)

// FromJSON parses a JSON byte slice into a validated ParseResult.
func FromJSON(data []byte) (*ParseResult, error) {
	var raw map[string]any
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	return extract(data, raw)
}

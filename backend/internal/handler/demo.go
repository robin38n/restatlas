package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/restatlas/backend/internal/store"
)

// demoSpec is a hardcoded Petstore-style OpenAPI spec for demo purposes.
var demoSpec = map[string]interface{}{
	"openapi": "3.0.3",
	"info": map[string]interface{}{
		"title":       "Petstore API",
		"version":     "1.0.0",
		"description": "A sample Petstore API for demonstrating RestAtlas graph visualization.",
	},
	"servers": []interface{}{
		map[string]interface{}{
			"url":         "https://petstore.example.com/api/v1",
			"description": "Production",
		},
	},
	"tags": []interface{}{
		map[string]interface{}{"name": "pets", "description": "Pet operations"},
		map[string]interface{}{"name": "store", "description": "Store operations"},
		map[string]interface{}{"name": "users", "description": "User operations"},
	},
	"paths": map[string]interface{}{
		"/pets": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listPets",
				"summary":     "List all pets",
				"tags":        []interface{}{"pets"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name":     "limit",
						"in":       "query",
						"required": false,
						"schema":   map[string]interface{}{"type": "integer", "maximum": 100},
					},
					map[string]interface{}{
						"name":     "status",
						"in":       "query",
						"required": false,
						"schema":   map[string]interface{}{"type": "string", "enum": []interface{}{"available", "pending", "sold"}},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of pets",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/Pet"},
								},
							},
						},
					},
					"400": map[string]interface{}{
						"description": "Invalid query parameters",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Error"},
							},
						},
					},
				},
			},
			"post": map[string]interface{}{
				"operationId": "createPet",
				"summary":     "Create a new pet",
				"tags":        []interface{}{"pets"},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/NewPet"},
						},
					},
				},
				"responses": map[string]interface{}{
					"201": map[string]interface{}{
						"description": "Pet created",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Pet"},
							},
						},
					},
					"422": map[string]interface{}{
						"description": "Validation error",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Error"},
							},
						},
					},
				},
			},
		},
		"/pets/{petId}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getPet",
				"summary":     "Get a pet by ID",
				"tags":        []interface{}{"pets"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name":     "petId",
						"in":       "path",
						"required": true,
						"schema":   map[string]interface{}{"type": "string", "format": "uuid"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single pet",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Pet"},
							},
						},
					},
					"404": map[string]interface{}{
						"description": "Pet not found",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Error"},
							},
						},
					},
				},
			},
			"put": map[string]interface{}{
				"operationId": "updatePet",
				"summary":     "Update an existing pet",
				"tags":        []interface{}{"pets"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name":     "petId",
						"in":       "path",
						"required": true,
						"schema":   map[string]interface{}{"type": "string", "format": "uuid"},
					},
				},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/NewPet"},
						},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Updated pet",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Pet"},
							},
						},
					},
				},
			},
			"delete": map[string]interface{}{
				"operationId": "deletePet",
				"summary":     "Delete a pet",
				"tags":        []interface{}{"pets"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name":     "petId",
						"in":       "path",
						"required": true,
						"schema":   map[string]interface{}{"type": "string", "format": "uuid"},
					},
				},
				"responses": map[string]interface{}{
					"204": map[string]interface{}{"description": "Pet deleted"},
					"404": map[string]interface{}{
						"description": "Pet not found",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Error"},
							},
						},
					},
				},
			},
		},
		"/store/orders": map[string]interface{}{
			"post": map[string]interface{}{
				"operationId": "placeOrder",
				"summary":     "Place an order for a pet",
				"tags":        []interface{}{"store"},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/Order"},
						},
					},
				},
				"responses": map[string]interface{}{
					"201": map[string]interface{}{
						"description": "Order placed",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Order"},
							},
						},
					},
				},
			},
		},
		"/users/login": map[string]interface{}{
			"post": map[string]interface{}{
				"operationId": "loginUser",
				"summary":     "Log in a user",
				"tags":        []interface{}{"users"},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/LoginRequest"},
						},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Login successful",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/User"},
							},
						},
					},
					"401": map[string]interface{}{
						"description": "Invalid credentials",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Error"},
							},
						},
					},
				},
			},
		},
	},
	"components": map[string]interface{}{
		"schemas": map[string]interface{}{
			"Pet": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "name", "status"},
				"properties": map[string]interface{}{
					"id":     map[string]interface{}{"type": "string", "format": "uuid"},
					"name":   map[string]interface{}{"type": "string"},
					"status": map[string]interface{}{"type": "string", "enum": []interface{}{"available", "pending", "sold"}},
					"tag":    map[string]interface{}{"type": "string"},
					"owner":  map[string]interface{}{"$ref": "#/components/schemas/User"},
				},
			},
			"NewPet": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"name"},
				"properties": map[string]interface{}{
					"name":   map[string]interface{}{"type": "string"},
					"tag":    map[string]interface{}{"type": "string"},
					"status": map[string]interface{}{"type": "string", "enum": []interface{}{"available", "pending", "sold"}},
				},
			},
			"Order": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"petId", "quantity"},
				"properties": map[string]interface{}{
					"id":       map[string]interface{}{"type": "string", "format": "uuid"},
					"petId":    map[string]interface{}{"type": "string", "format": "uuid"},
					"quantity": map[string]interface{}{"type": "integer"},
					"status":   map[string]interface{}{"type": "string", "enum": []interface{}{"placed", "approved", "delivered"}},
					"shipDate": map[string]interface{}{"type": "string", "format": "date-time"},
				},
			},
			"User": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "username", "email"},
				"properties": map[string]interface{}{
					"id":       map[string]interface{}{"type": "string", "format": "uuid"},
					"username": map[string]interface{}{"type": "string"},
					"email":    map[string]interface{}{"type": "string", "format": "email"},
					"role":     map[string]interface{}{"type": "string", "enum": []interface{}{"admin", "user"}},
				},
			},
			"LoginRequest": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"username", "password"},
				"properties": map[string]interface{}{
					"username": map[string]interface{}{"type": "string"},
					"password": map[string]interface{}{"type": "string", "format": "password"},
				},
			},
			"Error": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"code", "message"},
				"properties": map[string]interface{}{
					"code":    map[string]interface{}{"type": "integer"},
					"message": map[string]interface{}{"type": "string"},
				},
			},
		},
	},
}

// HandleDemo returns the hardcoded demo spec as JSON.
func (s *Server) HandleDemo(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, demoSpec)
}

// HandleDemoUpload uploads the demo spec through the normal pipeline and returns a SpecSummary.
func (s *Server) HandleDemoUpload(w http.ResponseWriter, r *http.Request) {
	rawBytes, _ := json.Marshal(demoSpec)

	// Feed it through the same upload logic by creating a synthetic request
	// Instead, just inline the validation + store logic for simplicity
	loader := openapi3.NewLoader()
	doc, err := loader.LoadFromData(rawBytes)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "demo spec failed validation: "+err.Error())
		return
	}

	title := doc.Info.Title
	version := doc.Info.Version

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
		Raw:           demoSpec,
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

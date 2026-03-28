package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/go-chi/chi/v5"
	openapi_types "github.com/oapi-codegen/runtime/types"

	"github.com/robin38n/restatlas/backend/internal/store"
)

type demoEntry struct {
	Slug        string
	Title       string
	Description string
	Spec        map[string]interface{}
}

var demoSpecs = []demoEntry{
	{
		Slug:        "jsonplaceholder",
		Title:       "JSONPlaceholder",
		Description: "Fake REST API for testing — posts, comments, users, todos. Supports all HTTP methods.",
		Spec:        jsonPlaceholderSpec,
	},
	{
		Slug:        "pokeapi",
		Title:       "PokéAPI",
		Description: "Pokémon data API — browse pokemon, types, abilities. Read-only.",
		Spec:        pokeAPISpec,
	},
	{
		Slug:        "dogceo",
		Title:       "Dog CEO",
		Description: "Random dog images by breed. Simple and fun.",
		Spec:        dogCEOSpec,
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

// ---------------------------------------------------------------------------
// JSONPlaceholder spec
// ---------------------------------------------------------------------------

var jsonPlaceholderSpec = map[string]interface{}{
	"openapi": "3.0.3",
	"info": map[string]interface{}{
		"title":       "JSONPlaceholder",
		"version":     "1.0.0",
		"description": "Free fake REST API for testing and prototyping. Powered by jsonplaceholder.typicode.com.",
	},
	"servers": []interface{}{
		map[string]interface{}{
			"url":         "https://jsonplaceholder.typicode.com",
			"description": "Production",
		},
	},
	"tags": []interface{}{
		map[string]interface{}{"name": "posts", "description": "Blog post operations"},
		map[string]interface{}{"name": "comments", "description": "Comment operations"},
		map[string]interface{}{"name": "users", "description": "User operations"},
		map[string]interface{}{"name": "todos", "description": "Todo operations"},
	},
	"paths": map[string]interface{}{
		// --- Posts ---
		"/posts": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listPosts",
				"summary":     "List all posts",
				"tags":        []interface{}{"posts"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "userId", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of posts",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/Post"},
								},
							},
						},
					},
				},
			},
			"post": map[string]interface{}{
				"operationId": "createPost",
				"summary":     "Create a new post",
				"tags":        []interface{}{"posts"},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/NewPost"},
						},
					},
				},
				"responses": map[string]interface{}{
					"201": map[string]interface{}{
						"description": "Post created",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Post"},
							},
						},
					},
				},
			},
		},
		"/posts/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getPost",
				"summary":     "Get a post by ID",
				"tags":        []interface{}{"posts"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single post",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Post"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Post not found"},
				},
			},
			"put": map[string]interface{}{
				"operationId": "updatePost",
				"summary":     "Replace a post",
				"tags":        []interface{}{"posts"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/NewPost"},
						},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Updated post",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Post"},
							},
						},
					},
				},
			},
			"patch": map[string]interface{}{
				"operationId": "patchPost",
				"summary":     "Partially update a post",
				"tags":        []interface{}{"posts"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"requestBody": map[string]interface{}{
					"required": true,
					"content": map[string]interface{}{
						"application/json": map[string]interface{}{
							"schema": map[string]interface{}{"$ref": "#/components/schemas/PostPatch"},
						},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Patched post",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Post"},
							},
						},
					},
				},
			},
			"delete": map[string]interface{}{
				"operationId": "deletePost",
				"summary":     "Delete a post",
				"tags":        []interface{}{"posts"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{"description": "Post deleted"},
				},
			},
		},
		"/posts/{id}/comments": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getPostComments",
				"summary":     "Get comments for a post",
				"tags":        []interface{}{"posts", "comments"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of comments",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/Comment"},
								},
							},
						},
					},
				},
			},
		},
		// --- Comments ---
		"/comments": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listComments",
				"summary":     "List all comments",
				"tags":        []interface{}{"comments"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "postId", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of comments",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/Comment"},
								},
							},
						},
					},
				},
			},
		},
		// --- Users ---
		"/users": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listUsers",
				"summary":     "List all users",
				"tags":        []interface{}{"users"},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of users",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/User"},
								},
							},
						},
					},
				},
			},
		},
		"/users/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getUser",
				"summary":     "Get a user by ID",
				"tags":        []interface{}{"users"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single user",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/User"},
							},
						},
					},
					"404": map[string]interface{}{"description": "User not found"},
				},
			},
		},
		// --- Todos ---
		"/todos": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listTodos",
				"summary":     "List all todos",
				"tags":        []interface{}{"todos"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "userId", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer"},
					},
					map[string]interface{}{
						"name": "completed", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "boolean"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A list of todos",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{
									"type":  "array",
									"items": map[string]interface{}{"$ref": "#/components/schemas/Todo"},
								},
							},
						},
					},
				},
			},
		},
		"/todos/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getTodo",
				"summary":     "Get a todo by ID",
				"tags":        []interface{}{"todos"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single todo",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Todo"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Todo not found"},
				},
			},
		},
	},
	"components": map[string]interface{}{
		"schemas": map[string]interface{}{
			"Post": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "userId", "title", "body"},
				"properties": map[string]interface{}{
					"id":     map[string]interface{}{"type": "integer"},
					"userId": map[string]interface{}{"type": "integer"},
					"title":  map[string]interface{}{"type": "string"},
					"body":   map[string]interface{}{"type": "string"},
				},
			},
			"NewPost": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"userId", "title", "body"},
				"properties": map[string]interface{}{
					"userId": map[string]interface{}{"type": "integer"},
					"title":  map[string]interface{}{"type": "string"},
					"body":   map[string]interface{}{"type": "string"},
				},
			},
			"PostPatch": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"title": map[string]interface{}{"type": "string"},
					"body":  map[string]interface{}{"type": "string"},
				},
			},
			"Comment": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "postId", "name", "email", "body"},
				"properties": map[string]interface{}{
					"id":     map[string]interface{}{"type": "integer"},
					"postId": map[string]interface{}{"type": "integer"},
					"name":   map[string]interface{}{"type": "string"},
					"email":  map[string]interface{}{"type": "string", "format": "email"},
					"body":   map[string]interface{}{"type": "string"},
				},
			},
			"User": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "name", "username", "email"},
				"properties": map[string]interface{}{
					"id":       map[string]interface{}{"type": "integer"},
					"name":     map[string]interface{}{"type": "string"},
					"username": map[string]interface{}{"type": "string"},
					"email":    map[string]interface{}{"type": "string", "format": "email"},
					"phone":    map[string]interface{}{"type": "string"},
					"website":  map[string]interface{}{"type": "string"},
					"address":  map[string]interface{}{"$ref": "#/components/schemas/Address"},
					"company":  map[string]interface{}{"$ref": "#/components/schemas/Company"},
				},
			},
			"Address": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"street":  map[string]interface{}{"type": "string"},
					"suite":   map[string]interface{}{"type": "string"},
					"city":    map[string]interface{}{"type": "string"},
					"zipcode": map[string]interface{}{"type": "string"},
					"geo":     map[string]interface{}{"$ref": "#/components/schemas/Geo"},
				},
			},
			"Geo": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"lat": map[string]interface{}{"type": "string"},
					"lng": map[string]interface{}{"type": "string"},
				},
			},
			"Company": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name":        map[string]interface{}{"type": "string"},
					"catchPhrase": map[string]interface{}{"type": "string"},
					"bs":          map[string]interface{}{"type": "string"},
				},
			},
			"Todo": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"id", "userId", "title", "completed"},
				"properties": map[string]interface{}{
					"id":        map[string]interface{}{"type": "integer"},
					"userId":    map[string]interface{}{"type": "integer"},
					"title":     map[string]interface{}{"type": "string"},
					"completed": map[string]interface{}{"type": "boolean"},
				},
			},
		},
	},
}

// ---------------------------------------------------------------------------
// PokéAPI spec
// ---------------------------------------------------------------------------

var pokeAPISpec = map[string]interface{}{
	"openapi": "3.0.3",
	"info": map[string]interface{}{
		"title":       "PokéAPI",
		"version":     "2.0.0",
		"description": "All the Pokémon data you'll ever need in one place. Read-only RESTful API.",
	},
	"servers": []interface{}{
		map[string]interface{}{
			"url":         "https://pokeapi.co/api/v2",
			"description": "Production",
		},
	},
	"tags": []interface{}{
		map[string]interface{}{"name": "pokemon", "description": "Pokémon data"},
		map[string]interface{}{"name": "types", "description": "Pokémon types"},
		map[string]interface{}{"name": "abilities", "description": "Pokémon abilities"},
		map[string]interface{}{"name": "generations", "description": "Game generations"},
	},
	"paths": map[string]interface{}{
		"/pokemon": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listPokemon",
				"summary":     "List pokémon",
				"tags":        []interface{}{"pokemon"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "limit", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 20},
					},
					map[string]interface{}{
						"name": "offset", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 0},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Paginated list of pokémon",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/PaginatedList"},
							},
						},
					},
				},
			},
		},
		"/pokemon/{idOrName}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getPokemon",
				"summary":     "Get a pokémon by ID or name",
				"tags":        []interface{}{"pokemon"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "idOrName", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "string"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single pokémon",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Pokemon"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Pokémon not found"},
				},
			},
		},
		"/type": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listTypes",
				"summary":     "List all types",
				"tags":        []interface{}{"types"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "limit", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 20},
					},
					map[string]interface{}{
						"name": "offset", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 0},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Paginated list of types",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/PaginatedList"},
							},
						},
					},
				},
			},
		},
		"/type/{idOrName}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getType",
				"summary":     "Get a type by ID or name",
				"tags":        []interface{}{"types"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "idOrName", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "string"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single type",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/PokemonType"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Type not found"},
				},
			},
		},
		"/ability": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listAbilities",
				"summary":     "List all abilities",
				"tags":        []interface{}{"abilities"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "limit", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 20},
					},
					map[string]interface{}{
						"name": "offset", "in": "query", "required": false,
						"schema": map[string]interface{}{"type": "integer", "default": 0},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "Paginated list of abilities",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/PaginatedList"},
							},
						},
					},
				},
			},
		},
		"/ability/{idOrName}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getAbility",
				"summary":     "Get an ability by ID or name",
				"tags":        []interface{}{"abilities"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "idOrName", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "string"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single ability",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Ability"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Ability not found"},
				},
			},
		},
		"/generation/{id}": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "getGeneration",
				"summary":     "Get a generation by ID",
				"tags":        []interface{}{"generations"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "id", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "integer"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A single generation",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/Generation"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Generation not found"},
				},
			},
		},
	},
	"components": map[string]interface{}{
		"schemas": map[string]interface{}{
			"NamedAPIResource": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"name": map[string]interface{}{"type": "string"},
					"url":  map[string]interface{}{"type": "string", "format": "uri"},
				},
			},
			"PaginatedList": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"count":    map[string]interface{}{"type": "integer"},
					"next":     map[string]interface{}{"type": "string", "format": "uri", "nullable": true},
					"previous": map[string]interface{}{"type": "string", "format": "uri", "nullable": true},
					"results": map[string]interface{}{
						"type":  "array",
						"items": map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
					},
				},
			},
			"Pokemon": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":              map[string]interface{}{"type": "integer"},
					"name":            map[string]interface{}{"type": "string"},
					"base_experience": map[string]interface{}{"type": "integer"},
					"height":          map[string]interface{}{"type": "integer"},
					"weight":          map[string]interface{}{"type": "integer"},
					"is_default":      map[string]interface{}{"type": "boolean"},
					"order":           map[string]interface{}{"type": "integer"},
					"sprites": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"front_default": map[string]interface{}{"type": "string", "format": "uri"},
							"front_shiny":   map[string]interface{}{"type": "string", "format": "uri"},
							"back_default":  map[string]interface{}{"type": "string", "format": "uri"},
							"back_shiny":    map[string]interface{}{"type": "string", "format": "uri"},
						},
					},
					"types": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"slot": map[string]interface{}{"type": "integer"},
								"type": map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
					"abilities": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"is_hidden": map[string]interface{}{"type": "boolean"},
								"slot":      map[string]interface{}{"type": "integer"},
								"ability":   map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
					"stats": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"base_stat": map[string]interface{}{"type": "integer"},
								"effort":    map[string]interface{}{"type": "integer"},
								"stat":      map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
				},
			},
			"PokemonType": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":   map[string]interface{}{"type": "integer"},
					"name": map[string]interface{}{"type": "string"},
					"pokemon": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"slot":    map[string]interface{}{"type": "integer"},
								"pokemon": map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
				},
			},
			"Ability": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":   map[string]interface{}{"type": "integer"},
					"name": map[string]interface{}{"type": "string"},
					"effect_entries": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"effect":       map[string]interface{}{"type": "string"},
								"short_effect": map[string]interface{}{"type": "string"},
								"language":     map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
					"pokemon": map[string]interface{}{
						"type": "array",
						"items": map[string]interface{}{
							"type": "object",
							"properties": map[string]interface{}{
								"is_hidden": map[string]interface{}{"type": "boolean"},
								"pokemon":   map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
							},
						},
					},
				},
			},
			"Generation": map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"id":   map[string]interface{}{"type": "integer"},
					"name": map[string]interface{}{"type": "string"},
					"main_region": map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
					"pokemon_species": map[string]interface{}{
						"type":  "array",
						"items": map[string]interface{}{"$ref": "#/components/schemas/NamedAPIResource"},
					},
				},
			},
		},
	},
}

// ---------------------------------------------------------------------------
// Dog CEO spec
// ---------------------------------------------------------------------------

var dogCEOSpec = map[string]interface{}{
	"openapi": "3.0.3",
	"info": map[string]interface{}{
		"title":       "Dog CEO",
		"version":     "1.0.0",
		"description": "The internet's biggest collection of open-source dog pictures. Free, no auth required.",
	},
	"servers": []interface{}{
		map[string]interface{}{
			"url":         "https://dog.ceo/api",
			"description": "Production",
		},
	},
	"tags": []interface{}{
		map[string]interface{}{"name": "breeds", "description": "Breed listing"},
		map[string]interface{}{"name": "images", "description": "Dog images"},
	},
	"paths": map[string]interface{}{
		"/breeds/list/all": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "listAllBreeds",
				"summary":     "List all breeds",
				"tags":        []interface{}{"breeds"},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "All breeds with sub-breeds",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/BreedList"},
							},
						},
					},
				},
			},
		},
		"/breeds/image/random": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "randomImage",
				"summary":     "Get a random dog image",
				"tags":        []interface{}{"images"},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A random dog image URL",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/SingleImage"},
							},
						},
					},
				},
			},
		},
		"/breed/{breed}/images": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "breedImages",
				"summary":     "Get all images for a breed",
				"tags":        []interface{}{"images"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "breed", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "string"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "List of image URLs for the breed",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/ImageList"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Breed not found"},
				},
			},
		},
		"/breed/{breed}/images/random": map[string]interface{}{
			"get": map[string]interface{}{
				"operationId": "breedRandomImage",
				"summary":     "Get a random image for a breed",
				"tags":        []interface{}{"images"},
				"parameters": []interface{}{
					map[string]interface{}{
						"name": "breed", "in": "path", "required": true,
						"schema": map[string]interface{}{"type": "string"},
					},
				},
				"responses": map[string]interface{}{
					"200": map[string]interface{}{
						"description": "A random image URL for the breed",
						"content": map[string]interface{}{
							"application/json": map[string]interface{}{
								"schema": map[string]interface{}{"$ref": "#/components/schemas/SingleImage"},
							},
						},
					},
					"404": map[string]interface{}{"description": "Breed not found"},
				},
			},
		},
	},
	"components": map[string]interface{}{
		"schemas": map[string]interface{}{
			"BreedList": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"status", "message"},
				"properties": map[string]interface{}{
					"status": map[string]interface{}{"type": "string"},
					"message": map[string]interface{}{
						"type": "object",
						"additionalProperties": map[string]interface{}{
							"type":  "array",
							"items": map[string]interface{}{"type": "string"},
						},
					},
				},
			},
			"SingleImage": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"status", "message"},
				"properties": map[string]interface{}{
					"status":  map[string]interface{}{"type": "string"},
					"message": map[string]interface{}{"type": "string", "format": "uri"},
				},
			},
			"ImageList": map[string]interface{}{
				"type":     "object",
				"required": []interface{}{"status", "message"},
				"properties": map[string]interface{}{
					"status": map[string]interface{}{"type": "string"},
					"message": map[string]interface{}{
						"type":  "array",
						"items": map[string]interface{}{"type": "string", "format": "uri"},
					},
				},
			},
		},
	},
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

// HandleDemoList returns the list of available demo specs.
func (s *Server) HandleDemoList(w http.ResponseWriter, r *http.Request) {
	type demoInfo struct {
		Slug        string `json:"slug"`
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	list := make([]demoInfo, len(demoSpecs))
	for i, d := range demoSpecs {
		list[i] = demoInfo{Slug: d.Slug, Title: d.Title, Description: d.Description}
	}
	writeJSON(w, http.StatusOK, list)
}

// HandleDemoUpload loads a demo spec by slug through the normal pipeline and returns a SpecSummary.
func (s *Server) HandleDemoUpload(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	entry := demoBySlug(slug)
	if entry == nil {
		writeError(w, http.StatusNotFound, "unknown demo: "+slug)
		return
	}

	rawBytes, _ := json.Marshal(entry.Spec)

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
		Raw:           entry.Spec,
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

# ReqViz

Visual OpenAPI Explorer — upload an API spec, visualize it as an interactive graph, and test endpoints with a built-in API client.

## Project Structure

```
api/openapi.yaml          # Single source of truth for all backend-frontend communication
backend/                  # Go + Chi HTTP server
  cmd/server/main.go      # Entry point
  internal/handler/        # Request handlers (implement generated ServerInterface)
  internal/handler/demos/  # Embedded demo API specs (Go maps)
  internal/store/          # In-memory spec storage
  oapi-codegen.yaml        # Go codegen config
frontend/                 # Angular 19+ SPA
  src/app/api/             # Generated types (schema.d.ts) + ApiService
  src/app/features/        # Feature modules (upload, spec-viewer, api-client)
```

## Contract-First API Communication

**All backend-frontend communication MUST go through the OpenAPI spec.**

The pipeline is:

1. Define endpoints and schemas in `api/openapi.yaml`
2. Generate Go server interface + types: `task generate:api:go` (runs `oapi-codegen`)
3. Generate TypeScript types: `task generate:api:ts` (runs `openapi-typescript`)
4. Backend implements the generated `ServerInterface` in `internal/handler/`
5. Frontend calls endpoints via the typed `openapi-fetch` client in `ApiService`

### Rules

- **Never** register routes manually in `main.go` — all routes come from the generated `HandlerFromMuxWithBaseURL`
- **Never** use raw `fetch()` in the frontend for API calls — always use `ApiService` with the typed client
- **Never** hand-write request/response types that duplicate the OpenAPI spec — import from `schema.d.ts` or `openapi_gen.go`
- When adding a new endpoint: update `openapi.yaml` first, regenerate, then implement

### Regenerating Types

```sh
task generate:api        # Both Go + TS
task generate:api:go     # Go only (from backend/)
task generate:api:ts     # TS only (from frontend/)
```

## Build & Dev

```sh
task dev                 # Start frontend + backend in parallel
task build               # Build both
task dev:frontend        # Angular dev server (port 4200)
task dev:backend         # Go server with air live-reload (port 3000)
```

## Backend Conventions

- Go 1.26+, use `any` not `interface{}`
- Chi router with oapi-codegen generated routing
- Shared logic extracted into reusable functions (e.g. `parseAndStoreSpec`, `countEndpoints`)
- DRY: if two handlers need the same logic, extract it — don't copy-paste
- Demo specs live in `internal/handler/demos/` as exported Go map variables
- Proxy endpoint blocks private/internal IPs (SSRF protection)

## Frontend Conventions

- Angular 19+ with standalone components, signals, `@if`/`@for` template syntax
- `ChangeDetectionStrategy.OnPush` for all components
- Inline templates and styles (no separate .html/.css files)
- `inject()` instead of constructor injection
- Package manager: `bun`
- Reusable components: `ResponseViewerComponent`, `SchemaFormComponent`, `RequestHistoryComponent`
- `TryItOutService` is root-scoped and shared between spec-viewer and api-client

## Testing

```sh
task test                # All tests
task test:backend        # go test ./...
task test:frontend       # bun run test (vitest)
```

## Linting

```sh
task lint
task lint:backend        # golangci-lint
task lint:frontend       # biome check
```

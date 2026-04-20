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

## Design Principles

### Security by Design

- Treat all user-supplied input as untrusted — validate and sanitize at system boundaries (API handlers, file uploads, proxy requests)
- New features that accept external input must consider injection, SSRF, path traversal, and XSS risks from the start — not as an afterthought
- Apply the principle of least privilege: services and components should only access what they need
- Never expose internal errors, stack traces, or system paths to the client

### General Programming Principles

- **DRY** — extract shared logic into reusable functions/services. Don't duplicate code across handlers or components
- **Separation of Concerns** — keep layers distinct: handlers handle HTTP, services handle business logic, stores handle data. Frontend components own presentation, services own state and API communication
- **Backend for heavy lifting** — service logic, data processing, parsing, and validation belong in the backend. The frontend is for presentation and user interaction
- **Established design patterns** — use well-known patterns (dependency injection, repository pattern, observer/signal pattern) rather than inventing custom abstractions. Follow what the framework provides
- **KISS** — prefer the simplest solution that solves the problem. Avoid clever code, premature optimization, and unnecessary indirection
- **YAGNI** — don't build for hypothetical future requirements. Implement what's needed now; refactor when actual needs emerge
- **Single Responsibility** — each function, service, and component should have one reason to change. If a unit does too many things, split it
- **Fail fast** — detect and surface errors as early as possible. Validate inputs at entry points, return meaningful errors immediately rather than letting bad state propagate
- **Composition over inheritance** — build behavior by composing small, focused units (functions, services, mixins) rather than deep class hierarchies
- **Explicit over implicit** — favor clear, readable code over magic. Avoid hidden side effects, global mutable state, and non-obvious control flow
- **Consistent naming** — use domain terminology consistently across the stack. If the OpenAPI spec calls it `spec`, don't call it `schema` or `definition` elsewhere
- **Immutability where practical** — prefer immutable data structures and pure transformations. Mutate only when there's a clear performance or ergonomic reason

### Go Conventions

- Organize by responsibility: `handler/` for HTTP concerns, `store/` for data access, extract service-layer packages as complexity grows
- Return errors, don't panic — use explicit error handling with meaningful error messages
- Use structs and interfaces for testability and dependency injection
- Keep functions small and focused — one function, one job
- Use standard library and Chi idioms; avoid unnecessary third-party dependencies

### Angular / TypeScript Conventions

- Signals for reactive state, `computed()` for derived values — avoid manual subscriptions where signals suffice
- Services own state and side effects; components own templates and user interaction
- Use Angular's dependency injection (`inject()`) — don't create service instances manually
- Keep components thin: delegate business logic to services
- Type everything — leverage the generated `schema.d.ts` types, avoid `any`

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

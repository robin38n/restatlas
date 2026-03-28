# Agent Instructions for ReqViz

## Critical: API Communication Contract

This project uses a **contract-first** approach. The OpenAPI spec at `api/openapi.yaml` is the single source of truth for all communication between the Go backend and Angular frontend.

### Adding or Modifying an Endpoint

Follow this exact sequence — no exceptions:

1. **Edit `api/openapi.yaml`** — add/modify the path, parameters, request body, response schema
2. **Run `task generate:api`** — regenerates both Go (`internal/handler/openapi_gen.go`) and TypeScript (`src/app/api/schema.d.ts`) types
3. **Implement the Go handler** — the generated `ServerInterface` will have a new method; implement it in `internal/handler/`
4. **Call from the frontend** — use `ApiService` with the typed `openapi-fetch` client; import types from `schema.d.ts`
5. **Build both** — `go build ./cmd/server` (from `backend/`) and `bun run build` (from `frontend/`)

### What NOT to Do

- Do NOT add routes manually in `cmd/server/main.go` — the generated router handles all routing
- Do NOT use `fetch()` directly in the frontend — always go through `ApiService` and the typed client
- Do NOT define request/response types by hand when they exist in the OpenAPI spec — import from generated files
- Do NOT modify `openapi_gen.go` or `schema.d.ts` — they are auto-generated and will be overwritten

### Backend Handler Pattern

Handlers implement the generated `ServerInterface`. The generated code handles:
- Route registration
- Path parameter extraction and type conversion
- Middleware chaining

Handler files in `internal/handler/`:
- `handler.go` — core endpoints (upload, get spec, proxy, health) + shared helpers
- `demo.go` — demo-related endpoints (list, get spec, load)

Shared logic lives in unexported helper functions on `*Server`:
- `parseAndStoreSpec(raw map[string]any)` — validates spec, extracts metadata, stores it
- `countEndpoints(doc *openapi3.T)` — counts HTTP operations across all paths

If a new handler needs logic that already exists in another handler, extract and reuse — do not duplicate.

### Frontend ApiService Pattern

All API calls go through `ApiService` (`src/app/api/api.service.ts`):

```typescript
// Typed client — paths and types come from openapi.yaml via schema.d.ts
private readonly client = createClient<paths>({ baseUrl: "/api" });

// Every method returns { data, error } with full type inference
listDemos() {
    return this.client.GET("/demos");
}
```

When consuming in components, import types from the schema:
```typescript
import type { components } from "../../api/schema";
type DemoInfo = components["schemas"]["DemoInfo"];
```

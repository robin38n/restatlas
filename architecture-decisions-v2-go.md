# Visual OpenAPI Explorer — Architecture Decisions (v2: Go Backend)

## Überblick

Ein schlankes, offline-fähiges OSS-Tool das OpenAPI-Specs als interaktiven Graph visualisiert, Schema-Beziehungen sichtbar macht und einen integrierten API-Client bietet.

**Stack: Angular 19+ (Frontend) + Go (Backend) — Polyglot-Monorepo**

---

## 1. Repo-Strategie

**Empfehlung: Polyglot-Monorepo mit Task Runner**

Da Nx keinen Go-Support hat, wechseln wir zu einer einfacheren Struktur. Ein `Makefile` oder **Taskfile** (task.dev) orchestriert beide Welten.

```
visual-openapi-explorer/
├── frontend/                # Angular App (Bun + Angular CLI)
│   ├── src/
│   ├── angular.json
│   ├── package.json
│   └── tsconfig.json
├── backend/                 # Go Service
│   ├── cmd/
│   │   └── server/
│   │       └── main.go      # Entrypoint
│   ├── internal/
│   │   ├── handler/         # HTTP Handler (Chi Routes)
│   │   ├── middleware/       # CORS, Logging, Recovery
│   │   ├── proxy/           # CORS-Proxy Logik
│   │   ├── parser/          # OpenAPI Spec Parsing (optional)
│   │   └── model/           # Go Structs
│   ├── go.mod
│   └── go.sum
├── api/                     # OpenAPI 3.1 Spec (Contract)
│   └── openapi.yaml         # Single Source of Truth für FE ↔ BE
├── deployments/
│   ├── Dockerfile
│   └── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci.yml
├── Taskfile.yml             # Task Runner (ersetzt Makefile + Nx)
├── .golangci.yml            # Go Linter Config
├── biome.json               # Frontend Linting/Formatting
└── README.md
```

**Warum Taskfile statt Makefile:**
- YAML-basiert, lesbarer als Make-Syntax
- Dependency-Tracking zwischen Tasks
- Cross-platform (kein Make auf Windows nötig)
- `task dev` startet Frontend + Backend parallel

```yaml
# Taskfile.yml
version: '3'

tasks:
  dev:
    desc: Start frontend + backend in parallel
    deps: [dev:frontend, dev:backend]

  dev:frontend:
    dir: frontend
    cmd: bun run start

  dev:backend:
    dir: backend
    cmd: air  # Hot-Reload für Go

  build:
    desc: Build everything
    deps: [build:frontend, build:backend]

  build:frontend:
    dir: frontend
    cmd: bun run build

  build:backend:
    dir: backend
    cmd: go build -o ../dist/server ./cmd/server

  test:
    desc: Run all tests
    deps: [test:frontend, test:backend]

  test:frontend:
    dir: frontend
    cmd: bun run test

  test:backend:
    dir: backend
    cmd: go test ./...

  lint:
    deps: [lint:frontend, lint:backend]

  lint:frontend:
    dir: frontend
    cmd: biome check .

  lint:backend:
    dir: backend
    cmd: golangci-lint run

  generate:api:
    desc: Generate Go types + Angular client from OpenAPI spec
    cmds:
      - oapi-codegen -config backend/oapi-codegen.yaml api/openapi.yaml
      - bun run --cwd frontend openapi-generate
```

---

## 2. Package Management & Runtimes

| Bereich | Tool | Begründung |
|---------|------|------------|
| **Frontend Packages** | **Bun** | Schnellster Package Manager, `bun install` + `bun.lockb` |
| **Frontend Runtime** | Node (via Angular CLI) | Angular CLI braucht Node intern, Bun ist nur Package Manager |
| **Backend Packages** | **Go Modules** (built-in) | `go mod init`, `go get`, `go.sum` — fertig. Kein externer Package Manager nötig. |
| **Backend Runtime** | **Go** | Kompiliert zu statischem Binary, kein Runtime nötig im Container |

**Go Modules — das Wichtigste für dich als Go-Neuling:**

Go hat keinen npm/bun/maven. Alles ist eingebaut:
```bash
# Projekt initialisieren (einmalig)
cd backend
go mod init github.com/dein-user/visual-openapi-explorer/backend

# Dependency hinzufügen (wie `bun add`)
go get github.com/go-chi/chi/v5

# Alle Dependencies aufräumen (wie `bun install --frozen-lockfile`)
go mod tidy

# Das wars. go.mod = package.json, go.sum = lockfile.
```

Kein `node_modules`-Äquivalent im Projektordner — Go cached Dependencies global in `$GOPATH/pkg/mod`.

---

## 3. Backend: Go mit Chi

### 3.1 Framework-Wahl

**Empfehlung: Chi**

| Option | Pro | Contra | Verdict |
|--------|-----|--------|---------|
| **Chi** | Idiomatic Go, composable Middleware, `net/http`-kompatibel, lightweight | Weniger "batteries" als Gin | ✅ **Empfohlen** |
| Gin | Populärstes Go-Framework, viele Tutorials | Eigene Context-Abstraktion, weniger idiomatic | Gute Alternative |
| Echo | Ähnlich wie Gin, gute Docs | Kleinere Community als Gin | ⚠️ |
| Fiber | Express-ähnliche API, schnell | Nicht `net/http`-kompatibel, eigenes Ökosystem | ❌ |
| Standard Library | Seit Go 1.22 hat `net/http` pattern-matching | Kein Middleware-Chaining, kein Route-Grouping | Für v2+ denkbar |

**Warum Chi statt Gin:**
- Chi baut auf `net/http` auf — alles was du lernst ist direkt übertragbar
- Gin hat eine eigene `gin.Context`-Abstraktion die dich von der Standard Library entfernt
- Chi's Middleware-Pattern ist composable und testbar
- Für ein kleines Backend ist Chi's Minimalismus ein Vorteil

### 3.2 Go Dependencies (komplett)

```go
// go.mod (Dependencies)
require (
    github.com/go-chi/chi/v5      // Router + Middleware
    github.com/go-chi/cors         // CORS Middleware
    github.com/go-chi/httplog/v2   // Structured Logging
    github.com/rs/zerolog          // JSON Logger (Production)
    github.com/go-playground/validator/v10  // Struct Validation
    github.com/google/uuid         // UUID Generation für Spec-IDs
    github.com/mattn/go-sqlite3    // SQLite (Phase 2)
)
```

### 3.3 Projektstruktur (Go-Konventionen)

Go hat keine erzwungene Projektstruktur, aber es gibt starke Konventionen:

```
backend/
├── cmd/
│   └── server/
│       └── main.go           # Entrypoint: config laden, router bauen, server starten
├── internal/                  # Nicht von außen importierbar (Go Compiler enforced!)
│   ├── handler/
│   │   ├── spec.go           # POST /api/specs, GET /api/specs/:id
│   │   ├── proxy.go          # POST /api/proxy
│   │   └── health.go         # GET /api/health
│   ├── middleware/
│   │   ├── cors.go
│   │   ├── logging.go
│   │   └── recovery.go
│   ├── proxy/
│   │   └── client.go         # HTTP Client für CORS-Proxy
│   ├── parser/
│   │   └── openapi.go        # Spec Validation + Parsing (optional)
│   ├── model/
│   │   └── spec.go           # Go Structs (generiert aus OpenAPI)
│   └── config/
│       └── config.go         # Env Vars, Ports, etc.
├── go.mod
└── go.sum
```

**`internal/`-Verzeichnis:** Go's einziger Access Modifier auf Package-Ebene. Alles unter `internal/` kann nur vom eigenen Modul importiert werden — verhindert versehentliche Kopplung.

### 3.4 Beispiel: Minimaler Server

```go
// cmd/server/main.go
package main

import (
    "log"
    "net/http"

    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
    "github.com/go-chi/cors"
)

func main() {
    r := chi.NewRouter()

    // Middleware
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(cors.Handler(cors.Options{
        AllowedOrigins: []string{"http://localhost:4200"}, // Angular Dev Server
        AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
    }))

    // Routes
    r.Get("/api/health", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "application/json")
        w.Write([]byte(`{"status":"ok"}`))
    })

    r.Route("/api/specs", func(r chi.Router) {
        r.Post("/", handleSpecUpload)
        r.Get("/{id}", handleSpecGet)
    })

    r.Post("/api/proxy", handleProxy)

    // Static Files (Angular Build Output)
    fileServer := http.FileServer(http.Dir("./public"))
    r.Handle("/*", fileServer)

    log.Println("Server starting on :3000")
    http.ListenAndServe(":3000", r)
}
```

### 3.5 Hot-Reload für Development

**Air** — der Standard Hot-Reloader für Go:
```bash
go install github.com/air-verse/air@latest
```

```toml
# backend/.air.toml
[build]
  cmd = "go build -o ./tmp/server ./cmd/server"
  bin = "./tmp/server"
  delay = 1000
  exclude_dir = ["tmp", "vendor"]
  include_ext = ["go", "yaml"]
```

Funktioniert wie `nodemon` — watched Go-Dateien und restartet den Server.

---

## 4. API-Design & Contract-First Workflow

### 4.1 Ansatz: Contract-First mit OpenAPI 3.1

Da Frontend (TypeScript) und Backend (Go) unterschiedliche Sprachen sind, brauchen wir einen **Contract** — die OpenAPI-Spec ist die Single Source of Truth.

```
api/openapi.yaml  (handgeschrieben)
       │
       ├──→  oapi-codegen  ──→  Go Types + Server Interface
       │
       └──→  openapi-typescript  ──→  TypeScript Types + API Client
```

### 4.2 Die API-Spec

```yaml
# api/openapi.yaml
openapi: 3.1.0
info:
  title: Visual OpenAPI Explorer API
  version: 0.1.0
  description: Backend API for the Visual OpenAPI Explorer

servers:
  - url: http://localhost:3000/api
    description: Local Development

paths:
  /specs:
    post:
      operationId: uploadSpec
      summary: Upload an OpenAPI specification
      requestBody:
        required: true
        content:
          multipart/form-data:
            schema:
              type: object
              properties:
                file:
                  type: string
                  format: binary
                url:
                  type: string
                  format: uri
          application/json:
            schema:
              type: object
              description: Raw OpenAPI spec as JSON
      responses:
        '201':
          description: Spec uploaded and parsed
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SpecSummary'
        '400':
          $ref: '#/components/responses/ValidationError'

  /specs/{id}:
    get:
      operationId: getSpec
      summary: Get a stored specification
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Full spec with parsed metadata
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ParsedSpec'
        '404':
          $ref: '#/components/responses/NotFound'

  /proxy:
    post:
      operationId: proxyRequest
      summary: CORS proxy for Try-It-Out requests
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ProxyRequest'
      responses:
        '200':
          description: Proxied response
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ProxyResponse'

  /health:
    get:
      operationId: healthCheck
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [ok]

components:
  schemas:
    SpecSummary:
      type: object
      required: [id, title, version, endpointCount, schemaCount]
      properties:
        id:
          type: string
          format: uuid
        title:
          type: string
        version:
          type: string
        endpointCount:
          type: integer
        schemaCount:
          type: integer
        tags:
          type: array
          items:
            type: string
        createdAt:
          type: string
          format: date-time

    ParsedSpec:
      type: object
      required: [id, raw, summary]
      properties:
        id:
          type: string
          format: uuid
        raw:
          type: object
          description: Original OpenAPI spec as JSON
        summary:
          $ref: '#/components/schemas/SpecSummary'

    ProxyRequest:
      type: object
      required: [method, url]
      properties:
        method:
          type: string
          enum: [GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS]
        url:
          type: string
          format: uri
        headers:
          type: object
          additionalProperties:
            type: string
        body:
          description: Request body (any type)

    ProxyResponse:
      type: object
      required: [status, headers]
      properties:
        status:
          type: integer
        headers:
          type: object
          additionalProperties:
            type: string
        body:
          description: Response body (any type)
        durationMs:
          type: integer

    ValidationError:
      type: object
      properties:
        error:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string

  responses:
    ValidationError:
      description: Validation failed
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/ValidationError'
    NotFound:
      description: Resource not found
      content:
        application/json:
          schema:
            type: object
            properties:
              error:
                type: string
```

### 4.3 Code-Generierung

**Go (Backend):**
```bash
go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest

# Generiert: Types + Chi Server Interface
oapi-codegen -config backend/oapi-codegen.yaml api/openapi.yaml
```

```yaml
# backend/oapi-codegen.yaml
package: handler
output: internal/handler/openapi_gen.go
generate:
  chi-server: true     # Generiert Chi Router Interface
  models: true         # Generiert Go Structs
  embedded-spec: true  # Bettet die Spec in den Binary ein (Meta!)
```

Das generiert ein Go Interface das du implementierst — Compile-Time Check dass dein Server die Spec erfüllt.

**TypeScript (Frontend):**
```bash
bun add -D openapi-typescript openapi-fetch
```

```bash
# Generiert TypeScript Types aus der Spec
bunx openapi-typescript api/openapi.yaml -o frontend/src/app/api/schema.d.ts
```

```typescript
// Frontend: Typ-sicherer API Client
import createClient from 'openapi-fetch';
import type { paths } from './api/schema';

const client = createClient<paths>({ baseUrl: '/api' });

// Voll typisiert — Autocomplete für Path, Method, Body, Response
const { data, error } = await client.POST('/specs', {
  body: specJson
});
// data ist automatisch SpecSummary
```

---

## 5. Angular Frontend — Architektur

### 5.1 Angular Version & Features

**Angular 19+ mit:**
- **Standalone Components** — keine NgModules
- **Signals + computed()** — für den gesamten Parsing/Filter-Pipeline
- **Zoneless Change Detection** (provideExperimentalZonelessChangeDetection) — Performance-Boost für Graph-Rendering
- **Deferred Views (@defer)** — Lazy Loading der Graph-Visualisierung
- **Control Flow (@if, @for, @switch)** — neue Template-Syntax

### 5.2 State Management

**Empfehlung: NgRx SignalStore**

| Option | Verdict | Begründung |
|--------|---------|------------|
| **NgRx SignalStore** | ✅ Empfohlen | Signal-basiert, lightweight, typ-sicher, perfekt für computed()-Pipeline |
| NgRx Store (classic) | ❌ | Overkill, zu viel Boilerplate für dieses Projekt |
| Reine Signals + Services | Möglich | Reicht für v1, aber SignalStore gibt Struktur |

**Store-Architektur:**
```
SpecStore       → Geladene Spec, Raw JSON, Parse-Status
GraphStore      → Nodes, Edges, Layout-Daten, Zoom/Pan
SelectionStore  → Ausgewählter Endpoint, Schema, Breadcrumbs
FilterStore     → Tag-Filter, Search Query, HTTP-Method-Filter
RequestStore    → Try-It-Out State, History, Responses
```

### 5.3 Graph-Visualisierung

**Empfehlung: D3.js (force-directed) + Custom Angular Wrapper**

| Option | Verdict | Begründung |
|--------|---------|------------|
| **D3.js** | ✅ Empfohlen | Volle Kontrolle, force-directed + dagre Layout, riesiges Ökosystem |
| @swimlane/ngx-graph | ⚠️ Alternative | Angular-nativ, aber weniger flexibel, weniger maintained |
| Cytoscape.js | ⚠️ | Mächtig für Graphen, aber Lernkurve |

**Warum D3:**
- Volle Kontrolle über SVG-Rendering → Custom Node Shapes (Endpoint-Cards, Schema-Bubbles)
- `d3-force` für interaktives force-directed Layout
- `d3-zoom` + `d3-drag` für Pan/Zoom
- Kann mit Angular Signals verbunden werden (Signal → D3 Update)
- Dagre-Layout als Alternative für hierarchische Darstellung

### 5.4 Virtual Scrolling

**@angular/cdk/scrolling** für:
- Endpoint-Liste (kann 500+ Endpoints haben)
- Schema-Property-Bäume (tief verschachtelte Objekte)
- Request-History

### 5.5 UI Component Library

**Empfehlung: Angular CDK + Spartan UI (headless shadcn-Port)**

Für ein Developer-Tool das sich von Swagger UI abheben soll, brauchst du Custom Design, kein Material-Look. CDK für Behavior (Overlay, A11y, Drag&Drop), Spartan für accessible Primitives.

**Styling: Tailwind CSS 4** — Dark Mode als Default (Developer-Tool!)

### 5.6 OpenAPI Parsing (Client-seitig)

**Kernbibliothek: `@readme/openapi-parser`**

Parsing-Pipeline:
```
Upload/URL → Raw JSON/YAML
  → Validation (OpenAPI 3.0/3.1)
  → $ref Dereferenzierung
  → Graph-Transformation (Nodes/Edges)
  → Signal Store Update
  → D3 Rendering
```

### 5.7 JSON Schema → Formular Rendering

**Eigener Recursive Form Builder mit Angular Reactive Forms.** Die existierenden Libraries (ngx-formly, etc.) können nicht mit `oneOf`, `anyOf`, `discriminator` umgehen. Der Custom-Builder ist das Showcase-Feature.

---

## 6. Build-Tooling

| Komponente | Tool | Begründung |
|-----------|------|------------|
| Frontend Build | **esbuild** (Angular CLI Default) | Seit Angular 17 Standard, extrem schnell |
| Backend Build | **`go build`** | Kompiliert zu einem statischen Binary. Kein Bundler, kein Transpiler, nichts. |
| Cross-Compile | `GOOS=linux GOARCH=amd64 go build` | Ein Befehl auf deinem Mac → Linux Binary für Docker |
| Task Orchestrierung | **Taskfile** (task.dev) | Ersetzt Make + Nx, YAML-basiert, cross-platform |
| Hot-Reload (Go) | **Air** | File Watcher + Auto-Rebuild für Development |
| Type Generation | **oapi-codegen** + **openapi-typescript** | Contract-First: OpenAPI Spec → Go Types + TS Types |

---

## 7. Testing

| Ebene | Tool | Scope |
|-------|------|-------|
| Unit (Frontend) | **Vitest** via `@analogjs/vitest-angular` | Components, Services, Pipes, Stores |
| Unit (Backend) | **`go test`** (built-in) | Handler, Parser, Proxy — kein Framework nötig |
| Component Testing | **Testing Library** (`@testing-library/angular`) | User-Interaction-basierte Tests |
| E2E | **Playwright** | Upload-Flow, Graph-Interaktion, Try-It-Out |
| API Contract | **Schemathesis** (optional) | Fuzz-Testing gegen die OpenAPI Spec |
| Benchmarks | **`go test -bench`** (built-in) | Performance-Tests für Proxy + Parser |

**Go Testing — kein Framework nötig:**
```go
// internal/handler/health_test.go
func TestHealthCheck(t *testing.T) {
    req := httptest.NewRequest("GET", "/api/health", nil)
    w := httptest.NewRecorder()

    handler := HealthCheck()
    handler.ServeHTTP(w, req)

    if w.Code != http.StatusOK {
        t.Errorf("expected 200, got %d", w.Code)
    }
}
```

Go hat Testing, Benchmarks, Fuzzing und HTTP-Test-Utilities in der Standard Library. Du brauchst kein Jest/Vitest/Mocha-Äquivalent.

---

## 8. Linting & Formatting

### Frontend (TypeScript/Angular)
| Tool | Rolle |
|------|-------|
| **Biome** | Formatter + Linter (ersetzt Prettier + teilweise ESLint) |
| **angular-eslint** | Angular-spezifische Regeln (Template-Linting) |

### Backend (Go)
| Tool | Rolle |
|------|-------|
| **`gofmt`** (built-in) | Formatter — kein Diskussionsbedarf, alle Go-Projekte verwenden es |
| **`go vet`** (built-in) | Statische Analyse, findet häufige Fehler |
| **golangci-lint** | Meta-Linter, aggregiert 50+ Linter (wie ESLint mit Plugins) |

```yaml
# .golangci.yml
linters:
  enable:
    - errcheck      # Unbehandelte Errors finden
    - govet         # Go vet
    - staticcheck   # Mächtigste statische Analyse für Go
    - unused        # Unbenutzte Variablen/Funktionen
    - gosimple      # Vereinfachbare Konstrukte
    - ineffassign   # Ineffektive Zuweisungen
    - gocritic      # Opinionated Style Checks
```

### Shared
| Tool | Rolle |
|------|-------|
| **Husky + lint-staged** | Pre-commit Hooks (Frontend) |
| **Pre-commit** (optional) | Go Linting im Pre-commit Hook |
| **Commitlint** | Conventional Commits erzwingen |

---

## 9. Containerisierung

**Multi-Stage Dockerfile — Go Binary + Angular Static Files:**

```dockerfile
# ============================================
# Stage 1: Build Go Backend
# ============================================
FROM golang:1.22-alpine AS go-builder
WORKDIR /app/backend
COPY backend/go.mod backend/go.sum ./
RUN go mod download
COPY backend/ ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# ============================================
# Stage 2: Build Angular Frontend
# ============================================
FROM oven/bun:1.2-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

# ============================================
# Stage 3: Production — SCRATCH Image
# ============================================
FROM alpine:3.20 AS production

# CA Certs für HTTPS Proxy-Requests
RUN apk --no-cache add ca-certificates

WORKDIR /app
COPY --from=go-builder /server ./server
COPY --from=frontend-builder /app/frontend/dist/frontend/browser ./public

EXPOSE 3000

# Non-root User
RUN adduser -D -g '' appuser
USER appuser

ENTRYPOINT ["./server"]
```

**Image-Größe im Vergleich:**
```
Bun Container:   ~150 MB
Node Container:  ~200 MB
Go + Alpine:     ~15-25 MB  ← 10x kleiner
Go + Scratch:    ~8-12 MB   ← Kleinstes mögliches Image
```

**Docker Compose für lokale Entwicklung:**
```yaml
# deployments/docker-compose.yml
services:
  app:
    build:
      context: ..
      dockerfile: deployments/Dockerfile
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - UPLOAD_DIR=/data/uploads
    volumes:
      - uploads:/data/uploads

volumes:
  uploads:
```

---

## 10. CI/CD

**GitHub Actions:**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
        with:
          go-version: '1.22'
      - name: Lint
        uses: golangci/golangci-lint-action@v4
      - name: Test
        run: cd backend && go test -race -coverprofile=coverage.out ./...
      - name: Build
        run: cd backend && go build ./cmd/server

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - name: Install
        run: cd frontend && bun install --frozen-lockfile
      - name: Lint
        run: cd frontend && bun run lint
      - name: Test
        run: cd frontend && bun run test
      - name: Build
        run: cd frontend && bun run build

  e2e:
    needs: [backend, frontend]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v5
      - uses: oven-sh/setup-bun@v2
      - name: Build All
        run: task build
      - name: E2E
        run: cd frontend && bunx playwright test

  docker:
    needs: [e2e]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & Push
        uses: docker/build-push-action@v5
        with:
          context: .
          file: deployments/Dockerfile
          push: true
          tags: ghcr.io/${{ github.repository }}:latest
```

**Container Registry:** GitHub Container Registry (ghcr.io)

---

## 11. Weitere Entscheidungen

### Git-Strategie
- **Trunk-based Development** mit kurzen Feature Branches
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, etc.)
- **Semantic Release** für automatische Versionierung + Changelog

### Dokumentation
- **Compodoc** für Angular-Komponenten-Dokumentation
- **GoDoc** (built-in) für Go — `go doc` generiert Docs aus Kommentaren
- **README.md** mit GIF/Video-Demo (wichtig für OSS-Adoption!)

### Lizenz
- **MIT** — maximale Adoption, keine Hürden

### Persistenz (Phase 2)
- **SQLite** via `mattn/go-sqlite3` oder `modernc.org/sqlite` (pure Go, kein CGO)
- Phase 1: File-basiert (JSON im Filesystem) — KISS

### Internationalisierung
- **Englisch-only** für v1

### Accessibility
- **CDK A11y-Modul** für Keyboard-Navigation im Graph
- ARIA-Labels für Nodes/Edges

### Error Handling
- **Angular ErrorHandler** + optionales Sentry
- Go: Explicit error returns (Go hat keine Exceptions!)

### PWA (optional, Phase 2)
- Angular Service Worker für Offline-Fähigkeit

### Go-spezifische Tooling-Empfehlungen
- **gopls** — Go Language Server (in jeder IDE)
- **dlv (Delve)** — Go Debugger
- **govulncheck** — Vulnerability Scanner für Go Dependencies
- **goimports** — Auto-Import Management (wie ESLint auto-import)

---

## 12. Zusammenfassung: Tech Stack

```
┌───────────────────────────────────────────────────┐
│                  TECH STACK (v2)                   │
├────────────────┬──────────────────────────────────┤
│ Repo           │ Polyglot Monorepo + Taskfile     │
│                │                                  │
│ FRONTEND       │                                  │
│ ├─ Framework   │ Angular 19+, Signals, Zoneless   │
│ ├─ Pkg Manager │ Bun                              │
│ ├─ Build       │ Angular CLI (esbuild)            │
│ ├─ Styling     │ Tailwind CSS 4                   │
│ ├─ UI          │ Angular CDK + Spartan UI         │
│ ├─ State       │ NgRx SignalStore                 │
│ ├─ Graph       │ D3.js (force + dagre)            │
│ ├─ Forms       │ Custom Reactive Form Builder     │
│ ├─ Testing     │ Vitest + Testing Library         │
│ └─ Linting     │ Biome + angular-eslint           │
│                │                                  │
│ BACKEND        │                                  │
│ ├─ Language    │ Go 1.22+                         │
│ ├─ Framework   │ Chi (net/http compatible)        │
│ ├─ Pkg Manager │ Go Modules (built-in)            │
│ ├─ Build       │ go build (single binary)         │
│ ├─ Hot-Reload  │ Air                              │
│ ├─ Testing     │ go test (built-in)               │
│ └─ Linting     │ gofmt + golangci-lint            │
│                │                                  │
│ SHARED         │                                  │
│ ├─ API Spec    │ OpenAPI 3.1 (Contract-First)     │
│ ├─ Codegen     │ oapi-codegen + openapi-typescript│
│ ├─ E2E         │ Playwright                       │
│ ├─ Container   │ Go Binary + Alpine (~20MB)       │
│ ├─ CI/CD       │ GitHub Actions                   │
│ └─ License     │ MIT                              │
└────────────────┴──────────────────────────────────┘
```

---

## 13. Empfohlene Reihenfolge (Phasen)

**Phase 0 — Setup & Go Learning**
1. Go installieren, Tour of Go durcharbeiten (go.dev/tour)
2. Taskfile + Repo-Struktur aufsetzen
3. Chi Hello-World mit Hot-Reload (Air)
4. OpenAPI Spec schreiben + Codegen Pipeline (oapi-codegen)
5. Angular Projekt mit Bun + openapi-fetch Client

**Phase 1 — MVP (Core Loop)**
6. Spec-Upload Endpoint (Go) + Angular Upload UI
7. OpenAPI Parser im Frontend (@readme/openapi-parser)
8. Graph-Visualisierung (D3 force-directed)
9. Endpoint-Detail-Panel mit Schema-Baum
10. Basic Tag-Filter + Search

**Phase 2 — Try-It-Out**
11. CORS-Proxy Endpoint (Go)
12. Dynamic Form Builder aus JSON Schema
13. Request/Response Viewer (syntax-highlighted)
14. Request History

**Phase 3 — Polish & Extend**
15. Virtual Scrolling für große Specs
16. Persistence (SQLite)
17. PWA + Offline Mode
18. Schema-Diff (zwei Spec-Versionen vergleichen)
19. Export: Markdown-Docs, Postman Collection

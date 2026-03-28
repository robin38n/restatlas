import { Component, computed, inject, type OnInit } from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import type {
	EndpointNode,
	GraphNode,
	SchemaNode,
} from "../../models/graph.model";
import { GraphCanvasComponent } from "./graph-canvas";
import { GraphToolbarComponent } from "./graph-toolbar";
import { NodeDetailComponent } from "./node-detail";
import { SpecGraphService } from "./spec-graph.service";

@Component({
	selector: "app-spec-viewer",
	standalone: true,
	imports: [
		RouterLink,
		GraphCanvasComponent,
		GraphToolbarComponent,
		NodeDetailComponent,
	],
	template: `
    <div class="viewer">
      @if (svc.loading()) {
        <p class="status">Loading spec...</p>
      }

      @if (svc.error(); as err) {
        <div class="error">{{ err }}</div>
      }

      @if (svc.summary(); as s) {
        <header>
          <a routerLink="/" class="back">&larr; Upload</a>
          <h1>{{ s.title }} <span class="version">v{{ s.version }}</span></h1>
          <div class="stats">
            <span class="stat">{{ svc.endpointNodes().length }} endpoints</span>
            <span class="stat">{{ svc.schemaNodes().length }} schemas</span>
            <span class="stat">{{ svc.edgeCount() }} relationships</span>
          </div>
        </header>

        <app-graph-toolbar />

        @if (displayGraph(); as g) {
          <app-graph-canvas [graph]="g" (nodeClick)="onNodeClick($event)" />

          <div class="main-layout">
            <div class="sidebar">
              <section>
                <h2>Endpoints</h2>
                @for (ep of filteredEndpoints(); track ep.id) {
                  <div
                    class="endpoint"
                    [class.selected]="svc.selectedNodeId() === ep.id"
                    (click)="onNodeClick(ep)"
                  >
                    <span class="method" [attr.data-method]="ep.method">{{ ep.method }}</span>
                    <span class="path">{{ ep.path }}</span>
                    @if (ep.summary) {
                      <span class="ep-summary">{{ ep.summary }}</span>
                    }
                  </div>
                } @empty {
                  <p class="empty">No endpoints found</p>
                }
              </section>

              <section>
                <h2>Schemas</h2>
                @for (sc of filteredSchemas(); track sc.id) {
                  <div
                    class="schema-card"
                    [class.selected]="svc.selectedNodeId() === sc.id"
                    (click)="onNodeClick(sc)"
                  >
                    <strong>{{ sc.name }}</strong>
                    <span class="prop-count">{{ sc.properties.length }} props</span>
                    @if (sc.properties.length > 0) {
                      <div class="props">{{ sc.properties.join(', ') }}</div>
                    }
                  </div>
                } @empty {
                  <p class="empty">No schemas found</p>
                }
              </section>
            </div>

            @if (svc.selectedNode()) {
              <div class="detail">
                <app-node-detail />
              </div>
            }
          </div>
        }
      }
    </div>
  `,
	styles: `
    .viewer {
      max-width: 1200px;
      margin: 2rem auto;
      padding: 1rem;
      font-family: system-ui, sans-serif;
    }
    .status {
      color: #666;
    }
    .error {
      padding: 0.75rem;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 4px;
    }
    .back {
      color: #666;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .back:hover {
      color: #333;
    }
    header h1 {
      margin: 0.5rem 0 0;
    }
    .version {
      color: #666;
      font-size: 0.875rem;
    }
    .stats {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      margin-bottom: 1rem;
    }
    .stat {
      padding: 0.25rem 0.5rem;
      background: #f3f4f6;
      border-radius: 4px;
      font-size: 0.875rem;
      color: #555;
    }
    .main-layout {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      margin-top: 1.5rem;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }
    h2 {
      font-size: 1rem;
      margin: 0 0 0.75rem;
      color: #333;
    }
    .endpoint {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .endpoint:hover {
      border-color: #9ca3af;
    }
    .endpoint.selected {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .method {
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      color: #fff;
      background: #6b7280;
      flex-shrink: 0;
    }
    .method[data-method="GET"] { background: #16a34a; }
    .method[data-method="POST"] { background: #2563eb; }
    .method[data-method="PUT"] { background: #d97706; }
    .method[data-method="PATCH"] { background: #9333ea; }
    .method[data-method="DELETE"] { background: #dc2626; }
    .path {
      font-family: monospace;
      font-weight: 500;
    }
    .ep-summary {
      color: #888;
      font-size: 0.8rem;
    }
    .schema-card {
      padding: 0.5rem;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      margin-bottom: 0.5rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .schema-card:hover {
      border-color: #9ca3af;
    }
    .schema-card.selected {
      border-color: #64748b;
      background: #f8fafc;
    }
    .prop-count {
      margin-left: 0.5rem;
      color: #888;
      font-size: 0.75rem;
    }
    .props {
      margin-top: 0.25rem;
      font-family: monospace;
      font-size: 0.75rem;
      color: #666;
    }
    .empty {
      color: #999;
      font-size: 0.875rem;
    }
  `,
})
export class SpecViewerComponent implements OnInit {
	protected readonly svc = inject(SpecGraphService);
	private readonly route = inject(ActivatedRoute);

	/** Use filteredGraph when filters are active, otherwise the full graph. */
	protected readonly displayGraph = computed(
		() => this.svc.filteredGraph() ?? this.svc.graph(),
	);

	protected readonly filteredEndpoints = computed(
		() =>
			this.displayGraph()?.nodes.filter(
				(n): n is EndpointNode => n.type === "endpoint",
			) ?? [],
	);

	protected readonly filteredSchemas = computed(
		() =>
			this.displayGraph()?.nodes.filter(
				(n): n is SchemaNode => n.type === "schema",
			) ?? [],
	);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get("id");
		if (id) {
			this.svc.loadSpec(id);
		}
	}

	onNodeClick(node: GraphNode): void {
		this.svc.selectNode(node);
	}
}

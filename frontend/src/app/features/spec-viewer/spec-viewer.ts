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
          <h1><img src="assets/icons/restatlas.svg" alt="" class="logo" /> {{ s.title }} <span class="version">v{{ s.version }}</span></h1>
          <div class="stats">
            <span class="stat">{{ svc.endpointNodes().length }} endpoints</span>
            <span class="stat">{{ svc.schemaNodes().length }} schemas</span>
            <span class="stat">{{ svc.edgeCount() }} relationships</span>
          </div>
        </header>

        <app-graph-toolbar />

        @if (displayGraph(); as g) {
          <app-graph-canvas [graph]="g" (nodeClick)="onNodeClick($event)" />

          <div class="detail-card">
            <div class="list-pane">
              <section>
                <h2>Endpoints</h2>
                @for (ep of filteredEndpoints(); track ep.id) {
                  <div
                    class="list-item"
                    [class.selected]="svc.selectedNodeId() === ep.id"
                    (click)="onNodeClick(ep)"
                  >
                    <span class="method" [attr.data-method]="ep.method">{{ ep.method }}</span>
                    <span class="path">{{ ep.path }}</span>
                  </div>
                } @empty {
                  <p class="empty">No endpoints found</p>
                }
              </section>

              <section>
                <h2>Schemas</h2>
                @for (sc of filteredSchemas(); track sc.id) {
                  <div
                    class="list-item"
                    [class.selected]="svc.selectedNodeId() === sc.id"
                    (click)="onNodeClick(sc)"
                  >
                    <strong>{{ sc.name }}</strong>
                    <span class="prop-count">{{ sc.properties.length }} props</span>
                  </div>
                } @empty {
                  <p class="empty">No schemas found</p>
                }
              </section>
            </div>

            <div class="detail-pane">
              @if (svc.selectedNode()) {
                <app-node-detail />
              } @else {
                <p class="empty hint">Select an endpoint or schema to see details</p>
              }
            </div>
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
    .status { color: #666; }
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
    .back:hover { color: #333; }
    header h1 {
      margin: 0.5rem 0 0;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .logo {
      width: 28px;
      height: 28px;
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

    /* Outer card wrapping both list and detail */
    .detail-card {
      display: grid;
      grid-template-columns: 1fr 1fr;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      margin-top: 1.5rem;
      overflow: hidden;
      background: #fff;
    }
    .list-pane {
      padding: 1rem;
      overflow-y: auto;
      max-height: 600px;
      border-right: 1px solid #e5e7eb;
    }
    .detail-pane {
      padding: 1rem;
      overflow-y: auto;
      max-height: 600px;
    }

    h2 {
      font-size: 0.8rem;
      margin: 0 0 0.5rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    section + section {
      margin-top: 1rem;
    }

    .list-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.4rem 0.5rem;
      border-radius: 4px;
      margin-bottom: 0.125rem;
      font-size: 0.85rem;
      cursor: pointer;
      transition: background 0.1s;
    }
    .list-item:hover {
      background: #f3f4f6;
    }
    .list-item.selected {
      background: #eff6ff;
    }
    .method {
      font-weight: 600;
      font-size: 0.7rem;
      padding: 0.1rem 0.3rem;
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
      font-size: 0.8rem;
    }
    .prop-count {
      margin-left: auto;
      color: #888;
      font-size: 0.75rem;
    }
    .empty {
      color: #999;
      font-size: 0.875rem;
    }
    .hint {
      margin-top: 2rem;
      text-align: center;
    }
  `,
})
export class SpecViewerComponent implements OnInit {
	protected readonly svc = inject(SpecGraphService);
	private readonly route = inject(ActivatedRoute);

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

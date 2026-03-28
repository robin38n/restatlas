import { Component, computed, inject, type Signal } from "@angular/core";
import type { EndpointNode, SchemaNode } from "../../models/graph.model";
import { SpecGraphService } from "./spec-graph.service";

/** Safely navigate a nested object by dot-separated keys. */
function dig(obj: unknown, ...keys: string[]): unknown {
	let current = obj;
	for (const key of keys) {
		if (current == null || typeof current !== "object") return undefined;
		current = (current as Record<string, unknown>)[key];
	}
	return current;
}

function asRecord(v: unknown): Record<string, unknown> | null {
	return v != null && typeof v === "object" && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: null;
}

@Component({
	selector: "app-node-detail",
	standalone: true,
	imports: [],
	template: `
    @if (svc.selectedNode(); as node) {
      <aside class="detail-panel">
        <div class="panel-header">
          <button class="close" (click)="svc.clearSelection()">&times;</button>

          @if (node.type === 'endpoint') {
            <div class="endpoint-header">
              <span class="method" [attr.data-method]="asEndpoint(node).method">
                {{ asEndpoint(node).method }}
              </span>
              <span class="path">{{ asEndpoint(node).path }}</span>
            </div>
            @if (asEndpoint(node).summary) {
              <p class="summary">{{ asEndpoint(node).summary }}</p>
            }
            @if (asEndpoint(node).operationId) {
              <p class="operation-id">operationId: <code>{{ asEndpoint(node).operationId }}</code></p>
            }
            @if (asEndpoint(node).tags.length > 0) {
              <div class="tags">
                @for (tag of asEndpoint(node).tags; track tag) {
                  <span class="tag">{{ tag }}</span>
                }
              </div>
            }
          }

          @if (node.type === 'schema') {
            <h3 class="schema-name">{{ asSchema(node).name }}</h3>
          }
        </div>

        @if (node.type === 'endpoint') {
          <!-- Parameters -->
          @if (endpointParams().length > 0) {
            <section>
              <h4>Parameters</h4>
              <table class="params-table">
                <thead>
                  <tr><th>Name</th><th>In</th><th>Type</th><th>Req</th></tr>
                </thead>
                <tbody>
                  @for (p of endpointParams(); track p.name) {
                    <tr>
                      <td><code>{{ p.name }}</code></td>
                      <td>{{ p.in }}</td>
                      <td>{{ p.type }}</td>
                      <td>{{ p.required ? 'Yes' : '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          }

          <!-- Request Body -->
          @if (requestBodySchemas().length > 0) {
            <section>
              <h4>Request Body</h4>
              @for (ref of requestBodySchemas(); track ref) {
                <button class="schema-link" (click)="navigateTo(ref)">{{ ref }}</button>
              }
            </section>
          }

          <!-- Responses -->
          @if (responseEntries().length > 0) {
            <section>
              <h4>Responses</h4>
              @for (r of responseEntries(); track r.status) {
                <div class="response-entry">
                  <span class="status-code" [attr.data-status]="r.statusGroup">{{ r.status }}</span>
                  <span class="response-desc">{{ r.description }}</span>
                  @for (ref of r.schemas; track ref) {
                    <button class="schema-link" (click)="navigateTo(ref)">{{ ref }}</button>
                  }
                </div>
              }
            </section>
          }
        }

        @if (node.type === 'schema') {
          <!-- Properties -->
          @if (schemaProperties().length > 0) {
            <section>
              <h4>Properties</h4>
              <table class="params-table">
                <thead>
                  <tr><th>Name</th><th>Type</th><th>Req</th></tr>
                </thead>
                <tbody>
                  @for (p of schemaProperties(); track p.name) {
                    <tr>
                      <td><code>{{ p.name }}</code></td>
                      <td>
                        @if (p.refTarget) {
                          <button class="schema-link" (click)="navigateTo(p.refTarget)">{{ p.type }}</button>
                        } @else {
                          {{ p.type }}
                        }
                      </td>
                      <td>{{ p.required ? 'Yes' : '' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </section>
          }

          <!-- Composition -->
          @if (compositionRefs().length > 0) {
            <section>
              <h4>Composition</h4>
              @for (c of compositionRefs(); track c.keyword + c.ref) {
                <div class="composition-entry">
                  <span class="comp-keyword">{{ c.keyword }}</span>
                  <button class="schema-link" (click)="navigateTo(c.ref)">{{ c.ref }}</button>
                </div>
              }
            </section>
          }
        }

        <!-- Connected nodes (edges) -->
        @if (connectedNodes().length > 0) {
          <section>
            <h4>{{ node.type === 'schema' ? 'Used By' : 'Connected Schemas' }}</h4>
            @for (c of connectedNodes(); track c.id) {
              <div class="connected-entry">
                <span class="edge-kind">{{ c.kind }}</span>
                <button class="schema-link" (click)="navigateTo(c.id)">{{ c.label }}</button>
                @if (c.edgeLabel) {
                  <span class="edge-label">{{ c.edgeLabel }}</span>
                }
              </div>
            }
          </section>
        }
      </aside>
    }
  `,
	styles: `
    .detail-panel {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      padding: 1rem;
      background: #fff;
      font-size: 0.875rem;
      max-height: 500px;
      overflow-y: auto;
    }
    .panel-header {
      margin-bottom: 0.75rem;
    }
    .close {
      float: right;
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: #666;
      padding: 0;
      line-height: 1;
    }
    .close:hover { color: #333; }
    .endpoint-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .method {
      font-weight: 600;
      font-size: 0.75rem;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      color: #fff;
      background: #6b7280;
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
    .summary {
      color: #666;
      margin: 0.25rem 0;
      font-size: 0.8rem;
    }
    .operation-id {
      color: #888;
      font-size: 0.75rem;
      margin: 0.25rem 0;
    }
    .operation-id code {
      background: #f3f4f6;
      padding: 0.125rem 0.25rem;
      border-radius: 2px;
    }
    .tags {
      display: flex;
      gap: 0.25rem;
      flex-wrap: wrap;
      margin-top: 0.25rem;
    }
    .tag {
      background: #e0e7ff;
      color: #3730a3;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.7rem;
    }
    .schema-name {
      margin: 0;
      font-size: 1rem;
      color: #1e293b;
    }
    section {
      margin-top: 0.75rem;
      padding-top: 0.75rem;
      border-top: 1px solid #f3f4f6;
    }
    h4 {
      margin: 0 0 0.5rem;
      font-size: 0.8rem;
      color: #555;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .params-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8rem;
    }
    .params-table th,
    .params-table td {
      text-align: left;
      padding: 0.25rem 0.375rem;
      border-bottom: 1px solid #f3f4f6;
    }
    .params-table th {
      font-weight: 600;
      color: #888;
      font-size: 0.7rem;
      text-transform: uppercase;
    }
    .schema-link {
      background: none;
      border: 1px solid #e0e7ff;
      color: #2563eb;
      cursor: pointer;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
      font-size: 0.75rem;
      font-family: monospace;
    }
    .schema-link:hover {
      background: #e0e7ff;
    }
    .response-entry {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.375rem;
      flex-wrap: wrap;
    }
    .status-code {
      font-weight: 600;
      font-family: monospace;
      font-size: 0.75rem;
      padding: 0.125rem 0.25rem;
      border-radius: 3px;
      background: #f3f4f6;
    }
    .status-code[data-status="2"] { background: #dcfce7; color: #166534; }
    .status-code[data-status="4"] { background: #fef3c7; color: #92400e; }
    .status-code[data-status="5"] { background: #fef2f2; color: #991b1b; }
    .response-desc {
      color: #666;
      font-size: 0.75rem;
    }
    .connected-entry {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .edge-kind {
      font-family: monospace;
      font-size: 0.65rem;
      padding: 0.125rem 0.25rem;
      background: #f3f4f6;
      border-radius: 3px;
      color: #666;
    }
    .edge-label {
      color: #888;
      font-size: 0.7rem;
    }
    .composition-entry {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      margin-bottom: 0.25rem;
    }
    .comp-keyword {
      font-family: monospace;
      font-size: 0.7rem;
      color: #dc2626;
    }
  `,
})
export class NodeDetailComponent {
	protected readonly svc = inject(SpecGraphService);

	/** Helper to extract raw operation object from the spec for an endpoint. */
	private readonly rawOperation: Signal<Record<string, unknown> | null> =
		computed(() => {
			const node = this.svc.selectedNode();
			const raw = this.svc.rawSpec();
			if (!node || node.type !== "endpoint" || !raw) return null;
			const ep = node as EndpointNode;
			const pathItem = asRecord(dig(raw, "paths", ep.path));
			if (!pathItem) return null;
			return asRecord(pathItem[ep.method.toLowerCase()]) ?? null;
		});

	/** Helper to extract raw schema object from the spec. */
	private readonly rawSchema: Signal<Record<string, unknown> | null> = computed(
		() => {
			const node = this.svc.selectedNode();
			const raw = this.svc.rawSpec();
			if (!node || node.type !== "schema" || !raw) return null;
			const sc = node as SchemaNode;
			return asRecord(dig(raw, "components", "schemas", sc.name)) ?? null;
		},
	);

	readonly endpointParams = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const params = op["parameters"];
		if (!Array.isArray(params)) return [];
		return params
			.filter(
				(p): p is Record<string, unknown> => p != null && typeof p === "object",
			)
			.map((p) => ({
				name: String(p["name"] ?? ""),
				in: String(p["in"] ?? ""),
				type: schemaType(asRecord(p["schema"])),
				required: Boolean(p["required"]),
			}));
	});

	readonly requestBodySchemas = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		return extractContentRefs(asRecord(op["requestBody"]));
	});

	readonly responseEntries = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const responses = asRecord(op["responses"]);
		if (!responses) return [];
		return Object.entries(responses).map(([status, respDef]) => {
			const resp = asRecord(respDef);
			return {
				status,
				statusGroup: status.charAt(0),
				description: resp ? String(resp["description"] ?? "") : "",
				schemas: extractContentRefs(resp),
			};
		});
	});

	readonly schemaProperties = computed(() => {
		const schema = this.rawSchema();
		const node = this.svc.selectedNode();
		if (!schema || !node || node.type !== "schema") return [];
		const props = asRecord(schema["properties"]);
		if (!props) return [];
		const required = Array.isArray(schema["required"])
			? new Set(
					schema["required"].filter((r): r is string => typeof r === "string"),
				)
			: new Set<string>();
		return Object.entries(props).map(([name, propDef]) => {
			const prop = asRecord(propDef);
			const ref = prop?.["$ref"];
			const refName =
				typeof ref === "string" && ref.startsWith("#/components/schemas/")
					? ref.slice("#/components/schemas/".length)
					: null;
			return {
				name,
				type: refName ?? schemaType(prop),
				required: required.has(name),
				refTarget: refName ? `schema:${refName}` : null,
			};
		});
	});

	readonly compositionRefs = computed(() => {
		const schema = this.rawSchema();
		if (!schema) return [];
		const results: Array<{ keyword: string; ref: string }> = [];
		for (const keyword of ["allOf", "oneOf", "anyOf"]) {
			const arr = schema[keyword];
			if (!Array.isArray(arr)) continue;
			for (const entry of arr) {
				const obj = asRecord(entry);
				const ref = obj?.["$ref"];
				if (
					typeof ref === "string" &&
					ref.startsWith("#/components/schemas/")
				) {
					const name = ref.slice("#/components/schemas/".length);
					results.push({ keyword, ref: `schema:${name}` });
				}
			}
		}
		return results;
	});

	readonly connectedNodes = computed(() => {
		const edges = this.svc.selectedNodeEdges();
		const nodeId = this.svc.selectedNodeId();
		const g = this.svc.graph();
		if (!g || !nodeId) return [];
		const nodeMap = new Map(g.nodes.map((n) => [n.id, n]));
		return edges.map((e) => {
			const isSource = e.source === nodeId;
			const otherId = isSource ? e.target : e.source;
			const other = nodeMap.get(otherId);
			return {
				id: otherId,
				kind: e.kind,
				edgeLabel: e.label,
				label: other
					? other.type === "endpoint"
						? `${(other as EndpointNode).method} ${(other as EndpointNode).path}`
						: (other as SchemaNode).name
					: otherId,
			};
		});
	});

	asEndpoint(node: unknown): EndpointNode {
		return node as EndpointNode;
	}

	asSchema(node: unknown): SchemaNode {
		return node as SchemaNode;
	}

	navigateTo(nodeId: string): void {
		const g = this.svc.graph();
		if (!g) return;
		const node = g.nodes.find((n) => n.id === nodeId);
		if (node) {
			this.svc.selectNode(node);
		}
	}
}

/** Extract a human-readable type from a JSON Schema object. */
function schemaType(schema: Record<string, unknown> | null): string {
	if (!schema) return "unknown";
	if (typeof schema["$ref"] === "string") {
		const ref = schema["$ref"];
		if (ref.startsWith("#/components/schemas/")) {
			return ref.slice("#/components/schemas/".length);
		}
		return ref;
	}
	const type = schema["type"];
	if (type === "array") {
		const items = asRecord(schema["items"]);
		return `${schemaType(items)}[]`;
	}
	if (typeof type === "string") return type;
	return "object";
}

/** Extract schema $ref names from a requestBody or response content map. */
function extractContentRefs(
	bodyOrResponse: Record<string, unknown> | null,
): string[] {
	if (!bodyOrResponse) return [];
	const content = asRecord(bodyOrResponse["content"]);
	if (!content) return [];
	const refs: string[] = [];
	for (const mediaType of Object.values(content)) {
		const media = asRecord(mediaType);
		if (!media) continue;
		const schema = asRecord(media["schema"]);
		if (!schema) continue;
		const ref = schema["$ref"];
		if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
			refs.push(ref.slice("#/components/schemas/".length));
		}
	}
	return refs;
}

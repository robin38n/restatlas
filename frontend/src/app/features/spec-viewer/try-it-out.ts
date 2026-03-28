import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import type { EndpointNode } from "../../models/graph.model";
import { ResponseViewerComponent } from "./response-viewer";
import { RequestHistoryComponent } from "./request-history";
import { SchemaFormComponent } from "./schema-form";
import { SpecGraphService } from "./spec-graph.service";
import {
	type HistoryEntry,
	type ProxyRequest,
	TryItOutService,
} from "./try-it-out.service";

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
	selector: "app-try-it-out",
	standalone: true,
	imports: [
		SchemaFormComponent,
		ResponseViewerComponent,
		RequestHistoryComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (endpointNode(); as ep) {
			<div class="try-it-out">
				<!-- URL Bar -->
				<div class="url-bar">
					<span class="method" [attr.data-method]="ep.method">{{ ep.method }}</span>
					<input class="url-input" [value]="constructedUrl()" readonly />
					<button
						class="send-btn"
						(click)="sendRequest()"
						[disabled]="tryItOut.loading()"
					>{{ tryItOut.loading() ? 'Sending...' : 'Send' }}</button>
				</div>

				@if (tryItOut.error()) {
					<div class="error">{{ tryItOut.error() }}</div>
				}

				<!-- Path Parameters -->
				@if (pathParams().length > 0) {
					<div class="param-section">
						<h4>Path Parameters</h4>
						@for (p of pathParams(); track p.name) {
							<div class="param-row">
								<label>{{ p.name }} <span class="req">*</span></label>
								<input
									[placeholder]="p.schema?.['format'] ?? p.name"
									[value]="pathValues()[p.name] ?? ''"
									(input)="updatePathParam(p.name, $event)"
								/>
							</div>
						}
					</div>
				}

				<!-- Query Parameters -->
				@if (queryParams().length > 0) {
					<div class="param-section">
						<h4>Query Parameters</h4>
						@for (p of queryParams(); track p.name) {
							<div class="param-row">
								<label>
									{{ p.name }}
									@if (p.required) { <span class="req">*</span> }
								</label>
								@if (p.enumValues.length > 0) {
									<select (change)="updateQueryParam(p.name, $event)">
										<option value="">--</option>
										@for (v of p.enumValues; track v) {
											<option [value]="v">{{ v }}</option>
										}
									</select>
								} @else {
									<input
										[placeholder]="p.name"
										[value]="queryValues()[p.name] ?? ''"
										(input)="updateQueryParam(p.name, $event)"
									/>
								}
							</div>
						}
					</div>
				}

				<!-- Headers -->
				@if (headerParams().length > 0) {
					<div class="param-section">
						<h4>Headers</h4>
						@for (p of headerParams(); track p.name) {
							<div class="param-row">
								<label>{{ p.name }}</label>
								<input
									[placeholder]="p.name"
									[value]="headerValues()[p.name] ?? ''"
									(input)="updateHeaderParam(p.name, $event)"
								/>
							</div>
						}
					</div>
				}

				<!-- Request Body -->
				@if (requestBodySchema()) {
					<div class="param-section">
						<div class="body-header">
							<h4>Request Body</h4>
							<button class="toggle-raw" (click)="rawBodyMode.update(v => !v)">
								{{ rawBodyMode() ? 'Form' : 'Raw JSON' }}
							</button>
						</div>
						@if (rawBodyMode()) {
							<textarea
								class="raw-body"
								rows="8"
								[value]="rawBodyText()"
								(input)="onRawBodyChange($event)"
							></textarea>
						} @else {
							<app-schema-form
								[schema]="requestBodySchema()!"
								[allSchemas]="allSchemas()"
								[value]="bodyValue()"
								(valueChange)="bodyValue.set($event)"
							/>
						}
					</div>
				}

				<!-- Response -->
				@if (tryItOut.lastResponse()) {
					<app-response-viewer [response]="tryItOut.lastResponse()!" />
				}

				<!-- History -->
				<app-request-history (replayRequest)="onReplayRequest($event)" />
			</div>
		}
	`,
	styles: `
		.try-it-out {
			font-size: 0.875rem;
		}
		.url-bar {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			margin-bottom: 0.75rem;
		}
		.method {
			font-weight: 600;
			font-size: 0.7rem;
			padding: 0.2rem 0.375rem;
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
		.url-input {
			flex: 1;
			padding: 0.35rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.75rem;
			font-family: monospace;
			background: #f9fafb;
			min-width: 0;
		}
		.send-btn {
			padding: 0.35rem 0.75rem;
			background: #2563eb;
			color: #fff;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.8rem;
			font-weight: 600;
			flex-shrink: 0;
		}
		.send-btn:hover:not(:disabled) { background: #1d4ed8; }
		.send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
		.error {
			padding: 0.5rem;
			background: #fef2f2;
			color: #dc2626;
			border-radius: 4px;
			font-size: 0.8rem;
			margin-bottom: 0.5rem;
		}
		.param-section {
			margin-bottom: 0.75rem;
		}
		h4 {
			margin: 0 0 0.375rem;
			font-size: 0.75rem;
			color: #555;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.param-row {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 0.375rem;
		}
		.param-row label {
			font-size: 0.75rem;
			font-weight: 600;
			color: #374151;
			min-width: 80px;
			flex-shrink: 0;
		}
		.req { color: #dc2626; }
		.param-row input, .param-row select {
			flex: 1;
			padding: 0.3rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.8rem;
			font-family: monospace;
		}
		.param-row input:focus, .param-row select:focus {
			outline: none;
			border-color: #2563eb;
		}
		.body-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
		}
		.toggle-raw {
			background: none;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			padding: 0.2rem 0.5rem;
			font-size: 0.7rem;
			color: #6b7280;
			cursor: pointer;
		}
		.toggle-raw:hover { background: #f3f4f6; }
		.raw-body {
			width: 100%;
			padding: 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-family: monospace;
			font-size: 0.8rem;
			box-sizing: border-box;
		}
		.raw-body:focus {
			outline: none;
			border-color: #2563eb;
		}
	`,
})
export class TryItOutComponent {
	private readonly svc = inject(SpecGraphService);
	protected readonly tryItOut = inject(TryItOutService);

	readonly pathValues = signal<Record<string, string>>({});
	readonly queryValues = signal<Record<string, string>>({});
	readonly headerValues = signal<Record<string, string>>({});
	readonly bodyValue = signal<Record<string, unknown>>({});
	readonly rawBodyMode = signal(false);

	readonly endpointNode = computed((): EndpointNode | null => {
		const node = this.svc.selectedNode();
		return node?.type === "endpoint" ? (node as EndpointNode) : null;
	});

	private readonly rawOperation = computed(() => {
		const ep = this.endpointNode();
		const raw = this.svc.rawSpec();
		if (!ep || !raw) return null;
		const pathItem = asRecord(dig(raw, "paths", ep.path));
		if (!pathItem) return null;
		return asRecord(pathItem[ep.method.toLowerCase()]) ?? null;
	});

	private readonly rawParams = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const params = op["parameters"];
		if (!Array.isArray(params)) return [];
		return params.filter(
			(p): p is Record<string, unknown> => p != null && typeof p === "object",
		);
	});

	readonly pathParams = computed(() =>
		this.rawParams()
			.filter((p) => p["in"] === "path")
			.map((p) => ({
				name: String(p["name"] ?? ""),
				required: Boolean(p["required"]),
				schema: asRecord(p["schema"]),
				enumValues: extractEnumFromParam(p),
			})),
	);

	readonly queryParams = computed(() =>
		this.rawParams()
			.filter((p) => p["in"] === "query")
			.map((p) => ({
				name: String(p["name"] ?? ""),
				required: Boolean(p["required"]),
				schema: asRecord(p["schema"]),
				enumValues: extractEnumFromParam(p),
			})),
	);

	readonly headerParams = computed(() =>
		this.rawParams()
			.filter((p) => p["in"] === "header")
			.map((p) => ({
				name: String(p["name"] ?? ""),
				required: Boolean(p["required"]),
				schema: asRecord(p["schema"]),
				enumValues: extractEnumFromParam(p),
			})),
	);

	readonly requestBodySchema = computed((): Record<string, unknown> | null => {
		const op = this.rawOperation();
		if (!op) return null;
		const schema = asRecord(
			dig(op, "requestBody", "content", "application/json", "schema"),
		);
		return schema;
	});

	readonly allSchemas = computed(() => {
		const raw = this.svc.rawSpec();
		return asRecord(dig(raw, "components", "schemas")) ?? {};
	});

	readonly baseUrl = computed(() => {
		const raw = this.svc.rawSpec();
		const servers = dig(raw, "servers");
		if (!Array.isArray(servers) || servers.length === 0) return "";
		const first = asRecord(servers[0]);
		return first ? String(first["url"] ?? "") : "";
	});

	readonly constructedUrl = computed(() => {
		const ep = this.endpointNode();
		const base = this.baseUrl();
		if (!ep) return "";

		let path = ep.path;
		for (const [name, value] of Object.entries(this.pathValues())) {
			if (value) {
				path = path.replace(`{${name}}`, encodeURIComponent(value));
			}
		}

		const queryEntries = Object.entries(this.queryValues()).filter(
			([, v]) => v,
		);
		const queryString =
			queryEntries.length > 0
				? "?" +
					queryEntries
						.map(
							([k, v]) =>
								`${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
						)
						.join("&")
				: "";

		return `${base}${path}${queryString}`;
	});

	readonly rawBodyText = computed(() => {
		const v = this.bodyValue();
		return Object.keys(v).length > 0 ? JSON.stringify(v, null, 2) : "";
	});

	updatePathParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.pathValues.update((c) => ({ ...c, [name]: val }));
	}

	updateQueryParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement | HTMLSelectElement).value;
		this.queryValues.update((c) => ({ ...c, [name]: val }));
	}

	updateHeaderParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.headerValues.update((c) => ({ ...c, [name]: val }));
	}

	onRawBodyChange(event: Event): void {
		const val = (event.target as HTMLTextAreaElement).value;
		try {
			this.bodyValue.set(JSON.parse(val));
		} catch {
			/* ignore invalid JSON while typing */
		}
	}

	async sendRequest(): Promise<void> {
		const ep = this.endpointNode();
		if (!ep) return;

		const headers: Record<string, string> = {};
		for (const [k, v] of Object.entries(this.headerValues())) {
			if (v) headers[k] = v;
		}

		const method = ep.method as ProxyRequest["method"];
		const hasBody = ["POST", "PUT", "PATCH"].includes(method);

		if (hasBody && !headers["Content-Type"]) {
			headers["Content-Type"] = "application/json";
		}

		const body = this.bodyValue();
		const hasBodyContent = Object.keys(body).length > 0;

		await this.tryItOut.sendRequest({
			method,
			url: this.constructedUrl(),
			headers: Object.keys(headers).length > 0 ? headers : undefined,
			body: hasBody && hasBodyContent ? body : undefined,
		});
	}

	onReplayRequest(entry: HistoryEntry): void {
		// Re-populate form from history entry
		const req = entry.request;

		// Try to extract path params from URL
		const ep = this.endpointNode();
		if (ep) {
			const pathParts = ep.path.split("/");
			try {
				const url = new URL(req.url);
				const urlParts = url.pathname.split("/");
				const pathVals: Record<string, string> = {};
				for (let i = 0; i < pathParts.length; i++) {
					const part = pathParts[i];
					if (part.startsWith("{") && part.endsWith("}")) {
						const name = part.slice(1, -1);
						pathVals[name] = decodeURIComponent(urlParts[i] ?? "");
					}
				}
				this.pathValues.set(pathVals);
			} catch {
				/* ignore URL parse errors */
			}
		}

		this.headerValues.set(req.headers ?? {});
		if (req.body && typeof req.body === "object") {
			this.bodyValue.set(req.body as Record<string, unknown>);
		}

		this.tryItOut.lastResponse.set(entry.response);
	}
}

function extractEnumFromParam(param: Record<string, unknown>): string[] {
	const schema = asRecord(param["schema"]);
	if (!schema) return [];
	const e = schema["enum"];
	return Array.isArray(e) ? e.map(String) : [];
}

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import { dig } from "../../../core/utils/dig";
import { asRecord } from "../../../core/utils/record-helpers";
import { extractEnumFromParam } from "../../../core/utils/schema-helpers";
import type { EndpointNode } from "../../../models/graph.model";
import { MethodBadgeComponent } from "../../../shared/components/method-badge/method-badge.component";
import { RequestHistoryComponent } from "../../../shared/components/request-history/request-history.component";
import { ResponseViewerComponent } from "../../../shared/components/response-viewer/response-viewer.component";
import { SpecGraphService } from "../services/spec-graph.service";
import {
	type HistoryEntry,
	type ProxyRequest,
	TryItOutService,
} from "../services/try-it-out.service";
import { SchemaFormComponent } from "./schema-form.component";

@Component({
	selector: "app-try-it-out",
	imports: [
		SchemaFormComponent,
		MethodBadgeComponent,
		ResponseViewerComponent,
		RequestHistoryComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./try-it-out.component.html",
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
		const params = op.parameters;
		if (!Array.isArray(params)) return [];
		return params.filter(
			(p): p is Record<string, unknown> => p != null && typeof p === "object",
		);
	});

	readonly pathParams = computed(() =>
		this.rawParams()
			.filter((p) => p.in === "path")
			.map((p) => ({
				name: String(p.name ?? ""),
				required: Boolean(p.required),
				schema: asRecord(p.schema),
				enumValues: extractEnumFromParam(p),
			})),
	);

	readonly queryParams = computed(() =>
		this.rawParams()
			.filter((p) => p.in === "query")
			.map((p) => ({
				name: String(p.name ?? ""),
				required: Boolean(p.required),
				schema: asRecord(p.schema),
				enumValues: extractEnumFromParam(p),
			})),
	);

	readonly headerParams = computed(() =>
		this.rawParams()
			.filter((p) => p.in === "header")
			.map((p) => ({
				name: String(p.name ?? ""),
				required: Boolean(p.required),
				schema: asRecord(p.schema),
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
		return first ? String(first.url ?? "") : "";
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
							([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`,
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

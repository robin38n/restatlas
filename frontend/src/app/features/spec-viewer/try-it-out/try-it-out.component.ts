import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	signal,
} from "@angular/core";
import { dig } from "../../../core/utils/dig";
import { asRecord } from "../../../core/utils/record-helpers";
import type { EndpointNode } from "../../../models/graph.model";
import { ResponseViewerComponent } from "../../../shared/components/response-viewer/response-viewer.component";
import { SpecGraphService } from "../services/spec-graph.service";
import {
	type ProxyRequest,
	TryItOutService,
} from "../services/try-it-out.service";
import { SchemaFormComponent } from "./schema-form.component";

@Component({
	selector: "app-try-it-out",
	imports: [SchemaFormComponent, ResponseViewerComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./try-it-out.component.html",
})
export class TryItOutComponent {
	readonly endpoint = input.required<EndpointNode>();

	protected readonly svc = inject(SpecGraphService);
	protected readonly tryItOut = inject(TryItOutService);

	readonly pathParams = signal<Record<string, string>>({});
	readonly queryParams = signal<Record<string, string>>({});
	readonly headerParams = signal<Record<string, string>>({});
	readonly body = signal<Record<string, unknown>>({});
	readonly urlOverride = signal<string | null>(null);
	readonly enabledParameters = signal<Record<string, boolean>>({});

	readonly rawOperation = computed(() => {
		const ep = this.endpoint();
		const raw = this.svc.rawSpec();
		if (!ep || !raw) return null;
		const pathItem = asRecord(dig(raw, "paths", ep.path));
		if (!pathItem) return null;
		return asRecord(pathItem[ep.method.toLowerCase()]) ?? null;
	});

	readonly parameters = computed(() => {
		const op = this.rawOperation();
		if (!op || !Array.isArray(op.parameters)) return [];
		// biome-ignore lint/suspicious/noExplicitAny: template needs index access
		return op.parameters as Record<string, any>[];
	});

	readonly pathParameters = computed(() =>
		this.parameters().filter((p) => p.in === "path"),
	);
	readonly queryParameters = computed(() =>
		this.parameters().filter((p) => p.in === "query"),
	);
	readonly headerParameters = computed(() =>
		this.parameters().filter((p) => p.in === "header"),
	);

	readonly url = computed(() => {
		const override = this.urlOverride();
		if (override !== null) return override;
		const ep = this.endpoint();

		let path = ep.path;
		for (const [name, value] of Object.entries(this.pathParams())) {
			if (value) {
				path = path.replace(`{${name}}`, encodeURIComponent(value));
			}
		}

		const raw = this.svc.rawSpec();
		const servers = dig(raw, "servers");
		const base =
			Array.isArray(servers) && servers.length > 0
				? asRecord(servers[0])?.url || ""
				: "";

		let url = `${base}${path}`;

		const qp = this.queryParams();
		const enabled = this.enabledParameters();
		const searchParams = new URLSearchParams();
		let hasQuery = false;

		for (const p of this.queryParameters()) {
			const value = qp[p.name];
			if ((p.required || enabled[p.name]) && value !== undefined && value !== "") {
				searchParams.append(p.name, value);
				hasQuery = true;
			}
		}

		if (hasQuery) {
			url += (url.includes("?") ? "&" : "?") + searchParams.toString();
		}

		return url;
	});

	onUrlChange(event: Event): void {
		this.urlOverride.set((event.target as HTMLInputElement).value);
	}

	updatePathParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.pathParams.update((p) => ({ ...p, [name]: val }));
	}

	updateQueryParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.queryParams.update((p) => ({ ...p, [name]: val }));
		if (val !== "") {
			this.enabledParameters.update((e) => ({ ...e, [name]: true }));
		}
	}

	updateHeaderParam(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.headerParams.update((p) => ({ ...p, [name]: val }));
		if (val !== "") {
			this.enabledParameters.update((e) => ({ ...e, [name]: true }));
		}
	}

	toggleParameter(name: string, event: Event): void {
		const checked = (event.target as HTMLInputElement).checked;
		this.enabledParameters.update((e) => ({ ...e, [name]: checked }));
	}

	hasSchema(obj: unknown): boolean {
		const s = this.getSchema(obj);
		return !!s && !!asRecord(s.properties);
	}

	getSchema(obj: unknown): Record<string, unknown> {
		return (
			asRecord(dig(asRecord(obj), "content", "application/json", "schema")) ||
			{}
		);
	}

	async sendRequest(): Promise<void> {
		const ep = this.endpoint();

		const qp = this.queryParams();
		const hp = this.headerParams();
		const enabled = this.enabledParameters();
		const headers: Record<string, string> = {};

		for (const p of this.headerParameters()) {
			const value = hp[p.name];
			if ((p.required || enabled[p.name]) && value) {
				headers[p.name] = value;
			}
		}

		await this.tryItOut.sendRequest({
			method: ep.method as ProxyRequest["method"],
			url: this.url(),
			body: this.body(),
			headers,
			specId: this.svc.specId() ?? undefined,
		});
	}
}

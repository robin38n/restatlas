import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { ResponseViewerComponent } from "../../shared/components/response-viewer/response-viewer.component";
import { RequestHistoryComponent } from "../../shared/components/request-history/request-history.component";
import {
	type HistoryEntry,
	type ProxyRequest,
	TryItOutService,
} from "../spec-viewer/services/try-it-out.service";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

@Component({
	selector: "app-api-client",
	imports: [ResponseViewerComponent, RequestHistoryComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./api-client.component.html",
})
export class ApiClientComponent {
	private readonly router = inject(Router);
	protected readonly tryItOut = inject(TryItOutService);

	readonly methods = METHODS;
	readonly method = signal<string>("GET");
	readonly url = signal("");
	readonly headers = signal<Array<{ key: string; value: string }>>([]);
	readonly body = signal("");

	readonly showBody = computed(() => {
		const m = this.method();
		return m === "POST" || m === "PUT" || m === "PATCH";
	});

	constructor() {
		const state = this.router.getCurrentNavigation()?.extras?.state;
		if (state) {
			if (state["method"]) this.method.set(String(state["method"]));
			if (state["url"]) this.url.set(String(state["url"]));
			if (state["body"]) this.body.set(String(state["body"]));
			if (Array.isArray(state["headers"])) {
				this.headers.set(state["headers"]);
			}
		}
	}

	inputValue(event: Event): string {
		return (event.target as HTMLInputElement).value;
	}

	asMethod(event: Event): string {
		return (event.target as HTMLSelectElement).value;
	}

	addHeader(): void {
		this.headers.update((h) => [...h, { key: "", value: "" }]);
	}

	removeHeader(index: number): void {
		this.headers.update((h) => h.filter((_, i) => i !== index));
	}

	updateHeader(index: number, field: "key" | "value", event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.headers.update((h) =>
			h.map((item, i) => (i === index ? { ...item, [field]: val } : item)),
		);
	}

	async sendRequest(): Promise<void> {
		const reqUrl = this.url().trim();
		if (!reqUrl) return;

		const headers: Record<string, string> = {};
		for (const h of this.headers()) {
			if (h.key.trim()) {
				headers[h.key.trim()] = h.value;
			}
		}

		const method = this.method() as ProxyRequest["method"];
		const hasBody = ["POST", "PUT", "PATCH"].includes(method);

		if (hasBody && !headers["Content-Type"]) {
			headers["Content-Type"] = "application/json";
		}

		let bodyPayload: unknown;
		if (hasBody && this.body().trim()) {
			try {
				bodyPayload = JSON.parse(this.body());
			} catch {
				bodyPayload = this.body();
			}
		}

		await this.tryItOut.sendRequest({
			method,
			url: reqUrl,
			headers: Object.keys(headers).length > 0 ? headers : undefined,
			body: hasBody && bodyPayload != null ? bodyPayload : undefined,
		});
	}

	onReplayRequest(entry: HistoryEntry): void {
		this.method.set(entry.request.method);
		this.url.set(entry.request.url);

		if (entry.request.headers) {
			this.headers.set(
				Object.entries(entry.request.headers).map(([key, value]) => ({
					key,
					value,
				})),
			);
		} else {
			this.headers.set([]);
		}

		if (entry.request.body != null) {
			this.body.set(
				typeof entry.request.body === "string"
					? entry.request.body
					: JSON.stringify(entry.request.body, null, 2),
			);
		} else {
			this.body.set("");
		}

		this.tryItOut.lastResponse.set(entry.response);
	}
}

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { ResponseViewerComponent } from "../spec-viewer/response-viewer";
import { RequestHistoryComponent } from "../spec-viewer/request-history";
import {
	type HistoryEntry,
	type ProxyRequest,
	TryItOutService,
} from "../spec-viewer/try-it-out.service";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

@Component({
	selector: "app-api-client",
	standalone: true,
	imports: [ResponseViewerComponent, RequestHistoryComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="client-container">
			<h1>API Client</h1>
			<p class="subtitle">Send HTTP requests to any API endpoint.</p>

			<!-- URL Bar -->
			<div class="url-bar">
				<select
					class="method-select"
					[attr.data-method]="method()"
					(change)="method.set(asMethod($event))"
				>
					@for (m of methods; track m) {
						<option [value]="m" [selected]="m === method()">{{ m }}</option>
					}
				</select>
				<input
					class="url-input"
					type="text"
					placeholder="https://api.example.com/resource"
					[value]="url()"
					(input)="url.set(inputValue($event))"
				/>
				<button
					class="send-btn"
					(click)="sendRequest()"
					[disabled]="tryItOut.loading() || !url()"
				>{{ tryItOut.loading() ? 'Sending...' : 'Send' }}</button>
			</div>

			@if (tryItOut.error()) {
				<div class="error">{{ tryItOut.error() }}</div>
			}

			<!-- Headers -->
			<details class="section" [open]="headers().length > 0">
				<summary class="section-title">
					Headers
					@if (headers().length > 0) {
						<span class="badge">{{ headers().length }}</span>
					}
				</summary>
				<div class="headers-editor">
					@for (h of headers(); track $index; let i = $index) {
						<div class="header-row">
							<input
								class="header-key"
								placeholder="Header name"
								[value]="h.key"
								(input)="updateHeader(i, 'key', $event)"
							/>
							<input
								class="header-value"
								placeholder="Value"
								[value]="h.value"
								(input)="updateHeader(i, 'value', $event)"
							/>
							<button class="remove-btn" (click)="removeHeader(i)" title="Remove header">&times;</button>
						</div>
					}
					<button class="add-btn" (click)="addHeader()">+ Add Header</button>
				</div>
			</details>

			<!-- Body -->
			@if (showBody()) {
				<div class="section">
					<div class="section-title">Body</div>
					<textarea
						class="body-editor"
						rows="8"
						placeholder='{ "key": "value" }'
						[value]="body()"
						(input)="body.set(inputValue($event))"
					></textarea>
				</div>
			}

			<!-- Response -->
			@if (tryItOut.lastResponse()) {
				<app-response-viewer [response]="tryItOut.lastResponse()!" />
			}

			<!-- History -->
			<app-request-history (replayRequest)="onReplayRequest($event)" />
		</div>
	`,
	styles: `
		.client-container {
			max-width: 900px;
			margin: 2rem auto;
			padding: 0 1rem;
			font-family: system-ui, sans-serif;
		}
		h1 {
			font-size: 1.5rem;
			margin: 0 0 0.25rem;
		}
		.subtitle {
			color: #555;
			font-size: 0.9rem;
			margin: 0 0 1.5rem;
		}
		.url-bar {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 1rem;
		}
		.method-select {
			padding: 0.5rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.85rem;
			font-weight: 600;
			background: #fff;
			cursor: pointer;
			color: #fff;
			min-width: 5.5rem;
		}
		.method-select[data-method="GET"] { background: #16a34a; border-color: #16a34a; }
		.method-select[data-method="POST"] { background: #2563eb; border-color: #2563eb; }
		.method-select[data-method="PUT"] { background: #d97706; border-color: #d97706; }
		.method-select[data-method="PATCH"] { background: #9333ea; border-color: #9333ea; }
		.method-select[data-method="DELETE"] { background: #dc2626; border-color: #dc2626; }
		.method-select option { background: #fff; color: #333; }
		.url-input {
			flex: 1;
			padding: 0.5rem 0.75rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.85rem;
			font-family: monospace;
			min-width: 0;
		}
		.url-input:focus {
			outline: none;
			border-color: #2563eb;
			box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
		}
		.send-btn {
			padding: 0.5rem 1.25rem;
			background: #1e293b;
			color: #fff;
			border: none;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.85rem;
			font-weight: 600;
			flex-shrink: 0;
		}
		.send-btn:hover:not(:disabled) { background: #334155; }
		.send-btn:disabled { opacity: 0.5; cursor: not-allowed; }
		.error {
			padding: 0.5rem 0.75rem;
			background: #fef2f2;
			color: #dc2626;
			border-radius: 4px;
			font-size: 0.85rem;
			margin-bottom: 1rem;
		}
		.section {
			margin-bottom: 1rem;
		}
		.section-title {
			font-size: 0.8rem;
			font-weight: 600;
			color: #555;
			text-transform: uppercase;
			letter-spacing: 0.05em;
			margin-bottom: 0.5rem;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}
		summary.section-title {
			list-style: none;
		}
		summary.section-title::-webkit-details-marker {
			display: none;
		}
		summary.section-title::before {
			content: '\\25B6';
			font-size: 0.6rem;
			transition: transform 0.15s;
		}
		details[open] > summary.section-title::before {
			transform: rotate(90deg);
		}
		.badge {
			font-size: 0.65rem;
			background: #e5e7eb;
			color: #374151;
			padding: 0.1rem 0.375rem;
			border-radius: 8px;
			font-weight: 600;
		}
		.headers-editor {
			display: flex;
			flex-direction: column;
			gap: 0.375rem;
			margin-top: 0.375rem;
		}
		.header-row {
			display: flex;
			gap: 0.375rem;
			align-items: center;
		}
		.header-key, .header-value {
			flex: 1;
			padding: 0.35rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.8rem;
			font-family: monospace;
		}
		.header-key { max-width: 200px; }
		.header-key:focus, .header-value:focus {
			outline: none;
			border-color: #2563eb;
		}
		.remove-btn {
			background: none;
			border: none;
			color: #9ca3af;
			cursor: pointer;
			font-size: 1.1rem;
			padding: 0 0.25rem;
			line-height: 1;
		}
		.remove-btn:hover { color: #dc2626; }
		.add-btn {
			background: none;
			border: 1px dashed #d1d5db;
			border-radius: 4px;
			padding: 0.3rem 0.5rem;
			font-size: 0.75rem;
			color: #6b7280;
			cursor: pointer;
			align-self: flex-start;
		}
		.add-btn:hover { border-color: #9ca3af; color: #374151; }
		.body-editor {
			width: 100%;
			padding: 0.5rem 0.75rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-family: monospace;
			font-size: 0.8rem;
			resize: vertical;
			box-sizing: border-box;
			line-height: 1.5;
		}
		.body-editor:focus {
			outline: none;
			border-color: #2563eb;
		}
	`,
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

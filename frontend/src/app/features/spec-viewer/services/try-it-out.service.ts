import { computed, inject, Injectable, signal } from "@angular/core";
import { ApiService } from "../../../core/api.service";

export interface HistoryEntry {
	id: number;
	timestamp: Date;
	request: ProxyRequest;
	response: ProxyResponse;
}

export interface ProxyRequest {
	method: string;
	url: string;
	headers?: Record<string, string>;
	body?: unknown;
}

export interface ProxyResponse {
	status: number;
	headers: Record<string, string>;
	body?: unknown;
	durationMs?: number;
}

@Injectable({ providedIn: "root" })
export class TryItOutService {
	private readonly api = inject(ApiService);
	private nextId = 1;

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly lastResponse = signal<ProxyResponse | null>(null);
	readonly history = signal<HistoryEntry[]>([]);
	readonly selectedHistoryIndex = signal<number | null>(null);

	readonly historyCount = computed(() => this.history().length);
	readonly selectedEntry = computed(() => {
		const idx = this.selectedHistoryIndex();
		return idx != null ? this.history()[idx] ?? null : null;
	});

	async sendRequest(req: ProxyRequest): Promise<void> {
		this.loading.set(true);
		this.error.set(null);

		try {
			const { data, error } = await this.api.proxyRequest(
				req as unknown as Parameters<typeof this.api.proxyRequest>[0],
			);
			if (error) {
				this.error.set("Proxy request failed");
				return;
			}
			const response = data as unknown as ProxyResponse;
			this.lastResponse.set(response);
			this.history.update((h) => [
				{
					id: this.nextId++,
					timestamp: new Date(),
					request: req,
					response,
				},
				...h,
			]);
		} catch (e) {
			this.error.set(e instanceof Error ? e.message : "Unknown error");
		} finally {
			this.loading.set(false);
		}
	}

	selectHistoryEntry(index: number): HistoryEntry | null {
		this.selectedHistoryIndex.set(index);
		const entry = this.history()[index] ?? null;
		if (entry) {
			this.lastResponse.set(entry.response);
		}
		return entry;
	}

	clearHistory(): void {
		this.history.set([]);
		this.selectedHistoryIndex.set(null);
	}
}

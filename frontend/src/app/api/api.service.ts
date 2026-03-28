import { Injectable } from "@angular/core";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

type ProxyRequestBody = components["schemas"]["ProxyRequest"];

export interface DemoInfo {
	slug: string;
	title: string;
	description: string;
}

@Injectable({ providedIn: "root" })
export class ApiService {
	private readonly client = createClient<paths>({ baseUrl: "/api" });

	uploadSpec(spec: Record<string, unknown>) {
		return this.client.POST("/specs", { body: spec });
	}

	getSpec(id: string) {
		return this.client.GET("/specs/{id}", {
			params: { path: { id } },
		});
	}

	healthCheck() {
		return this.client.GET("/health");
	}

	proxyRequest(body: ProxyRequestBody) {
		return this.client.POST("/proxy", { body });
	}

	async listDemos(): Promise<{
		data?: DemoInfo[];
		error?: unknown;
	}> {
		const res = await fetch("/api/demos");
		if (!res.ok) return { error: await res.json() };
		return { data: await res.json() };
	}

	async loadDemo(slug: string): Promise<{
		data?: {
			id: string;
			title: string;
			version: string;
			endpointCount: number;
			schemaCount: number;
		};
		error?: unknown;
	}> {
		const res = await fetch(`/api/demos/${encodeURIComponent(slug)}`, {
			method: "POST",
		});
		if (!res.ok) return { error: await res.json() };
		return { data: await res.json() };
	}
}

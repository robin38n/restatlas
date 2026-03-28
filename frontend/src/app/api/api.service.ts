import { Injectable } from "@angular/core";
import createClient from "openapi-fetch";
import type { paths } from "./schema";

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

	async loadDemo(): Promise<{
		data?: {
			id: string;
			title: string;
			version: string;
			endpointCount: number;
			schemaCount: number;
		};
		error?: unknown;
	}> {
		const res = await fetch("/api/demo", { method: "POST" });
		if (!res.ok) return { error: await res.json() };
		return { data: await res.json() };
	}
}

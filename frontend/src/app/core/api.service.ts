import { Injectable } from "@angular/core";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

type ProxyRequestBody = components["schemas"]["ProxyRequest"];
type SpecSummary = components["schemas"]["SpecSummary"];
type ValidationError = components["schemas"]["ValidationError"];

@Injectable({ providedIn: "root" })
export class ApiService {
	private readonly client = createClient<paths>({ baseUrl: "/api" });

	uploadSpec(spec: Record<string, unknown>) {
		return this.client.POST("/specs", { body: spec });
	}

	async uploadSpecRaw(
		text: string,
		contentType: string,
	): Promise<{ data?: SpecSummary; error?: ValidationError }> {
		const res = await fetch("/api/specs", {
			method: "POST",
			headers: { "Content-Type": contentType },
			body: text,
		});
		const body = await res.json();
		if (!res.ok) return { error: body };
		return { data: body };
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

	listDemos() {
		return this.client.GET("/demos");
	}

	getDemoSpec(slug: string) {
		return this.client.GET("/demos/{slug}", {
			params: { path: { slug } },
		});
	}

	loadDemo(slug: string) {
		return this.client.POST("/demos/{slug}/load", {
			params: { path: { slug } },
		});
	}
}

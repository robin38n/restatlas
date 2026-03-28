import { Injectable } from "@angular/core";
import createClient from "openapi-fetch";
import type { components, paths } from "./schema";

type ProxyRequestBody = components["schemas"]["ProxyRequest"];

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

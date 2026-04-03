import {
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import { ApiService } from "../../core/api.service";
import type { components } from "../../core/schema";

type SpecSummary = components["schemas"]["SpecSummary"];
type DemoInfo = components["schemas"]["DemoInfo"];

const PLACEHOLDER_SPEC = `Paste a JSON or YAML OpenAPI spec, e.g.:

{
  "openapi": "3.0.3",
  "info": { "title": "My API", "version": "1.0.0" },
  "paths": { ... }
}

or:

openapi: 3.0.3
info:
  title: My API
  version: 1.0.0
paths: ...`;

@Component({
	selector: "app-upload",
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./upload.component.html",
})
export class UploadComponent {
	private readonly api = inject(ApiService);
	specInput = viewChild.required<ElementRef<HTMLTextAreaElement>>("specInput");

	loading = signal(false);
	loadingDemo = signal(false);
	error = signal<string | null>(null);
	summary = signal<SpecSummary | null>(null);
	demos = signal<DemoInfo[]>([]);
	selectedDemoSlug = signal("");

	readonly placeholder = PLACEHOLDER_SPEC;

	constructor() {
		this.api.listDemos().then(({ data }) => {
			if (data && data.length > 0) {
				this.demos.set(data);
			}
		});
	}

	async selectDemo(slug: string) {
		if (this.selectedDemoSlug() === slug) {
			this.selectedDemoSlug.set("");
			this.specInput().nativeElement.value = "";
			this.autoResize();
			return;
		}

		this.selectedDemoSlug.set(slug);
		this.loadingDemo.set(true);

		try {
			const { data } = await this.api.getDemoSpec(slug);
			if (data) {
				const text = JSON.stringify(data, null, 2);
				this.specInput().nativeElement.value = text;
				this.autoResize();
			}
		} catch {
			this.error.set("Failed to load example spec");
		} finally {
			this.loadingDemo.set(false);
		}
	}

	async onFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const text = await file.text();
		this.specInput().nativeElement.value = text;
		this.selectedDemoSlug.set("");
		this.autoResize();
	}

	autoResize(): void {
		const el = this.specInput().nativeElement;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 500)}px`;
	}

	async submit() {
		this.error.set(null);
		this.summary.set(null);

		const text = this.specInput().nativeElement.value.trim();
		if (!text) {
			this.error.set("Please paste or upload an OpenAPI spec");
			return;
		}

		let isJSON = false;
		try {
			JSON.parse(text);
			isJSON = true;
		} catch {
			// Not valid JSON — treat as YAML
		}

		const contentType = isJSON ? "application/json" : "application/x-yaml";

		this.loading.set(true);
		try {
			const { data, error } = await this.api.uploadSpecRaw(text, contentType);
			if (error) {
				this.error.set(error.error ?? "Upload failed");
			} else if (data) {
				this.summary.set(data);
			}
		} catch {
			this.error.set("Network error — is the backend running?");
		} finally {
			this.loading.set(false);
		}
	}
}

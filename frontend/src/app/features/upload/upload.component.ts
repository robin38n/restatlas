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
import { ThemeService } from "../../core/theme.service";

type SpecSummaryRaw = components["schemas"]["SpecSummary"];
type SpecSummary = SpecSummaryRaw & { endpoints?: number; schemas?: number };
type DemoInfo = components["schemas"]["DemoInfo"];

import { DecimalPipe } from "@angular/common";
import { ReactiveBackgroundComponent } from "../../shared/components/reactive-background/reactive-background.component";

@Component({
	selector: "app-upload",
	imports: [RouterLink, ReactiveBackgroundComponent, DecimalPipe],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./upload.component.html",
})
export class UploadComponent {
	private readonly api = inject(ApiService);
	protected readonly theme = inject(ThemeService);

	readonly input = viewChild.required<ElementRef<HTMLTextAreaElement>>("input");

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly summary = signal<SpecSummary | null>(null);
	readonly demos = signal<DemoInfo[]>([]);
	readonly selectedDemoSlug = signal("");

	constructor() {
		this.api.listDemos().then(({ data }) => {
			if (data && data.length > 0) {
				this.demos.set(data);
			}
		});
	}

	async loadDemo(slug: string) {
		this.selectedDemoSlug.set(slug);
		try {
			const { data } = await this.api.getDemoSpec(slug);
			if (data) {
				this.input().nativeElement.value = JSON.stringify(data, null, 2);
			}
		} catch {
			this.error.set("Failed to load demo");
		}
	}

	async onFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;
		this.input().nativeElement.value = await file.text();
	}

	async visualize() {
		this.error.set(null);
		const text = this.input().nativeElement.value.trim();
		if (!text) return;

		this.loading.set(true);
		try {
			const { data, error } = await this.api.uploadSpecRaw(
				text,
				text.startsWith("{") ? "application/json" : "application/x-yaml",
			);
			if (error) {
				this.error.set(error.error || "Upload failed");
			} else if (data) {
				const s = data as SpecSummary;
				s.endpoints = data.endpointCount;
				s.schemas = data.schemaCount;
				this.summary.set(s);
			}
		} catch {
			this.error.set("Network error");
		} finally {
			this.loading.set(false);
		}
	}
}

import {
	Component,
	type ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { ApiService, type DemoInfo } from "../../api/api.service";
import type { components } from "../../api/schema";

type SpecSummary = components["schemas"]["SpecSummary"];

const PLACEHOLDER_JSON = `{
  "openapi": "3.0.3",
  "info": {
    "title": "My API",
    "version": "1.0.0"
  },
  "paths": { ... },
  "components": {
    "schemas": { ... }
  }
}`;

@Component({
	selector: "app-upload",
	standalone: true,
	imports: [RouterLink],
	template: `
    <div class="upload-container">
      <h1><img src="assets/icons/restatlas.svg" alt="" class="logo" /> RestAtlas</h1>
      <p class="subtitle">Visual OpenAPI Explorer — paste a spec or upload a file to visualize your API as an interactive graph.</p>

      <div class="textarea-wrapper">
        <div class="textarea-toolbar">
          @if (demos().length > 0) {
            <select class="demo-select" (change)="selectedDemoSlug.set($any($event.target).value)">
              @for (d of demos(); track d.slug) {
                <option [value]="d.slug" [selected]="d.slug === selectedDemoSlug()">{{ d.title }}</option>
              }
            </select>
            <button class="use-example" (click)="loadDemo()" [disabled]="loading() || !selectedDemoSlug()">
              Load Example
            </button>
          }
        </div>
        <textarea
          #specInput
          [placeholder]="placeholder"
          (input)="autoResize()"
        ></textarea>
      </div>

      <div class="actions">
        <label class="file-label">
          Upload file
          <input type="file" accept=".json,.yaml,.yml" (change)="onFileSelect($event)" hidden />
        </label>
        <button class="primary-btn" (click)="submit()" [disabled]="loading()">
          {{ loading() ? 'Uploading...' : 'Upload Spec' }}
        </button>
      </div>

      @if (error()) {
        <div class="error">{{ error() }}</div>
      }

      @if (summary(); as s) {
        <div class="summary">
          <h2>{{ s.title }} <span class="version">v{{ s.version }}</span></h2>
          <div class="stats">
            <span>{{ s.endpointCount }} endpoints</span>
            <span>{{ s.schemaCount }} schemas</span>
          </div>
          <a [routerLink]="['/specs', s.id]" class="view-link">View Graph &rarr;</a>
        </div>
      }
    </div>
  `,
	styles: `
    .upload-container {
      max-width: 700px;
      margin: 3rem auto;
      padding: 1rem;
      font-family: system-ui, sans-serif;
    }
    h1 {
      font-size: 1.75rem;
      margin: 0 0 0.25rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .logo {
      width: 32px;
      height: 32px;
    }
    .subtitle {
      color: #555;
      font-size: 0.9rem;
      margin: 0 0 1.5rem;
      line-height: 1.5;
    }
    .textarea-wrapper {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      overflow: hidden;
    }
    .textarea-toolbar {
      display: flex;
      justify-content: flex-end;
      padding: 0.375rem 0.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .demo-select {
      font-size: 0.8rem;
      padding: 0.125rem 0.375rem;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      background: #fff;
      color: #374151;
    }
    .use-example {
      background: none;
      border: none;
      color: #2563eb;
      font-size: 0.8rem;
      cursor: pointer;
      padding: 0.125rem 0.375rem;
      border-radius: 3px;
    }
    .use-example:hover {
      background: #eff6ff;
    }
    .use-example:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    textarea {
      width: 100%;
      min-height: 360px;
      max-height: 500px;
      font-family: monospace;
      font-size: 0.85rem;
      padding: 0.75rem;
      border: none;
      outline: none;
      resize: none;
      line-height: 1.5;
      box-sizing: border-box;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    .primary-btn {
      padding: 0.5rem 1rem;
      border: 1px solid #333;
      border-radius: 4px;
      cursor: pointer;
      background: #333;
      color: #fff;
      font-size: 0.875rem;
    }
    .primary-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .file-label {
      padding: 0.5rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      cursor: pointer;
      background: #fff;
      color: #333;
      font-size: 0.875rem;
    }
    .file-label:hover {
      background: #f9fafb;
    }
    .error {
      margin-top: 1rem;
      padding: 0.75rem;
      background: #fef2f2;
      color: #dc2626;
      border-radius: 4px;
    }
    .summary {
      margin-top: 1rem;
      padding: 1rem;
      background: #f0fdf4;
      border-radius: 6px;
      border: 1px solid #bbf7d0;
    }
    .summary h2 {
      margin: 0;
      font-size: 1.1rem;
    }
    .version {
      color: #666;
      font-size: 0.875rem;
    }
    .stats {
      display: flex;
      gap: 1rem;
      margin-top: 0.5rem;
      color: #555;
      font-size: 0.875rem;
    }
    .view-link {
      display: inline-block;
      margin-top: 0.75rem;
      padding: 0.5rem 1rem;
      background: #333;
      color: #fff;
      border-radius: 4px;
      text-decoration: none;
      font-size: 0.875rem;
    }
    .view-link:hover {
      background: #555;
    }
  `,
})
export class UploadComponent {
	private readonly api = inject(ApiService);
	private readonly router = inject(Router);
	specInput = viewChild.required<ElementRef<HTMLTextAreaElement>>("specInput");

	loading = signal(false);
	error = signal<string | null>(null);
	summary = signal<SpecSummary | null>(null);
	demos = signal<DemoInfo[]>([]);
	selectedDemoSlug = signal("");

	readonly placeholder = PLACEHOLDER_JSON;

	constructor() {
		this.api.listDemos().then(({ data }) => {
			if (data && data.length > 0) {
				this.demos.set(data);
				this.selectedDemoSlug.set(data[0].slug);
			}
		});
	}

	async onFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const text = await file.text();
		this.specInput().nativeElement.value = text;
		this.autoResize();
	}

	autoResize(): void {
		const el = this.specInput().nativeElement;
		el.style.height = "auto";
		el.style.height = `${Math.min(el.scrollHeight, 500)}px`;
	}

	async loadDemo() {
		const slug = this.selectedDemoSlug();
		if (!slug) return;

		this.error.set(null);
		this.summary.set(null);
		this.loading.set(true);

		try {
			const { data, error } = await this.api.loadDemo(slug);
			if (error) {
				this.error.set("Failed to load demo");
			} else if (data) {
				this.router.navigate(["/specs", data.id]);
			}
		} catch {
			this.error.set("Network error — is the backend running?");
		} finally {
			this.loading.set(false);
		}
	}

	async submit() {
		this.error.set(null);
		this.summary.set(null);

		const text = this.specInput().nativeElement.value.trim();
		if (!text) {
			this.error.set("Please paste or upload an OpenAPI spec");
			return;
		}

		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(text);
		} catch {
			this.error.set("Invalid JSON. YAML support coming soon.");
			return;
		}

		this.loading.set(true);
		try {
			const { data, error } = await this.api.uploadSpec(parsed);
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

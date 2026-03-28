import {
	Component,
	type ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { ApiService } from "../../api/api.service";
import type { components } from "../../api/schema";

type SpecSummary = components["schemas"]["SpecSummary"];
type DemoInfo = components["schemas"]["DemoInfo"];

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
      <h1>Visual OpenAPI Explorer</h1>
      <p class="subtitle">Paste a spec or upload a file to visualize your API as an interactive graph.</p>

      <div class="textarea-wrapper">
        <div class="textarea-toolbar">
          @if (demos().length > 0) {
            <span class="toolbar-label">Examples:</span>
            @for (d of demos(); track d.slug) {
              <button
                class="demo-chip"
                [class.active]="selectedDemoSlug() === d.slug"
                (click)="selectDemo(d.slug)"
                [disabled]="loadingDemo()"
              >{{ d.title }}</button>
            }
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
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 10v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3"/><polyline points="5 6 8 3 11 6"/><line x1="8" y1="3" x2="8" y2="11"/></svg>
          Upload file
          <input type="file" accept=".json,.yaml,.yml" (change)="onFileSelect($event)" hidden />
        </label>
        <button class="primary-btn" (click)="submit()" [disabled]="loading()">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="6.5" cy="6.5" r="4.5"/><line x1="10" y1="10" x2="14" y2="14"/></svg>
          {{ loading() ? 'Analyzing...' : 'Visualize' }}
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
      align-items: center;
      gap: 0.375rem;
      padding: 0.375rem 0.5rem;
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }
    .toolbar-label {
      font-size: 0.75rem;
      color: #6b7280;
      flex-shrink: 0;
    }
    .demo-chip {
      font-size: 0.75rem;
      padding: 0.2rem 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 12px;
      background: #fff;
      color: #374151;
      cursor: pointer;
      transition: all 0.15s;
    }
    .demo-chip:hover:not(:disabled) {
      background: #f3f4f6;
      border-color: #9ca3af;
    }
    .demo-chip.active {
      background: #1e293b;
      color: #fff;
      border-color: #1e293b;
    }
    .demo-chip:disabled {
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
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
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
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
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
	loadingDemo = signal(false);
	error = signal<string | null>(null);
	summary = signal<SpecSummary | null>(null);
	demos = signal<DemoInfo[]>([]);
	selectedDemoSlug = signal("");

	readonly placeholder = PLACEHOLDER_JSON;

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

import {
	Component,
	type ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { ApiService } from "../../api/api.service";
import type { components } from "../../api/schema";

type SpecSummary = components["schemas"]["SpecSummary"];

@Component({
	selector: "app-upload",
	standalone: true,
	template: `
    <div class="upload-container">
      <h1>RestAtlas</h1>
      <p>Paste an OpenAPI spec (JSON) or upload a file</p>

      <textarea
        #specInput
        rows="12"
        placeholder='{"openapi": "3.0.3", "info": {...}, "paths": {...}}'
      ></textarea>

      <div class="actions">
        <label class="file-label">
          Upload file
          <input type="file" accept=".json,.yaml,.yml" (change)="onFileSelect($event)" hidden />
        </label>
        <button (click)="submit()" [disabled]="loading()">
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
          <pre>ID: {{ s.id }}</pre>
        </div>
      }
    </div>
  `,
	styles: `
    .upload-container {
      max-width: 700px;
      margin: 2rem auto;
      padding: 1rem;
      font-family: system-ui, sans-serif;
    }
    textarea {
      width: 100%;
      font-family: monospace;
      font-size: 0.875rem;
      padding: 0.75rem;
      border: 1px solid #ccc;
      border-radius: 4px;
      resize: vertical;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      margin-top: 0.75rem;
    }
    button, .file-label {
      padding: 0.5rem 1rem;
      border: 1px solid #333;
      border-radius: 4px;
      cursor: pointer;
      background: #333;
      color: #fff;
      font-size: 0.875rem;
    }
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .file-label {
      background: #fff;
      color: #333;
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
      border-radius: 4px;
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
    }
    pre {
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: #888;
    }
  `,
})
export class UploadComponent {
	private readonly api = inject(ApiService);
	specInput = viewChild.required<ElementRef<HTMLTextAreaElement>>("specInput");

	loading = signal(false);
	error = signal<string | null>(null);
	summary = signal<SpecSummary | null>(null);

	async onFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const text = await file.text();
		this.specInput().nativeElement.value = text;
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

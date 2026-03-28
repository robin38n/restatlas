import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	signal,
} from "@angular/core";
import type { ProxyResponse } from "./try-it-out.service";

@Component({
	selector: "app-response-viewer",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="response-viewer">
			<div class="status-bar">
				<span class="status-badge" [attr.data-status]="statusGroup()">
					{{ response().status === 0 ? 'ERR' : response().status }}
				</span>
				@if (response().durationMs != null) {
					<span class="duration">{{ response().durationMs }}ms</span>
				}
			</div>

			<button class="headers-toggle" (click)="headersExpanded.update(v => !v)">
				Headers ({{ headerEntries().length }})
				<span>{{ headersExpanded() ? '\u25B2' : '\u25BC' }}</span>
			</button>
			@if (headersExpanded()) {
				<div class="headers-list">
					@for (h of headerEntries(); track h[0]) {
						<div class="header-row">
							<span class="header-name">{{ h[0] }}:</span>
							<span class="header-value">{{ h[1] }}</span>
						</div>
					}
				</div>
			}

			@if (formattedBody()) {
				<pre class="response-body"><code>{{ formattedBody() }}</code></pre>
			}
		</div>
	`,
	styles: `
		.response-viewer {
			margin-top: 0.75rem;
			border-top: 1px solid #e5e7eb;
			padding-top: 0.75rem;
		}
		.status-bar {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			margin-bottom: 0.5rem;
		}
		.status-badge {
			font-weight: 600;
			font-family: monospace;
			font-size: 0.8rem;
			padding: 0.2rem 0.5rem;
			border-radius: 4px;
			background: #f3f4f6;
		}
		.status-badge[data-status="2"] { background: #dcfce7; color: #166534; }
		.status-badge[data-status="3"] { background: #dbeafe; color: #1e40af; }
		.status-badge[data-status="4"] { background: #fef3c7; color: #92400e; }
		.status-badge[data-status="5"] { background: #fef2f2; color: #991b1b; }
		.status-badge[data-status="0"] { background: #f3f4f6; color: #6b7280; }
		.duration {
			font-size: 0.75rem;
			color: #6b7280;
		}
		.headers-toggle {
			background: none;
			border: none;
			cursor: pointer;
			font-size: 0.75rem;
			color: #6b7280;
			padding: 0.25rem 0;
			display: flex;
			align-items: center;
			gap: 0.375rem;
		}
		.headers-toggle:hover { color: #374151; }
		.headers-list {
			background: #f9fafb;
			border-radius: 4px;
			padding: 0.5rem;
			margin-bottom: 0.5rem;
			font-size: 0.7rem;
		}
		.header-row {
			display: flex;
			gap: 0.375rem;
			padding: 0.125rem 0;
		}
		.header-name {
			font-weight: 600;
			color: #374151;
			flex-shrink: 0;
		}
		.header-value {
			color: #6b7280;
			word-break: break-all;
		}
		.response-body {
			white-space: pre-wrap;
			word-break: break-all;
			font-family: monospace;
			font-size: 0.75rem;
			background: #f8fafc;
			border: 1px solid #e5e7eb;
			border-radius: 4px;
			padding: 0.75rem;
			max-height: 400px;
			overflow-y: auto;
			margin: 0.5rem 0 0;
		}
	`,
})
export class ResponseViewerComponent {
	readonly response = input.required<ProxyResponse>();

	readonly statusGroup = computed(() =>
		this.response().status === 0 ? "0" : String(this.response().status).charAt(0),
	);

	readonly formattedBody = computed(() => {
		const body = this.response().body;
		if (body == null) return "";
		if (typeof body === "string") return body;
		return JSON.stringify(body, null, 2);
	});

	readonly headerEntries = computed(() =>
		Object.entries(this.response().headers),
	);

	readonly headersExpanded = signal(false);
}

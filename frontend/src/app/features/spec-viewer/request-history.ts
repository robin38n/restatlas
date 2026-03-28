import {
	ChangeDetectionStrategy,
	Component,
	inject,
	output,
} from "@angular/core";
import { type HistoryEntry, TryItOutService } from "./try-it-out.service";

@Component({
	selector: "app-request-history",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (tryItOut.history().length > 0) {
			<div class="history">
				<div class="history-header">
					<h4>History</h4>
					<button class="clear-btn" (click)="tryItOut.clearHistory()">Clear</button>
				</div>
				@for (entry of tryItOut.history(); track entry.id; let i = $index) {
					<div
						class="history-item"
						[class.selected]="tryItOut.selectedHistoryIndex() === i"
						(click)="onReplay(entry)"
					>
						<span class="method" [attr.data-method]="entry.request.method">{{ entry.request.method }}</span>
						<span class="url">{{ truncateUrl(entry.request.url) }}</span>
						<span class="status-badge" [attr.data-status]="statusGroup(entry.response.status)">
							{{ entry.response.status === 0 ? 'ERR' : entry.response.status }}
						</span>
						@if (entry.response.durationMs != null) {
							<span class="duration">{{ entry.response.durationMs }}ms</span>
						}
					</div>
				}
			</div>
		}
	`,
	styles: `
		.history {
			margin-top: 0.75rem;
			border-top: 1px solid #e5e7eb;
			padding-top: 0.75rem;
		}
		.history-header {
			display: flex;
			align-items: center;
			justify-content: space-between;
			margin-bottom: 0.5rem;
		}
		h4 {
			margin: 0;
			font-size: 0.8rem;
			color: #555;
			text-transform: uppercase;
			letter-spacing: 0.05em;
		}
		.clear-btn {
			background: none;
			border: none;
			color: #dc2626;
			cursor: pointer;
			font-size: 0.7rem;
		}
		.clear-btn:hover { text-decoration: underline; }
		.history-item {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.3rem 0.375rem;
			border-radius: 4px;
			cursor: pointer;
			font-size: 0.75rem;
			margin-bottom: 0.125rem;
		}
		.history-item:hover { background: #f3f4f6; }
		.history-item.selected { background: #eff6ff; }
		.method {
			font-weight: 600;
			font-size: 0.6rem;
			padding: 0.1rem 0.25rem;
			border-radius: 3px;
			color: #fff;
			background: #6b7280;
			flex-shrink: 0;
		}
		.method[data-method="GET"] { background: #16a34a; }
		.method[data-method="POST"] { background: #2563eb; }
		.method[data-method="PUT"] { background: #d97706; }
		.method[data-method="PATCH"] { background: #9333ea; }
		.method[data-method="DELETE"] { background: #dc2626; }
		.url {
			font-family: monospace;
			font-size: 0.7rem;
			color: #374151;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			flex: 1;
			min-width: 0;
		}
		.status-badge {
			font-weight: 600;
			font-family: monospace;
			font-size: 0.65rem;
			padding: 0.1rem 0.25rem;
			border-radius: 3px;
			background: #f3f4f6;
			flex-shrink: 0;
		}
		.status-badge[data-status="2"] { background: #dcfce7; color: #166534; }
		.status-badge[data-status="4"] { background: #fef3c7; color: #92400e; }
		.status-badge[data-status="5"] { background: #fef2f2; color: #991b1b; }
		.status-badge[data-status="0"] { background: #f3f4f6; color: #6b7280; }
		.duration {
			font-size: 0.65rem;
			color: #9ca3af;
			flex-shrink: 0;
		}
	`,
})
export class RequestHistoryComponent {
	protected readonly tryItOut = inject(TryItOutService);
	readonly replayRequest = output<HistoryEntry>();

	onReplay(entry: HistoryEntry): void {
		this.replayRequest.emit(entry);
	}

	truncateUrl(url: string): string {
		try {
			const u = new URL(url);
			return u.pathname + u.search;
		} catch {
			return url.length > 60 ? url.slice(0, 60) + "..." : url;
		}
	}

	statusGroup(status: number): string {
		return status === 0 ? "0" : String(status).charAt(0);
	}
}

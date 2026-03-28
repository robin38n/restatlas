import {
	ChangeDetectionStrategy,
	Component,
	HostListener,
	signal,
} from "@angular/core";

interface LegendEntry {
	color: string;
	dash: string;
	label: string;
}

const LEGEND_ENTRIES: LegendEntry[] = [
	{ color: "#2563eb", dash: "", label: "Request body (input)" },
	{ color: "#6366f1", dash: "4 2", label: "Parameter" },
	{ color: "#16a34a", dash: "", label: "Response 2xx" },
	{ color: "#ef4444", dash: "", label: "Response 4xx" },
	{ color: "#991b1b", dash: "", label: "Response 5xx" },
	{ color: "#94a3b8", dash: "", label: "Schema reference" },
	{ color: "#94a3b8", dash: "6 3", label: "Array item" },
	{ color: "#94a3b8", dash: "2 2", label: "Composition" },
];

@Component({
	selector: "app-graph-legend",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<button
			class="legend-toggle"
			(click)="toggle($event)"
			title="Edge legend"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
				<line x1="12" y1="17" x2="12.01" y2="17"/>
			</svg>
		</button>
		@if (open()) {
			<div class="legend-panel" (click)="$event.stopPropagation()">
				<div class="legend-title">Edge Types</div>
				@for (entry of entries; track entry.label) {
					<div class="legend-row">
						<svg width="32" height="12" viewBox="0 0 32 12">
							<line
								x1="0" y1="6" x2="24" y2="6"
								[attr.stroke]="entry.color"
								stroke-width="2"
								[attr.stroke-dasharray]="entry.dash || 'none'"
							/>
							<polygon
								points="24,3 30,6 24,9"
								[attr.fill]="entry.color"
							/>
						</svg>
						<span>{{ entry.label }}</span>
					</div>
				}
			</div>
		}
	`,
	styles: `
		:host {
			position: absolute;
			top: 8px;
			right: 8px;
			z-index: 10;
		}
		.legend-toggle {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 32px;
			height: 32px;
			border-radius: 6px;
			border: 1px solid #e5e7eb;
			background: rgba(255, 255, 255, 0.85);
			backdrop-filter: blur(4px);
			cursor: pointer;
			color: #64748b;
			transition: background 0.15s;
		}
		.legend-toggle:hover {
			background: #fff;
			color: #1e293b;
		}
		.legend-panel {
			position: absolute;
			top: 36px;
			right: 0;
			background: rgba(255, 255, 255, 0.92);
			backdrop-filter: blur(8px);
			border: 1px solid #e5e7eb;
			border-radius: 8px;
			padding: 12px 14px;
			min-width: 180px;
			box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
		}
		.legend-title {
			font-size: 11px;
			font-weight: 600;
			color: #1e293b;
			margin-bottom: 8px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		.legend-row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 3px 0;
		}
		.legend-row span {
			font-size: 12px;
			color: #475569;
		}
	`,
})
export class GraphLegendComponent {
	readonly entries = LEGEND_ENTRIES;
	readonly open = signal(false);

	toggle(event: Event): void {
		event.stopPropagation();
		this.open.update((v) => !v);
	}

	@HostListener("document:click")
	onDocumentClick(): void {
		if (this.open()) {
			this.open.set(false);
		}
	}
}

import { ChangeDetectionStrategy, Component, output } from "@angular/core";

@Component({
	selector: "app-graph-controls",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="controls">
			<button (click)="zoomIn.emit()" title="Zoom in">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
					<line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/>
				</svg>
			</button>
			<button (click)="zoomOut.emit()" title="Zoom out">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
					<line x1="8" y1="11" x2="14" y2="11"/>
				</svg>
			</button>
			<button (click)="resetZoom.emit()" title="Reset zoom">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3.5 5.5L2 4l1.5-1.5"/><path d="M2 4h4.5a6.5 6.5 0 1 1 0 13H2"/>
				</svg>
			</button>
			<div class="divider"></div>
			<button (click)="fullscreen.emit()" title="Fullscreen">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
					<line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
				</svg>
			</button>
		</div>
	`,
	styles: `
		:host {
			position: absolute;
			bottom: 8px;
			right: 8px;
			z-index: 10;
		}
		.controls {
			display: flex;
			gap: 2px;
			border: 1px solid #e5e7eb;
			border-radius: 6px;
			background: rgba(255, 255, 255, 0.85);
			backdrop-filter: blur(4px);
			padding: 2px;
		}
		button {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 30px;
			height: 30px;
			border-radius: 4px;
			border: none;
			background: transparent;
			cursor: pointer;
			color: #64748b;
			transition: background 0.15s, color 0.15s;
		}
		button:hover {
			background: #f1f5f9;
			color: #1e293b;
		}
		.divider {
			width: 1px;
			background: #e5e7eb;
			margin: 4px 1px;
		}
	`,
})
export class GraphControlsComponent {
	readonly zoomIn = output();
	readonly zoomOut = output();
	readonly resetZoom = output();
	readonly fullscreen = output();
}

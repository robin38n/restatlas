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
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./graph-legend.component.html",
	host: {
		class: "absolute top-2 right-2 z-10",
	},
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

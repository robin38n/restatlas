import { ChangeDetectionStrategy, Component, output } from "@angular/core";

@Component({
	selector: "app-graph-controls",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./graph-controls.component.html",
	host: { class: "absolute bottom-2 right-2 z-10" },
})
export class GraphControlsComponent {
	readonly zoomIn = output();
	readonly zoomOut = output();
	readonly resetZoom = output();
	readonly fullscreen = output();
}

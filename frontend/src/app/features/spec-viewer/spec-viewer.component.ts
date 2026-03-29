import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
	type OnInit,
} from "@angular/core";
import { ActivatedRoute, RouterLink } from "@angular/router";
import type {
	EndpointNode,
	GraphNode,
	SchemaNode,
} from "../../models/graph.model";
import { GraphCanvasComponent } from "./graph/graph-canvas.component";
import { GraphCanvasForceComponent } from "./graph/graph-canvas-force.component";
import { GraphToolbarComponent } from "./graph/graph-toolbar.component";
import { MethodBadgeComponent } from "../../shared/components/method-badge/method-badge.component";
import { NodeDetailComponent } from "./node-detail/node-detail.component";
import { SpecGraphService } from "./services/spec-graph.service";

type GraphLayout = "structured" | "interactive";

@Component({
	selector: "app-spec-viewer",
	imports: [
		RouterLink,
		GraphCanvasComponent,
		GraphCanvasForceComponent,
		GraphToolbarComponent,
		MethodBadgeComponent,
		NodeDetailComponent,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./spec-viewer.component.html",
})
export class SpecViewerComponent implements OnInit {
	protected readonly svc = inject(SpecGraphService);
	private readonly route = inject(ActivatedRoute);
	protected readonly layout = signal<GraphLayout>("interactive");

	protected readonly displayGraph = computed(
		() => this.svc.filteredGraph() ?? this.svc.graph(),
	);

	protected readonly filteredEndpoints = computed(
		() =>
			this.displayGraph()?.nodes.filter(
				(n): n is EndpointNode => n.type === "endpoint",
			) ?? [],
	);

	protected readonly filteredSchemas = computed(
		() =>
			this.displayGraph()?.nodes.filter(
				(n): n is SchemaNode => n.type === "schema",
			) ?? [],
	);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get("id");
		if (id) {
			this.svc.loadSpec(id);
		}
	}

	onNodeClick(node: GraphNode): void {
		this.svc.selectNode(node);
	}
}

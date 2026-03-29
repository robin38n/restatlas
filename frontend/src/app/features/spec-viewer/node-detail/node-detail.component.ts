import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { SpecGraphService } from "../services/spec-graph.service";
import { EndpointDetailComponent } from "./endpoint-detail.component";
import { SchemaDetailComponent } from "./schema-detail.component";

@Component({
	selector: "app-node-detail",
	imports: [EndpointDetailComponent, SchemaDetailComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./node-detail.component.html",
})
export class NodeDetailComponent {
	protected readonly svc = inject(SpecGraphService);
}

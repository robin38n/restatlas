import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	type Signal,
	signal,
} from "@angular/core";
import { dig } from "../../../core/utils/dig";
import { asRecord } from "../../../core/utils/record-helpers";
import {
	extractContentRefs,
	schemaType,
} from "../../../core/utils/schema-helpers";
import type {
	EndpointNode,
	GraphNode,
	SchemaNode,
} from "../../../models/graph.model";
import { MethodBadgeComponent } from "../../../shared/components/method-badge/method-badge.component";
import { RequestHistoryComponent } from "../../../shared/components/request-history/request-history.component";
import { SpecGraphService } from "../services/spec-graph.service";
import { TryItOutComponent } from "../try-it-out/try-it-out.component";

@Component({
	selector: "app-endpoint-detail",
	imports: [TryItOutComponent, MethodBadgeComponent, RequestHistoryComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./endpoint-detail.component.html",
})
export class EndpointDetailComponent {
	protected readonly svc = inject(SpecGraphService);
	readonly activeTab = signal<"details" | "try-it">("details");
	readonly showApprovalDialog = signal(false);

	openApprovalDialog(): void {
		this.showApprovalDialog.set(true);
	}

	cancelApproval(): void {
		this.showApprovalDialog.set(false);
	}

	async confirmApproval(): Promise<void> {
		this.showApprovalDialog.set(false);
		await this.svc.approve();
	}

	asEndpoint(node: GraphNode | null): EndpointNode | null {
		return node?.type === "endpoint" ? (node as EndpointNode) : null;
	}

	readonly endpoint = computed((): EndpointNode | null => {
		return this.asEndpoint(this.svc.selectedNode());
	});

	private readonly rawOperation: Signal<Record<string, unknown> | null> =
		computed(() => {
			const ep = this.endpoint();
			const raw = this.svc.rawSpec();
			if (!ep || !raw) return null;
			const pathItem = asRecord(dig(raw, "paths", ep.path));
			if (!pathItem) return null;
			return asRecord(pathItem[ep.method.toLowerCase()]) ?? null;
		});

	readonly endpointParams = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const params = op.parameters;
		if (!Array.isArray(params)) return [];
		return params
			.filter(
				(p): p is Record<string, unknown> => p != null && typeof p === "object",
			)
			.map((p) => ({
				name: String(p.name ?? ""),
				in: String(p.in ?? ""),
				type: schemaType(asRecord(p.schema)),
				required: Boolean(p.required),
			}));
	});

	readonly requestBodySchemas = computed(() => {
		const op = this.rawOperation();
		if (!op) return null;
		const schemas = extractContentRefs(asRecord(op.requestBody));
		return schemas.length > 0 ? { refs: schemas } : null;
	});

	readonly responseEntries = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const responses = asRecord(op.responses);
		if (!responses) return [];
		return Object.entries(responses).map(([code, respDef]) => {
			const resp = asRecord(respDef);
			return {
				code,
				description: resp ? String(resp.description ?? "") : "",
				refs: extractContentRefs(resp),
			};
		});
	});

	readonly connections = computed(() => {
		const edges = this.svc.selectedNodeEdges();
		const nodeId = this.svc.selectedNodeId();
		const g = this.svc.graph();
		if (!g || !nodeId) return [];
		const nodeMap = new Map(g.nodes.map((n) => [n.id, n]));
		return edges.map((e) => {
			const otherId = e.target === nodeId ? e.source : e.target;
			const other = nodeMap.get(otherId);
			return {
				id: otherId,
				kind: e.kind,
				edgeLabel: e.label,
				label: other
					? other.type === "endpoint"
						? `${(other as EndpointNode).method} ${(other as EndpointNode).path}`
						: (other as SchemaNode).name
					: otherId,
			};
		});
	});

	navigateTo(nodeId: string): void {
		const g = this.svc.graph();
		if (!g) return;
		const node = g.nodes.find((n) => n.id === nodeId);
		if (node) {
			this.svc.selectNode(node);
		}
	}
}

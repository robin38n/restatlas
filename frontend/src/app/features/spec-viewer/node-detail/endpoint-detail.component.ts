import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	type Signal,
	signal,
} from "@angular/core";
import { Router } from "@angular/router";
import { dig } from "../../../core/utils/dig";
import { asRecord } from "../../../core/utils/record-helpers";
import {
	extractContentRefs,
	schemaType,
} from "../../../core/utils/schema-helpers";
import type { EndpointNode, SchemaNode } from "../../../models/graph.model";
import { MethodBadgeComponent } from "../../../shared/components/method-badge/method-badge.component";
import { StatusBadgeComponent } from "../../../shared/components/status-badge/status-badge.component";
import { SpecGraphService } from "../services/spec-graph.service";
import { TryItOutComponent } from "../try-it-out/try-it-out.component";

@Component({
	selector: "app-endpoint-detail",
	imports: [TryItOutComponent, MethodBadgeComponent, StatusBadgeComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./endpoint-detail.component.html",
})
export class EndpointDetailComponent {
	private readonly router = inject(Router);
	private readonly svc = inject(SpecGraphService);
	readonly activeTab = signal<"details" | "try-it">("details");

	readonly endpoint = computed((): EndpointNode | null => {
		const node = this.svc.selectedNode();
		return node?.type === "endpoint" ? (node as EndpointNode) : null;
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
		if (!op) return [];
		return extractContentRefs(asRecord(op.requestBody));
	});

	readonly responseEntries = computed(() => {
		const op = this.rawOperation();
		if (!op) return [];
		const responses = asRecord(op.responses);
		if (!responses) return [];
		return Object.entries(responses).map(([status, respDef]) => {
			const resp = asRecord(respDef);
			return {
				status,
				statusGroup: status.charAt(0),
				description: resp ? String(resp.description ?? "") : "",
				schemas: extractContentRefs(resp),
			};
		});
	});

	readonly connectedNodes = computed(() => {
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

	private readonly baseUrl = computed(() => {
		const raw = this.svc.rawSpec();
		const servers = dig(raw, "servers");
		if (!Array.isArray(servers) || servers.length === 0) return "";
		const first = asRecord(servers[0]);
		return first ? String(first.url ?? "") : "";
	});

	openInApiClient(): void {
		const ep = this.endpoint();
		if (!ep) return;
		this.router.navigate(["/api-client"], {
			state: {
				method: ep.method,
				url: `${this.baseUrl()}${ep.path}`,
			},
		});
	}

	navigateTo(nodeId: string): void {
		const g = this.svc.graph();
		if (!g) return;
		const node = g.nodes.find((n) => n.id === nodeId);
		if (node) {
			this.svc.selectNode(node);
		}
	}
}

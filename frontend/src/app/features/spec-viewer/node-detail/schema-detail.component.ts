import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
} from "@angular/core";
import { dig } from "../../../core/utils/dig";
import { asRecord } from "../../../core/utils/record-helpers";
import { schemaType } from "../../../core/utils/schema-helpers";
import type { EndpointNode, SchemaNode } from "../../../models/graph.model";
import { SpecGraphService } from "../services/spec-graph.service";

@Component({
	selector: "app-schema-detail",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./schema-detail.component.html",
})
export class SchemaDetailComponent {
	private readonly svc = inject(SpecGraphService);

	readonly schema = computed((): SchemaNode | null => {
		const node = this.svc.selectedNode();
		return node?.type === "schema" ? (node as SchemaNode) : null;
	});

	private readonly rawSchema = computed(() => {
		const sc = this.schema();
		const raw = this.svc.rawSpec();
		if (!sc || !raw) return null;
		return asRecord(dig(raw, "components", "schemas", sc.name)) ?? null;
	});

	readonly schemaProperties = computed(() => {
		const schema = this.rawSchema();
		if (!schema) return [];
		const props = asRecord(schema.properties);
		if (!props) return [];
		const required = Array.isArray(schema.required)
			? new Set(
					schema.required.filter((r): r is string => typeof r === "string"),
				)
			: new Set<string>();
		return Object.entries(props).map(([name, propDef]) => {
			const prop = asRecord(propDef);
			const ref = prop?.$ref;
			const refName =
				typeof ref === "string" && ref.startsWith("#/components/schemas/")
					? ref.slice("#/components/schemas/".length)
					: null;
			return {
				name,
				type: refName ?? schemaType(prop),
				required: required.has(name),
				refTarget: refName ? `schema:${refName}` : null,
			};
		});
	});

	readonly compositionRefs = computed(() => {
		const schema = this.rawSchema();
		if (!schema) return [];
		const results: Array<{ keyword: string; ref: string }> = [];
		for (const keyword of ["allOf", "oneOf", "anyOf"]) {
			const arr = schema[keyword];
			if (!Array.isArray(arr)) continue;
			for (const entry of arr) {
				const obj = asRecord(entry);
				const ref = obj?.$ref;
				if (
					typeof ref === "string" &&
					ref.startsWith("#/components/schemas/")
				) {
					const name = ref.slice("#/components/schemas/".length);
					results.push({ keyword, ref: `schema:${name}` });
				}
			}
		}
		return results;
	});

	readonly connectedNodes = computed(() => {
		const edges = this.svc.selectedNodeEdges();
		const nodeId = this.svc.selectedNodeId();
		const g = this.svc.graph();
		if (!g || !nodeId) return [];
		const nodeMap = new Map(g.nodes.map((n) => [n.id, n]));
		// For schemas, only show incoming edges ("used by")
		return edges
			.filter((e) => e.target === nodeId)
			.map((e) => {
				const otherId = e.source;
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

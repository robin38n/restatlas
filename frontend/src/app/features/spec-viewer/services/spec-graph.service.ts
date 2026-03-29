import { computed, effect, Injectable, inject, signal } from "@angular/core";
import { ApiService } from "../../../core/api.service";
import type { components } from "../../../core/schema";
import type {
	EndpointNode,
	GraphNode,
	SchemaNode,
	SpecGraph,
} from "../../../models/graph.model";
import { buildSpecGraph } from "../../../models/spec-to-graph";

type SpecSummary = components["schemas"]["SpecSummary"];

@Injectable({ providedIn: "root" })
export class SpecGraphService {
	private readonly api = inject(ApiService);

	readonly loading = signal(false);
	readonly error = signal<string | null>(null);
	readonly specId = signal<string | null>(null);
	readonly summary = signal<SpecSummary | null>(null);
	readonly graph = signal<SpecGraph | null>(null);
	readonly rawSpec = signal<Record<string, unknown> | null>(null);
	readonly selectedNodeId = signal<string | null>(null);

	// Filter state
	readonly searchQuery = signal("");
	readonly selectedTags = signal<Set<string>>(new Set());
	readonly selectedMethods = signal<Set<string>>(new Set());

	readonly endpointNodes = computed(
		() =>
			this.graph()?.nodes.filter(
				(n): n is EndpointNode => n.type === "endpoint",
			) ?? [],
	);

	readonly schemaNodes = computed(
		() =>
			this.graph()?.nodes.filter((n): n is SchemaNode => n.type === "schema") ??
			[],
	);

	readonly edgeCount = computed(() => this.graph()?.edges.length ?? 0);

	readonly allTags = computed(() => {
		const tags = new Set<string>();
		for (const ep of this.endpointNodes()) {
			for (const tag of ep.tags) tags.add(tag);
		}
		return [...tags].sort();
	});

	readonly filteredGraph = computed((): SpecGraph | null => {
		const g = this.graph();
		if (!g) return null;

		const query = this.searchQuery().toLowerCase().trim();
		const tags = this.selectedTags();
		const methods = this.selectedMethods();
		const hasFilters = query.length > 0 || tags.size > 0 || methods.size > 0;
		if (!hasFilters) return g;

		// Filter endpoint nodes
		const filteredEndpoints = g.nodes.filter((n): n is EndpointNode => {
			if (n.type !== "endpoint") return false;
			const ep = n as EndpointNode;
			if (methods.size > 0 && !methods.has(ep.method)) return false;
			if (tags.size > 0 && !ep.tags.some((t) => tags.has(t))) return false;
			if (query) {
				const haystack =
					`${ep.method} ${ep.path} ${ep.summary} ${ep.operationId ?? ""}`.toLowerCase();
				if (!haystack.includes(query)) return false;
			}
			return true;
		});

		const endpointIds = new Set(filteredEndpoints.map((n) => n.id));

		// Keep schema nodes connected to surviving endpoints
		const connectedSchemaIds = new Set<string>();
		for (const edge of g.edges) {
			if (endpointIds.has(edge.source)) connectedSchemaIds.add(edge.target);
			if (endpointIds.has(edge.target)) connectedSchemaIds.add(edge.source);
		}

		// Also include schemas matching the search query directly
		const filteredSchemas = g.nodes.filter((n): n is SchemaNode => {
			if (n.type !== "schema") return false;
			const sc = n as SchemaNode;
			if (connectedSchemaIds.has(sc.id)) return true;
			if (query) {
				const haystack = `${sc.name} ${sc.properties.join(" ")}`.toLowerCase();
				return haystack.includes(query);
			}
			return false;
		});

		const allNodeIds = new Set([
			...endpointIds,
			...filteredSchemas.map((n) => n.id),
		]);

		// Also add schema→schema edges for connected schemas
		const edges = g.edges.filter(
			(e) => allNodeIds.has(e.source) && allNodeIds.has(e.target),
		);

		return {
			nodes: [...filteredEndpoints, ...filteredSchemas],
			edges,
		};
	});

	// Auto-clear selection when filtered graph no longer contains the selected node
	private readonly selectionGuard = effect(() => {
		const fg = this.filteredGraph();
		const id = this.selectedNodeId();
		if (!id || !fg) return;
		const nodeExists = fg.nodes.some((n) => n.id === id);
		if (!nodeExists) {
			this.selectedNodeId.set(null);
		}
	});

	readonly selectedNode = computed(() => {
		const id = this.selectedNodeId();
		if (!id) return null;
		return this.graph()?.nodes.find((n) => n.id === id) ?? null;
	});

	readonly selectedNodeEdges = computed(() => {
		const id = this.selectedNodeId();
		const g = this.graph();
		if (!id || !g) return [];
		return g.edges.filter((e) => e.source === id || e.target === id);
	});

	selectNode(node: GraphNode): void {
		this.selectedNodeId.set(this.selectedNodeId() === node.id ? null : node.id);
	}

	clearSelection(): void {
		this.selectedNodeId.set(null);
	}

	toggleTag(tag: string): void {
		const current = this.selectedTags();
		const next = new Set(current);
		if (next.has(tag)) next.delete(tag);
		else next.add(tag);
		this.selectedTags.set(next);
	}

	toggleMethod(method: string): void {
		const current = this.selectedMethods();
		const next = new Set(current);
		if (next.has(method)) next.delete(method);
		else next.add(method);
		this.selectedMethods.set(next);
	}

	clearFilters(): void {
		this.searchQuery.set("");
		this.selectedTags.set(new Set());
		this.selectedMethods.set(new Set());
	}

	async loadSpec(id: string): Promise<void> {
		this.loading.set(true);
		this.error.set(null);
		this.specId.set(id);
		this.selectedNodeId.set(null);

		try {
			const { data, error } = await this.api.getSpec(id);
			if (error) {
				this.error.set("Failed to load spec");
				return;
			}
			if (data) {
				this.summary.set(data.summary);
				this.rawSpec.set(data.raw as Record<string, unknown>);
				const graph = buildSpecGraph(data.raw);
				this.graph.set(graph);

				// Preselect first node
				if (graph.nodes.length > 0) {
					this.selectedNodeId.set(graph.nodes[0].id);
				}
			}
		} catch {
			this.error.set("Network error — is the backend running?");
		} finally {
			this.loading.set(false);
		}
	}
}

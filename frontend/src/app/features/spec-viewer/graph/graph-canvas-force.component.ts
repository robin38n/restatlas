import {
	afterNextRender,
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	effect,
	input,
	output,
	viewChild,
} from "@angular/core";
import * as d3 from "d3";
import type {
	EdgeKind,
	EndpointNode,
	GraphNode,
	SchemaNode,
	SpecGraph,
} from "../../../models/graph.model";
import {
	EDGE_COLORS,
	EDGE_DASH,
	SCHEMA_FILL,
	SCHEMA_STROKE,
} from "../../../shared/constants/edge-styles";
import { METHOD_COLORS } from "../../../shared/constants/method-colors";
import { GraphControlsComponent } from "./graph-controls.component";
import { GraphLegendComponent } from "./graph-legend.component";

/** Mutable copy of GraphNode for D3 force simulation (adds x, y, vx, vy). */
interface SimNode extends d3.SimulationNodeDatum {
	id: string;
	type: "endpoint" | "schema";
	label: string;
	sublabel: string;
	method?: string;
	width: number;
	height: number;
	original: GraphNode;
}

/** Mutable copy of GraphEdge for D3 force simulation (source/target become object refs). */
interface SimLink extends d3.SimulationLinkDatum<SimNode> {
	kind: EdgeKind;
	label?: string;
	curveOffset: number;
}

function nodeWidth(node: SimNode): number {
	return node.width;
}

function nodeHeight(node: SimNode): number {
	return node.height;
}

@Component({
	selector: "app-graph-canvas-force",
	imports: [GraphControlsComponent, GraphLegendComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./graph-canvas-force.component.html",
	styleUrl: "./graph-canvas-force.component.css",
})
export class GraphCanvasForceComponent {
	readonly graph = input.required<SpecGraph>();
	readonly nodeClick = output<GraphNode>();

	private readonly svgRef =
		viewChild.required<ElementRef<SVGSVGElement>>("svg");
	private readonly containerRef =
		viewChild.required<ElementRef<HTMLDivElement>>("container");

	private simulation: d3.Simulation<SimNode, SimLink> | null = null;
	private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
	private svgSelection: d3.Selection<
		SVGSVGElement,
		unknown,
		null,
		undefined
	> | null = null;

	constructor() {
		afterNextRender(() => {
			this.initGraph();
		});

		// Re-render when graph input changes after initial render
		effect(() => {
			const g = this.graph();
			if (this.simulation && g) {
				this.initGraph();
			}
		});
	}

	private initGraph(): void {
		const graph = this.graph();
		const svgEl = this.svgRef().nativeElement;

		// Clear previous simulation and SVG content
		if (this.simulation) {
			this.simulation.stop();
			this.simulation = null;
		}
		d3.select(svgEl).selectAll("*").remove();

		if (!graph || graph.nodes.length === 0) return;

		const container = this.containerRef().nativeElement;
		const width = container.clientWidth || 800;
		const height = container.clientHeight || 500;

		// Build mutable copies for D3
		const nodes: SimNode[] = graph.nodes.map((n) => {
			if (n.type === "endpoint") {
				const ep = n as EndpointNode;
				const label = `${ep.method} ${ep.path}`;
				return {
					id: n.id,
					type: "endpoint" as const,
					label,
					sublabel: ep.summary || "",
					method: ep.method,
					width: Math.max(140, label.length * 7.5 + 24),
					height: 40,
					original: n,
				};
			}
			const sc = n as SchemaNode;
			return {
				id: n.id,
				type: "schema" as const,
				label: sc.name,
				sublabel: "",
				width: Math.max(120, sc.name.length * 8 + 24),
				height: 30,
				original: n,
			};
		});

		const nodeMap = new Map(nodes.map((n) => [n.id, n]));

		const links: SimLink[] = graph.edges
			.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
			.map((e) => ({
				source: e.source,
				target: e.target,
				kind: e.kind,
				label: e.label,
				curveOffset: 0,
			}));

		// Assign curve offsets to parallel edges (same source+target pair).
		// Each parallel edge gets a different offset so they fan out instead of overlapping.
		const pairCount = new Map<string, number>();
		const pairIndex = new Map<string, number>();
		for (const l of links) {
			const key = [String(l.source), String(l.target)].sort().join("||");
			pairCount.set(key, (pairCount.get(key) ?? 0) + 1);
		}
		for (const l of links) {
			const key = [String(l.source), String(l.target)].sort().join("||");
			const total = pairCount.get(key) ?? 1;
			if (total > 1) {
				const idx = pairIndex.get(key) ?? 0;
				pairIndex.set(key, idx + 1);
				// Spread symmetrically: -20, +20 for 2 edges; -20, 0, +20 for 3, etc.
				l.curveOffset = (idx - (total - 1) / 2) * 25;
			}
		}

		// SVG setup
		const svg = d3
			.select(svgEl)
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("preserveAspectRatio", "xMidYMid meet");

		// Arrow markers for each edge kind
		const defs = svg.append("defs");
		for (const [kind, color] of Object.entries(EDGE_COLORS)) {
			defs
				.append("marker")
				.attr("id", `arrow-force-${kind}`)
				.attr("viewBox", "0 0 10 6")
				.attr("refX", 10)
				.attr("refY", 3)
				.attr("markerWidth", 8)
				.attr("markerHeight", 6)
				.attr("orient", "auto")
				.append("path")
				.attr("d", "M0,0 L10,3 L0,6 Z")
				.attr("fill", color);
		}

		const g = svg.append("g");

		// Zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 4])
			.on("zoom", (event) => {
				g.attr("transform", event.transform);
			});
		svg.call(zoom);
		this.zoom = zoom;
		this.svgSelection = svg;

		// Edges (paths to support curved parallel edges)
		const linkGroup = g
			.append("g")
			.attr("class", "links")
			.selectAll("path")
			.data(links)
			.join("path")
			.attr("stroke", (d) => EDGE_COLORS[d.kind])
			.attr("stroke-width", 1.5)
			.attr("stroke-dasharray", (d) => EDGE_DASH[d.kind])
			.attr("marker-end", (d) => `url(#arrow-force-${d.kind})`)
			.attr("opacity", 0.7)
			.attr("fill", "none");

		// Edge labels
		const edgeLabelGroup = g
			.append("g")
			.attr("class", "edge-labels")
			.selectAll("text")
			.data(links.filter((l) => l.label))
			.join("text")
			.text((d) => d.label ?? "")
			.attr("font-size", 9)
			.attr("fill", "#888")
			.attr("text-anchor", "middle")
			.attr("dy", -4);

		// Node groups
		const nodeGroup = g
			.append("g")
			.attr("class", "nodes")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("cursor", "pointer")
			.on("click", (_event, d) => {
				this.nodeClick.emit(d.original);
			});

		// Endpoint rectangles
		nodeGroup
			.filter((d) => d.type === "endpoint")
			.append("rect")
			.attr("width", (d) => nodeWidth(d))
			.attr("height", (d) => nodeHeight(d))
			.attr("rx", 4)
			.attr("ry", 4)
			.attr("fill", (d) => METHOD_COLORS[d.method ?? "GET"] ?? "#6b7280")
			.attr("opacity", 0.9);

		// Endpoint text
		nodeGroup
			.filter((d) => d.type === "endpoint")
			.append("text")
			.text((d) => d.label)
			.attr("x", (d) => nodeWidth(d) / 2)
			.attr("y", (d) => nodeHeight(d) / 2)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("fill", "#fff")
			.attr("font-size", 11)
			.attr("font-family", "monospace")
			.attr("font-weight", 600);

		// Schema rectangles (UML class style)
		const schemaNodes = nodeGroup.filter((d) => d.type === "schema");

		// Schema header background
		schemaNodes
			.append("rect")
			.attr("width", (d) => nodeWidth(d))
			.attr("height", (d) => nodeHeight(d))
			.attr("rx", 3)
			.attr("ry", 3)
			.attr("fill", SCHEMA_FILL)
			.attr("stroke", SCHEMA_STROKE)
			.attr("stroke-width", 1.5);

		// Schema name
		schemaNodes
			.append("text")
			.text((d) => d.label)
			.attr("x", (d) => nodeWidth(d) / 2)
			.attr("y", (d) => nodeHeight(d) / 2)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("fill", "#1e293b")
			.attr("font-size", 12)
			.attr("font-weight", 700);

		// Drag behavior — low alphaTarget to minimize drift of unconnected subgraphs
		const drag = d3
			.drag<SVGGElement, SimNode>()
			.on("start", (event, d) => {
				if (!event.active) simulation.alphaTarget(0.05).restart();
				d.fx = d.x;
				d.fy = d.y;
			})
			.on("drag", (event, d) => {
				d.fx = event.x;
				d.fy = event.y;
			})
			.on("end", (event, d) => {
				if (!event.active) simulation.alphaTarget(0);
				d.fx = null;
				d.fy = null;
			});

		nodeGroup.call(drag);

		// Force simulation — high velocityDecay dampens drift of unconnected subgraphs.
		// forceX/forceY with low strength replace forceCenter to avoid pulling
		// disconnected clusters toward the center during drag.
		const simulation = d3
			.forceSimulation(nodes)
			.velocityDecay(0.7)
			.force(
				"link",
				d3
					.forceLink<SimNode, SimLink>(links)
					.id((d) => d.id)
					.distance(160),
			)
			.force("charge", d3.forceManyBody().strength(-350))
			.force("x", d3.forceX(width / 2).strength(0.03))
			.force("y", d3.forceY(height / 2).strength(0.03))
			.force(
				"collision",
				d3
					.forceCollide<SimNode>()
					.radius((d) => Math.max(d.width, d.height) / 2 + 10),
			)
			.on("tick", () => {
				// Update link paths — curved for parallel edges, straight otherwise
				linkGroup.attr("d", (d) => {
					const src = d.source as SimNode;
					const tgt = d.target as SimNode;
					const x1 = (src.x ?? 0) + nodeWidth(src) / 2;
					const y1 = (src.y ?? 0) + nodeHeight(src) / 2;
					const x2 = (tgt.x ?? 0) + nodeWidth(tgt) / 2;
					const y2 = (tgt.y ?? 0) + nodeHeight(tgt) / 2;

					if (d.curveOffset === 0) {
						return `M${x1},${y1} L${x2},${y2}`;
					}

					// Perpendicular offset for the quadratic control point
					const dx = x2 - x1;
					const dy = y2 - y1;
					const len = Math.sqrt(dx * dx + dy * dy) || 1;
					const nx = -dy / len;
					const ny = dx / len;
					const cx = (x1 + x2) / 2 + nx * d.curveOffset;
					const cy = (y1 + y2) / 2 + ny * d.curveOffset;
					return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
				});

				// Edge labels at midpoint (offset along curve for parallel edges)
				edgeLabelGroup
					.attr("x", (d) => {
						const src = d.source as SimNode;
						const tgt = d.target as SimNode;
						const x1 = (src.x ?? 0) + nodeWidth(src) / 2;
						const x2 = (tgt.x ?? 0) + nodeWidth(tgt) / 2;
						if (d.curveOffset === 0) return (x1 + x2) / 2;
						const dx = x2 - x1;
						const dy =
							(tgt.y ?? 0) +
							nodeHeight(tgt) / 2 -
							((src.y ?? 0) + nodeHeight(src) / 2);
						const len = Math.sqrt(dx * dx + dy * dy) || 1;
						return (x1 + x2) / 2 + (-dy / len) * d.curveOffset;
					})
					.attr("y", (d) => {
						const src = d.source as SimNode;
						const tgt = d.target as SimNode;
						const y1 = (src.y ?? 0) + nodeHeight(src) / 2;
						const y2 = (tgt.y ?? 0) + nodeHeight(tgt) / 2;
						if (d.curveOffset === 0) return (y1 + y2) / 2;
						const dx =
							(tgt.x ?? 0) +
							nodeWidth(tgt) / 2 -
							((src.x ?? 0) + nodeWidth(src) / 2);
						const dy = y2 - y1;
						const len = Math.sqrt(dx * dx + dy * dy) || 1;
						return (y1 + y2) / 2 + (dx / len) * d.curveOffset;
					});

				// Node positions (translate to top-left corner)
				nodeGroup.attr(
					"transform",
					(d) => `translate(${d.x ?? 0},${d.y ?? 0})`,
				);
			});

		this.simulation = simulation;
	}

	onZoomIn(): void {
		if (this.zoom && this.svgSelection) {
			this.svgSelection.transition().duration(300).call(this.zoom.scaleBy, 1.3);
		}
	}

	onZoomOut(): void {
		if (this.zoom && this.svgSelection) {
			this.svgSelection.transition().duration(300).call(this.zoom.scaleBy, 0.7);
		}
	}

	onResetZoom(): void {
		if (this.zoom && this.svgSelection) {
			this.svgSelection
				.transition()
				.duration(300)
				.call(this.zoom.transform, d3.zoomIdentity);
		}
	}

	onFullscreen(): void {
		const el = this.containerRef().nativeElement;
		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			el.requestFullscreen();
		}
	}
}

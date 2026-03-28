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
import { Graph, layout as dagreLayout } from "@dagrejs/dagre";
import type {
	EdgeKind,
	EndpointNode,
	GraphNode,
	SchemaNode,
	SpecGraph,
} from "../../models/graph.model";
import { GraphControlsComponent } from "./graph-controls";
import { GraphLegendComponent } from "./graph-legend";

interface SimNode {
	id: string;
	type: "endpoint" | "schema";
	label: string;
	sublabel: string;
	method?: string;
	width: number;
	height: number;
	x: number;
	y: number;
	original: GraphNode;
}

interface SimLink {
	source: string;
	target: string;
	kind: EdgeKind;
	label?: string;
	points?: Array<{ x: number; y: number }>;
}

const METHOD_COLORS: Record<string, string> = {
	GET: "#16a34a",
	POST: "#2563eb",
	PUT: "#d97706",
	PATCH: "#9333ea",
	DELETE: "#dc2626",
	HEAD: "#6b7280",
	OPTIONS: "#6b7280",
};

const EDGE_DASH: Record<EdgeKind, string> = {
	requestBody: "none",
	response: "none",
	parameter: "4 2",
	property: "none",
	arrayItem: "6 3",
	composition: "2 2",
};

const SCHEMA_FILL = "#f8fafc";
const SCHEMA_STROKE = "#64748b";

function edgeColor(kind: EdgeKind, label?: string): string {
	switch (kind) {
		case "requestBody":
			return "#2563eb";
		case "parameter":
			return "#6366f1";
		case "response": {
			const ch = label?.charAt(0);
			if (ch === "2") return "#16a34a";
			if (ch === "4") return "#ef4444";
			if (ch === "5") return "#991b1b";
			return "#16a34a"; // default for response
		}
		case "property":
		case "arrayItem":
		case "composition":
			return "#94a3b8";
	}
}

@Component({
	selector: "app-graph-canvas",
	standalone: true,
	imports: [GraphControlsComponent, GraphLegendComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<div class="graph-container" #container>
		<svg #svg></svg>
		<app-graph-legend />
		<app-graph-controls
			(zoomIn)="onZoomIn()"
			(zoomOut)="onZoomOut()"
			(resetZoom)="onResetZoom()"
			(fullscreen)="onFullscreen()"
		/>
		@if (graph().nodes.length === 0) {
			<div class="empty-state">
				<p>No nodes match the current filters</p>
			</div>
		}
	</div>`,
	styles: `
		.graph-container {
			width: 100%;
			height: 500px;
			border: 1px solid #e5e7eb;
			border-radius: 6px;
			overflow: hidden;
			background: #fafafa;
			position: relative;
		}
		svg {
			width: 100%;
			height: 100%;
		}
		.empty-state {
			position: absolute;
			inset: 0;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.empty-state p {
			color: #999;
			font-size: 0.9rem;
		}
	`,
})
export class GraphCanvasComponent {
	readonly graph = input.required<SpecGraph>();
	readonly nodeClick = output<GraphNode>();

	private readonly svgRef =
		viewChild.required<ElementRef<SVGSVGElement>>("svg");
	private readonly containerRef =
		viewChild.required<ElementRef<HTMLDivElement>>("container");

	private initialized = false;
	private zoom: d3.ZoomBehavior<SVGSVGElement, unknown> | null = null;
	private svgSelection: d3.Selection<SVGSVGElement, unknown, null, undefined> | null = null;

	constructor() {
		afterNextRender(() => {
			this.initialized = true;
			this.initGraph();
		});

		effect(() => {
			const g = this.graph();
			if (this.initialized && g) {
				this.initGraph();
			}
		});
	}

	private initGraph(): void {
		const graph = this.graph();
		const svgEl = this.svgRef().nativeElement;

		d3.select(svgEl).selectAll("*").remove();

		if (!graph || graph.nodes.length === 0) return;

		const container = this.containerRef().nativeElement;
		const width = container.clientWidth || 800;
		const height = container.clientHeight || 500;

		// Build mutable node copies
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
					x: 0,
					y: 0,
					original: n,
				};
			}
			const sc = n as SchemaNode;
			const propText = `${sc.properties.length} props`;
			return {
				id: n.id,
				type: "schema" as const,
				label: sc.name,
				sublabel: propText,
				width: Math.max(120, sc.name.length * 8 + 24),
				height: 44,
				x: 0,
				y: 0,
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
			}));

		// --- Dagre layout ---
		const g2 = new Graph()
			.setGraph({
				rankdir: "TB",
				nodesep: 40,
				ranksep: 120,
				edgesep: 20,
			})
			.setDefaultEdgeLabel(() => ({}));

		for (const node of nodes) {
			g2.setNode(node.id, { width: node.width, height: node.height });
		}
		for (const link of links) {
			g2.setEdge(link.source, link.target);
		}

		dagreLayout(g2);

		// Read positions back
		for (const node of nodes) {
			const pos = g2.node(node.id);
			node.x = pos.x - node.width / 2;
			node.y = pos.y - node.height / 2;
		}

		// Read edge routing points
		for (const link of links) {
			const edgeData = g2.edge(link.source, link.target);
			if (edgeData?.points) {
				link.points = edgeData.points;
			}
		}

		// --- SVG setup ---
		const svg = d3
			.select(svgEl)
			.attr("viewBox", `0 0 ${width} ${height}`)
			.attr("preserveAspectRatio", "xMidYMid meet");

		// Arrow markers keyed by color
		const defs = svg.append("defs");
		const uniqueColors = new Set(
			links.map((l) => edgeColor(l.kind, l.label)),
		);
		for (const color of uniqueColors) {
			const hex = color.replace("#", "");
			defs
				.append("marker")
				.attr("id", `arrow-${hex}`)
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

		const rootG = svg.append("g");

		// Zoom
		const zoom = d3
			.zoom<SVGSVGElement, unknown>()
			.scaleExtent([0.2, 4])
			.on("zoom", (event) => {
				rootG.attr("transform", event.transform);
			});
		svg.call(zoom);
		this.zoom = zoom;
		this.svgSelection = svg;

		// Curve generator
		const lineGen = d3
			.line<{ x: number; y: number }>()
			.x((d) => d.x)
			.y((d) => d.y)
			.curve(d3.curveBasis);

		// Helper: build path points for a link using current node positions
		const buildPathPoints = (d: SimLink): Array<{ x: number; y: number }> => {
			if (d.points && d.points.length > 0) {
				return d.points;
			}
			const src = nodeMap.get(d.source)!;
			const tgt = nodeMap.get(d.target)!;
			const sx = src.x + src.width / 2;
			const sy = src.y + src.height / 2;
			const tx = tgt.x + tgt.width / 2;
			const ty = tgt.y + tgt.height / 2;
			return [
				{ x: sx, y: sy },
				{ x: (sx + tx) / 2, y: (sy + ty) / 2 },
				{ x: tx, y: ty },
			];
		};

		// Edges as paths
		const linkGroup = rootG
			.append("g")
			.attr("class", "links")
			.selectAll("path")
			.data(links)
			.join("path")
			.attr("d", (d) => lineGen(buildPathPoints(d)))
			.attr("stroke", (d) => edgeColor(d.kind, d.label))
			.attr("stroke-width", 1.5)
			.attr("stroke-dasharray", (d) => EDGE_DASH[d.kind])
			.attr(
				"marker-end",
				(d) => `url(#arrow-${edgeColor(d.kind, d.label).replace("#", "")})`,
			)
			.attr("fill", "none")
			.attr("opacity", 0.7);

		// Edge labels at midpoint of path
		const edgeLabelGroup = rootG
			.append("g")
			.attr("class", "edge-labels")
			.selectAll("text")
			.data(links.filter((l) => l.label))
			.join("text")
			.text((d) => d.label ?? "")
			.attr("font-size", 9)
			.attr("fill", "#888")
			.attr("text-anchor", "middle")
			.attr("dy", -4)
			.attr("x", (d) => {
				const pts = buildPathPoints(d);
				const mid = pts[Math.floor(pts.length / 2)];
				return mid.x;
			})
			.attr("y", (d) => {
				const pts = buildPathPoints(d);
				const mid = pts[Math.floor(pts.length / 2)];
				return mid.y;
			});

		// Node groups
		const nodeGroup = rootG
			.append("g")
			.attr("class", "nodes")
			.selectAll<SVGGElement, SimNode>("g")
			.data(nodes)
			.join("g")
			.attr("transform", (d) => `translate(${d.x},${d.y})`)
			.attr("cursor", "pointer")
			.on("click", (_event, d) => {
				this.nodeClick.emit(d.original);
			});

		// Endpoint rectangles
		nodeGroup
			.filter((d) => d.type === "endpoint")
			.append("rect")
			.attr("width", (d) => d.width)
			.attr("height", (d) => d.height)
			.attr("rx", 4)
			.attr("ry", 4)
			.attr("fill", (d) => METHOD_COLORS[d.method ?? "GET"] ?? "#6b7280")
			.attr("opacity", 0.9);

		// Endpoint text
		nodeGroup
			.filter((d) => d.type === "endpoint")
			.append("text")
			.text((d) => d.label)
			.attr("x", (d) => d.width / 2)
			.attr("y", (d) => d.height / 2)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("fill", "#fff")
			.attr("font-size", 11)
			.attr("font-family", "monospace")
			.attr("font-weight", 600);

		// Schema rectangles (UML class style)
		const schemaNodes = nodeGroup.filter((d) => d.type === "schema");

		schemaNodes
			.append("rect")
			.attr("width", (d) => d.width)
			.attr("height", (d) => d.height)
			.attr("rx", 3)
			.attr("ry", 3)
			.attr("fill", SCHEMA_FILL)
			.attr("stroke", SCHEMA_STROKE)
			.attr("stroke-width", 1.5);

		schemaNodes
			.append("line")
			.attr("x1", 0)
			.attr("y1", 24)
			.attr("x2", (d) => d.width)
			.attr("y2", 24)
			.attr("stroke", SCHEMA_STROKE)
			.attr("stroke-width", 1);

		schemaNodes
			.append("text")
			.text((d) => d.label)
			.attr("x", (d) => d.width / 2)
			.attr("y", 15)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("fill", "#1e293b")
			.attr("font-size", 12)
			.attr("font-weight", 700);

		schemaNodes
			.append("text")
			.text((d) => d.sublabel)
			.attr("x", (d) => d.width / 2)
			.attr("y", 35)
			.attr("text-anchor", "middle")
			.attr("dominant-baseline", "central")
			.attr("fill", "#64748b")
			.attr("font-size", 10);

		// Drag without simulation
		const drag = d3
			.drag<SVGGElement, SimNode>()
			.on("drag", function (event, d) {
				d.x += event.dx;
				d.y += event.dy;
				d3.select(this).attr(
					"transform",
					`translate(${d.x},${d.y})`,
				);

				// Redraw connected edges
				linkGroup
					.filter(
						(l) => l.source === d.id || l.target === d.id,
					)
					.each(function (l) {
						// Clear cached dagre points for dragged links
						l.points = undefined;
					})
					.attr("d", (l) => lineGen(buildPathPoints(l)));

				// Reposition connected edge labels
				edgeLabelGroup
					.filter(
						(l) => l.source === d.id || l.target === d.id,
					)
					.attr("x", (l) => {
						const pts = buildPathPoints(l);
						return pts[Math.floor(pts.length / 2)].x;
					})
					.attr("y", (l) => {
						const pts = buildPathPoints(l);
						return pts[Math.floor(pts.length / 2)].y;
					});
			});

		nodeGroup.call(drag);

		// Zoom-to-fit
		const graphInfo = g2.graph();
		const gWidth = graphInfo.width ?? width;
		const gHeight = graphInfo.height ?? height;
		const padding = 40;
		const scale = Math.min(
			(width - padding * 2) / gWidth,
			(height - padding * 2) / gHeight,
			1,
		);
		const translateX = (width - gWidth * scale) / 2;
		const translateY = (height - gHeight * scale) / 2;
		svg.call(
			zoom.transform,
			d3.zoomIdentity.translate(translateX, translateY).scale(scale),
		);
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
			this.svgSelection.transition().duration(300).call(this.zoom.transform, d3.zoomIdentity);
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

import type { EdgeKind } from "../../models/graph.model";

export const EDGE_COLORS: Record<EdgeKind, string> = {
	requestBody: "var(--graph-edge-req)",
	response: "var(--graph-edge-res-2xx)",
	parameter: "var(--graph-edge-param)",
	property: "var(--graph-edge-prop)",
	arrayItem: "var(--graph-edge-prop)",
	composition: "var(--graph-edge-req)", // Reusing a blue/red hue
};

export const EDGE_DASH: Record<EdgeKind, string> = {
	requestBody: "none",
	response: "none",
	parameter: "4 2",
	property: "none",
	arrayItem: "6 3",
	composition: "2 2",
};

export const SCHEMA_FILL = "var(--graph-schema-fill)";
export const SCHEMA_STROKE = "var(--graph-schema-stroke)";

/** Get edge color based on kind, with special handling for response status codes. */
export function edgeColor(kind: EdgeKind, label?: string): string {
	switch (kind) {
		case "requestBody":
			return "var(--graph-edge-req)";
		case "parameter":
			return "var(--graph-edge-param)";
		case "response": {
			const ch = label?.charAt(0);
			if (ch === "2") return "var(--graph-edge-res-2xx)";
			if (ch === "4") return "var(--graph-edge-res-4xx)";
			if (ch === "5") return "var(--graph-edge-res-5xx)";
			return "var(--graph-edge-res-2xx)";
		}
		case "property":
		case "arrayItem":
		case "composition":
			return "var(--graph-edge-prop)";
	}
}

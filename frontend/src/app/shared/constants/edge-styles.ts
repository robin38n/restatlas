import type { EdgeKind } from "../../models/graph.model";

export const EDGE_COLORS: Record<EdgeKind, string> = {
	requestBody: "#2563eb",
	response: "#16a34a",
	parameter: "#d97706",
	property: "#6b7280",
	arrayItem: "#9333ea",
	composition: "#dc2626",
};

export const EDGE_DASH: Record<EdgeKind, string> = {
	requestBody: "none",
	response: "none",
	parameter: "4 2",
	property: "none",
	arrayItem: "6 3",
	composition: "2 2",
};

export const SCHEMA_FILL = "#f8fafc";
export const SCHEMA_STROKE = "#64748b";

/** Get edge color based on kind, with special handling for response status codes. */
export function edgeColor(kind: EdgeKind, label?: string): string {
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
			return "#16a34a";
		}
		case "property":
		case "arrayItem":
		case "composition":
			return "#94a3b8";
	}
}

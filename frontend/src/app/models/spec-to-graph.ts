import { asArray, asRecord } from "../core/utils/record-helpers";
import type {
	EdgeKind,
	EndpointNode,
	GraphEdge,
	SchemaNode,
	SpecGraph,
} from "./graph.model";

const HTTP_METHODS = [
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"head",
	"options",
] as const;

const REF_PREFIX = "#/components/schemas/";

/**
 * Extract a local schema node ID from a $ref string.
 * Returns null for external refs or non-schema refs.
 */
function resolveSchemaRef(ref: unknown): string | null {
	if (typeof ref !== "string" || !ref.startsWith(REF_PREFIX)) return null;
	return `schema:${ref.slice(REF_PREFIX.length)}`;
}

/**
 * Collect all $ref targets from a schema object (properties, items, composition).
 * Returns edges from the given source node ID.
 */
function collectSchemaEdges(
	sourceId: string,
	schema: Record<string, unknown>,
): GraphEdge[] {
	const edges: GraphEdge[] = [];

	const properties = asRecord(schema["properties"]);
	if (properties) {
		for (const [propName, propDef] of Object.entries(properties)) {
			const prop = asRecord(propDef);
			if (!prop) continue;

			const directRef = resolveSchemaRef(prop["$ref"]);
			if (directRef) {
				edges.push({
					source: sourceId,
					target: directRef,
					kind: "property",
					label: propName,
				});
				continue;
			}

			const items = asRecord(prop["items"]);
			if (items) {
				const itemRef = resolveSchemaRef(items["$ref"]);
				if (itemRef) {
					edges.push({
						source: sourceId,
						target: itemRef,
						kind: "arrayItem",
						label: propName,
					});
				}
			}
		}
	}

	for (const keyword of ["allOf", "oneOf", "anyOf"] as const) {
		const arr = asArray(schema[keyword]);
		if (!arr) continue;
		for (const entry of arr) {
			const entryObj = asRecord(entry);
			if (!entryObj) continue;
			const ref = resolveSchemaRef(entryObj["$ref"]);
			if (ref) {
				edges.push({
					source: sourceId,
					target: ref,
					kind: "composition",
					label: keyword,
				});
			}
		}
	}

	return edges;
}

/**
 * Find $ref targets in an operation's request body, responses, and parameters.
 */
function collectEndpointEdges(
	endpointId: string,
	operation: Record<string, unknown>,
): GraphEdge[] {
	const edges: GraphEdge[] = [];

	const requestBody = asRecord(operation["requestBody"]);
	if (requestBody) {
		for (const ref of extractContentSchemaRefs(requestBody)) {
			edges.push({
				source: endpointId,
				target: ref,
				kind: "requestBody",
			});
		}
	}

	const responses = asRecord(operation["responses"]);
	if (responses) {
		for (const [statusCode, responseDef] of Object.entries(responses)) {
			const response = asRecord(responseDef);
			if (!response) continue;
			for (const ref of extractContentSchemaRefs(response)) {
				edges.push({
					source: endpointId,
					target: ref,
					kind: "response" as EdgeKind,
					label: statusCode,
				});
			}
		}
	}

	const params = asArray(operation["parameters"]);
	if (params) {
		for (const param of params) {
			const paramObj = asRecord(param);
			if (!paramObj) continue;
			const paramSchema = asRecord(paramObj["schema"]);
			if (!paramSchema) continue;

			const ref = resolveSchemaRef(paramSchema["$ref"]);
			if (ref) {
				edges.push({
					source: endpointId,
					target: ref,
					kind: "parameter",
					label: paramObj["name"] as string,
				});
			}
		}
	}

	return edges;
}

/**
 * Extract schema $ref targets from a requestBody or response object's content map.
 * Handles both direct $ref and items.$ref (for arrays).
 */
function extractContentSchemaRefs(
	bodyOrResponse: Record<string, unknown>,
): string[] {
	const refs: string[] = [];
	const content = asRecord(bodyOrResponse["content"]);
	if (!content) return refs;

	for (const mediaType of Object.values(content)) {
		const media = asRecord(mediaType);
		if (!media) continue;
		const schema = asRecord(media["schema"]);
		if (!schema) continue;

		const directRef = resolveSchemaRef(schema["$ref"]);
		if (directRef) {
			refs.push(directRef);
			continue;
		}

		const items = asRecord(schema["items"]);
		if (items) {
			const itemRef = resolveSchemaRef(items["$ref"]);
			if (itemRef) refs.push(itemRef);
		}
	}

	return refs;
}

/**
 * Transform a raw OpenAPI spec JSON into a graph of endpoints and schemas.
 */
export function buildSpecGraph(raw: Record<string, unknown>): SpecGraph {
	const nodes: (EndpointNode | SchemaNode)[] = [];
	const edges: GraphEdge[] = [];

	// Phase 1: Schema nodes
	const components = asRecord(raw["components"]);
	const schemas = components ? asRecord(components["schemas"]) : null;

	if (schemas) {
		for (const [name, schemaDef] of Object.entries(schemas)) {
			const schema = asRecord(schemaDef);
			if (!schema) continue;

			const properties = asRecord(schema["properties"]);
			const propNames = properties ? Object.keys(properties) : [];
			const required = asArray(schema["required"]);
			const requiredProps = required
				? (required.filter((r) => typeof r === "string") as string[])
				: [];

			const nodeId = `schema:${name}`;
			nodes.push({
				id: nodeId,
				type: "schema",
				name,
				properties: propNames,
				requiredProps,
			});

			edges.push(...collectSchemaEdges(nodeId, schema));
		}
	}

	// Phase 2: Endpoint nodes
	const paths = asRecord(raw["paths"]);
	if (paths) {
		for (const [pathStr, pathDef] of Object.entries(paths)) {
			const pathItem = asRecord(pathDef);
			if (!pathItem) continue;

			for (const method of HTTP_METHODS) {
				const operation = asRecord(pathItem[method]);
				if (!operation) continue;

				const endpointId = `${method.toUpperCase()} ${pathStr}`;
				const tags = asArray(operation["tags"]);

				nodes.push({
					id: endpointId,
					type: "endpoint",
					path: pathStr,
					method: method.toUpperCase(),
					summary: (operation["summary"] as string) ?? "",
					operationId: operation["operationId"] as string | undefined,
					tags: tags
						? (tags.filter((t) => typeof t === "string") as string[])
						: [],
				});

				edges.push(...collectEndpointEdges(endpointId, operation));
			}
		}
	}

	return { nodes, edges };
}

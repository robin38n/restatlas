import { asRecord } from "./record-helpers";

/** Extract a human-readable type from a JSON Schema object. */
export function schemaType(schema: Record<string, unknown> | null): string {
	if (!schema) return "unknown";
	const schemaRef = schema.$ref;
	if (typeof schemaRef === "string") {
		const ref = schemaRef;
		if (ref.startsWith("#/components/schemas/")) {
			return ref.slice("#/components/schemas/".length);
		}
		return ref;
	}
	const type = schema.type;
	if (type === "array") {
		const items = asRecord(schema.items);
		return `${schemaType(items)}[]`;
	}
	if (typeof type === "string") return type;
	return "object";
}

/** Extract schema $ref names from a requestBody or response content map. */
export function extractContentRefs(
	bodyOrResponse: Record<string, unknown> | null,
): string[] {
	if (!bodyOrResponse) return [];
	const content = asRecord(bodyOrResponse.content);
	if (!content) return [];
	const refs: string[] = [];
	for (const mediaType of Object.values(content)) {
		const media = asRecord(mediaType);
		if (!media) continue;
		const schema = asRecord(media.schema);
		if (!schema) continue;
		const schemaRef = schema.$ref;
		const ref = schemaRef;
		if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
			refs.push(ref.slice("#/components/schemas/".length));
		}
	}
	return refs;
}

/** Extract enum values from an OpenAPI parameter's schema. */
export function extractEnumFromParam(param: Record<string, unknown>): string[] {
	const schema = asRecord(param.schema);
	if (!schema) return [];
	const enumValues = schema.enum;
	const e = enumValues;
	return Array.isArray(e) ? e.map(String) : [];
}

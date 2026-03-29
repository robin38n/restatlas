/** Safely cast a value to a Record if it's a non-null, non-array object. */
export function asRecord(v: unknown): Record<string, unknown> | null {
	return v != null && typeof v === "object" && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: null;
}

/** Safely cast a value to an array. */
export function asArray(obj: unknown): unknown[] | null {
	return Array.isArray(obj) ? obj : null;
}

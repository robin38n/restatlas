import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	model,
} from "@angular/core";
import { asRecord } from "../../../core/utils/record-helpers";

function resolveRef(
	schema: Record<string, unknown> | null,
	allSchemas: Record<string, unknown>,
): Record<string, unknown> | null {
	if (!schema) return null;
	const ref = schema.$ref;
	if (typeof ref === "string" && ref.startsWith("#/components/schemas/")) {
		const name = ref.slice("#/components/schemas/".length);
		return asRecord(allSchemas[name]) ?? null;
	}
	return schema;
}

interface FormField {
	name: string;
	schema: Record<string, unknown>;
	required: boolean;
	type: string;
	enumValues: string[];
	format: string;
}

function determineFieldType(schema: Record<string, unknown>): string {
	if (schema.enum) return "enum";
	if (schema.$ref) return "object";
	const type = schema.type;
	if (type === "object" || schema.properties) return "object";
	if (type === "array") return "array";
	if (type === "boolean") return "boolean";
	if (type === "integer") return "integer";
	if (type === "number") return "number";
	return "string";
}

function extractEnum(schema: Record<string, unknown>): string[] {
	const e = schema.enum;
	return Array.isArray(e) ? e.map(String) : [];
}

@Component({
	selector: "app-schema-form",
	// biome-ignore lint/correctness/noInvalidUseBeforeDeclaration: recursive component requires self-import
	imports: [SchemaFormComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./schema-form.component.html",
})
export class SchemaFormComponent {
	readonly schema = input.required<Record<string, unknown>>();
	readonly value = model<Record<string, unknown>>({});
	readonly allSchemas = input<Record<string, unknown>>({});
	readonly depth = input(0);

	readonly resolvedSchema = computed(() => {
		return resolveRef(this.schema(), this.allSchemas());
	});

	readonly fields = computed((): FormField[] => {
		const s = this.resolvedSchema();
		if (!s) return [];
		const props = asRecord(s.properties);
		if (!props) return [];
		const required = Array.isArray(s.required)
			? new Set(
					s.required.filter((r: unknown): r is string => typeof r === "string"),
				)
			: new Set<string>();

		return Object.entries(props).map(([name, propDef]) => {
			const raw = asRecord(propDef) ?? {};
			const resolved = resolveRef(raw, this.allSchemas()) ?? raw;
			return {
				name,
				schema: resolved,
				required: required.has(name),
				type: determineFieldType(resolved),
				enumValues: extractEnum(resolved),
				format: String(resolved.format ?? ""),
			};
		});
	});

	inputType(format: string): string {
		switch (format) {
			case "email":
				return "email";
			case "password":
				return "password";
			case "uri":
				return "url";
			case "date-time":
				return "datetime-local";
			default:
				return "text";
		}
	}

	getFieldValue(name: string): string {
		const v = this.value()[name];
		return v != null ? String(v) : "";
	}

	getNestedValue(name: string): Record<string, unknown> {
		const v = this.value()[name];
		return asRecord(v) ?? {};
	}

	getArrayItems(name: string): unknown[] {
		const v = this.value()[name];
		return Array.isArray(v) ? v : [];
	}

	getArrayItemSchema(
		fieldSchema: Record<string, unknown>,
	): Record<string, unknown> {
		return asRecord(fieldSchema.items) ?? {};
	}

	isObjectArray(fieldSchema: Record<string, unknown>): boolean {
		const items = asRecord(fieldSchema.items);
		if (!items) return false;
		return items.type === "object" || !!items.properties || !!items.$ref;
	}

	asRecord(v: unknown): Record<string, unknown> | null {
		return asRecord(v);
	}

	updateField(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.value.update((c) => ({ ...c, [name]: val || undefined }));
	}

	updateFieldNumber(name: string, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.value.update((c) => ({
			...c,
			[name]: val ? Number(val) : undefined,
		}));
	}

	updateFieldBoolean(name: string, event: Event): void {
		const val = (event.target as HTMLSelectElement).value;
		this.value.update((c) => ({
			...c,
			[name]: val === "true" ? true : val === "false" ? false : undefined,
		}));
	}

	updateNestedField(name: string, nested: Record<string, unknown>): void {
		this.value.update((c) => ({ ...c, [name]: nested }));
	}

	addArrayItem(name: string, fieldSchema: Record<string, unknown>): void {
		const newItem = this.isObjectArray(fieldSchema) ? {} : "";
		this.value.update((c) => ({
			...c,
			[name]: [
				...(Array.isArray(c[name]) ? (c[name] as unknown[]) : []),
				newItem,
			],
		}));
	}

	removeArrayItem(name: string, index: number): void {
		this.value.update((c) => {
			const arr = Array.isArray(c[name]) ? [...(c[name] as unknown[])] : [];
			arr.splice(index, 1);
			return { ...c, [name]: arr };
		});
	}

	updateArrayItem(
		name: string,
		index: number,
		val: Record<string, unknown>,
	): void {
		this.value.update((c) => {
			const arr = Array.isArray(c[name]) ? [...(c[name] as unknown[])] : [];
			arr[index] = val;
			return { ...c, [name]: arr };
		});
	}

	updateArrayItemPrimitive(name: string, index: number, event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.value.update((c) => {
			const arr = Array.isArray(c[name]) ? [...(c[name] as unknown[])] : [];
			arr[index] = val;
			return { ...c, [name]: arr };
		});
	}

	onRawInput(event: Event): void {
		const val = (event.target as HTMLTextAreaElement).value;
		try {
			this.value.set(JSON.parse(val));
		} catch {
			/* ignore invalid JSON while typing */
		}
	}

	onRawFieldInput(name: string, event: Event): void {
		const val = (event.target as HTMLTextAreaElement).value;
		try {
			this.value.update((c) => ({ ...c, [name]: JSON.parse(val) }));
		} catch {
			/* ignore */
		}
	}
}

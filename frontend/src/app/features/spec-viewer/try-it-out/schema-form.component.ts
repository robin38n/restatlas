import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	model,
	signal,
} from "@angular/core";
import { asRecord } from "../../../core/utils/record-helpers";

interface FormField {
	name: string;
	schema: Record<string, unknown>;
	required: boolean;
	type: string;
	enumValues: string[];
	format: string;
	originalSchema?: Record<string, unknown>;
	itemsSchema?: Record<string, unknown>;
	properties?: boolean;
}

function determineFieldType(schema: Record<string, unknown>): string {
	if (schema.enum) return "enum";
	const type = schema.type;
	if (type === "object" || schema.properties) return "object";
	if (type === "array") return "array";
	if (type === "boolean") return "boolean";
	if (type === "integer") return "integer";
	if (type === "number") return "number";
	return "string";
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

	readonly arrayValues = signal<Record<string, unknown[]>>({});

	readonly fields = computed((): FormField[] => {
		const s = this.schema();
		const props = asRecord(s.properties);
		if (!props) return [];
		const required = Array.isArray(s.required)
			? new Set(s.required.filter((r): r is string => typeof r === "string"))
			: new Set<string>();

		return Object.entries(props).map(([name, propDef]) => {
			const resolved = asRecord(propDef) || {};
			const type = determineFieldType(resolved);
			return {
				name,
				schema: resolved,
				required: required.has(name),
				type,
				enumValues: Array.isArray(resolved.enum)
					? resolved.enum.map(String)
					: [],
				format: String(resolved.format ?? ""),
				originalSchema: resolved,
				itemsSchema: asRecord(resolved.items) || undefined,
				properties: !!resolved.properties,
			};
		});
	});

	updateValue(name: string, event: Event, isNumber = false): void {
		const target = event.target as HTMLInputElement;
		let val: string | number | boolean =
			target.type === "checkbox" ? target.checked : target.value;
		if (isNumber && val !== "") val = Number(val);
		this.value.update((v) => ({ ...v, [name]: val }));
	}

	updateNested(name: string, val: Record<string, unknown>): void {
		this.value.update((v) => ({ ...v, [name]: val }));
	}

	addArrayItem(name: string): void {
		this.arrayValues.update((v) => ({
			...v,
			[name]: [...(v[name] || []), {}],
		}));
	}

	removeArrayItem(name: string, index: number): void {
		this.arrayValues.update((v) => {
			const arr = [...(v[name] || [])];
			arr.splice(index, 1);
			return { ...v, [name]: arr };
		});
	}

	updateArrayItem(
		name: string,
		index: number,
		val: Record<string, unknown>,
	): void {
		this.arrayValues.update((v) => {
			const arr = [...(v[name] || [])];
			arr[index] = val;
			return { ...v, [name]: arr };
		});
		// Also update the model value
		const current = this.arrayValues()[name];
		this.value.update((v) => ({ ...v, [name]: current }));
	}
}

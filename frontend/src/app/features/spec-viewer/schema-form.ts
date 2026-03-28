import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	model,
} from "@angular/core";

function asRecord(v: unknown): Record<string, unknown> | null {
	return v != null && typeof v === "object" && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: null;
}

function resolveRef(
	schema: Record<string, unknown> | null,
	allSchemas: Record<string, unknown>,
): Record<string, unknown> | null {
	if (!schema) return null;
	const ref = schema["$ref"];
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
	if (schema["enum"]) return "enum";
	if (schema["$ref"]) return "object";
	const type = schema["type"];
	if (type === "object" || schema["properties"]) return "object";
	if (type === "array") return "array";
	if (type === "boolean") return "boolean";
	if (type === "integer") return "integer";
	if (type === "number") return "number";
	return "string";
}

function extractEnum(schema: Record<string, unknown>): string[] {
	const e = schema["enum"];
	return Array.isArray(e) ? e.map(String) : [];
}

@Component({
	selector: "app-schema-form",
	standalone: true,
	imports: [SchemaFormComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		@if (depth() > 3) {
			<textarea
				class="raw-fallback"
				placeholder="JSON value..."
				rows="3"
				(input)="onRawInput($event)"
			></textarea>
		} @else {
			@for (field of fields(); track field.name) {
				<div class="field">
					<label>
						{{ field.name }}
						@if (field.required) { <span class="req">*</span> }
						<span class="field-type">{{ field.type }}</span>
					</label>

					@switch (field.type) {
						@case ('string') {
							<input
								[type]="inputType(field.format)"
								[placeholder]="field.format || field.name"
								[value]="getFieldValue(field.name)"
								(input)="updateField(field.name, $event)"
							/>
						}
						@case ('integer') {
							<input
								type="number"
								step="1"
								[placeholder]="field.name"
								[value]="getFieldValue(field.name)"
								(input)="updateFieldNumber(field.name, $event)"
							/>
						}
						@case ('number') {
							<input
								type="number"
								[placeholder]="field.name"
								[value]="getFieldValue(field.name)"
								(input)="updateFieldNumber(field.name, $event)"
							/>
						}
						@case ('boolean') {
							<select (change)="updateFieldBoolean(field.name, $event)">
								<option value="">--</option>
								<option value="true">true</option>
								<option value="false">false</option>
							</select>
						}
						@case ('enum') {
							<select (change)="updateField(field.name, $event)">
								<option value="">--</option>
								@for (v of field.enumValues; track v) {
									<option [value]="v">{{ v }}</option>
								}
							</select>
						}
						@case ('object') {
							<div class="nested">
								<app-schema-form
									[schema]="field.schema"
									[allSchemas]="allSchemas()"
									[depth]="depth() + 1"
									[value]="getNestedValue(field.name)"
									(valueChange)="updateNestedField(field.name, $event)"
								/>
							</div>
						}
						@case ('array') {
							<div class="array-field">
								<button class="array-add" (click)="addArrayItem(field.name, field.schema)">+ Add item</button>
								@for (item of getArrayItems(field.name); track $index) {
									<div class="array-item">
										<span class="array-idx">[{{ $index }}]</span>
										@if (isObjectArray(field.schema)) {
											<app-schema-form
												[schema]="getArrayItemSchema(field.schema)"
												[allSchemas]="allSchemas()"
												[depth]="depth() + 1"
												[value]="asRecord(item) ?? {}"
												(valueChange)="updateArrayItem(field.name, $index, $event)"
											/>
										} @else {
											<input
												[value]="item ?? ''"
												(input)="updateArrayItemPrimitive(field.name, $index, $event)"
											/>
										}
										<button class="array-remove" (click)="removeArrayItem(field.name, $index)">x</button>
									</div>
								}
							</div>
						}
						@default {
							<textarea
								class="raw-fallback"
								placeholder="JSON value..."
								rows="2"
								(input)="onRawFieldInput(field.name, $event)"
							></textarea>
						}
					}
				</div>
			}
		}
	`,
	styles: `
		.field {
			margin-bottom: 0.5rem;
		}
		label {
			display: block;
			font-size: 0.75rem;
			font-weight: 600;
			color: #374151;
			margin-bottom: 0.2rem;
		}
		.req {
			color: #dc2626;
		}
		.field-type {
			color: #9ca3af;
			font-weight: 400;
			margin-left: 0.25rem;
		}
		input, select, textarea {
			width: 100%;
			padding: 0.35rem 0.5rem;
			border: 1px solid #d1d5db;
			border-radius: 4px;
			font-size: 0.8rem;
			font-family: monospace;
			background: #fff;
			box-sizing: border-box;
		}
		input:focus, select:focus, textarea:focus {
			outline: none;
			border-color: #2563eb;
			box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
		}
		.nested {
			margin-left: 0.75rem;
			padding-left: 0.75rem;
			border-left: 2px solid #e5e7eb;
		}
		.array-field {
			margin-left: 0.25rem;
		}
		.array-add {
			background: none;
			border: 1px dashed #d1d5db;
			color: #2563eb;
			cursor: pointer;
			padding: 0.25rem 0.5rem;
			border-radius: 4px;
			font-size: 0.75rem;
			margin-bottom: 0.375rem;
			width: 100%;
		}
		.array-add:hover {
			background: #eff6ff;
		}
		.array-item {
			display: flex;
			align-items: flex-start;
			gap: 0.375rem;
			margin-bottom: 0.25rem;
		}
		.array-idx {
			font-size: 0.7rem;
			color: #9ca3af;
			font-family: monospace;
			padding-top: 0.4rem;
			flex-shrink: 0;
		}
		.array-item input {
			flex: 1;
		}
		.array-remove {
			background: none;
			border: none;
			color: #dc2626;
			cursor: pointer;
			font-size: 0.8rem;
			padding: 0.25rem;
			flex-shrink: 0;
		}
		.raw-fallback {
			font-family: monospace;
			font-size: 0.8rem;
			width: 100%;
		}
	`,
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
		const props = asRecord(s["properties"]);
		if (!props) return [];
		const required = Array.isArray(s["required"])
			? new Set(s["required"].filter((r: unknown): r is string => typeof r === "string"))
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
				format: String(resolved["format"] ?? ""),
			};
		});
	});

	inputType(format: string): string {
		switch (format) {
			case "email": return "email";
			case "password": return "password";
			case "uri": return "url";
			case "date-time": return "datetime-local";
			default: return "text";
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

	getArrayItemSchema(fieldSchema: Record<string, unknown>): Record<string, unknown> {
		return asRecord(fieldSchema["items"]) ?? {};
	}

	isObjectArray(fieldSchema: Record<string, unknown>): boolean {
		const items = asRecord(fieldSchema["items"]);
		if (!items) return false;
		return items["type"] === "object" || !!items["properties"] || !!items["$ref"];
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
			[name]: [...(Array.isArray(c[name]) ? (c[name] as unknown[]) : []), newItem],
		}));
	}

	removeArrayItem(name: string, index: number): void {
		this.value.update((c) => {
			const arr = Array.isArray(c[name]) ? [...(c[name] as unknown[])] : [];
			arr.splice(index, 1);
			return { ...c, [name]: arr };
		});
	}

	updateArrayItem(name: string, index: number, val: Record<string, unknown>): void {
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
		} catch { /* ignore invalid JSON while typing */ }
	}

	onRawFieldInput(name: string, event: Event): void {
		const val = (event.target as HTMLTextAreaElement).value;
		try {
			this.value.update((c) => ({ ...c, [name]: JSON.parse(val) }));
		} catch { /* ignore */ }
	}
}

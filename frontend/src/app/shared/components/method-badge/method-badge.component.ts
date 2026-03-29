import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from "@angular/core";

const METHOD_BG: Record<string, string> = {
	GET: "bg-green-600",
	POST: "bg-blue-600",
	PUT: "bg-amber-600",
	PATCH: "bg-purple-600",
	DELETE: "bg-red-600",
};

@Component({
	selector: "app-method-badge",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<span
		class="font-semibold rounded-sm text-white shrink-0 inline-block"
		[class]="colorClass()"
	>{{ method() }}</span>`,
	host: { class: "contents" },
})
export class MethodBadgeComponent {
	readonly method = input.required<string>();
	readonly size = input<"xs" | "sm" | "base">("sm");

	readonly colorClass = computed(() => {
		const bg = METHOD_BG[this.method()] ?? "bg-gray-500";
		const sizeMap = {
			xs: "text-[0.6rem] py-0.5 px-1",
			sm: "text-[0.7rem] py-0.5 px-1.5",
			base: "text-xs py-0.5 px-1.5",
		};
		return `${bg} ${sizeMap[this.size()]}`;
	});
}

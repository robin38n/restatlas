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
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <span 
      class="inline-flex items-center justify-center font-bold text-white dark:text-zinc-950 rounded-sm leading-none shrink-0"
      [class]="classes()"
    >
      {{ method() }}
    </span>
  `,
})
export class MethodBadgeComponent {
	readonly method = input.required<string>();
	readonly size = input<"xs" | "sm" | "lg">("sm");

	protected readonly classes = computed(() => {
		const bg = METHOD_BG[this.method()] ?? "bg-zinc-500";
		const size = this.size();

		let sizeClasses = "text-[0.65rem] px-1 py-1 min-w-[36px] h-[18px]";
		if (size === "xs")
			sizeClasses = "text-[0.6rem] px-1 py-0.5 min-w-[30px] h-[16px]";
		if (size === "lg")
			sizeClasses = "text-[0.8rem] px-2 py-1 min-w-[48px] h-[24px]";

		return `${bg} ${sizeClasses}`;
	});
}

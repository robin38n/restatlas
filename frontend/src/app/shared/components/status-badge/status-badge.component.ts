import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
} from "@angular/core";

@Component({
	selector: "app-status-badge",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <span class="px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold border transition-colors" [class]="classes()">
      {{ status() }}
    </span>
  `,
})
export class StatusBadgeComponent {
	readonly status = input.required<number>();
	readonly size = input<"xs" | "sm">("xs");

	protected readonly classes = computed(() => {
		const s = this.status();
		let color = "";

		if (s >= 200 && s < 300) {
			color =
				"bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50";
		} else if (s >= 300 && s < 400) {
			color =
				"bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800/50";
		} else if (s >= 400 && s < 500) {
			color =
				"bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800/50";
		} else if (s >= 500) {
			color =
				"bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50";
		} else {
			color = "bg-app-surface text-app-text-muted border-app-border";
		}

		return color;
	});
}

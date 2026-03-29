import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";

@Component({
	selector: "app-status-badge",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<span
		class="font-semibold font-mono rounded-sm shrink-0 inline-block"
		[class]="colorClass()"
	>{{ displayText() }}</span>`,
	host: { class: "contents" },
})
export class StatusBadgeComponent {
	readonly status = input.required<string | number>();
	readonly size = input<"xs" | "sm" | "base">("sm");

	readonly displayText = computed(() => {
		const s = this.status();
		return s === 0 || s === "0" ? "ERR" : String(s);
	});

	readonly colorClass = computed(() => {
		const group = String(this.status()).charAt(0);
		const sizeMap = {
			xs: "text-[0.65rem] py-0.5 px-1",
			sm: "text-xs py-px px-1",
			base: "text-[0.8rem] py-0.5 px-2",
		};
		let color: string;
		switch (group) {
			case "2":
				color = "bg-green-100 text-green-800";
				break;
			case "3":
				color = "bg-blue-100 text-blue-800";
				break;
			case "4":
				color = "bg-amber-100 text-amber-800";
				break;
			case "5":
				color = "bg-red-50 text-red-800";
				break;
			default:
				color = "bg-gray-100 text-gray-500";
				break;
		}
		return `${color} ${sizeMap[this.size()]}`;
	});
}

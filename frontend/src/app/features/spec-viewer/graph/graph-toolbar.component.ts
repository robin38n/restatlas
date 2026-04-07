import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { TagOverflowComponent } from "../../../shared/components/tag-overflow/tag-overflow.component";
import { SpecGraphService } from "../services/spec-graph.service";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const METHOD_ACTIVE: Record<string, string> = {
	GET: "bg-green-600 text-white dark:text-zinc-950 border-green-600",
	POST: "bg-blue-600 text-white dark:text-zinc-950 border-blue-600",
	PUT: "bg-amber-600 text-white dark:text-zinc-950 border-amber-600",
	PATCH: "bg-purple-600 text-white dark:text-zinc-950 border-purple-600",
	DELETE: "bg-red-600 text-white dark:text-zinc-950 border-red-600",
};

@Component({
	selector: "app-graph-toolbar",
	imports: [TagOverflowComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./graph-toolbar.component.html",
})
export class GraphToolbarComponent {
	protected readonly svc = inject(SpecGraphService);
	protected readonly methods = HTTP_METHODS;

	hasActiveFilters(): boolean {
		return (
			this.svc.searchQuery().length > 0 ||
			this.svc.selectedTags().size > 0 ||
			this.svc.selectedMethods().size > 0
		);
	}

	onSearch(event: Event): void {
		const input = event.target as HTMLInputElement;
		this.svc.searchQuery.set(input.value);
	}

	methodClasses(method: string): string {
		const selected = this.svc.selectedMethods();
		const included = selected.size === 0 || selected.has(method);
		if (included) {
			return (
				METHOD_ACTIVE[method] ??
				"bg-app-text-muted text-app-text-inv border-app-text-muted"
			);
		}
		return "border-app-border bg-app-bg text-app-text-muted opacity-60 hover:opacity-100 transition-all";
	}
}

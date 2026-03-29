import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { SpecGraphService } from "../services/spec-graph.service";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const METHOD_ACTIVE: Record<string, string> = {
	GET: "bg-green-600 text-white border-green-600",
	POST: "bg-blue-600 text-white border-blue-600",
	PUT: "bg-amber-600 text-white border-amber-600",
	PATCH: "bg-purple-600 text-white border-purple-600",
	DELETE: "bg-red-600 text-white border-red-600",
};

@Component({
	selector: "app-graph-toolbar",
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
		if (this.svc.selectedMethods().has(method)) {
			return METHOD_ACTIVE[method] ?? "bg-gray-500 text-white border-gray-500";
		}
		return "border-gray-200 bg-white text-gray-500 hover:border-gray-400";
	}
}

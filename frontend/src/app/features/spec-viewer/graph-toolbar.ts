import { Component, inject } from "@angular/core";
import { SpecGraphService } from "./spec-graph.service";

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

@Component({
	selector: "app-graph-toolbar",
	standalone: true,
	template: `
    <div class="toolbar">
      <input
        type="text"
        class="search"
        placeholder="Search endpoints & schemas..."
        [value]="svc.searchQuery()"
        (input)="onSearch($event)"
      />

      <div class="filter-group">
        @for (method of methods; track method) {
          <button
            class="method-btn"
            [attr.data-method]="method"
            [class.active]="svc.selectedMethods().has(method)"
            (click)="svc.toggleMethod(method)"
          >{{ method }}</button>
        }
      </div>

      @if (svc.allTags().length > 0) {
        <div class="filter-group">
          @for (tag of svc.allTags(); track tag) {
            <button
              class="tag-chip"
              [class.active]="svc.selectedTags().has(tag)"
              (click)="svc.toggleTag(tag)"
            >{{ tag }}</button>
          }
        </div>
      }

      @if (hasActiveFilters()) {
        <button class="clear-btn" (click)="svc.clearFilters()">Clear filters</button>
      }
    </div>
  `,
	styles: `
    .toolbar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      flex-wrap: wrap;
      margin-bottom: 1rem;
    }
    .search {
      padding: 0.375rem 0.625rem;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 0.8rem;
      width: 220px;
      outline: none;
    }
    .search:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
    }
    .filter-group {
      display: flex;
      gap: 0.25rem;
    }
    .method-btn {
      border: 1px solid #e5e7eb;
      background: #fff;
      padding: 0.25rem 0.5rem;
      border-radius: 3px;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      color: #6b7280;
      transition: all 0.15s;
    }
    .method-btn:hover {
      border-color: #9ca3af;
    }
    .method-btn.active[data-method="GET"] { background: #16a34a; color: #fff; border-color: #16a34a; }
    .method-btn.active[data-method="POST"] { background: #2563eb; color: #fff; border-color: #2563eb; }
    .method-btn.active[data-method="PUT"] { background: #d97706; color: #fff; border-color: #d97706; }
    .method-btn.active[data-method="PATCH"] { background: #9333ea; color: #fff; border-color: #9333ea; }
    .method-btn.active[data-method="DELETE"] { background: #dc2626; color: #fff; border-color: #dc2626; }
    .tag-chip {
      border: 1px solid #c7d2fe;
      background: #fff;
      color: #4338ca;
      padding: 0.2rem 0.5rem;
      border-radius: 12px;
      font-size: 0.7rem;
      cursor: pointer;
      transition: all 0.15s;
    }
    .tag-chip:hover {
      background: #eef2ff;
    }
    .tag-chip.active {
      background: #4338ca;
      color: #fff;
      border-color: #4338ca;
    }
    .clear-btn {
      background: none;
      border: none;
      color: #6b7280;
      font-size: 0.75rem;
      cursor: pointer;
      text-decoration: underline;
      padding: 0.25rem;
    }
    .clear-btn:hover {
      color: #374151;
    }
  `,
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
}

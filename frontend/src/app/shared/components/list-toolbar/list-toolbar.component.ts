import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
	signal,
} from "@angular/core";

@Component({
	selector: "app-list-toolbar",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
    <div class="flex gap-2 mb-3">
      <div class="relative flex-1">
        <input
          type="text"
          [placeholder]="placeholder()"
          class="w-full py-1.5 pl-2 pr-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
          (input)="onSearch($event)"
        />
      </div>
      <div class="relative">
        <button 
          type="button"
          class="py-1.5 px-3 border border-gray-200 rounded text-sm bg-white cursor-pointer hover:bg-gray-50 focus:outline-none focus:border-blue-500 flex items-center gap-2"
          (click)="isOpen.set(!isOpen())"
        >
          <span class="flex items-center gap-1.5">
            @if (activeSort() === 'az') {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
              <span>Asc.</span>
            } @else if (activeSort() === 'za') {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
              <span>Desc.</span>
            } @else {
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
              <span>Method</span>
            }
          </span>
        </button>

        @if (isOpen()) {
          <div class="fixed inset-0 z-10" (click)="isOpen.set(false)"></div>
          <div class="absolute top-full right-0 mt-1 p-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 min-w-[110px]">
            @for (opt of sortOptions(); track opt.value) {
              <button
                type="button"
                class="w-full flex items-center gap-2 px-3 py-2 rounded text-sm hover:bg-gray-50 cursor-pointer text-left"
                [class.bg-blue-50]="activeSort() === opt.value"
                [class.text-blue-700]="activeSort() === opt.value"
                (click)="onSortSelect(opt.value)"
              >
                @if (opt.value === 'az') {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
                  <span>Asc.</span>
                } @else if (opt.value === 'za') {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4" /></svg>
                  <span>Desc.</span>
                } @else {
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                  <span>Method</span>
                }
              </button>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class ListToolbarComponent {
	readonly placeholder = input("Search...");
	readonly sortOptions = input<{ value: string; label: string }[]>([]);
	readonly activeSort = input<string>("az");

	readonly searchChange = output<string>();
	readonly sortChange = output<string>();

	readonly isOpen = signal(false);

	onSearch(event: Event): void {
		const val = (event.target as HTMLInputElement).value;
		this.searchChange.emit(val);
	}

	onSortSelect(val: string): void {
		this.isOpen.set(false);
		this.sortChange.emit(val);
	}
}

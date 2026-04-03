import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
	signal,
} from "@angular/core";

@Component({
	selector: "app-tag-overflow",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	styles: [":host { display: block; width: 100%; }"],
	template: `
    <div class="flex flex-wrap items-center gap-1.5">
      @for (tag of (isOpen() ? tags() : tags().slice(0, 10)); track tag) {
        <button
          type="button"
          class="px-2 py-0.5 rounded-full text-xs font-medium border transition-colors cursor-pointer shrink-0"
          [class]="selectedTags().has(tag) 
            ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200' 
            : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'"
          (click)="toggleTag.emit(tag)"
        >
          {{ tag }}
        </button>
      }

      @if (tags().length > 10) {
        <button
          type="button"
          class="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 cursor-pointer shrink-0"
          (click)="isOpen.set(!isOpen())"
        >
          {{ isOpen() ? 'Show less' : '+' + (tags().length - 10) + ' more' }}
        </button>
      }
    </div>
  `,
})
export class TagOverflowComponent {
	readonly tags = input.required<string[]>();
	readonly selectedTags = input.required<Set<string>>();
	readonly toggleTag = output<string>();

	readonly isOpen = signal(false);
}

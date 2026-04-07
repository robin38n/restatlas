import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
} from "@angular/core";
import {
	type HistoryEntry,
	TryItOutService,
} from "../../../features/spec-viewer/services/try-it-out.service";
import { MethodBadgeComponent } from "../method-badge/method-badge.component";
import { StatusBadgeComponent } from "../status-badge/status-badge.component";

@Component({
	selector: "app-request-history",
	imports: [MethodBadgeComponent, StatusBadgeComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./request-history.component.html",
})
export class RequestHistoryComponent {
	protected readonly tryItOut = inject(TryItOutService);
	readonly replayRequest = output<HistoryEntry>();
	readonly collapsible = input(false);
	readonly filterMethod = input<string | null>(null);
	readonly filterPath = input<string | null>(null);

	protected readonly entries = computed<HistoryEntry[]>(() => {
		const all = this.tryItOut.history();
		const m = this.filterMethod();
		const p = this.filterPath();
		if (!m || !p) return all;
		const re = new RegExp(
			`${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{[^/]+?\\\}/g, "[^/]+")}$`,
		);
		return all.filter(
			(e) =>
				e.request.method.toUpperCase() === m.toUpperCase() &&
				this.matchPath(e.request.url, re),
		);
	});

	private matchPath(url: string, re: RegExp): boolean {
		try {
			return re.test(new URL(url).pathname);
		} catch {
			return re.test(url);
		}
	}

	onSelect(entry: HistoryEntry): void {
		const idx = this.tryItOut.history().findIndex((e) => e.id === entry.id);
		if (idx >= 0) this.tryItOut.selectHistoryEntry(idx);
	}

	onReplay(entry: HistoryEntry): void {
		this.replayRequest.emit(entry);
	}

	truncateUrl(url: string): string {
		try {
			const u = new URL(url);
			return u.pathname + u.search;
		} catch {
			return url.length > 60 ? `${url.slice(0, 60)}...` : url;
		}
	}
}

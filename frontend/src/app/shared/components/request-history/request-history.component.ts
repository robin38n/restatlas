import {
	ChangeDetectionStrategy,
	Component,
	inject,
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

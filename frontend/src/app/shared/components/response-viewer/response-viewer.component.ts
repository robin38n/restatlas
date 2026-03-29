import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	signal,
} from "@angular/core";
import type { ProxyResponse } from "../../../features/spec-viewer/services/try-it-out.service";
import { StatusBadgeComponent } from "../status-badge/status-badge.component";

@Component({
	selector: "app-response-viewer",
	imports: [StatusBadgeComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./response-viewer.component.html",
})
export class ResponseViewerComponent {
	readonly response = input.required<ProxyResponse>();

	readonly formattedBody = computed(() => {
		const body = this.response().body;
		if (body == null) return "";
		if (typeof body === "string") return body;
		return JSON.stringify(body, null, 2);
	});

	readonly headerEntries = computed(() =>
		Object.entries(this.response().headers),
	);

	readonly headersExpanded = signal(false);
}

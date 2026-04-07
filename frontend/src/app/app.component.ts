import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { ThemeService } from "./core/theme.service";

@Component({
	selector: "app-root",
	imports: [RouterLink, RouterLinkActive, RouterOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.component.html",
})
export class AppComponent {
	protected readonly theme = inject(ThemeService);
}

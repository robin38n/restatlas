import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";
import { ThemeService } from "./core/theme.service";
import { ReactiveBackgroundComponent } from "./shared/components/reactive-background/reactive-background.component";

@Component({
	selector: "app-root",
	imports: [RouterLink, RouterLinkActive, RouterOutlet, ReactiveBackgroundComponent],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.component.html",
})
export class AppComponent {
	protected readonly theme = inject(ThemeService);
}

import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
	selector: "app-root",
	imports: [RouterLink, RouterLinkActive, RouterOutlet],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./app.component.html",
})
export class App {}

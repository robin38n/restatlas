import { Component } from "@angular/core";
import { RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

@Component({
	selector: "app-root",
	imports: [RouterLink, RouterLinkActive, RouterOutlet],
	template: `
		<nav class="app-header">
			<a routerLink="/" class="brand">
				<img src="assets/icons/reqviz.svg" alt="" class="brand-icon" />
				<span class="brand-name">ReqViz</span>
			</a>
			<div class="nav-links">
				<a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" class="nav-link">Explorer</a>
				<a routerLink="/api-client" routerLinkActive="active" class="nav-link">API Client</a>
			</div>
		</nav>
		<router-outlet />
	`,
	styles: `
		.app-header {
			display: flex;
			align-items: center;
			padding: 0.5rem 1rem;
			border-bottom: 1px solid #e5e7eb;
			background: #fff;
			font-family: system-ui, sans-serif;
		}
		.brand {
			display: flex;
			align-items: center;
			gap: 0.5rem;
			text-decoration: none;
			color: #111;
		}
		.brand-icon {
			width: 24px;
			height: 24px;
		}
		.brand-name {
			font-weight: 700;
			font-size: 1.1rem;
		}
		.nav-links {
			display: flex;
			align-items: center;
			gap: 1rem;
			margin-left: auto;
		}
		.nav-link {
			font-size: 0.85rem;
			color: #6b7280;
			text-decoration: none;
			padding: 0.25rem 0.5rem;
			border-radius: 4px;
			transition: color 0.15s, background 0.15s;
		}
		.nav-link:hover {
			color: #111;
			background: #f3f4f6;
		}
		.nav-link.active {
			color: #111;
			font-weight: 600;
		}
	`,
})
export class App {}

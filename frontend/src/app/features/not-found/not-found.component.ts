import { ChangeDetectionStrategy, Component } from "@angular/core";
import { RouterLink } from "@angular/router";

@Component({
	selector: "app-not-found",
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="flex flex-col items-center justify-center min-h-[80vh] px-4 text-center">
			<div class="relative mb-8">
				<div class="absolute inset-0 blur-3xl opacity-20 bg-app-primary rounded-full w-40 h-40 left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2"></div>
				<h1 class="text-9xl font-bold text-app-text/20 tracking-tighter m-0">404</h1>
			</div>
			
			<h2 class="text-2xl font-semibold mb-4">Connection Broken</h2>
			<p class="text-app-text-muted mb-8 max-w-md">
				The route you requested could not be found. It looks like the endpoint is missing from our specification.
			</p>
			
			<a routerLink="/" 
				class="inline-flex items-center gap-2 py-2.5 px-6 rounded-md bg-app-surface border border-app-border hover:border-app-primary/50 hover:bg-app-surface-hover text-app-text transition-all shadow-sm">
				<svg class="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
				</svg>
				Return to Explorer
			</a>
		</div>
	`,
})
export class NotFoundComponent {}

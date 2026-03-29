import type { Routes } from "@angular/router";
import { UploadComponent } from "./features/upload/upload.component";

export const routes: Routes = [
	{ path: "", component: UploadComponent },
	{
		path: "specs/:id",
		loadComponent: () =>
			import("./features/spec-viewer/spec-viewer.component").then(
				(m) => m.SpecViewerComponent,
			),
	},
	{
		path: "api-client",
		loadComponent: () =>
			import("./features/api-client/api-client.component").then(
				(m) => m.ApiClientComponent,
			),
	},
	{ path: "**", redirectTo: "" },
];

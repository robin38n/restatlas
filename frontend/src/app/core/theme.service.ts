import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
	readonly isDark = signal(this.getInitialTheme());

	toggleTheme(): void {
		const newDark = !this.isDark();
		console.log("Toggling theme to:", newDark ? "dark" : "light");
		this.isDark.set(newDark);
		this.applyTheme(newDark);
	}

	private applyTheme(dark: boolean): void {
		if (dark) {
			document.documentElement.classList.add("dark");
			localStorage.setItem("theme", "dark");
		} else {
			document.documentElement.classList.remove("dark");
			localStorage.setItem("theme", "light");
		}
	}

	private getInitialTheme(): boolean {
		const saved = localStorage.getItem("theme");
		let isDark = true; // Default to dark mode
		if (saved) {
			isDark = saved === "dark";
		}
		// Apply initial theme
		setTimeout(() => this.applyTheme(isDark), 0);
		return isDark;
	}
}

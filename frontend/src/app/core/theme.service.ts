import { Injectable, signal } from "@angular/core";

@Injectable({ providedIn: "root" })
export class ThemeService {
	readonly isDark = signal(this.getInitialTheme());
	readonly backgroundEnabled = signal(this.getInitialBackground());

	toggleTheme(): void {
		const newDark = !this.isDark();
		this.isDark.set(newDark);
		this.applyTheme(newDark);
	}

	toggleBackground(): void {
		const enabled = !this.backgroundEnabled();
		this.backgroundEnabled.set(enabled);
		localStorage.setItem("bg-animation", enabled ? "on" : "off");
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

	private getInitialBackground(): boolean {
		const saved = localStorage.getItem("bg-animation");
		return saved !== "off"; // Default to enabled
	}
}

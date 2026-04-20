import {
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	HostListener,
	effect,
	inject,
	NgZone,
	type OnDestroy,
	type OnInit,
	viewChild,
} from "@angular/core";
import { ThemeService } from "../../../core/theme.service";

interface Node {
	x: number;
	y: number;
	vx: number;
	vy: number;
	radius: number;
}

@Component({
	selector: "app-reactive-background",
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `<canvas #canvas class="fixed inset-0 w-full h-full pointer-events-none" style="transition: opacity 0.4s ease"></canvas>`,
})
export class ReactiveBackgroundComponent implements OnInit, OnDestroy {
	private readonly ngZone = inject(NgZone);
	private readonly theme = inject(ThemeService);

	readonly canvasRef =
		viewChild.required<ElementRef<HTMLCanvasElement>>("canvas");

	private ctx!: CanvasRenderingContext2D;
	private nodes: Node[] = [];
	private animationFrameId = 0;
	private initialized = false;

	private mouseX = -1000;
	private mouseY = -1000;
	private width = 0;
	private height = 0;

	constructor() {
		effect(() => {
			const enabled = this.theme.backgroundEnabled();
			if (!this.initialized) return;
			this.ngZone.runOutsideAngular(() => {
				if (enabled) {
					this.startAnimation();
				} else {
					this.stopAnimation();
				}
			});
		});
	}

	ngOnInit() {
		this.ngZone.runOutsideAngular(() => {
			// Small delay to ensure view is ready
			setTimeout(() => this.initCanvas(), 0);
		});
	}

	ngOnDestroy() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
		}
	}

	@HostListener("window:resize")
	onResize() {
		this.resizeCanvas();
	}

	@HostListener("window:mousemove", ["$event"])
	onMouseMove(event: MouseEvent) {
		this.mouseX = event.clientX;
		this.mouseY = event.clientY;
	}

	@HostListener("window:mouseleave")
	onMouseLeave() {
		this.mouseX = -1000;
		this.mouseY = -1000;
	}

	private initCanvas() {
		const canvas = this.canvasRef().nativeElement;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		this.ctx = ctx;

		this.resizeCanvas();
		this.initNodes();
		this.initialized = true;

		if (this.theme.backgroundEnabled()) {
			this.startAnimation();
		} else {
			canvas.style.opacity = "0";
		}
	}

	private startAnimation() {
		const canvas = this.canvasRef().nativeElement;
		canvas.style.opacity = "1";
		if (!this.animationFrameId) {
			this.animate();
		}
	}

	private stopAnimation() {
		if (this.animationFrameId) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = 0;
		}
		const canvas = this.canvasRef().nativeElement;
		canvas.style.opacity = "0";
	}

	private resizeCanvas() {
		const canvas = this.canvasRef().nativeElement;
		this.width = window.innerWidth;
		this.height = window.innerHeight;
		// Handle high DPI displays
		const dpr = window.devicePixelRatio || 1;
		canvas.width = this.width * dpr;
		canvas.height = this.height * dpr;
		this.ctx.scale(dpr, dpr);
	}

	private initNodes() {
		const nodeCount = Math.floor((this.width * this.height) / 25000); // responsive count
		this.nodes = [];
		for (let i = 0; i < nodeCount; i++) {
			this.nodes.push({
				x: Math.random() * this.width,
				y: Math.random() * this.height,
				vx: (Math.random() - 0.5) * 0.5,
				vy: (Math.random() - 0.5) * 0.5,
				radius: Math.random() * 2 + 1.5,
			});
		}
	}

	private animate() {
		this.ctx.clearRect(0, 0, this.width, this.height);

		const isDark = this.theme.isDark();
		const nodeColor = isDark
			? "rgba(255, 255, 255, 0.15)"
			: "rgba(0, 0, 0, 0.1)";
		const lineColor = isDark ? "rgba(255, 255, 255, " : "rgba(0, 0, 0, ";
		const activeLineColor = isDark
			? "rgba(161, 161, 170, " // zinc-400
			: "rgba(82, 82, 91, "; // zinc-600

		for (let i = 0; i < this.nodes.length; i++) {
			const node = this.nodes[i];

			// Move
			node.x += node.vx;
			node.y += node.vy;

			// Bounce
			if (node.x < 0 || node.x > this.width) node.vx *= -1;
			if (node.y < 0 || node.y > this.height) node.vy *= -1;

			// Draw Node
			this.ctx.beginPath();
			this.ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
			this.ctx.fillStyle = nodeColor;
			this.ctx.fill();

			// Connect to other nodes
			for (let j = i + 1; j < this.nodes.length; j++) {
				const node2 = this.nodes[j];
				const dx = node.x - node2.x;
				const dy = node.y - node2.y;
				const dist = Math.sqrt(dx * dx + dy * dy);

				if (dist < 150) {
					this.ctx.beginPath();
					this.ctx.moveTo(node.x, node.y);
					this.ctx.lineTo(node2.x, node2.y);

					// If near mouse, highlight the connection
					const mx = (node.x + node2.x) / 2 - this.mouseX;
					const my = (node.y + node2.y) / 2 - this.mouseY;
					const mouseDist = Math.sqrt(mx * mx + my * my);

					if (mouseDist < 120) {
						this.ctx.strokeStyle = `${activeLineColor}${(1 - dist / 150) * 0.5})`;
						this.ctx.lineWidth = 1.5;
					} else {
						this.ctx.strokeStyle = `${lineColor}${(1 - dist / 150) * 0.15})`;
						this.ctx.lineWidth = 1;
					}
					this.ctx.stroke();
				}
			}

			// React to mouse
			const dx = node.x - this.mouseX;
			const dy = node.y - this.mouseY;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist < 150) {
				// Gravitate slowly
				const angle = Math.atan2(dy, dx);
				const pullForce = (150 - dist) * 0.0015;
				node.x -= Math.cos(angle) * pullForce;
				node.y -= Math.sin(angle) * pullForce;
			}
		}

		this.animationFrameId = requestAnimationFrame(() => this.animate());
	}
}


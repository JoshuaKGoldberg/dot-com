// #66 Chaos Pendulums: exact double-pendulum equations (RK4) in the margins, each with a twin that starts
// 0.001 rad away. Fading trails show the two diverge. Drag or flick a bob to perturb only one twin.
import { bindKeys, clamp, createLoop, createPill, dprCap } from "./physics-kit/kit.js";

const G = 950;
const TRAIL = 260;
const SUB = 4;

export function activate({ root, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return undefined;
	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	scenery.append(canvas);
	const ctx = canvas.getContext("2d");

	let dpr = 1;
	let VW = 0;
	let VH = 0;
	let cells = [];
	let paused = reducedMotion;
	let drag;
	let hover;
	let colA = "#e2461f";
	let colB = "#1a8cd8";
	let ink = "#1c2733";
	let seed = 7;
	const rnd = () => {
		seed = (seed * 16807) % 2147483647;
		return seed / 2147483647;
	};

	function mkTwin(t1, t2) {
		return { t1, t2, w1: 0, w2: 0, trail: new Float32Array(TRAIL * 2), head: 0, len: 0 };
	}

	function layout() {
		const rr = root.getBoundingClientRect();
		VW = rr.width;
		VH = rr.height;
		dpr = dprCap(1.5);
		canvas.width = Math.round(VW * dpr);
		canvas.height = Math.round(VH * dpr);
		const cs = getComputedStyle(root);
		colA = cs.getPropertyValue("--pd-a").trim() || colA;
		colB = cs.getPropertyValue("--pd-b").trim() || colB;
		ink = cs.getPropertyValue("--pd-ink").trim() || ink;
		const page = root.querySelector(".site-page");
		const pr = page.getBoundingClientRect();
		const contentW = Math.min(pr.width, 832);
		const margin = Math.max(0, (VW - contentW) / 2);
		const rows = clamp(Math.floor(VH / 235), 2, 4);
		const cellW = Math.max(margin, 150);
		const cellH = VH / rows;
		const L = clamp(Math.min(cellW, cellH) * 0.27, 34, 74);
		seed = 7;
		cells = [];
		for (const side of [0, 1]) {
			for (let r = 0; r < rows; r++) {
				const cx = side === 0 ? Math.max(cellW / 2, margin / 2) : VW - Math.max(cellW / 2, margin / 2);
				const cy = cellH * r + cellH * 0.38;
				const t1 = Math.PI * (0.55 + rnd() * 0.45) * (rnd() < 0.5 ? -1 : 1);
				const t2 = Math.PI * (0.6 + rnd() * 0.4) * (rnd() < 0.5 ? -1 : 1);
				const a = mkTwin(t1, t2);
				const b = mkTwin(t1 + 0.001, t2);
				cells.push({ x: cx, y: cy, L, a, b, sep: 0, cellH });
			}
		}
		// Pre-roll so trails and motion are already in progress.
		const pre = reducedMotion ? 120 : 160;
		for (let s = 0; s < pre; s++) {
			for (const c of cells) {
				advance(c.a, c.L, 1 / 240);
				advance(c.a, c.L, 1 / 240);
				advance(c.b, c.L, 1 / 240);
				advance(c.b, c.L, 1 / 240);
				record(c);
			}
		}
	}

	function accel(t1, t2, w1, w2, L) {
		const d = t1 - t2;
		const den = 3 - Math.cos(2 * d);
		const a1 = (-G * 3 * Math.sin(t1) - G * Math.sin(t1 - 2 * t2) - 2 * Math.sin(d) * (w2 * w2 * L + w1 * w1 * L * Math.cos(d))) / (L * den);
		const a2 = (2 * Math.sin(d) * (w1 * w1 * L * 2 + G * 2 * Math.cos(t1) + w2 * w2 * L * Math.cos(d))) / (L * den);
		return [a1, a2];
	}

	function advance(p, L, h) {
		const f = (t1, t2, w1, w2) => {
			const [a1, a2] = accel(t1, t2, w1, w2, L);
			return [w1, w2, a1, a2];
		};
		const k1 = f(p.t1, p.t2, p.w1, p.w2);
		const k2 = f(p.t1 + (h / 2) * k1[0], p.t2 + (h / 2) * k1[1], p.w1 + (h / 2) * k1[2], p.w2 + (h / 2) * k1[3]);
		const k3 = f(p.t1 + (h / 2) * k2[0], p.t2 + (h / 2) * k2[1], p.w1 + (h / 2) * k2[2], p.w2 + (h / 2) * k2[3]);
		const k4 = f(p.t1 + h * k3[0], p.t2 + h * k3[1], p.w1 + h * k3[2], p.w2 + h * k3[3]);
		p.t1 += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
		p.t2 += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
		p.w1 += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
		p.w2 += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
	}

	function pos(c, p) {
		const x1 = c.x + c.L * Math.sin(p.t1);
		const y1 = c.y + c.L * Math.cos(p.t1);
		const x2 = x1 + c.L * Math.sin(p.t2);
		const y2 = y1 + c.L * Math.cos(p.t2);
		return [x1, y1, x2, y2];
	}

	function record(c) {
		for (const p of [c.a, c.b]) {
			const [, , x2, y2] = pos(c, p);
			p.trail[p.head * 2] = x2;
			p.trail[p.head * 2 + 1] = y2;
			p.head = (p.head + 1) % TRAIL;
			p.len = Math.min(TRAIL, p.len + 1);
		}
	}

	function step(dt) {
		if (paused && !drag) return false;
		for (const c of cells) {
			for (const p of [c.a, c.b]) {
				if (drag && drag.twin === p) continue;
				for (let s = 0; s < SUB; s++) advance(p, c.L, dt / SUB);
			}
			record(c);
		}
		if (drag) applyDrag();
		return true;
	}

	// ---- rendering
	function drawTrail(c, p, color, width) {
		const n = p.len;
		if (n < 2) return;
		const bands = 5;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		for (let b = 0; b < bands; b++) {
			const from = Math.floor((b / bands) * (n - 1));
			const to = Math.floor(((b + 1) / bands) * (n - 1)) + 1;
			ctx.globalAlpha = 0.05 + (0.8 * (b + 1)) / bands ** 1.0 * ((b + 1) / bands);
			ctx.lineWidth = width * (0.35 + (0.65 * (b + 1)) / bands);
			ctx.strokeStyle = color;
			ctx.beginPath();
			for (let i = from; i <= to && i < n; i++) {
				const idx = (p.head - n + i + TRAIL * 2) % TRAIL;
				const x = p.trail[idx * 2];
				const y = p.trail[idx * 2 + 1];
				if (i === from) ctx.moveTo(x, y);
				else ctx.lineTo(x, y);
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}

	function drawPendulum(c, p, color, lift) {
		const [x1, y1, x2, y2] = pos(c, p);
		ctx.strokeStyle = color;
		ctx.lineWidth = 2.2;
		ctx.lineCap = "round";
		ctx.globalAlpha = 0.9;
		ctx.beginPath();
		ctx.moveTo(c.x, c.y);
		ctx.lineTo(x1, y1);
		ctx.lineTo(x2, y2);
		ctx.stroke();
		ctx.globalAlpha = 1;
		for (const [x, y, r] of [[x1, y1, 4.2], [x2, y2, 5.6 + lift]]) {
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.arc(x, y, r, 0, 7);
			ctx.fill();
			ctx.fillStyle = "rgb(255 255 255 / 0.55)";
			ctx.beginPath();
			ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, 7);
			ctx.fill();
		}
	}

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, VW, VH);
		for (const c of cells) {
			drawTrail(c, c.b, colB, 2.6);
			drawTrail(c, c.a, colA, 2.6);
			// Mount.
			ctx.strokeStyle = ink;
			ctx.globalAlpha = 0.55;
			ctx.lineWidth = 1.4;
			ctx.beginPath();
			ctx.arc(c.x, c.y, 7, 0, 7);
			ctx.moveTo(c.x - 12, c.y);
			ctx.lineTo(c.x + 12, c.y);
			ctx.moveTo(c.x, c.y - 12);
			ctx.lineTo(c.x, c.y + 12);
			ctx.stroke();
			ctx.globalAlpha = 1;
			// Twin tips and the tether that shows divergence.
			const [, , ax, ay] = pos(c, c.a);
			const [, , bx, by] = pos(c, c.b);
			c.sep = Math.hypot(ax - bx, ay - by);
			ctx.setLineDash([3, 4]);
			ctx.strokeStyle = ink;
			ctx.globalAlpha = clamp(c.sep / 90, 0.08, 0.5);
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(ax, ay);
			ctx.lineTo(bx, by);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.globalAlpha = 1;
			drawPendulum(c, c.b, colB, hover?.twin === c.b ? 2 : 0);
			drawPendulum(c, c.a, colA, hover?.twin === c.a ? 2 : 0);
			// Readout.
			ctx.font = '500 11px "IBM Plex Mono", ui-monospace, monospace';
			ctx.fillStyle = ink;
			ctx.globalAlpha = 0.7;
			ctx.textAlign = "center";
			ctx.fillText(`twin Δ ${c.sep < 0.5 ? c.sep.toFixed(3) : c.sep.toFixed(1)} px`, c.x, c.y - 16);
			ctx.globalAlpha = 1;
		}
	}

	const loop = createLoop({ hz: 60, maxSteps: 2, step, render: draw });

	// ---- interaction
	function local(e) {
		const r = root.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function nearest(pt, radius) {
		let best;
		let bd = radius * radius;
		for (const c of cells) {
			for (const [p, name] of [[c.a, "a"], [c.b, "b"]]) {
				const [x1, y1, x2, y2] = pos(c, p);
				for (const [x, y, lower] of [[x2, y2, true], [x1, y1, false]]) {
					const d = (x - pt.x) ** 2 + (y - pt.y) ** 2;
					if (d < bd) {
						bd = d;
						best = { c, twin: p, name, lower };
					}
				}
			}
		}
		return best;
	}

	function onMove(e) {
		const pt = local(e);
		const h = nearest(pt, 22);
		if (!drag && (h?.twin !== hover?.twin || !!h !== !!hover)) {
			hover = h;
			if (!loop.running) draw();
		}
		if (drag) {
			drag.pt = pt;
			const now = performance.now();
			drag.samples.push([now, pt.x, pt.y]);
			while (drag.samples.length > 6) drag.samples.shift();
			loop.start();
		}
	}

	function onDown(e) {
		if (e.button !== 0 || e.target.closest?.("a, button, .phys-pill")) return;
		const pt = local(e);
		const h = nearest(pt, 26);
		if (!h) return;
		e.preventDefault();
		drag = { ...h, pt, samples: [[performance.now(), pt.x, pt.y]], prev: [h.twin.t1, h.twin.t2, performance.now()] };
		h.twin.w1 = h.twin.w2 = 0;
		if (paused) {
			paused = false;
			syncPause();
		}
		root.style.cursor = "grabbing";
		loop.start();
	}

	function applyDrag() {
		const { c, twin, lower, pt } = drag;
		const dx = pt.x - c.x;
		const dy = pt.y - c.y;
		const prev1 = twin.t1;
		const prev2 = twin.t2;
		if (lower) {
			// Two-link IK for the lower bob, keeping the current elbow side.
			const d = clamp(Math.hypot(dx, dy), 0.001, c.L * 2 - 0.01);
			const base = Math.atan2(dx, dy); // angle from straight-down
			const cosA = d / (2 * c.L);
			const a = Math.acos(clamp(cosA, -1, 1));
			const side = Math.sin(twin.t2 - twin.t1) >= 0 ? 1 : -1;
			twin.t1 = base - side * a;
			twin.t2 = base + side * a;
		} else {
			twin.t1 = Math.atan2(dx, dy);
		}
		const dt = 1 / 60;
		twin.w1 = (twin.t1 - prev1) / dt;
		twin.w2 = (twin.t2 - prev2) / dt;
	}

	function onUp() {
		if (!drag) return;
		const { twin } = drag;
		const lim = 14;
		twin.w1 = clamp(twin.w1, -lim, lim);
		twin.w2 = clamp(twin.w2, -lim, lim);
		// A plain click (no movement) is a nudge.
		if (Math.abs(twin.w1) + Math.abs(twin.w2) < 0.5) {
			twin.w2 += (Math.random() < 0.5 ? -1 : 1) * 2.5;
		}
		drag = undefined;
		root.style.cursor = "";
		loop.start();
	}

	function syncPause() {
		ui.buttons.pause.labelNode.textContent = paused ? "Swing" : "Pause";
		ui.buttons.pause.setAttribute("aria-pressed", String(!paused));
		if (!paused) loop.start();
		else {
			loop.stop();
			draw();
		}
	}

	function nudgeAll() {
		for (const c of cells) {
			c.a.w2 += (rnd() - 0.5) * 6;
		}
		if (paused) {
			paused = false;
			syncPause();
		}
		loop.start();
	}

	function reset() {
		layout();
		draw();
		loop.start();
	}

	const ui = createPill(root, {
		pos: "left",
		hint: "Drag a bob to perturb one twin · watch Δ grow",
		items: [
			{ id: "pause", label: paused ? "Swing" : "Pause", key: "p", primary: true, pressed: !paused, onClick: () => { paused = !paused; syncPause(); } },
			{ id: "nudge", label: "Nudge", key: "n", title: "Nudge every orange twin", onClick: nudgeAll },
			{ id: "reset", label: "Reseed", key: "r", onClick: reset },
		],
	});
	const removeKeys = bindKeys({ p: () => { paused = !paused; syncPause(); }, n: nudgeAll, r: reset });

	const ro = new ResizeObserver(() => {
		layout();
		draw();
	});

	layout();
	draw();
	ro.observe(root);
	window.addEventListener("pointermove", onMove, { passive: true });
	window.addEventListener("pointerdown", onDown);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onUp);
	if (!paused) loop.start();

	return () => {
		loop.stop();
		ro.disconnect();
		removeKeys();
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		canvas.remove();
	};
}

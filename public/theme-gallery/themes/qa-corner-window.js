/*
 * #273 Corner Window: a round porthole in the corner with a tiny live lake,
 * aurora and loon. Click opens a larger view (opt-in, built on first click).
 */
import { clamp, curtains, disposer, fitCanvas, loop, pointer, rng } from "./_quiet-d/kit.js";

const PAL = {
	dark: {
		skyTop: "#070d1c",
		skyBot: "#14243f",
		ridge: "#0b1424",
		ridge2: "#0f1c30",
		lakeTop: "#0f1d33",
		lakeBot: "#08111f",
		ink: "#05080f",
		fleck: "rgba(235,245,255,0.7)",
		star: "rgba(235,242,255,0.8)",
		ring: "rgba(190,225,255,0.28)",
	},
	light: {
		skyTop: "#d9e6f2",
		skyBot: "#f2f6f8",
		ridge: "#a9bccd",
		ridge2: "#bccbd9",
		lakeTop: "#cfdfea",
		lakeBot: "#e6eff4",
		ink: "#3a4a63",
		fleck: "rgba(255,255,255,0.85)",
		star: "rgba(255,255,255,0)",
		ring: "rgba(70,100,140,0.22)",
	},
};

const ridgeR = rng(273);
const RIDGE = Array.from({ length: 14 }, (_, i) => 0.5 + 0.35 * Math.sin(i * 0.9) * ridgeR() + ridgeR() * 0.25);
const STARS = Array.from({ length: 22 }, () => [ridgeR(), ridgeR() * 0.45, 0.4 + ridgeR() * 0.6]);

function loonPose(t, w) {
	const swim = Math.sin(t * 0.11) * 0.28;
	const x = w * (0.5 + swim);
	const dir = Math.cos(t * 0.11) >= 0 ? 1 : -1;
	const cycle = t % 26;
	const dive = cycle > 21 ? Math.sin(((cycle - 21) / 5) * Math.PI) : 0;
	return { x, dir, dive, ripple: cycle > 24.5 ? (cycle - 24.5) / 1.5 : -1 };
}

export function drawScene(ctx, w, h, t, o) {
	const P = PAL[o.dark ? "dark" : "light"];
	const horizon = h * 0.56;
	const sky = ctx.createLinearGradient(0, 0, 0, horizon);
	sky.addColorStop(0, P.skyTop);
	sky.addColorStop(1, P.skyBot);
	ctx.fillStyle = sky;
	ctx.fillRect(0, 0, w, horizon + 1);
	if (o.dark) {
		ctx.fillStyle = P.star;
		for (const [sx, sy, sa] of STARS) {
			ctx.globalAlpha = sa * (0.6 + 0.4 * Math.sin(t * 0.7 + sx * 20));
			ctx.fillRect(Math.round(sx * w), Math.round(sy * h), 1, 1);
		}
		ctx.globalAlpha = 1;
	}
	curtains(ctx, 0, 0, w, horizon, { ...o, t, strength: o.dark ? 1 : 0.7 });

	for (const [layer, col, k] of [
		[0, P.ridge2, 0.7],
		[1, P.ridge, 1],
	]) {
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.moveTo(0, horizon + 1);
		RIDGE.forEach((r, i) => {
			const idx = (i + layer * 5) % RIDGE.length;
			ctx.lineTo((i / (RIDGE.length - 1)) * w, horizon - RIDGE[idx] * h * 0.2 * k);
		});
		ctx.lineTo(w, horizon + 1);
		ctx.fill();
	}

	const lake = ctx.createLinearGradient(0, horizon, 0, h);
	lake.addColorStop(0, P.lakeTop);
	lake.addColorStop(1, P.lakeBot);
	ctx.fillStyle = lake;
	ctx.fillRect(0, horizon, w, h - horizon);

	// Faint aurora reflection.
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, horizon, w, h - horizon);
	ctx.clip();
	ctx.translate(0, horizon * 2);
	ctx.scale(1, -1);
	curtains(ctx, 0, 0, w, horizon, { ...o, t, strength: o.dark ? 0.35 : 0.2 });
	ctx.restore();

	// Loon.
	const ly = h * 0.8;
	const u = h * 0.045;
	const pose = loonPose(t, w);
	ctx.strokeStyle = P.ring;
	ctx.lineWidth = Math.max(1, h / 90);
	if (pose.ripple >= 0) {
		for (let k = 0; k < 2; k++) {
			const r = (pose.ripple + k * 0.3) % 1;
			ctx.globalAlpha = 1 - r;
			ctx.beginPath();
			ctx.ellipse(pose.x, ly + u * 0.4, u * (1.5 + r * 5), u * (0.35 + r * 1.2), 0, 0, 7);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
	}
	const sink = pose.dive * u * 2.2;
	ctx.save();
	ctx.beginPath();
	ctx.rect(0, 0, w, ly + u * 0.7);
	ctx.clip();
	ctx.translate(pose.x, ly + sink);
	ctx.scale(pose.dir, 1);
	ctx.fillStyle = P.ink;
	ctx.beginPath();
	ctx.ellipse(0, 0, u * 3.1, u * 0.95, 0, 0, 7);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(u * 2.0, -u * 0.2);
	ctx.quadraticCurveTo(u * 2.9, -u * 1.2, u * 2.6, -u * 2.4);
	ctx.lineTo(u * 3.15, -u * 2.4);
	ctx.quadraticCurveTo(u * 3.3, -u * 1.0, u * 2.6, 0);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(u * 2.95, -u * 2.5, u * 0.55, u * 0.4, 0, 0, 7);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(u * 3.4, -u * 2.6);
	ctx.lineTo(u * 4.5, -u * 2.45);
	ctx.lineTo(u * 3.4, -u * 2.3);
	ctx.fill();
	ctx.fillStyle = P.fleck;
	for (let i = 0; i < 5; i++) ctx.fillRect(-u * 1.8 + i * u * 0.75, -u * 0.55 + (i % 2) * u * 0.3, Math.max(1, u * 0.2), Math.max(1, u * 0.2));
	ctx.restore();
	ctx.fillStyle = P.ring;
	ctx.globalAlpha = 0.9;
	ctx.fillRect(pose.x - u * 3, ly + u * 0.75, u * 6, Math.max(1, h / 120));
	ctx.globalAlpha = 1;
}

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const overlay = root.querySelector(".overlay-a") || root;
	const footer = root.querySelector(".site-footer");

	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "qcw-window";
	btn.setAttribute("aria-label", "Open a larger view of the lake");
	btn.setAttribute("aria-expanded", "false");
	btn.title = "A tiny lake. Click to open.";
	const small = document.createElement("canvas");
	btn.append(small);
	overlay.append(btn);
	const SM = 56;
	const sctx = fitCanvas(small, SM, SM, 1, 2);
	const lean = { x: 0, y: 0 };
	const state = { t: 3, big: null };

	const pt = pointer(d, () => lp.wake());
	const aim = (canvas) => {
		const r = canvas.getBoundingClientRect();
		if (!pt.has) return { x: 0, y: 0 };
		return {
			x: clamp((pt.x - (r.left + r.width / 2)) / 600, -1, 1),
			y: clamp((pt.y - (r.top + r.height / 2)) / 600, -1, 1),
		};
	};
	const paint = () => {
		const a = aim(small);
		lean.x += (a.x - lean.x) * 0.1;
		lean.y += (a.y - lean.y) * 0.1;
		sctx.clearRect(0, 0, small.width, small.height);
		drawScene(sctx, small.width, small.height, state.t, { dark, lean, energy: pt.energy });
		if (state.big) {
			const b = state.big;
			const ba = aim(b.canvas);
			b.lean.x += (ba.x - b.lean.x) * 0.1;
			b.lean.y += (ba.y - b.lean.y) * 0.1;
			drawScene(b.ctx, b.canvas.width, b.canvas.height, state.t, { dark, lean: b.lean, energy: pt.energy });
		}
	};
	// Idle is nearly free: ambient drift at 8 fps only while visible; faster while the cursor stirs.
	const lp = loop(
		(dt) => {
			state.t += dt;
			pt.decay(dt);
			paint();
			return true;
		},
		{ fps: 10, el: btn, d },
	);
	if (reducedMotion) paint();
	else lp.wake();

	// Place the window in the footer at narrow widths so it never covers text.
	const mq = window.matchMedia("(max-width: 1000px)");
	const place = () => {
		if (mq.matches && footer) footer.append(btn);
		else overlay.append(btn);
		btn.classList.toggle("is-inline", mq.matches);
		panel?.classList.toggle("is-narrow", mq.matches);
	};
	let panel = null;
	d.on(mq, "change", place);
	place();

	// Opt-in expanded view. Nothing below runs until the first click.
	const close = () => {
		if (!panel || panel.hidden) return;
		panel.hidden = true;
		btn.setAttribute("aria-expanded", "false");
		state.big = null;
		document.removeEventListener("keydown", onKey, true);
		document.removeEventListener("pointerdown", onOutside, true);
		btn.focus({ preventScroll: true });
	};
	const onKey = (e) => {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			close();
		}
	};
	const onOutside = (e) => {
		if (panel.contains(e.target) || btn.contains(e.target)) return;
		close();
	};
	const open = () => {
		if (!panel) {
			panel = document.createElement("div");
			panel.className = "qcw-panel";
			panel.setAttribute("role", "dialog");
			panel.setAttribute("aria-label", "Lake view");
			const cv = document.createElement("canvas");
			cv.className = "qcw-big";
			const cap = document.createElement("p");
			cap.className = "qcw-caption";
			cap.textContent = "Up north, after dark. Esc closes.";
			panel.append(cv, cap);
			overlay.append(panel);
			panel.classList.toggle("is-narrow", mq.matches);
		}
		panel.hidden = false;
		const cv = panel.querySelector("canvas");
		const W = 300;
		const H = 200;
		const ctx = fitCanvas(cv, W, H, 1, 1.5);
		state.big = { canvas: cv, ctx, lean: { x: 0, y: 0 } };
		btn.setAttribute("aria-expanded", "true");
		document.addEventListener("keydown", onKey, true);
		document.addEventListener("pointerdown", onOutside, true);
		paint();
		if (!reducedMotion) lp.wake();
	};
	d.on(btn, "click", () => (panel && !panel.hidden ? close() : open()));
	d.add(() => {
		document.removeEventListener("keydown", onKey, true);
		document.removeEventListener("pointerdown", onOutside, true);
		btn.remove();
		panel?.remove();
	});
	return () => d.run();
}

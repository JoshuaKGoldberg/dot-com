/*
 * Edge-only scenery for the #330-338 themes (Josh: nothing full-screen, nothing behind the text, no masks).
 *  - an aurora in a band at the very top, strongest at the top edge and the outer corners, gone before the hero title;
 *  - small spruce stands anchored to the bottom-left and bottom-right viewport corners;
 *  - optional per-theme effects confined to two narrow edge strips (snow, fireflies).
 * The page background is never painted over. The footer band (footer.js) completes the scene.
 */
import { createAurora } from "./aurora.js";
import { spruce, rng } from "./footer.js";
import { addHint } from "../forest-kit/kit.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// Where the aurora may show: tall at the corners, a thin sliver across the very top.
export function edgeShape(H, { centerH = 100, cornerH = 360, centerGain = 0.45 } = {}) {
	return (u, v) => {
		const side = smooth(0.2, 0.95, Math.abs(2 * u - 1));
		const end = (centerH + (cornerH - centerH) * side) / H;
		const gain = centerGain + (1 - centerGain) * side;
		return (1 - smooth(0, end, v)) * gain;
	};
}
export const makeAurora = (opt) => (dark, shape) => createAurora({ alphaMode: true, bottom: 1, ...opt, dark, shape });

export function createEdge(root, o) {
	o = { bandH: 380, stands: {}, hint: "", mirrorAurora: null, ...o };
	const host = root.querySelector(".scenery-a");
	const reduced = !!o.reducedMotion;
	const html = document.documentElement;
	let dark = html.classList.contains("dark");
	let vw = 1, vh = 1, dead = false;
	const made = [];
	const mk = (css, parent = host) => { const c = document.createElement("canvas"); c.style.cssText = "position:absolute;pointer-events:none;display:block;" + css; parent.append(c); made.push(c); return c; };

	const top = mk("left:0;top:0;width:100%;will-change:opacity,transform");
	const topx = top.getContext("2d");
	const standL = mk("left:0;bottom:0"), standR = mk("right:0;bottom:0");
	const strips = o.fx ? [mk("left:0;top:0;height:100%"), mk("right:0;top:0;height:100%")] : [];
	let aur = null;
	let E = { w: 1, h: 1, dark, stripW: 200, aur: null, band: o.bandH };
	const s = { pointer: { x: -1e4, y: -1e4, active: false }, reduced, t: 0 };
	const hint = o.hint ? addHint(root, o.hint) : null;

	function build() {
		vw = host.clientWidth || window.innerWidth; vh = host.clientHeight || window.innerHeight;
		dark = html.classList.contains("dark");
		const H = Math.min(o.bandH, Math.round(vh * 0.5));
		E = { ...E, w: vw, h: vh, dark, stripW: Math.round(clamp(vw * 0.17, 120, 240)), band: H };
		top.width = vw; top.height = H; top.style.height = H + "px";
		aur = o.aurora(dark, o.shape ? o.shape(H) : edgeShape(H));
		aur.resize(vw, H);
		E.aur = aur;
		o.onBuild?.(E);
		buildStands();
		for (const [i, c] of strips.entries()) { c.width = E.stripW; c.height = vh; c.style.width = E.stripW + "px"; }
		o.fxInit?.(E);
		since = 1e9;
		render(0);
	}

	function buildStands() {
		const dpr = Math.min(1.5, window.devicePixelRatio || 1);
		const W = Math.round(clamp(vw * 0.17, 120, 240)), Hs = Math.round(clamp(vh * 0.34, 140, 290));
		const col = o.stands.colors?.[dark ? "dark" : "light"] || (dark ? ["#16283f", "#0d1a2c", "#060d19"] : ["#7fa3a8", "#4d7a80", "#2c4c52"]);
		const snow = o.stands.snow ? (dark ? "#9db6d4" : "#ffffff") : null;
		for (const [c, side] of [[standL, 0], [standR, 1]]) {
			c.width = Math.round(W * dpr); c.height = Math.round(Hs * dpr); c.style.width = W + "px"; c.style.height = Hs + "px";
			const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, Hs);
			const r = rng(o.seed + side * 17);
			// back, mid, front rows: tallest at the viewport edge, shrinking and thinning away from it
			for (let layer = 0; layer < 3; layer++) {
				x.fillStyle = col[layer];
				const n = [5, 5, 4][layer];
				for (let i = 0; i < n; i++) {
					const u = (i + r() * 0.8) / n; // 0 at the viewport edge
					const px = side ? W - u * W * 0.92 : u * W * 0.92;
					const h = Hs * (1 - 0.14 * layer) * Math.pow(1 - u, 0.95) * (0.65 + 0.35 * r()) + 16;
					spruce(x, px, Hs + 2 - layer * 3, h, h * 0.44, layer > 0 ? snow : null);
				}
			}
			// a low shoulder of ground at the corner
			x.fillStyle = col[2];
			x.beginPath(); x.moveTo(side ? W : 0, Hs);
			for (let k = 0; k <= 12; k++) { const u = k / 12; const px = side ? W - u * W : u * W; x.lineTo(px, Hs - 14 * Math.pow(1 - u, 1.8)); }
			x.lineTo(side ? 0 : W, Hs); x.closePath(); x.fill();
			if (snow) { x.fillStyle = snow; x.globalAlpha = 0.6; x.fillRect(side ? W - 40 : 0, Hs - 2, 40, 1.5); x.globalAlpha = 1; }
		}
	}

	let since = 1e9, last = 0, raf = 0, timer = 0, scrollY = 0, fade = 1;
	function render(dt) {
		since = 0;
		if (!aur) return;
		const H = top.height;
		topx.clearRect(0, 0, vw, H);
		if (fade > 0.01) aur.drawMain(topx, 1);
		o.drawTop?.(topx, E, s);
		for (const [i, c] of strips.entries()) {
			const x = c.getContext("2d");
			x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
			x.translate(i ? -(vw - E.stripW) : 0, 0);
			o.fxDraw(x, i, E, s);
		}
	}
	function tick(now) {
		raf = 0;
		if (dead || document.hidden || (fade <= 0.01 && !o.fx)) return;
		const dt = Math.min(0.1, (now - last) / 1000);
		if (dt >= 1 / 26) {
			last = now; s.t += dt;
			if (fade > 0.01) aur.update(dt, mapState());
			o.fxUpdate?.(dt, s, E);
			render(dt);
		}
		raf = requestAnimationFrame(tick);
	}
	function mapState() {
		// the aurora lives in a short band: feed it a pointer scaled into band space
		const p = s.pointer;
		return { reduced, pointer: { active: p.active, x: p.x, y: p.y * 0.4 } };
	}
	function kick() { if (!raf && !dead && !document.hidden && (fade > 0.01 || o.fx) && !reduced) { last = performance.now(); raf = requestAnimationFrame(tick); } }
	function onMove(e) {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		const p = s.pointer; p.x = e.clientX - r.left; p.y = e.clientY - r.top; p.active = true;
		hint?.hide();
		if (reduced) { aur.update(0.016, mapState()); render(0); } else kick();
	}
	function onScroll() {
		scrollY = root.scrollTop;
		fade = 1 - clamp(scrollY / 380);
		top.style.opacity = fade.toFixed(3);
		top.style.transform = `translateY(${(-scrollY * 0.35).toFixed(1)}px)`;
		if (fade > 0.01) kick();
	}
	function onLeave() { s.pointer.active = false; }
	window.addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	root.addEventListener("scroll", onScroll, { passive: true });
	const onVis = () => kick();
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(() => { build(); kick(); });
	ro.observe(host);
	const mo = new MutationObserver(() => { if (html.classList.contains("dark") !== dark) { build(); } });
	mo.observe(html, { attributes: true, attributeFilter: ["class"] });
	build(); onScroll();
	if (!reduced) kick();
	return {
		get aur() { return aur; },
		get band() { return E.band; },
		destroy() {
			dead = true; cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect();
			window.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", onLeave);
			root.removeEventListener("scroll", onScroll); document.removeEventListener("visibilitychange", onVis);
			for (const c of made) c.remove();
			hint?.hide?.();
		},
	};
}

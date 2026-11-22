// #287 Local Sky: a sky band across the top third follows your local time (day, golden hour, dusk, night + aurora)
// above a low ridgeline. In dark mode daytime hours get a dusky rendition, never a bright sky. Try ?hour=21.5.
import { addAurora, canvasAt, clamp, disposer, el, hex, lerp, mix, paintRidge, pointer, rgba, rng, scrollT, smooth, TAU } from "./_medium-b/kit.js";

const H_ = (a) => a.map(hex);
// [hour, top, horizon, sun/glow]
const LIGHT = [
	[0, "#b6c0ee", "#e8eefc", "#dfe6ff"], [5, "#bcc2ee", "#f2e0ea", "#f2d4e0"], [6.6, "#f5c6b4", "#fde8d0", "#ffd9a8"],
	[9, "#a8d2f4", "#e6f3fb", "#fff3c8"], [12.5, "#9acbf3", "#e2f1fc", "#fff6d8"], [16, "#a6cff0", "#f2eee4", "#fff0c4"],
	[18, "#f6c294", "#fce4c4", "#ffcf88"], [19.7, "#e2a6b6", "#f6dcdc", "#ffb8a0"], [21.2, "#b2b4e8", "#e8e8fa", "#dfe0ff"], [24, "#b6c0ee", "#e8eefc", "#dfe6ff"],
].map(([h, a, b, c]) => [h, ...H_([a, b, c])]);
const DARK = [
	[0, "#060c20", "#12214a", "#9db4ee"], [5, "#0c1534", "#2a2f5c", "#b8a4d8"], [6.6, "#1a2350", "#6a4a5c", "#f2b27a"],
	[9, "#12234a", "#27466f", "#ffe3a8"], [12.5, "#112650", "#2a4a7a", "#ffeab8"], [16, "#13244a", "#2a4670", "#ffdca0"],
	[18, "#1c2250", "#744c56", "#f0a468"], [19.7, "#191b48", "#58386a", "#d890a8"], [21.2, "#0a112e", "#16275a", "#9db4ee"], [24, "#060c20", "#12214a", "#9db4ee"],
].map(([h, a, b, c]) => [h, ...H_([a, b, c])]);

function sample(keys, h) {
	for (let i = 1; i < keys.length; i++) if (h <= keys[i][0]) {
		const k = (h - keys[i - 1][0]) / (keys[i][0] - keys[i - 1][0]);
		return { top: mix(keys[i - 1][1], keys[i][1], k), hor: mix(keys[i - 1][2], keys[i][2], k), glow: mix(keys[i - 1][3], keys[i][3], k) };
	}
	return { top: keys[0][1], hor: keys[0][2], glow: keys[0][3] };
}
function localHour() {
	const f = parseFloat(new URLSearchParams(location.search).get("hour"));
	if (!Number.isNaN(f)) return ((f % 24) + 24) % 24;
	const n = new Date();
	return n.getHours() + n.getMinutes() / 60;
}
// 0..1 how "night" it is (aurora + stars + moon)
const nightAmt = (h) => (h >= 21 || h <= 4.8 ? 1 : h > 19.4 ? smooth((h - 19.4) / 1.6) : h < 6 ? smooth((6 - h) / 1.2) : 0);

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const sceneryA = root.querySelector(".scenery-a");
	if (!sceneryA) return;
	const wrap = el(sceneryA, "inset:0;overflow:hidden");
	const aur = addAurora(d, root, { dark, reduced: reducedMotion, height: "48%", intensity: dark ? 1.05 : 1.15, top: 0.97, opacity: 0 });
	let hour = localHour(), W = 0, H = 0, sky = null, stars = null, ridgeA = null, ridgeB = null, cloudEls = [], sunEl = null, px = 0;
	const keys = dark ? DARK : LIGHT;

	function build() {
		W = root.clientWidth; H = root.clientHeight;
		if (!W || !H) return;
		wrap.textContent = "";
		const top = el(wrap, "inset:0;bottom:auto;height:100%;will-change:opacity");
		aur.fadeWith(top);
		const bh = Math.round(H * 0.38);
		sky = canvasAt(top, `left:0;top:0;width:${W}px;height:${bh}px`, Math.round(W / 4), Math.round(bh / 4), 1);
		sky.c.style.width = `${W}px`; sky.c.style.height = `${bh}px`; sky.bh = bh;
		stars = canvasAt(top, "left:0;top:0;", W, Math.round(bh * 0.8), 1);
		sunEl = el(top, "left:0;top:0;width:90px;height:90px;border-radius:50%;will-change:transform");
		cloudEls = [];
		const R = rng(287);
		for (let i = 0; i < 4; i++) {
			const w = 220 + R() * 160, c = el(top, `left:0;top:${Math.round(bh * (0.1 + R() * 0.4))}px;width:${w}px;height:${w * 0.28}px;will-change:transform;opacity:0`);
			c.className = "mls-cloud";
			c.style.setProperty("--w", `${W + w}px`);
			c.style.animation = reducedMotion ? "none" : `mlsDrift ${160 + R() * 120}s linear -${R() * 200}s infinite`;
			cloudEls.push(c);
		}
		const rh = Math.round(clamp(H * 0.16, 90, 170)), lw = W + 80;
		ridgeA = canvasAt(wrap, "left:-40px;bottom:0;will-change:transform;contain:paint", lw, rh);
		ridgeB = canvasAt(wrap, "left:-40px;bottom:0;will-change:transform;contain:paint", lw, rh);
		paint();
	}

	function paint() {
		if (!sky) return;
		const s = sample(keys, hour), n = nightAmt(hour);
		const x = sky.x, w = sky.w, h = sky.h;
		x.clearRect(0, 0, w, h);
		const g = x.createLinearGradient(0, 0, 0, h);
		const a0 = dark ? 1 : 0.92;
		g.addColorStop(0, rgba(s.top, a0));
		g.addColorStop(0.45, rgba(mix(s.top, s.hor, 0.55), a0 * 0.62));
		g.addColorStop(1, rgba(s.hor, 0));
		x.fillStyle = g; x.fillRect(0, 0, w, h);
		// sun (day) arc and moon (night) arc
		const day = hour > 5.6 && hour < 20.4, u = day ? (hour - 5.6) / 14.8 : (((hour + 6) % 24) / 11.2) % 1;
		const sx = lerp(0.12, 0.88, u) * W, sy = (0.62 - 0.46 * Math.sin(u * Math.PI)) * sky.bh;
		const gl = x.createRadialGradient(sx / 4, sy / 4, 0, sx / 4, sy / 4, h * 0.7);
		const ga = dark ? (day ? 0.28 : 0.1) : day ? 0.7 : 0.35;
		gl.addColorStop(0, rgba(s.glow, ga)); gl.addColorStop(1, rgba(s.glow, 0));
		x.fillStyle = gl; x.fillRect(0, 0, w, h);
		x.globalCompositeOperation = "destination-in";
		const fade = x.createLinearGradient(0, 0, 0, h);
		fade.addColorStop(0, "#000"); fade.addColorStop(0.35, "#000"); fade.addColorStop(1, "rgba(0,0,0,0)");
		x.fillStyle = fade; x.fillRect(0, 0, w, h);
		x.globalCompositeOperation = "source-over";
		// disc
		const disc = day ? (dark ? "rgba(255,226,170,.55)" : "rgba(255,247,222,.95)") : (dark ? "rgba(232,238,255,.9)" : "rgba(255,255,255,.95)");
		sunEl.style.cssText += `;transform:translate3d(${sx - 45}px,${sy - 45}px,0);background:radial-gradient(circle, ${disc} 0 ${day ? 17 : 12}px, ${rgba(s.glow, day ? 0.35 : 0.3)} ${day ? 18 : 14}px, transparent 44px)`;
		sunEl.style.opacity = day ? (dark ? 0.6 : 1) : 0.9 * clamp(n + (dark ? 0.2 : 0));
		// stars
		const sa = dark ? Math.max(0.45, n) : n * 0.85;
		stars.c.style.opacity = sa;
		stars.x.clearRect(0, 0, stars.w, stars.h);
		stars.x.fillStyle = dark ? "#eaf1ff" : "#6e78c8";
		const R = rng(7);
		for (let i = 0; i < 70; i++) { const sx2 = R() * W, sy2 = Math.pow(R(), 1.3) * stars.h, r = 0.5 + R() * 1.1; stars.x.globalAlpha = 0.35 + R() * 0.65; stars.x.beginPath(); stars.x.arc(sx2, sy2, r, 0, TAU); stars.x.fill(); }
		stars.x.globalAlpha = 1;
		// clouds
		const cc = dark ? "rgba(120,140,190,.22)" : hour > 17 && hour < 20.6 ? "rgba(255,226,206,.75)" : "rgba(255,255,255,.85)";
		const cAmt = dark ? 0.7 : (1 - n);
		cloudEls.forEach((c) => {
			c.style.background = `radial-gradient(ellipse 50% 50% at 28% 62%, ${cc}, transparent 70%), radial-gradient(ellipse 40% 55% at 55% 45%, ${cc}, transparent 70%), radial-gradient(ellipse 45% 45% at 78% 62%, ${cc}, transparent 72%)`;
			c.style.opacity = cAmt * (dark ? 1 : 0.9);
		});
		aur.setOpacity(dark ? Math.max(0.4, n) : n);
		// ridges, tinted by the horizon colour
		const tint = (c, k) => mix(c, s.hor, k);
		const base = dark ? [[15, 28, 54], [22, 40, 70]] : [[168, 192, 206], [200, 220, 226]];
		const lay = [[ridgeA, tint(base[0], dark ? 0.22 : 0.3), 4.2, 0.5], [ridgeB, tint(base[1], dark ? 0.15 : 0.22), 1.7, 0.36]];
		lay.forEach(([c, col, seed, amp], i) => {
			c.x.clearRect(0, 0, c.w, c.h);
			paintRidge(c.x, c.w, c.h, { base: c.h * (0.62 + i * 0.14), amp: c.h * amp, scale: c.w * (0.1 - i * 0.03), seed, top: col, bottom: mix(col, dark ? [8, 14, 30] : [240, 246, 250], 0.55), cap: dark ? mix(col, [180, 200, 240], 0.35) : null, capAlpha: 0.5, capWidth: 1 });
			c.depth = i ? 14 : 7;
		});
		move();
	}
	function move() { for (const c of [ridgeA, ridgeB]) if (c) c.c.style.transform = `translate3d(${(-px * c.depth).toFixed(1)}px,0,0)`; }
	scrollT(d, root, (v, top) => { wrap.style.transform = ""; });
	const ptr = pointer(d, () => { px = clamp((ptr.x / Math.max(1, W)) * 2 - 1, -1, 1); move(); });
	const timer = setInterval(() => { if (document.hidden) return; const h2 = localHour(); if (Math.abs(h2 - hour) > 0.01) { hour = h2; paint(); } }, 30000);
	d.add(() => { clearInterval(timer); wrap.remove(); });
	const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(build, 120); });
	ro.observe(root);
	d.add(() => { ro.disconnect(); clearTimeout(ro.t); });
	build();
	return () => d.run();
}

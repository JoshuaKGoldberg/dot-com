/*
 * #275 Sky Strip: a slim strip above the header showing the sky at the
 * visitor's real local time. Day blue, sunset, or night with stars and a
 * faint aurora that leans toward the cursor. Test with ?hour=21.5.
 */
import { clamp, curtains, disposer, fitCanvas, lerp, loop, param, pointer, rng } from "./_quiet-d/kit.js";

// [hour, top, bottom] sky colours.
const KEYS = [
	[0, [10, 17, 36], [22, 38, 74]],
	[4.5, [14, 22, 48], [34, 48, 92]],
	[6, [96, 110, 170], [240, 178, 150]],
	[8, [140, 192, 236], [220, 236, 245]],
	[12, [122, 184, 240], [214, 236, 250]],
	[16.5, [138, 188, 232], [238, 228, 214]],
	[18.5, [106, 106, 168], [242, 167, 125]],
	[20, [40, 48, 94], [122, 91, 142]],
	[21.5, [12, 19, 40], [24, 40, 78]],
	[24, [10, 17, 36], [22, 38, 74]],
];

function sky(h) {
	for (let i = 1; i < KEYS.length; i++) {
		if (h <= KEYS[i][0]) {
			const [h0, t0, b0] = KEYS[i - 1];
			const [h1, t1, b1] = KEYS[i];
			const k = (h - h0) / (h1 - h0);
			const mix = (a, b) => a.map((v, j) => Math.round(lerp(v, b[j], k)));
			return { top: mix(t0, t1), bot: mix(b0, b1) };
		}
	}
	return { top: KEYS[0][1], bot: KEYS[0][2] };
}

const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const R = rng(275);
const STARS = Array.from({ length: 46 }, () => [R(), R(), 0.4 + R() * 0.6]);
const CLOUDS = Array.from({ length: 5 }, () => [R(), 0.25 + R() * 0.5, 0.05 + R() * 0.06, 0.01 + R() * 0.01]);

function localHour() {
	const f = parseFloat(param("hour"));
	if (!Number.isNaN(f)) return ((f % 24) + 24) % 24;
	const n = new Date();
	return n.getHours() + n.getMinutes() / 60;
}

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const page = root.querySelector(".site-page");
	if (!page) return;

	const strip = document.createElement("div");
	strip.className = "qss-strip";
	strip.setAttribute("aria-hidden", "true");
	const canvas = document.createElement("canvas");
	strip.append(canvas);
	root.insertBefore(strip, page);

	const CW = 360;
	const CH = 28;
	canvas.width = CW;
	canvas.height = CH;
	const ctx = canvas.getContext("2d");
	let hour = localHour();
	let t = 0;
	const lean = { x: 0, y: 0 };
	const pt = pointer(d, () => lp.wake());

	function paint() {
		const s0 = sky(hour);
		const deep = sky(22.5);
		// Dark mode: always a muted night sky, nudged by the real hour.
		const dm = (a, b) => a.map((v, j) => Math.round(lerp(v, b[j], 0.88)));
		const s = dark ? { top: dm(s0.top, deep.top), bot: dm(s0.bot, deep.bot) } : s0;
		const night = dark || hour < 5.5 || hour > 20.8;
		const dusk = !dark && hour > 18 && hour <= 20.8;
		const g = ctx.createLinearGradient(0, 0, 0, CH);
		// In light mode, nudge toward the page white so it reads as "paper with a sky tint".
		const soften = dark ? 0 : 0.3;
		const sm = (c) => c.map((v) => Math.round(lerp(v, 253, soften)));
		g.addColorStop(0, rgb(sm(s.top)));
		g.addColorStop(1, rgb(sm(s.bot)));
		ctx.clearRect(0, 0, CW, CH);
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, CW, CH);

		const starA = dark ? 0.7 : night ? 1 : dusk ? clamp((hour - 19) / 1.8) : hour < 7 ? clamp((6 - hour) / 1.5) : 0;
		if (starA > 0) {
			ctx.fillStyle = "#eaf1ff";
			for (const [x, y, a] of STARS) {
				ctx.globalAlpha = starA * a * (0.55 + 0.45 * Math.sin(t * 0.8 + x * 40));
				ctx.fillRect(Math.floor(x * CW), Math.floor(y * CH * 0.8), 1, 1);
			}
			ctx.globalAlpha = 1;
		}
		// Aurora when it's dark out (and a hint at the edges of dusk).
		const auroraA = night ? 1 : dusk ? clamp((hour - 20) / 0.8) : hour < 6 ? clamp((5.5 - hour) / 1) * 0 + 1 : 0;
		if (auroraA > 0 || pt.energy > 0) {
			curtains(ctx, 0, 0, CW, CH, { t, dark: true, lean, energy: pt.energy, strength: (dark ? 0.8 : 0.5) * (night ? 1 : 0.5) * Math.max(auroraA, 0.0) });
		}
		// Sun / moon on the hour's arc.
		const sunU = clamp((hour - 5.5) / 14);
		const isDay = hour > 5.5 && hour < 20;
		const px = (isDay ? sunU : (((hour + 6) % 24) / 11.5) % 1) * CW;
		const py = CH * (0.7 - 0.45 * Math.sin((isDay ? sunU : ((hour + 6) % 24) / 11.5) * Math.PI));
		const glow = ctx.createRadialGradient(px, py, 0, px, py, isDay ? 9 : 6);
		glow.addColorStop(0, isDay ? "rgba(255,244,214,0.95)" : "rgba(235,240,255,0.9)");
		glow.addColorStop(0.35, isDay ? "rgba(255,236,190,0.35)" : "rgba(220,230,255,0.25)");
		glow.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = glow;
		ctx.fillRect(px - 10, py - 10, 20, 20);
		// Clouds by day and dusk.
		if (!night) {
			ctx.fillStyle = dusk ? "rgba(255,200,180,0.35)" : "rgba(255,255,255,0.55)";
			for (const [cx, cy, cw, sp] of CLOUDS) {
				const x = (((cx + t * sp * 0.1) % 1.2) - 0.1) * CW;
				ctx.beginPath();
				ctx.ellipse(x, cy * CH, cw * CW * 0.5, 2.6, 0, 0, 7);
				ctx.ellipse(x + 8, cy * CH - 1.5, cw * CW * 0.3, 2.2, 0, 0, 7);
				ctx.fill();
			}
		}
	}

	const lp = loop(
		(dt) => {
			t += dt;
			const a = pt.has ? strip.getBoundingClientRect() : null;
			const tx = a ? clamp((pt.x - (a.left + a.width / 2)) / (a.width / 2), -1, 1) : 0;
			lean.x += (tx - lean.x) * 0.1;
			pt.decay(dt);
			paint();
			return true;
		},
		{ fps: 12, el: strip, d },
	);
	paint();
	if (!reducedMotion) lp.wake();
	// Keep the real clock honest without a hot timer.
	const tick = setInterval(() => {
		if (document.hidden) return;
		hour = localHour();
		if (reducedMotion) paint();
	}, 60000);
	d.add(() => {
		clearInterval(tick);
		strip.remove();
	});
	return () => d.run();
}

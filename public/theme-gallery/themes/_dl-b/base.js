/*
 * Wave 14 base: #317 Footer Watercolor with the calmer header from the brief
 * (hugs the top edge, ~55% brightness, 3x slower) and a footer that runs to the page end.
 */
import { clamp, disposer, fullBleed, grainLayer, idle, isDark, loop, pigmentPainter, pointer, rng, whenVisible } from "../_refined-d/kit.js";
export { disposer, isDark, clamp, rng, idle };

const RIDGE = {
	dark: [
		{ top: "rgba(60,76,150,0.42)", bot: "rgba(30,42,98,0.6)", edge: "rgba(150,170,255,0.12)", y: 0.5, amp: 0.1, bloom: [120, 150, 255] },
		{ top: "rgba(30,44,104,0.6)", bot: "rgba(18,28,74,0.8)", edge: "rgba(120,150,230,0.1)", y: 0.66, amp: 0.09, bloom: [90, 200, 200] },
		{ top: "rgba(18,28,70,0.85)", bot: "rgba(11,18,48,0.95)", edge: "rgba(100,130,210,0.12)", y: 0.82, amp: 0.07, bloom: [160, 110, 230] },
	],
	light: [
		{ top: "rgba(176,198,214,0.6)", bot: "rgba(214,226,230,0.5)", edge: "rgba(90,120,150,0.22)", y: 0.5, amp: 0.1, bloom: [240, 190, 200] },
		{ top: "rgba(156,190,188,0.52)", bot: "rgba(204,224,218,0.45)", edge: "rgba(70,110,110,0.22)", y: 0.66, amp: 0.09, bloom: [250, 220, 170] },
		{ top: "rgba(130,172,166,0.5)", bot: "rgba(190,216,208,0.45)", edge: "rgba(50,96,92,0.22)", y: 0.82, amp: 0.07, bloom: [200, 190, 235] },
	],
};

/** Paints three washed ridges with pooled edges and blooms into a canvas (CSS size w x h). */
function paintRidges(canvas, w, h, dark) {
	const dpr = Math.min(1.25, devicePixelRatio || 1);
	canvas.width = Math.round(w * dpr);
	canvas.height = Math.round(h * dpr);
	const x = canvas.getContext("2d");
	x.scale(dpr, dpr);
	const rnd = rng(317);
	RIDGE[dark ? "dark" : "light"].forEach((r, li) => {
		const s1 = rnd() * 6, s2 = rnd() * 6, s3 = rnd() * 6;
		const yAt = (px, wob) => h * r.y + h * r.amp * (0.6 * Math.sin(px / w * 5.1 + s1) + 0.32 * Math.sin(px / w * 11.7 + s2) + 0.18 * Math.sin(px / w * 27 + s3)) + wob;
		// two wash passes, slightly misregistered like layered paint
		for (let pass = 0; pass < 2; pass++) {
			const dy = pass * 3 - 1.5;
			x.beginPath();
			x.moveTo(0, h);
			for (let px = 0; px <= w + 8; px += 8) x.lineTo(px, yAt(px, dy + (rnd() - 0.5) * 1.4));
			x.lineTo(w, h);
			x.closePath();
			const g = x.createLinearGradient(0, h * (r.y - r.amp), 0, h);
			g.addColorStop(0, r.top);
			g.addColorStop(1, r.bot);
			x.globalAlpha = pass ? 0.55 : 0.8;
			x.fillStyle = g;
			x.fill();
		}
		x.globalAlpha = 1;
		// pigment pooled along the top edge
		x.lineWidth = 1.6;
		x.strokeStyle = r.edge;
		x.beginPath();
		for (let px = 0; px <= w + 8; px += 6) {
			const py = yAt(px, -1 + (rnd() - 0.5) * 0.9);
			px ? x.lineTo(px, py) : x.moveTo(px, py);
		}
		x.stroke();
		// wet blooms: pale pigment dropped into the wash
		for (let b = 0; b < 5; b++) {
			const bx = rnd() * w, by = yAt(bx, 0) + 22 + rnd() * 40, br = 40 + rnd() * 70;
			const g = x.createRadialGradient(bx, by, 0, bx, by, br);
			g.addColorStop(0, `rgba(${r.bloom[0]},${r.bloom[1]},${r.bloom[2]},${dark ? 0.1 : 0.22})`);
			g.addColorStop(1, `rgba(${r.bloom[0]},${r.bloom[1]},${r.bloom[2]},0)`);
			x.fillStyle = g;
			x.save();
			x.beginPath();
			x.moveTo(0, h);
			for (let px = 0; px <= w + 8; px += 8) x.lineTo(px, yAt(px, 0));
			x.lineTo(w, h);
			x.clip();
			x.fillRect(bx - br, by - br, br * 2, br * 2);
			x.restore();
		}
		void li;
	});
}


/** Mounts the calm top aurora and the watercolor footer. Returns { pt, dark }. */
export function mountBase({ root, reducedMotion, d }) {
	const dark = isDark();
	const pt = pointer(d, () => loops.forEach((l) => l.wake()));
	const loops = [];
	const SLOW = 3; // every time constant is 3x slower than the #317 header

	/* ---- top aurora: hugs the top edge, hangs ~10% of the viewport at most ---- */
	const host = root.querySelector(".scenery-b");
	if (host) {
		const cv = document.createElement("canvas");
		cv.className = "rw-top";
		host.append(cv);
		d.add(() => cv.remove());
		const A = dark ? 0.03 : 0.05; // ~57% of #317
		const paint = pigmentPainter({ dark, A, bands: 3, seed: 17 });
		const ctx = cv.getContext("2d");
		const SC = 0.4;
		let W = 0, H = 0, Hv = 0;
		const fit = () => {
			const r = host.getBoundingClientRect();
			W = r.width; Hv = r.height; H = Math.round(Hv * 0.16);
			cv.width = Math.round(W * SC); cv.height = Math.round(H * SC);
			cv.style.width = `${W}px`; cv.style.height = `${H}px`;
		};
		fit();
		d.on(window, "resize", () => { fit(); lp.wake(); }, { passive: true });
		let t = 0, lx = 0, ly = 0, e = 0;
		const kf = 1 - Math.exp(-0.05 / 1.0); // ~1.0 s follow time constant at 20 fps
		const ke = 1 - Math.exp(-0.05 / 0.8);
		const draw = () => {
			const r = host.getBoundingClientRect();
			const tx = pt.has ? clamp(pt.x - r.left, -50, W + 50) : W * 0.5;
			const ty = pt.has ? clamp(pt.y - r.top, 0, Hv * 0.08) + Hv * 0.012 : Hv * 0.022;
			lx += (tx - lx) * kf; ly += (ty - ly) * kf; e += (pt.energy - e) * ke;
			paint(ctx, SC, {
				w: W, t: t / SLOW, lx, ly, energy: e, hasPtr: pt.has, wd: [170, 120],
				base: (u, b, ph, s) => Hv * (0.012 + b * 0.007) + Hv * 0.012 * Math.sin(u * 3.2 + s[0] + ph * 0.55) + Hv * 0.007 * Math.sin(u * 7.1 + s[1] - ph * 0.8),
				hg: (u, b) => Hv * (0.085 + 0.02 * Math.sin(u * 5 + b)),
			});
			// feather the lower edge so no curtain ends in a line: full strength to ~3%, gone by ~11% of the viewport
			ctx.globalCompositeOperation = "destination-in";
			const fade = ctx.createLinearGradient(0, 0, 0, H * SC);
			const f0 = Math.min(1, (Hv * 0.03) / H), f1 = Math.min(1, (Hv * 0.11) / H);
			fade.addColorStop(0, "#000"); fade.addColorStop(f0, "#000"); fade.addColorStop(f1, "rgba(0,0,0,0)");
			ctx.fillStyle = fade; ctx.fillRect(0, 0, cv.width, cv.height);
			ctx.globalCompositeOperation = "source-over";
			return Math.abs(tx - lx) > 0.5 || Math.abs(ty - ly) > 0.5 || Math.abs(e - pt.energy) > 0.004;
		};
		const lp = loop(
			(dt) => {
				t += dt;
				const moving = draw();
				pt.decay(dt * 0.55); // energy decays over ~2.5 s
				return reducedMotion ? moving || pt.energy > 0 : true;
			},
			{ fps: 20, el: cv, d },
		);
		loops.push(lp);
		draw();
		cv.classList.add("is-ready");
		lp.wake();
		let raf = 0;
		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(() => { raf = 0; cv.style.transform = `translate3d(0,${-root.scrollTop}px,0)`; });
		};
		root.addEventListener("scroll", onScroll, { passive: true });
		d.add(() => { root.removeEventListener("scroll", onScroll); cancelAnimationFrame(raf); });
	}

	/* ---- footer: painted ridges + pigment aurora on paper ---- */
	const footer = root.querySelector(".site-footer");
	if (footer) {
		const deco = document.createElement("div");
		deco.className = "rfw";
		const sky = document.createElement("canvas");
		sky.className = "rfw-sky";
		const ridges = document.createElement("canvas");
		deco.append(sky, ridges);
		footer.prepend(deco);
		d.add(() => deco.remove());
		fullBleed(root, footer, deco, d);

		const SC = 0.35;
		const paint = pigmentPainter({ dark, A: dark ? 0.06 : 0.09, bands: 4, seed: 9 });
		const ctx = sky.getContext("2d");
		let W = 0, H = 0, built = false, live = false;
		const build = () => {
			W = deco.clientWidth; H = deco.clientHeight;
			if (!W || !H) return;
			sky.width = Math.round(W * SC); sky.height = Math.round(H * SC);
			paintRidges(ridges, W, H, dark);
			ridges.classList.add("is-ready");
			built = true;
			draw();
			sky.classList.add("is-ready");
		};
		let t = 0, lx = 0, ly = 0, e = 0;
		const draw = () => {
			if (!built) return false;
			const r = deco.getBoundingClientRect();
			const tx = pt.has ? clamp(pt.x - r.left, -50, W + 50) : W * 0.55;
			const ty = pt.has ? clamp(pt.y - r.top, H * 0.1, H * 0.6) : H * 0.4;
			lx += (tx - lx) * 0.08; ly += (ty - ly) * 0.08; e += (pt.energy - e) * 0.1;
			paint(ctx, SC, {
				w: W, t: t + 3, lx, ly, energy: e, hasPtr: pt.has, wd: [150, 110],
				base: (u, b, ph, s) => H * (0.5 - b * 0.03) + H * 0.05 * Math.sin(u * 3.4 + s[0] + ph * 0.55) + H * 0.025 * Math.sin(u * 7.3 + s[1] - ph * 0.8),
				hg: (u, b) => H * (0.5 + 0.1 * Math.sin(u * 4.3 + b * 1.3)),
			});
			return Math.abs(tx - lx) > 0.5 || Math.abs(ty - ly) > 0.5 || Math.abs(e - pt.energy) > 0.004;
		};
		const lp = loop(
			(dt) => {
				if (!live) return false;
				t += dt;
				const moving = draw();
				pt.decay(dt);
				return reducedMotion ? moving || pt.energy > 0 : true;
			},
			{ fps: 20, el: deco, d },
		);
		loops.push(lp);
		const g = grainLayer(deco, "rp-grain rfw-grain", dark, 317);
		d.add(g.cancel);
		const cancelIdle = idle(build);
		d.add(cancelIdle);
		let rt = 0;
		const ro = new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => built && build(), 120); });
		ro.observe(deco);
		d.add(() => { ro.disconnect(); clearTimeout(rt); });
		whenVisible(root, footer, (v) => { live = v; if (v) { lp.wake(); } }, d);
	}
	return { pt, dark };
}

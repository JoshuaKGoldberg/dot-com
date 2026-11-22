// _vs3/portrait.js: the hero portrait on a canvas: the photo's background at 70% opacity, Josh at 100%
// (via assets/josh-mask.png), a soft rim glow that follows his silhouette (a one-off blur of the mask, build time only),
// and an aurora color shift that plays across the photo's background only, never his face.
//   bgFx: "drift" | "sweep" | "cursor" | "breathe" | "follow" (hue follows the cursor's x like the header) | null
import { isDark } from "../_refined-e/kit.js";

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export function vsPortrait(root, { bgAlpha = 0.7, glow = 0.5, bgFx = null, reduced = false } = {}) {
	const pic = root.querySelector(".site-portrait");
	if (!pic) return () => {};
	const dark = isDark();
	const img = pic.querySelector(dark ? ".site-portrait-dark" : ".site-portrait-light");
	if (!img) return () => {};
	let canvas = null, dead = false, raf = 0, io = null, onMove = null, onVis = null;
	const base = new URL("../../assets/", import.meta.url).href;
	Promise.all([load(img.currentSrc || img.src), load(base + "josh-mask.png")]).then(([photo, mask]) => {
		if (dead) return;
		const N = 256, S = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1))) * N;
		const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return [c, c.getContext("2d")]; };
		// mask -> alpha channel
		const [mc, mg] = mk();
		mg.drawImage(mask, 0, 0, S, S);
		const d = mg.getImageData(0, 0, S, S);
		for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
		mg.putImageData(d, 0, 0);
		// person only
		const [pc, pg] = mk();
		pg.drawImage(photo, 0, 0, S, S);
		pg.globalCompositeOperation = "destination-in"; pg.drawImage(mc, 0, 0);
		// rim glow: blurred silhouette, tinted once
		const [gc, gg] = mk();
		gg.filter = `blur(${S * 0.035}px)`; gg.drawImage(mc, 0, 0); gg.filter = "none";
		gg.globalCompositeOperation = "source-in";
		const gr = gg.createLinearGradient(0, 0, S, S);
		if (dark) { gr.addColorStop(0, "rgb(120,255,205)"); gr.addColorStop(0.55, "rgb(120,190,255)"); gr.addColorStop(1, "rgb(190,150,255)"); }
		else { gr.addColorStop(0, "rgb(255,255,255)"); gr.addColorStop(1, "rgb(235,225,255)"); }
		gg.fillStyle = gr; gg.fillRect(0, 0, S, S);
		// background only: the photo minus Josh
		const [bc, bg] = mk();
		bg.drawImage(photo, 0, 0, S, S);
		bg.globalCompositeOperation = "destination-out"; bg.drawImage(mc, 0, 0);
		const [tc, tg] = mk(); // scratch for the tinted background
		// final
		canvas = document.createElement("canvas");
		canvas.className = "vs-portrait"; canvas.width = canvas.height = S;
		canvas.setAttribute("aria-hidden", "true");
		const g = canvas.getContext("2d");
		g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 6.2832); g.clip();
		const P = { x: 0.5, y: 0.5, near: 0, tx: 0.5, tn: 0 };
		const hueAt = (t) => {
			switch (bgFx) {
				case "drift": return 165 + 70 * Math.sin(t * 0.16) + 25 * Math.sin(t * 0.07 + 1);
				case "breathe": return 175 + 40 * Math.sin(t * 0.11);
				case "cursor": return 160 + 140 * P.x;
				case "follow": return 150 + 150 * P.x;
				default: return 180;
			}
		};
		const strength = (t) => {
			const k = dark ? 1 : 0.7;
			switch (bgFx) {
				case "drift": return 0.34 * k;
				case "sweep": return 0.4 * k;
				case "breathe": return (0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t * 0.23))) * k;
				case "cursor": return (0.12 + 0.36 * P.near) * k;
				case "follow": return (0.2 + 0.2 * P.near) * k;
				default: return 0;
			}
		};
		const render = (t) => {
			g.clearRect(0, 0, S, S);
			// background, color-shifted (hue blend restricted to the background's own pixels)
			tg.globalCompositeOperation = "copy"; tg.drawImage(bc, 0, 0);
			const a = bgFx ? strength(t) : 0;
			if (a > 0.003) {
				tg.globalCompositeOperation = "source-atop";
				tg.globalAlpha = a;
				if (bgFx === "sweep") {
					// a soft aurora band drifting diagonally across the background
					const u = ((t * 0.03) % 1.6) - 0.3;
					const gr = tg.createLinearGradient(S * (u - 0.5), 0, S * (u + 0.5), S);
					gr.addColorStop(0, "hsla(160,85%,55%,0)"); gr.addColorStop(0.4, "hsl(165,85%,55%)");
					gr.addColorStop(0.6, "hsl(265,75%,62%)"); gr.addColorStop(1, "hsla(300,70%,60%,0)");
					tg.globalCompositeOperation = "color"; tg.fillStyle = gr; tg.fillRect(0, 0, S, S);
				} else {
					tg.globalCompositeOperation = "color";
					tg.fillStyle = `hsl(${hueAt(t).toFixed(1)},80%,55%)`; tg.fillRect(0, 0, S, S);
				}
				// keep the tint inside the background's alpha
				tg.globalAlpha = 1; tg.globalCompositeOperation = "destination-in"; tg.drawImage(bc, 0, 0);
			}
			g.globalAlpha = bgAlpha; g.drawImage(tc, 0, 0);
			g.globalAlpha = glow * (dark ? 0.55 : 0.7); g.drawImage(gc, 0, 0);
			g.globalAlpha = 1; g.drawImage(pc, 0, 0);
		};
		render(0);
		pic.appendChild(canvas); pic.classList.add("vs-fx");
		if (!bgFx || reduced) return;
		// slow loop (~15 fps) only while the portrait is on screen and the tab is visible
		let vis = true, last = 0;
		const t0 = performance.now();
		const frame = (now) => {
			raf = 0;
			if (dead || !vis || document.hidden) return;
			if (now - last > 66) {
				last = now;
				P.x += (P.tx - P.x) * 0.06; P.near += (P.tn - P.near) * 0.05;
				render((now - t0) / 1000);
			}
			raf = requestAnimationFrame(frame);
		};
		const wake = () => { if (!raf && !dead && vis && !document.hidden) raf = requestAnimationFrame(frame); };
		io = new IntersectionObserver((es) => { vis = es[0].isIntersecting; wake(); });
		io.observe(canvas);
		onMove = (e) => {
			const r = canvas.getBoundingClientRect();
			P.tx = Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
			const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
			P.tn = Math.max(0, 1 - d / (r.width * 1.6));
		};
		if (bgFx === "cursor" || bgFx === "follow") addEventListener("pointermove", onMove, { passive: true });
		onVis = () => wake();
		document.addEventListener("visibilitychange", onVis);
		wake();
	}).catch(() => {});
	return () => {
		dead = true; cancelAnimationFrame(raf); io?.disconnect();
		if (onMove) removeEventListener("pointermove", onMove);
		if (onVis) document.removeEventListener("visibilitychange", onVis);
		canvas?.remove(); pic.classList.remove("vs-fx");
	};
}

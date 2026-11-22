import { isDark, trackPointer, topWash } from "./_quiet-b/kit.js";

const rng = (seed) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

export function activate({ root, reducedMotion }) {
	if (!isDark()) return; // light mode is the plain site
	const layer = root.querySelector(".site-scenery");
	const overlay = root.querySelector(".site-overlay");
	const ptr = trackPointer(() => wash.wake());
	const wash = topWash(layer.querySelector(".scenery-a"), { dark: true, height: 90, alpha: 0.3, reduced: reducedMotion, ptr });

	// Sparse stars, only in the side margins.
	const host = document.createElement("div");
	host.className = "qa-stars";
	overlay.querySelector(".overlay-a").appendChild(host);
	let stars = [], constellation = null, shooter = null, timer = 0, raf = 0;

	const build = () => {
		host.textContent = "";
		stars = [];
		const W = overlay.clientWidth, H = overlay.clientHeight;
		const page = root.querySelector(".site-page");
		const pr = page.getBoundingClientRect(), or = overlay.getBoundingClientRect();
		const left = pr.left - or.left + 24, right = pr.right - or.left - 24; // content edge (minus padding)
		const mL = left - 20, mR = W - right - 20;
		if (Math.max(mL, mR) < 70) return; // narrow: no margins, no stars
		const r = rng(265);
		const n = Math.round(Math.min(26, (mL + mR) * H / 42000));
		for (let i = 0; i < n; i++) {
			const sideL = mL >= 70 && (mR < 70 || r() < mL / (mL + mR));
			const x = sideL ? 10 + r() * (mL - 20) : right + 30 + r() * (mR - 20);
			const y = 24 + r() * (H - 60);
			const star = document.createElement("i");
			const size = 1 + (r() < 0.2 ? 1 : 0);
			star.style.cssText = `left:${x}px;top:${y}px;--s:${size}px;--o:${(0.35 + r() * 0.4).toFixed(2)};--d:${(5 + r() * 7).toFixed(1)}s;--dl:${(-r() * 9).toFixed(1)}s`;
			star.innerHTML = "<b></b>";
			host.appendChild(star);
			stars.push({ el: star, x, y });
		}
		// A small constellation in the right margin; its lines draw in when the pointer comes near.
		if (mR >= 100) {
			const cx = right + 30 + (mR - 90) / 2, cy = H * 0.58;
			const pts = [[0, 14], [18, 36], [40, 20], [60, 42], [84, 12]];
			const ns = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(ns, "svg");
			svg.setAttribute("viewBox", "-6 0 96 50");
			svg.setAttribute("class", "qa-constellation");
			svg.style.cssText = `left:${cx}px;top:${cy}px`;
			const line = document.createElementNS(ns, "polyline");
			line.setAttribute("points", pts.map((p) => p.join(",")).join(" "));
			line.setAttribute("pathLength", "1");
			svg.appendChild(line);
			for (const [px, py] of pts) {
				const c = document.createElementNS(ns, "circle");
				c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("r", 1.4);
				svg.appendChild(c);
			}
			host.appendChild(svg);
			constellation = { el: svg, x: cx + 45, y: cy + 25 };
		} else constellation = null;
	};

	let pending = false;
	const update = () => {
		pending = false;
		if (!ptr.has) { for (const s of stars) s.el.style.setProperty("--b", 0); constellation?.el.classList.remove("is-near"); return; }
		const or = overlay.getBoundingClientRect();
		const px = ptr.x - or.left, py = ptr.y - or.top;
		for (const s of stars) {
			const d = Math.hypot(s.x - px, s.y - py);
			s.el.style.setProperty("--b", Math.max(0, 1 - d / 190).toFixed(2));
		}
		if (constellation) constellation.el.classList.toggle("is-near", Math.hypot(constellation.x - px, constellation.y - py) < 170);
	};
	const onMove = () => { if (!pending && stars.length) { pending = true; raf = requestAnimationFrame(update); } };
	window.addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onMove);

	const ro = new ResizeObserver(() => build());
	ro.observe(overlay);
	build();

	// A rare, faint shooting star across a margin.
	const shoot = () => {
		timer = window.setTimeout(shoot, 30000 + Math.random() * 30000);
		if (document.hidden || reducedMotion || !stars.length) return;
		const s = stars[Math.floor(Math.random() * stars.length)];
		shooter?.remove();
		shooter = document.createElement("u");
		shooter.className = "qa-shooter";
		shooter.style.cssText = `left:${s.x}px;top:${Math.min(s.y, overlay.clientHeight * 0.5)}px`;
		host.appendChild(shooter);
		shooter.addEventListener("animationend", () => { shooter?.remove(); shooter = null; }, { once: true });
	};
	timer = window.setTimeout(shoot, 9000);

	return () => {
		clearTimeout(timer);
		cancelAnimationFrame(raf);
		ro.disconnect();
		window.removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onMove);
		ptr.destroy();
		wash.destroy();
		host.remove();
	};
}

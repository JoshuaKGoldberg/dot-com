import { createJourney, clamp } from "./_scroll/lib.js";

/** A page-curl band that sweeps up the page as each new section's leaf is turned into view. */
export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const sections = [".site-posts", ".site-projects", ".site-talks", ".site-footer"].map((s) => root.querySelector(s)).filter(Boolean);
	const page = root.querySelector(".site-page");
	const journey = createJourney(root, {
		layer: ".overlay-a",
		reducedMotion,
		dark,
		scale: 1,
		maxDpr: 1.25,
		follow: 40,
		draw(S) {
			const c = S.ctx;
			c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
			c.clearRect(0, 0, S.cssW, S.cssH);
			if (reducedMotion) return;
			const pr = page.getBoundingClientRect();
			const top0 = root.getBoundingClientRect().top;
			const x0 = pr.left;
			const w = pr.width;
			for (const el of sections) {
				const y = el.getBoundingClientRect().top - top0 - 52;
				const ct = clamp((S.cssH * 0.96 - y) / (S.cssH * 0.62));
				if (ct <= 0 || ct >= 1) continue;
				const r = 10 + 30 * Math.sin(Math.PI * ct);
				const tilt = (1 - ct) * 26 - 8;
				const e = Math.sin(Math.PI * ct);
				c.save();
				c.beginPath();
				c.rect(x0, 0, w, S.cssH);
				c.clip();
				c.translate(x0 + w / 2, y);
				c.rotate((tilt / w) * 0.9);
				c.translate(-w / 2, 0);
				const paper = dark ? [58, 52, 46] : [247, 241, 227];
				// shadow cast onto the new page
				let g = c.createLinearGradient(0, r, 0, r + 60);
				g.addColorStop(0, `rgba(0,0,0,${0.2 * e + 0.03})`);
				g.addColorStop(1, "rgba(0,0,0,0)");
				c.fillStyle = g;
				c.fillRect(-20, r, w + 40, 60);
				// cylinder of the curling leaf
				g = c.createLinearGradient(0, -r, 0, r);
				const hi = dark ? "rgba(170,160,140," : "rgba(255,253,246,";
				g.addColorStop(0, `rgba(${paper[0] - 40},${paper[1] - 40},${paper[2] - 40},1)`);
				g.addColorStop(0.28, hi + "1)");
				g.addColorStop(0.55, `rgba(${paper[0] - 22},${paper[1] - 22},${paper[2] - 22},1)`);
				g.addColorStop(1, `rgba(${paper[0] - 90},${paper[1] - 90},${paper[2] - 90},1)`);
				c.fillStyle = g;
				c.fillRect(-20, -r, w + 40, r * 2);
				// back of the lifted leaf, fading out so the old text stays legible
				g = c.createLinearGradient(0, -r, 0, -r - 120 * e - 20);
				g.addColorStop(0, `rgba(${paper[0] - 14},${paper[1] - 14},${paper[2] - 14},0.96)`);
				g.addColorStop(1, `rgba(${paper[0] - 14},${paper[1] - 14},${paper[2] - 14},0)`);
				c.fillStyle = g;
				c.fillRect(-20, -r - 120 * e - 20, w + 40, 120 * e + 20);
				c.restore();
			}
		},
	});
	return () => journey.destroy();
}

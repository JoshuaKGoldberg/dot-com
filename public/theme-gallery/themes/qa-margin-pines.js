import { createPainter, createPointer, createLoop, mk, onSize, seeded } from "./_quiet-a/kit.js";

const NS = "http://www.w3.org/2000/svg";

function pinePath(x, base, h, w) {
	// A slim, tiered conifer silhouette.
	const tiers = 5;
	let r = `M${x},${base - h}`;
	for (let k = 1; k <= tiers; k++) {
		const y = base - h + (h * 0.88 * k) / tiers;
		const ww = (w * (0.35 + 0.65 * k / tiers)) / 2;
		r += ` L${x + ww},${y} L${x + ww * 0.4},${y - 2}`;
	}
	r += ` L${x + 1.5},${base} L${x - 1.5},${base}`;
	for (let k = tiers; k >= 1; k--) {
		const y = base - h + (h * 0.88 * k) / tiers;
		const ww = (w * (0.35 + 0.65 * k / tiers)) / 2;
		r += ` L${x - ww * 0.4},${y - 2} L${x - ww},${y}`;
	}
	return r + "Z";
}

export function activate({ root, mode, reducedMotion }) {
	const page = root.querySelector(".site-page");
	if (!page) return;
	const dark = mode === "dark" || document.documentElement.classList.contains("dark");
	// Fixed-looking layer: lives in the (fixed) scenery so it never scrolls with text.
	const host = root.querySelector(".scenery-a") || root;
	const wrap = mk("div", "qa-pines", host);
	wrap.setAttribute("aria-hidden", "true");
	const cols = [];
	const ptr = createPointer(() => loops.forEach((l) => l.wake()));
	const loops = [];

	for (const side of ["l", "r"]) {
		const col = mk("div", "qa-col", wrap);
		const canvas = mk("canvas", "", col);
		const svg = document.createElementNS(NS, "svg");
		col.appendChild(svg);
		const painter = createPainter(canvas, {
			dark,
			profile: { c0: 0.62, amp: 0.05, sig: 0.3, fade: 0, fadeIn: 0.9, gain: 1, reach: 520, pullX: 0.5, rays: 0.5, maxA: dark ? 0.4 : 0.24, seed: side === "l" ? 1 : 4 },
		});
		const c = { side, col, canvas, svg, painter, back: null, front: null };
		const loop = createLoop(col, (t) => painter.draw(t, canvas.getBoundingClientRect(), ptr), { fps: 20, reduced: reducedMotion, ptr });
		loops.push(loop);
		c.loop = loop;
		cols.push(c);
	}

	const build = () => {
		const total = root.clientWidth;
		const vh = root.clientHeight || innerHeight;
		const contentW = Math.min(page.clientWidth, 832);
		const margin = (total - contentW) / 2;
		const avail = margin - 28;
		wrap.hidden = avail < 90;
		wrap.style.height = `${vh}px`;
		if (wrap.hidden) return;
		const cw = Math.min(avail, 260);
		cols.forEach((c, i) => {
			c.col.style.width = `${cw}px`;
			c.col.style.left = i === 0 ? `${Math.max(8, margin - 28 - cw)}px` : "";
			c.col.style.right = i === 1 ? `${Math.max(8, margin - 28 - cw)}px` : "";
			c.col.style.left = i === 0 ? c.col.style.left : "auto";
			const rnd = seeded(i ? 264 : 261);
			const svg = c.svg;
			svg.setAttribute("viewBox", `0 0 ${cw} ${vh * 0.5 + 90}`);
			svg.style.height = `${vh * 0.5 + 90}px`;
			svg.style.bottom = "0";
			svg.textContent = "";
			const base = vh * 0.5 + 90;
			c.layers = [];
			for (const [name, count, hmin, hmax, par] of [["back", Math.max(2, Math.round(cw / 70)), 0.22, 0.4, 0.03], ["front", Math.max(2, Math.round(cw / 100)), 0.16, 0.3, 0.07]]) {
				const g = document.createElementNS(NS, "g");
				g.setAttribute("class", `qa-layer qa-pine-${name}`);
				for (let k = 0; k < count; k++) {
										const h = vh * (hmin + rnd() * (hmax - hmin));
					const w = 26 + h * 0.07;
					const x = Math.min(cw - w / 2 - 6, Math.max(w / 2 + 6, ((k + 0.3 + rnd() * 0.5) / count) * cw));
					const p = document.createElementNS(NS, "path");
					p.setAttribute("d", pinePath(x, base, h + 90, w));
					p.setAttribute("class", "qa-sway");
					p.style.animationDelay = `${-rnd() * 9}s`;
					g.appendChild(p);
				}
				svg.appendChild(g);
				c.layers.push({ g, par });
			}
			c.painter.setSize(cw, vh * 0.54, 5);
			c.loop.once();
		});
		onScroll();
	};

	const onScroll = () => {
		const s = Math.min(root.scrollTop, 2000);
		for (const c of cols) for (const l of c.layers || []) l.g.style.transform = `translate3d(0,${-Math.min(70, s * l.par)}px,0)`;
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	const off = onSize([root], build);
	build();
	return () => {
		off();
		root.removeEventListener("scroll", onScroll);
		loops.forEach((l) => l.destroy());
		ptr.destroy();
		wrap.remove();
	};
}

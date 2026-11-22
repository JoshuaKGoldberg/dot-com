// Focus & Ribbon scenery that only exists at the edges: an aurora/ribbon band at the top (brightest at the top edge and
// outer corners, sweeping down the side margins), short spruce stands at the viewport sides, and a footer lake scene.
// Nothing here covers the content column and nothing paints the page background.
import { Flock, glowSprite, rng, clamp } from "../forest-kit/kit.js";
import { createAurora } from "./aurora.js";
import { createFooter, spruce } from "./footer.js";
import { paintMilky, paintStars } from "../_aurora-d/kit.js";

const ss = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
const BIRD = {
	dark: ["rgba(190,205,235,.5)", "rgba(200,214,240,.66)", "rgba(215,226,248,.82)"],
	light: ["rgba(52,70,92,.62)", "rgba(36,52,74,.78)", "rgba(20,32,50,.92)"],
};
const TREE = { dark: { far: "#1a2c5c", near: "#03060f" }, light: { far: "#6f94a4", near: "#27493f" } };

// Edge-weighted shaping of the art itself: strong at the top edge and corners, running down the side margins.
function weightCanvas(W, H, colHalf) {
	const gw = Math.ceil(W / 8), gh = Math.ceil(H / 8);
	const c = document.createElement("canvas");
	c.width = gw; c.height = gh;
	const x = c.getContext("2d");
	const img = x.createImageData(gw, gh);
	const m = clamp(colHalf / (W / 2), 0, 1.2) * 0.86;
	for (let j = 0; j < gh; j++) {
		const y = (j + 0.5) * 8;
		for (let i = 0; i < gw; i++) {
			const a = Math.abs(((i + 0.5) * 8 / W) * 2 - 1);
			const top = Math.pow(ss(1 - y / 190), 1.4) * (0.5 + 0.5 * Math.pow(a, 1.4));
			const side = m >= 1 ? 0 : ss((a - m) / (1 - m)) * ss(1 - y / H);
			img.data[(j * gw + i) * 4 + 3] = Math.max(top, 0.92 * side) * 255;
		}
	}
	x.putImageData(img, 0, 0);
	return c;
}

export function createEdges({ root, reducedMotion }, opt) {
	const host = root.querySelector(".scenery-a");
	if (!host) return () => {};
	const isDark = () => document.documentElement.classList.contains("dark");
	let dark = isDark();
	const mk = (cls) => { const c = document.createElement("canvas"); c.className = `fr-edge ${cls}`; c.setAttribute("aria-hidden", "true"); host.appendChild(c); return c; };
	const skyC = mk("fr-edge-sky"), liveC = mk("fr-edge-live"), standL = mk("fr-edge-stand fr-edge-l"), standR = mk("fr-edge-stand fr-edge-r");
	const lx = liveC.getContext("2d");
	const dummy = document.createElement("canvas").getContext("2d");
	let W = 0, H = 0, Ht = 0, wt = null, aur = null, raf = 0, last = 0, dead = false, scrollY = 0, rzT = 0, stillRaf = 0;
	const ptr = { x: 0, y: 0, active: false };
	const swallows = opt.birds ? new Flock({ seed: 3, groups: 2, perGroup: [4, 7], size: [3.6, 6], band: [0.07, 0.15], speed: [46, 70], respawn: [2, 8], flap: [6, 9] }) : null;
	const geese = opt.birds ? new Flock({ seed: 8, groups: 1, perGroup: [5, 7], size: [6.5, 8], band: [0.05, 0.09], speed: [32, 40], formation: "v", respawn: [10, 24], flap: [2.4, 3] }) : null;

	function stands(c, side, seed, P) {
		const Ws = Math.round(clamp((W - 880) / 2 - 12, 0, 240) * (opt.standScale || 1));
		const Hs = Math.round(H * (opt.standHeight || 0.42));
		if (Ws < 50) { c.style.display = "none"; return; }
		c.style.display = "block";
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		c.width = Math.ceil(Ws * dpr); c.height = Math.ceil(Hs * dpr);
		c.style.width = Ws + "px"; c.style.height = Hs + "px";
		const x = c.getContext("2d");
		x.setTransform(dpr, 0, 0, dpr, 0, 0);
		const r = rng(seed);
		for (const [col, k, jit] of [[P.far, 0.72, 5], [P.near, 1, 0]]) {
			x.fillStyle = col;
			for (let d = -12 + jit; d < Ws; d += 8 + d * 0.13 + r() * 7) {
				const f = Math.pow(1 - d / Ws, 1.5);
				if (r() < 0.12 + 0.55 * (d / Ws)) continue;
				const hh = Hs * (0.1 + 0.9 * f) * (0.72 + 0.4 * r()) * k;
				const px = side === "l" ? d : Ws - d;
				x.fill(spruce(px, Hs + 3, hh, hh * 0.34 + 6, r));
			}
		}
	}

	function sky(P) {
		const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		skyC.width = Math.ceil(W * dpr); skyC.height = Math.ceil(Ht * dpr);
		skyC.style.width = W + "px"; skyC.style.height = Ht + "px";
		const x = skyC.getContext("2d");
		x.setTransform(dpr, 0, 0, dpr, 0, 0);
		x.clearRect(0, 0, W, Ht);
		if (opt.stars && dark) {
			const t = document.createElement("canvas");
			t.width = W; t.height = Ht;
			const tx = t.getContext("2d");
			if (opt.stars.milky) paintMilky(tx, W, Ht, { dark, strength: opt.stars.milky, seed: 5 });
			paintStars(tx, W, Ht * 0.95, { dark, count: opt.stars.count || 900, seed: 11, bright: opt.stars.bright || 24 });
			tx.globalCompositeOperation = "destination-in";
			tx.drawImage(wt, 0, 0, W, Ht);
			x.drawImage(t, 0, 0);
		}
		if (opt.moon) {
			const ms = opt.moon, mx = W - 74, my = 78;
			const g = glowSprite(256, dark ? [230, 238, 255] : [255, 238, 200], [dark ? 0.55 : 0.8, 0.18, 0]);
			x.drawImage(g, mx - 150 * ms, my - 150 * ms, 300 * ms, 300 * ms);
			x.fillStyle = dark ? "rgba(236,241,255,.92)" : "rgba(255,248,226,.95)";
			x.beginPath(); x.arc(mx, my, (dark ? 16 : 22) * ms, 0, Math.PI * 2); x.fill();
			if (dark) { x.fillStyle = "rgba(150,165,205,.35)"; for (const [dx, dy, rr] of [[-6, -4, 4], [5, 6, 3], [4, -8, 2.4]]) { x.beginPath(); x.arc(mx + dx * ms, my + dy * ms, rr * ms, 0, Math.PI * 2); x.fill(); } }
		}
	}

	function build() {
		W = host.clientWidth; H = host.clientHeight;
		if (!W || !H) return;
		dark = isDark();
		Ht = Math.round(H * 0.62);
		const P = TREE[dark ? "dark" : "light"];
		const pg = root.querySelector(".site-page");
		const colHalf = pg ? pg.getBoundingClientRect().width / 2 - 8 : 420;
		wt = weightCanvas(W, Ht, colHalf);
		liveC.width = W; liveC.height = Ht;
		liveC.style.width = W + "px"; liveC.style.height = Ht + "px";
		aur = createAurora({ scale: 5, ...opt.aurora, gain: (opt.aurora.gain || 1) * 1.9, style: "ribbon", bottom: 0.62, dark });
		aur.resize(W, H);
		stands(standL, "l", 11, P); stands(standR, "r", 29, P);
		sky(P);
		swallows?.resize(W, H); geese?.resize(W, H);
		applyScroll();
		tick(0.016);
	}

	function tick(dt) {
		if (!aur || !wt) return;
		const reduced = !!reducedMotion;
		aur.update(dt, { reduced, pointer: ptr });
		aur.draw(dummy, 0, 0, 1, 1);
		lx.setTransform(1, 0, 0, 1, 0, 0);
		lx.globalCompositeOperation = "source-over";
		lx.clearRect(0, 0, W, Ht);
		lx.imageSmoothingEnabled = true;
		lx.drawImage(aur.low, 0, 0, aur.low.width, aur.low.height, 0, 0, W, Ht);
		lx.globalCompositeOperation = "destination-in";
		lx.drawImage(wt, 0, 0, W, Ht);
		lx.globalCompositeOperation = "source-over";
		if (swallows && !reduced) {
			const env = { wind: 0.8, perches: [], pointer: ptr, w: W, h: H };
			swallows.update(dt, env); geese.update(dt, { wind: 0.8, perches: [] });
			swallows.draw(lx, BIRD[dark ? "dark" : "light"], {});
			geese.draw(lx, BIRD[dark ? "dark" : "light"]);
		}
	}

	function applyScroll() {
		const op = clamp(1 - scrollY / 400);
		skyC.style.opacity = liveC.style.opacity = op.toFixed(3);
		const vis = op > 0.01 ? "" : "hidden";
		skyC.style.visibility = liveC.style.visibility = vis;
	}
	function frame(now) {
		raf = 0;
		if (dead || document.hidden || scrollY > 400) return;
		if (now - last >= 32) { const dt = Math.min(0.1, (now - last) / 1000); last = now; tick(dt); }
		raf = requestAnimationFrame(frame);
	}
	function run() { if (!raf && !dead && !reducedMotion && !document.hidden && scrollY <= 400 && W) { last = performance.now(); raf = requestAnimationFrame(frame); } }
	function still() { if (stillRaf || !reducedMotion) return; stillRaf = requestAnimationFrame(() => { stillRaf = 0; tick(1); }); }

	const onMove = (e) => { ptr.x = e.clientX; ptr.y = e.clientY; ptr.active = true; still(); };
	const onLeave = () => { ptr.active = false; };
	const onScroll = () => { scrollY = root.scrollTop; applyScroll(); run(); };
	const onVis = () => { if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run(); };
	window.addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	root.addEventListener("scroll", onScroll, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	const ro = new ResizeObserver(() => { if (host.clientWidth === W && host.clientHeight === H) return; clearTimeout(rzT); rzT = setTimeout(() => { build(); run(); }, 160); });
	ro.observe(host);
	const mo = new MutationObserver(() => { if (isDark() !== dark) { build(); } });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	const footer = opt.footer ? createFooter(root, { ...opt.footer, reduced: !!reducedMotion }) : null;
	let hint = null;
	if (opt.hint) {
		const ov = root.querySelector(".overlay-b");
		hint = document.createElement("div");
		hint.className = "fk-hint";
		hint.textContent = opt.hint;
		ov?.appendChild(hint);
		setTimeout(() => hint?.classList.add("is-gone"), 9000);
	}
	build();
	run();

	return () => {
		dead = true;
		cancelAnimationFrame(raf); cancelAnimationFrame(stillRaf); clearTimeout(rzT);
		window.removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		root.removeEventListener("scroll", onScroll);
		document.removeEventListener("visibilitychange", onVis);
		ro.disconnect(); mo.disconnect();
		footer?.destroy();
		for (const c of [skyC, liveC, standL, standR]) c.remove();
		hint?.remove();
	};
}

/*
 * Focus scene, edge-only composition (Update 4). No masks, no cover layers, nothing
 * painting the page background:
 *  - top: the #244 focus aurora in a band hugging the top edge (fades out above the
 *    hero), with a small moon and a few stars; the whole band scrolls/fades away
 *    within ~400px
 *  - sides: soft aurora glow running a little down each outer edge, plus short, sparse
 *    spruce stands anchored to the bottom corners
 *  - the footer scene is separate (footer.js)
 */
import { createAurora } from "./aurora.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

const TREE = { dark: ["#0b1633", "#050a1d", "#02050f"], light: ["#7f9fb3", "#3d6a66", "#1d3a34"] };
const GLOW = {
	dark: [[90, 255, 170], [110, 150, 255], [190, 110, 255]],
	light: [[70, 200, 150], [120, 150, 230], [180, 130, 225]],
};

function spruce(c, x, base, h, w) {
	const n = Math.max(4, Math.round(h / 11)), st = h / n;
	c.beginPath(); c.moveTo(x, base - h);
	for (let k = 1; k <= n; k++) { const y = base - h + k * st, hw = w * (0.16 + 0.84 * (k / n)); c.lineTo(x + hw, y - st * 0.26); c.lineTo(x + hw * 0.5, y - st * 0.22); }
	c.lineTo(x + w * 0.08, base + 4); c.lineTo(x - w * 0.08, base + 4);
	for (let k = n; k >= 1; k--) { const y = base - h + k * st, hw = w * (0.16 + 0.84 * (k / n)); c.lineTo(x - hw * 0.5, y - st * 0.22); c.lineTo(x - hw, y - st * 0.26); }
	c.closePath(); c.fill();
}

export function createScene({ root, reducedMotion, aurora, edge = 0.6, trees = 1, hint }) {
	const host = root.querySelector(".scenery-a") || root;
	const wrap = document.createElement("div");
	wrap.className = "fr-topwrap";
	const mk = (cls, parent) => { const c = document.createElement("canvas"); c.className = cls; c.setAttribute("aria-hidden", "true"); parent.appendChild(c); return c; };
	const sky = mk("fr-sky", wrap), band = mk("fr-band", wrap);
	host.appendChild(wrap);
	const side = mk("fr-side", host);
	const bx = band.getContext("2d"), sx = side.getContext("2d");
	let dark = document.documentElement.classList.contains("dark");
	let aur = null, W = 0, H = 0, dpr = 1, treeL = null, raf = 0, last = 0, scrollY = 0, t = 0, glowT = 0;
	const pointer = { active: false, x: -1e4, y: -1e4 };
	const state = { reduced: reducedMotion, pointer, scrollY: 0 };
	const hintEl = hint ? Object.assign(document.createElement("div"), { className: "fr-hint", textContent: hint }) : null;
	if (hintEl) (root.querySelector(".overlay-b") || root).appendChild(hintEl);
	const hintTimer = hintEl ? setTimeout(() => hintEl.classList.add("is-gone"), 9000) : 0;

	function build() {
		const sr = root.getBoundingClientRect();
		W = Math.max(320, Math.round(sr.width)); H = Math.max(320, Math.round(sr.height));
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		side.width = Math.round(W * dpr); side.height = Math.round(H * dpr);
		aur = createAurora({ ...aurora, dark });
		aur.resize(W, H);
		band.width = Math.max(8, Math.ceil(W / (aurora.scale || 5)));
		band.height = Math.max(8, Math.round(aur.height / (aurora.scale || 5)));
		band.style.height = `${aur.height}px`;
		// static sky strip: moon at the top-right corner, a few stars hugging the top edge
		sky.width = Math.round(W * dpr); sky.height = Math.round(170 * dpr);
		const s = sky.getContext("2d"); s.setTransform(dpr, 0, 0, dpr, 0, 0);
		const r = rng(11);
		if (dark) for (let i = 0; i < 46; i++) { const x = r() * W, y = Math.pow(r(), 1.8) * 120; s.fillStyle = `rgba(225,232,255,${0.25 + r() * 0.5})`; s.fillRect(x, y, 1.2, 1.2); }
		const mxp = W - 64, myp = 54;
		const mg = s.createRadialGradient(mxp, myp, 3, mxp, myp, 54);
		mg.addColorStop(0, dark ? "rgba(190,215,255,.5)" : "rgba(255,244,214,.75)"); mg.addColorStop(1, "rgba(190,215,255,0)");
		s.fillStyle = mg; s.fillRect(mxp - 60, myp - 60, 120, 120);
		s.fillStyle = dark ? "rgba(236,241,255,.95)" : "rgba(255,248,226,.95)";
		s.beginPath(); s.arc(mxp, myp, dark ? 9 : 13, 0, 6.2832); s.fill();
		// small spruce stands anchored to the bottom corners; they never reach toward the middle
		const SW = Math.min(190, W * 0.15);
		treeL = document.createElement("canvas"); treeL.width = Math.round(SW * dpr); treeL.height = Math.round(H * 0.34 * dpr);
		const c = treeL.getContext("2d"); c.setTransform(dpr, 0, 0, dpr, 0, 0);
		const rt = rng(77), T = TREE[dark ? "dark" : "light"], th = H * 0.34;
		const n = Math.round(11 * trees) + 2;
		const items = [];
		for (let i = 0; i < n; i++) { const u = Math.pow(rt(), 1.2); items.push({ u, hh: th * (0.22 + 0.78 * Math.pow(1 - u, 1.6)) * (0.8 + rt() * 0.3), l: i % 3 }); }
		items.sort((p, q) => q.l - p.l);
		for (const it of items) { c.fillStyle = T[it.l]; if (it.hh < th * 0.14) continue; spruce(c, it.u * SW, th + 6 - it.l * 4, it.hh, it.hh * 0.2); }
		aur.refresh(); drawAll();
	}

	function glow(x0, dir) {
		const G = GLOW[dark ? "dark" : "light"], e = aur?.state().energy || 0;
		const a = edge * (0.75 + 0.5 * e) * (dark ? 0.55 : 0.4);
		const sw = 95 + 20 * Math.sin(glowT * 0.4 + x0), ry = H * (0.17 + 0.03 * Math.sin(glowT * 0.3 + dir));
		sx.save(); sx.translate(x0, 0); sx.scale(dir, 1);
		sx.globalCompositeOperation = dark ? "lighter" : "source-over";
		[[0, 0.0, 1.0], [1, 0.26, 0.6], [2, 0.12, 0.45]].forEach(([ci, cy, k]) => {
			const col = G[(ci + (dir > 0 ? 0 : 1)) % 3];
			sx.save(); sx.translate(0, H * cy * 0.45); sx.scale(1, ry / sw);
			const g = sx.createRadialGradient(0, 0, 0, 0, 0, sw);
			g.addColorStop(0, `rgba(${col},${a * k})`); g.addColorStop(0.5, `rgba(${col},${a * k * 0.35})`); g.addColorStop(1, `rgba(${col},0)`);
			sx.fillStyle = g; sx.fillRect(-sw, -sw * 1.2, sw * 2, sw * 2.4); sx.restore();
		});
		sx.restore();
	}

	function drawAll() {
		if (!aur) return;
		state.scrollY = scrollY;
		bx.clearRect(0, 0, band.width, band.height);
		bx.drawImage(aur.low, 0, 0);
		sx.setTransform(dpr, 0, 0, dpr, 0, 0);
		sx.clearRect(0, 0, W, H);
		sx.globalCompositeOperation = "source-over";
		glow(0, 1); glow(W, -1);
		sx.globalCompositeOperation = "source-over";
		if (treeL) {
			const tw = treeL.width / dpr, th = treeL.height / dpr;
			sx.drawImage(treeL, 0, H - th, tw, th);
			sx.save(); sx.translate(W, 0); sx.scale(-1, 1); sx.drawImage(treeL, 0, H - th, tw, th); sx.restore();
		}
	}

	function applyScroll() {
		const f = clamp(1 - scrollY / 380);
		wrap.style.opacity = f.toFixed(3);
		wrap.style.transform = `translate3d(0,${(-scrollY * 0.5).toFixed(1)}px,0)`;
		const rem = root.scrollHeight - root.clientHeight - scrollY;
		side.style.opacity = clamp(rem / 350).toFixed(3);
		wrap.style.visibility = f <= 0 ? "hidden" : "visible";
	}

	function tick(now) {
		raf = requestAnimationFrame(tick);
		if (document.hidden) return;
		const dt = last ? Math.min(0.1, (now - last) / 1000) : 0.016;
		last = now; glowT += dt;
		aur.update(dt, state);
		if (aur.refresh()) drawAll();
	}

	const onMove = (e) => { const r = root.getBoundingClientRect(); pointer.active = true; pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; if (reducedMotion) { aur.update(1, state); aur.refresh(); drawAll(); } };
	const onLeave = () => { pointer.active = false; };
	const onScroll = () => { scrollY = root.scrollTop; applyScroll(); };
	window.addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", onLeave);
	root.addEventListener("scroll", onScroll, { passive: true });
	const rebuild = () => { cancelAnimationFrame(raf); build(); applyScroll(); if (!reducedMotion) raf = requestAnimationFrame(tick); };
	const ro = new ResizeObserver(rebuild); ro.observe(root);
	const mo = new MutationObserver(() => { dark = document.documentElement.classList.contains("dark"); rebuild(); });
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

	return {
		getAurora: () => aur,
		destroy() {
			cancelAnimationFrame(raf); clearTimeout(hintTimer);
			window.removeEventListener("pointermove", onMove); document.documentElement.removeEventListener("pointerleave", onLeave); root.removeEventListener("scroll", onScroll);
			ro.disconnect(); mo.disconnect(); wrap.remove(); side.remove(); hintEl?.remove();
		},
	};
}

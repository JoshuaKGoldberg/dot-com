import { isDark, auroraAt, rgba, createLoop, makeCanvas, sizeCanvas, idle, onResize } from "./_quiet-e/kit.js";

const LIFE = 900; // ms
const MAX_PTS = 40;
// Only these structural containers count as "empty space"; everything else (p, a, h1, img, span, li...) is text.
const EMPTY = new Set(["DIV", "SECTION", "MAIN", "UL", "OL", "HEADER", "FOOTER", "NAV", "PICTURE", "HTML", "BODY"]);

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const overlay = root.querySelector(".site-overlay") || root;
	let canvas, ctx, W = 0, H = 0, dead = false;
	let pts = [];
	let lastX = 0, lastY = 0, hasLast = false, pending = null;

	const isText = (x, y) => {
		const el = document.elementFromPoint(x, y);
		if (!el || !root.contains(el)) return true; // gallery chrome etc.
		if (!EMPTY.has(el.tagName)) return true;
		return /site-(socials|hero-text|portrait|nav)\b/.test(el.getAttribute("class") || "");
	};
	// Probe the cursor plus four neighbours so the ribbon's width can't kiss text either.
	const blocked = (x, y) => isText(x, y) || isText(x - 12, y) || isText(x + 12, y) || isText(x, y - 12) || isText(x, y + 12);

	const clear = () => { pts = []; hasLast = false; ctx?.clearRect(0, 0, W, H); };

	const onMove = (e) => { pending = e; loop.wake(); };
	const handle = (e) => {
		if (blocked(e.clientX, e.clientY)) { clear(); return; } // instant: nothing lingers over text
		const r = overlay.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		const now = performance.now();
		if (hasLast) {
			const d = Math.hypot(x - lastX, y - lastY);
			if (d > 2) {
				const n = Math.min(4, Math.ceil(d / 14));
				for (let i = 1; i <= n; i++) pts.push({ x: lastX + ((x - lastX) * i) / n, y: lastY + ((y - lastY) * i) / n, t: now, s: Math.min(1, d / 60) });
			}
		}
		lastX = x; lastY = y; hasLast = true;
		if (pts.length > MAX_PTS) pts.splice(0, pts.length - MAX_PTS);
	};

	const loop = createLoop(() => {
		if (pending) { const e = pending; pending = null; handle(e); }
		const now = performance.now();
		const life = reducedMotion ? LIFE * 0.5 : LIFE;
		pts = pts.filter((p) => now - p.t < life);
		ctx.clearRect(0, 0, W, H);
		if (pts.length < 2) return pts.length > 0 || !!pending;
		ctx.lineCap = "round"; ctx.lineJoin = "round";
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i];
			if (Math.hypot(b.x - a.x, b.y - a.y) > 80) continue; // jump: don't bridge
			const age = (now - b.t) / life;
			const fade = (1 - age) * (1 - age);
			const k = i / pts.length;
			const wob = reducedMotion ? 0 : Math.sin(now / 260 + i * 0.6) * 1.2 * (1 - age);
			const col = auroraAt(dark, 0.1 + 0.8 * (1 - age) * 0.6 + k * 0.3);
			ctx.strokeStyle = rgba(col, fade * (dark ? 0.45 : 0.42) * (0.5 + 0.5 * b.s));
			ctx.lineWidth = (1.5 + 4 * k * (1 - age)) * (0.6 + 0.6 * b.s);
			ctx.beginPath();
			ctx.moveTo(a.x, a.y + wob);
			ctx.lineTo(b.x, b.y + wob);
			ctx.stroke();
		}
		return true;
	}, { fps: 40 });

	const size = () => {
		W = root.clientWidth; H = root.clientHeight;
		if (!canvas) canvas = makeCanvas(overlay, "left:0;top:0;width:100%;height:100%");
		ctx = sizeCanvas(canvas, W, H, 1); // 1x is plenty for a soft ribbon
	};
	size();
	const stopResize = onResize(size);
	const leave = () => clear();
	const onScroll = () => clear(); // text moves under a stale ribbon: drop it
	addEventListener("pointermove", onMove, { passive: true });
	document.documentElement.addEventListener("pointerleave", leave);
	root.addEventListener("scroll", onScroll, { passive: true });
	root.addEventListener("wheel", onScroll, { passive: true });

	return () => {
		dead = true;
		loop.destroy(); stopResize();
		removeEventListener("pointermove", onMove);
		document.documentElement.removeEventListener("pointerleave", leave);
		root.removeEventListener("scroll", onScroll);
		root.removeEventListener("wheel", onScroll);
		canvas?.remove();
	};
}

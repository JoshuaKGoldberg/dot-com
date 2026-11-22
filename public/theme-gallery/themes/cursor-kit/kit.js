/*
 * Shared helper for the cursor-reactive themes (#136-145).
 * - reads the pointer from window listeners (mouse/pen only; touch gets a static state)
 * - smooths it, tracks velocity
 * - runs a rAF loop only while something is changing (step() or pointer chasing)
 * - optional viewport-sized canvas (DPR capped at 1.5) in a scenery/overlay layer
 */
export function createKit({
	root,
	reducedMotion,
	layer = ".scenery-b",
	canvas: wantCanvas = true,
	scale = 1,
	follow = 12,
	rest = [0.72, 0.32],
	step = () => false,
	draw = () => {},
	onResize = () => {},
	onScroll,
}) {
	const host = root.querySelector(layer);
	let canvas = null;
	let ctx = null;
	if (wantCanvas) {
		canvas = document.createElement("canvas");
		canvas.style.cssText =
			"position:absolute;inset:0;width:100%;height:100%;pointer-events:none;display:block";
		host.append(canvas);
		ctx = canvas.getContext("2d");
	}
	const k = {
		canvas,
		ctx,
		host,
		w: 0,
		h: 0,
		dpr: 1,
		ox: 0,
		oy: 0,
		x: 0,
		y: 0,
		tx: 0,
		ty: 0,
		vx: 0,
		vy: 0,
		speed: 0,
		t: 0,
		active: false,
		hover: matchMedia("(hover: hover) and (pointer: fine)").matches,
		reduced: reducedMotion,
		dark: document.documentElement.classList.contains("dark"),
		wake,
		redraw,
	};

	let raf = 0;
	let last = 0;

	function measure() {
		const r = host.getBoundingClientRect();
		const had = k.w > 0;
		const fx = had ? k.tx / k.w : rest[0];
		const fy = had ? k.ty / k.h : rest[1];
		k.ox = r.left;
		k.oy = r.top;
		k.w = Math.max(1, Math.round(r.width));
		k.h = Math.max(1, Math.round(r.height));
		k.dpr = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
		if (canvas) {
			canvas.width = Math.round(k.w * k.dpr);
			canvas.height = Math.round(k.h * k.dpr);
			ctx.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
		}
		if (!k.active) {
			k.tx = k.x = fx * k.w;
			k.ty = k.y = fy * k.h;
		}
		onResize(k);
		redraw();
	}

	function redraw() {
		draw(k);
	}

	function onMove(e) {
		if (e.pointerType === "touch") return;
		const r = host.getBoundingClientRect();
		k.ox = r.left;
		k.oy = r.top;
		k.tx = e.clientX - r.left;
		k.ty = e.clientY - r.top;
		if (!k.active) {
			k.active = true;
		}
		wake();
	}

	function wake() {
		if (!raf && !document.hidden) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	}

	function frame(now) {
		raf = 0;
		const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
		last = now;
		k.t += dt;
		const a = k.reduced ? 1 : 1 - Math.exp(-dt * follow);
		const px = k.x;
		const py = k.y;
		k.x += (k.tx - k.x) * a;
		k.y += (k.ty - k.y) * a;
		let busy = false;
		if (Math.abs(k.tx - k.x) < 0.25 && Math.abs(k.ty - k.y) < 0.25) {
			k.x = k.tx;
			k.y = k.ty;
		} else {
			busy = true;
		}
		const rvx = (k.x - px) / dt;
		const rvy = (k.y - py) / dt;
		k.vx = k.reduced ? 0 : k.vx * 0.6 + rvx * 0.4;
		k.vy = k.reduced ? 0 : k.vy * 0.6 + rvy * 0.4;
		k.speed = Math.hypot(k.vx, k.vy);
		if (k.speed < 4) {
			k.vx = k.vy = k.speed = 0;
		} else {
			busy = true;
		}
		if (step(k, dt)) busy = true;
		draw(k);
		if (busy) raf = requestAnimationFrame(frame);
	}

	function onVis() {
		if (!document.hidden) wake();
	}

	const ro = new ResizeObserver(measure);
	ro.observe(host);
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("visibilitychange", onVis);
	const scrollHandler = onScroll
		? () => {
				onScroll(k);
				wake();
			}
		: null;
	if (scrollHandler) root.addEventListener("scroll", scrollHandler, { passive: true });
	measure();

	return {
		k,
		wake,
		destroy() {
			cancelAnimationFrame(raf);
			raf = 0;
			ro.disconnect();
			window.removeEventListener("pointermove", onMove);
			document.removeEventListener("visibilitychange", onVis);
			if (scrollHandler) root.removeEventListener("scroll", scrollHandler);
			canvas?.remove();
		},
	};
}

export function cssColor(root, name, fallback = "#888") {
	return getComputedStyle(root).getPropertyValue(name).trim() || fallback;
}

export function rgbOf(color) {
	const c = document.createElement("canvas").getContext("2d");
	c.fillStyle = color;
	c.fillRect(0, 0, 1, 1);
	const d = c.getImageData(0, 0, 1, 1).data;
	return [d[0], d[1], d[2]];
}

export function mulberry(seed) {
	let a = seed;
	return () => {
		a |= 0;
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

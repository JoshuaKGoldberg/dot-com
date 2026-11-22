// Runtime shared by the aurora x adirondacks "c" themes: layered cached scenery, a low-res cursor-reactive
// aurora, one throttled loop, pointer/scroll plumbing and cleanup.
import { Aurora } from "./aurora.js";

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const idle = () => new Promise((r) => ("requestIdleCallback" in window ? requestIdleCallback(() => r(), { timeout: 120 }) : setTimeout(r, 16)));

export function start({ root, mode, reducedMotion }, cfg) {
	const dark = mode ? mode === "dark" : document.documentElement.classList.contains("dark");
	const scenery = root.querySelector(".site-scenery");
	const host = scenery.querySelector(".scenery-b");
	const over = root.querySelector(".overlay-a");
	const overB = root.querySelector(".overlay-b") || over;
	if (!host) return;
	const S = {
		root, host, over, dark, reduced: !!reducedMotion, t: 20, w: 0, h: 0, dpr: 1,
		ptr: { x: 0, y: 0, sx: 0, sy: 0, active: false, moved: -1e9, dist: 0, speed: 0, energy: 0, z: 0.3, down: false },
		aurora: null, aurH: 0, features: [], built: [], parallax: [], scrollT: 0, taps: [],
	};
	let dead = false, raf = 0, last = 0, auroraAcc = 0, building = 0, rzTimer = 0, scrollRaf = 0, stillRaf = 0;
	const cleanups = [];
	const on = (target, type, fn, opts) => {
		target.addEventListener(type, fn, opts);
		cleanups.push(() => target.removeEventListener(type, fn, opts));
	};
	S.on = on;
	S.add = (el, parent = host) => {
		parent.appendChild(el);
		S.built.push(el);
		return el;
	};
	S.addParallax = (el, depth) => S.parallax.push([el, depth]);
	S.onTap = (fn) => S.taps.push(fn);
	S.hint = (text) => {
		const d = document.createElement("div");
		d.className = "aa-hint";
		d.textContent = text;
		overB.appendChild(d);
		S.built.push(d);
		const hide = () => d.classList.add("is-gone");
		const id = setTimeout(hide, 9000);
		cleanups.push(() => clearTimeout(id));
		return { hide };
	};

	// ---- pointer ----
	const rect = () => scenery.getBoundingClientRect();
	on(window, "pointermove", (e) => {
		const r = rect();
		const p = S.ptr;
		const x = e.clientX - r.left, y = e.clientY - r.top;
		if (p.active) p.dist += Math.hypot(x - p.x, y - p.y);
		else { p.sx = x; p.sy = y; }
		p.x = x; p.y = y; p.active = true; p.moved = performance.now();
		if (S.reduced) scheduleStill();
	}, { passive: true });
	on(document.documentElement, "pointerleave", () => { S.ptr.active = false; });
	on(window, "blur", () => { S.ptr.active = false; });
	let down = null;
	on(window, "pointerdown", (e) => { down = e.button === 0 ? { x: e.clientX, y: e.clientY, t: performance.now() } : null; });
	on(window, "pointerup", (e) => {
		if (!down) return;
		const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
		const quick = performance.now() - down.t < 600;
		down = null;
		if (moved > 6 || !quick) return;
		const sel = window.getSelection();
		if (sel && !sel.isCollapsed) return;
		const el = document.elementFromPoint(e.clientX, e.clientY);
		if (!el || !root.contains(el)) return;
		if (el.closest("a,button,input,select,textarea,label,[contenteditable]")) return;
		if (el !== root && !["DIV", "MAIN", "SECTION", "HEADER", "FOOTER", "UL", "OL", "NAV", "PICTURE"].includes(el.tagName)) return;
		const r = rect();
		for (const f of S.taps) f(e.clientX - r.left, e.clientY - r.top);
		if (S.reduced) scheduleStill();
	});

	// ---- scroll parallax (transform only) ----
	const applyScroll = () => {
		scrollRaf = 0;
		for (const [el, d] of S.parallax) el.style.transform = `translate3d(0,${(-S.scrollT * d).toFixed(2)}px,0)`;
	};
	on(root, "scroll", () => {
		S.scrollT = clamp(root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight));
		if (!scrollRaf) scrollRaf = requestAnimationFrame(applyScroll);
	}, { passive: true });

	// ---- aurora canvas ----
	const acv = document.createElement("canvas");
	acv.className = "aa-cv aa-aurora";
	acv.style.zIndex = 15;
	host.appendChild(acv);
	const colors = cfg.colors(dark);
	S.aurora = new Aurora(acv, { dark, colors, amp: cfg.amp });
	const auroraRender = (t) => {
		const p = S.ptr;
		S.aurora.render(t, { x: clamp(p.sx / Math.max(1, S.w)), y: clamp(p.sy / Math.max(1, S.aurH), 0.14, 0.7), z: p.z }, p.energy);
	};

	function stepPointer(dt) {
		const p = S.ptr;
		if (!p.active) { p.x = S.w * 0.64; p.y = S.h * 0.2; }
		const k = 1 - Math.exp(-dt * (S.reduced ? 12 : 4.5));
		p.sx += (p.x - p.sx) * k;
		p.sy += (p.y - p.sy) * k;
		const target = S.reduced ? 0 : Math.min(1, p.dist / Math.max(dt, 0.001) / 900);
		p.dist = 0;
		p.energy += (target - p.energy) * (1 - Math.exp(-dt * (target > p.energy ? 6 : 1.6)));
		if (p.energy < 0.005) p.energy = 0;
		p.speed = target;
		p.z += ((p.active ? 1 : 0.32) - p.z) * (1 - Math.exp(-dt * 2));
	}

	function scheduleStill() {
		if (stillRaf || dead || !S.w) return;
		stillRaf = requestAnimationFrame(() => {
			stillRaf = 0;
			stepPointer(1);
			auroraRender(S.t);
			for (const f of S.features) f.still?.();
		});
	}

	// ---- loop ----
	function frame(now) {
		raf = 0;
		if (dead || document.hidden) return;
		if (now - last < 30) { raf = requestAnimationFrame(frame); return; }
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		S.t += dt;
		stepPointer(dt);
		auroraAcc += dt;
		const p = S.ptr;
		const busy = p.energy > 0.01 || Math.hypot(p.x - p.sx, p.y - p.sy) > 0.6 || Math.abs((p.active ? 1 : 0.32) - p.z) > 0.01;
		if (busy || auroraAcc > 0.066) { auroraRender(S.t); auroraAcc = 0; }
		for (const f of S.features) f.frame?.(dt, now);
		raf = requestAnimationFrame(frame);
	}
	function run() {
		if (dead || S.reduced || raf || document.hidden || !S.w) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}
	on(document, "visibilitychange", () => {
		if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else run();
	});

	// ---- build / resize ----
	function teardownBuilt() {
		for (const f of S.features) f.destroy?.();
		S.features = [];
		S.parallax = [];
		S.taps = S.taps.filter((f) => f.keep);
		for (const el of S.built) el.remove();
		S.built = [];
	}
	async function build() {
		const id = ++building;
		cancelAnimationFrame(raf); raf = 0;
		const w = scenery.clientWidth, h = scenery.clientHeight;
		if (!w || !h) return;
		teardownBuilt();
		S.w = w; S.h = h;
		S.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		const frac = cfg.auroraFrac ?? 0.6;
		S.aurH = h * frac;
		acv.style.cssText = `z-index:15;width:${w}px;height:${S.aurH}px`;
		const sc = 0.3;
		S.aurora.resize(w * sc, S.aurH * sc);
		const p = S.ptr;
		if (!p.active) { p.sx = w * 0.64; p.sy = h * 0.2; }
		await idle();
		if (dead || id !== building) return;
		const feats = await cfg.build(S, { idle, alive: () => !dead && id === building });
		if (dead || id !== building) { feats?.forEach((f) => f.destroy?.()); return; }
		S.features = feats || [];
		auroraRender(S.t);
		applyScroll();
		for (const f of S.features) f.still?.();
		run();
	}
	const ro = new ResizeObserver(() => {
		if (dead) return;
		if (scenery.clientWidth === S.w && scenery.clientHeight === S.h) return;
		clearTimeout(rzTimer);
		rzTimer = setTimeout(build, S.w ? 160 : 0);
	});
	ro.observe(scenery);
	cleanups.push(() => ro.disconnect());

	return () => {
		dead = true;
		cancelAnimationFrame(raf);
		cancelAnimationFrame(scrollRaf);
		cancelAnimationFrame(stillRaf);
		clearTimeout(rzTimer);
		cleanups.forEach((f) => f());
		for (const f of S.features) f.destroy?.();
		S.aurora.destroy();
		acv.remove();
		for (const el of S.built) el.remove();
	};
}

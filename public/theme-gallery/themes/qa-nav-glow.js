import { createPainter, createPointer, createLoop, mk, onSize, clamp } from "./_quiet-a/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const header = root.querySelector(".site-header");
	if (!header) return;
	const wrap = mk("div", "qa-navglow");
	wrap.setAttribute("aria-hidden", "true");
	const canvas = mk("canvas", "", wrap);
	header.appendChild(wrap);
	const dark = mode === "dark" || document.documentElement.classList.contains("dark");
	// Glow sits just under the nav text and fades downward, never behind it.
	const painter = createPainter(canvas, {
		dark,
		profile: { c0: 0.0, amp: 0.03, sig: 0.4, fade: 1.2, fadeIn: 0.12, gain: 0.7, reach: 300, pullX: 0.1, rays: 0.12, maxA: dark ? 0.55 : 0.3, hot: { x: 0.8, k: 0.35, w: 0.12 } },
	});
	const P = painter.P;
	const ptr = createPointer(() => loop.wake());
	let hx = 0.8;
	let hk = 0.35;
	let targetX = 0.8;
	let targetK = 0.35;
	const loop = createLoop(
		wrap,
		(t, dt) => {
			hx += (targetX - hx) * (dt ? 1 - Math.exp(-dt * 4) : 1);
			hk += (targetK - hk) * (dt ? 1 - Math.exp(-dt * 3) : 1);
			P.hot = { x: hx, k: hk, w: 0.1 };
			painter.draw(t, wrap.getBoundingClientRect(), ptr);
		},
		{ fps: 24, reduced: reducedMotion, ptr },
	);
	const aim = (link) => {
		const r = wrap.getBoundingClientRect();
		const l = link.getBoundingClientRect();
		targetX = clamp((l.left + l.width / 2 - r.left) / r.width, 0, 1);
		targetK = 1.2;
		loop.wake();
	};
	const rest = () => {
		const active = header.querySelector(".site-nav-link.is-active");
		if (active) {
			const r = wrap.getBoundingClientRect();
			const l = active.getBoundingClientRect();
			targetX = clamp((l.left + l.width / 2 - r.left) / r.width, 0, 1);
		}
		targetK = 0.35;
		loop.wake();
	};
	const links = [...header.querySelectorAll(".site-nav-link")];
	const cleanups = [];
	for (const l of links) {
		const over = () => aim(l);
		l.addEventListener("pointerenter", over);
		l.addEventListener("focus", over);
		l.addEventListener("pointerleave", rest);
		l.addEventListener("blur", rest);
		cleanups.push(() => ["pointerenter", "focus"].forEach((e) => l.removeEventListener(e, over)));
		cleanups.push(() => ["pointerleave", "blur"].forEach((e) => l.removeEventListener(e, rest)));
	}
	const size = () => {
		painter.setSize(wrap.clientWidth, wrap.clientHeight, 5);
		rest();
		hx = targetX;
		hk = targetK;
		loop.once();
	};
	const off = onSize([wrap], size);
	size();
	return () => {
		off();
		cleanups.forEach((f) => f());
		loop.destroy();
		ptr.destroy();
		wrap.remove();
	};
}

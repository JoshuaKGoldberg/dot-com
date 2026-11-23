// _wc/index.js: #518 with a watercolor light mode. Dark mode runs #518's own code untouched (except the portrait, see portrait.js).
import { makeHp } from "../_hp/hp.js";
import { wcStarfield } from "./portrait.js";
import { applyWatercolor } from "./gl.js";

export function makeWc(opts) {
	const base = makeHp(wcStarfield(opts));
	return function activate(ctx) {
		const clean = base(ctx);
		const dark = document.documentElement.classList.contains("dark");
		const undo = dark ? () => {} : applyWatercolor(opts.mode, opts.scale, !!opts.boost);
		const off = tiltInput(ctx);
		return () => { off(); undo(); clean?.(); };
	};
}

// phones: device tilt drives the portrait like the pointer does (synthetic pointermove over the portrait). The iOS permission prompt only ever
// follows a tap on the portrait; nothing is requested automatically.
function tiltInput({ root, reducedMotion }) {
	if (reducedMotion || !matchMedia("(pointer: coarse)").matches) return () => {};
	const pic = root.querySelector(".site-portrait"); if (!pic) return () => {};
	let on = false, last = 0;
	const onOri = (e) => {
		const now = performance.now(); if (now - last < 40 || e.gamma == null) return; last = now;
		const r = pic.getBoundingClientRect(), x = r.left + r.width / 2 + Math.max(-1, Math.min(1, e.gamma / 30)) * r.width * 0.45, y = r.top + r.height / 2 + Math.max(-1, Math.min(1, ((e.beta ?? 45) - 45) / 30)) * r.height * 0.45;
		window.dispatchEvent(new PointerEvent("pointermove", { clientX: x, clientY: y, pointerType: "touch" }));
	};
	const enable = async () => {
		if (on) return;
		try { if (typeof DeviceOrientationEvent !== "undefined" && DeviceOrientationEvent.requestPermission && (await DeviceOrientationEvent.requestPermission()) !== "granted") return; } catch { return; }
		on = true; addEventListener("deviceorientation", onOri, { passive: true });
	};
	pic.addEventListener("pointerdown", enable);
	return () => { pic.removeEventListener("pointerdown", enable); removeEventListener("deviceorientation", onOri); };
}

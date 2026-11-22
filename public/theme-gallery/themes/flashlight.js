// 119 — Lights Out: press L (or the chip) and the page goes dark; the pointer is a flashlight.
export function activate({ root, reducedMotion }) {
	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Turn the lights out. [ and ] resize the beam.";
	chip.innerHTML = '<span aria-hidden="true">🔦</span><span>Lights out</span><kbd>L</kbd>';
	root.append(chip);

	let layer = null, raf = 0, pending = null;
	let x = innerWidth / 2, y = innerHeight / 2, tx = x, ty = y, r = 1600, tr = 190;

	const paint = () => {
		raf = 0;
		const k = reducedMotion ? 1 : 0.22;
		x += (tx - x) * k;
		y += (ty - y) * k;
		r += (tr - r) * (reducedMotion ? 1 : 0.1);
		layer.style.setProperty("--x", x.toFixed(1) + "px");
		layer.style.setProperty("--y", y.toFixed(1) + "px");
		layer.style.setProperty("--r", r.toFixed(1) + "px");
		if (Math.abs(tx - x) + Math.abs(ty - y) + Math.abs(tr - r) > 0.6) raf = requestAnimationFrame(paint);
	};
	const kick = () => {
		if (layer && !raf) raf = requestAnimationFrame(paint);
	};
	const onMove = (e) => {
		tx = e.clientX;
		ty = e.clientY;
		kick();
	};
	const on = () => {
		layer = document.createElement("div");
		layer.className = "fl-dark";
		(root.querySelector(".overlay-b") ?? root).append(layer);
		if (!reducedMotion)
			layer.animate(
				[{ opacity: 0 }, { opacity: 0.55, offset: 0.12 }, { opacity: 0.12, offset: 0.28 }, { opacity: 0.85, offset: 0.46 }, { opacity: 0.35, offset: 0.58 }, { opacity: 1 }],
				{ duration: 900, easing: "linear" },
			);
		r = reducedMotion ? tr : 1400;
		window.addEventListener("pointermove", onMove, { passive: true });
		chip.setAttribute("aria-pressed", "true");
		kick();
		paint();
	};
	const off = () => {
		cancelAnimationFrame(raf);
		raf = 0;
		window.removeEventListener("pointermove", onMove);
		layer?.remove();
		layer = null;
		chip.setAttribute("aria-pressed", "false");
	};
	const toggle = () => (layer ? off() : on());
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "l" || event.key === "L") {
			event.preventDefault();
			toggle();
		} else if (layer && (event.key === "[" || event.key === "]")) {
			tr = Math.min(420, Math.max(90, tr + (event.key === "]" ? 40 : -40)));
			kick();
		} else if (layer && event.key === "Escape") off();
	};
	chip.addEventListener("click", toggle);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("keydown", onKey);
		off();
	};
}

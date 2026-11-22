import { panel, h } from "./_sensor/kit.js";

// Patterns as navigator.vibrate arrays: [on, off, on, off, ...] in ms.
const PATTERNS = {
	tick: { name: "Tick", note: "navigation", p: [12] },
	double: { name: "Double tap", note: "social links", p: [14, 45, 14] },
	squiggle: { name: "Squiggle", note: "post links", p: [10, 28, 10, 28, 10, 28, 10, 28, 26] },
	thud: { name: "Thud", note: "projects", p: [46, 70, 14] },
	ripple: { name: "Ripple", note: "talks", p: [8, 40, 12, 36, 18, 32, 26] },
	confirm: { name: "Confirm", note: "on click", p: [24, 40, 48] },
};
const KIND = [
	[".site-nav-link, .site-logo", "tick"],
	[".site-socials .site-link", "double"],
	[".site-post .site-link", "squiggle"],
	[".site-project .site-link", "thud"],
	[".site-talk .site-link", "ripple"],
	[".site-link", "tick"],
];
const NS = "http://www.w3.org/2000/svg";

export function activate({ root, reducedMotion }) {
	const canSense = typeof navigator.vibrate === "function";
	let on = false;
	let anim;

	// ---- scope ----
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "hs-svg");
	svg.setAttribute("viewBox", "0 0 300 40");
	svg.setAttribute("preserveAspectRatio", "none");
	svg.setAttribute("aria-hidden", "true");
	const base = document.createElementNS(NS, "line");
	base.setAttribute("class", "hs-base");
	base.setAttribute("x1", "0"); base.setAttribute("x2", "300"); base.setAttribute("y1", "32"); base.setAttribute("y2", "32");
	const wave = document.createElementNS(NS, "path");
	wave.setAttribute("class", "hs-wave");
	const head = document.createElementNS(NS, "line");
	head.setAttribute("class", "hs-head");
	head.setAttribute("y1", "2"); head.setAttribute("y2", "38"); head.setAttribute("x1", "0"); head.setAttribute("x2", "0");
	head.style.opacity = "0";
	svg.append(base, wave, head);
	const name = h("div", { class: "hs-name" }, "Hover a link");
	const scope = h("div", { class: "hs-scope", role: "img", "aria-label": "Haptic waveform" }, svg, name);

	function draw(key) {
		const { p, name: n, note } = PATTERNS[key];
		const total = p.reduce((a, b) => a + b, 0);
		const W = 300, hi = 6, lo = 32;
		let x = 0, d = `M0 ${lo}`;
		p.forEach((ms, i) => {
			const w = (ms / total) * W;
			if (i % 2 === 0) {
				// an "on" pulse: rounded top with short motor ramps
				const r = Math.min(4, w / 2);
				d += ` L${x.toFixed(1)} ${lo} C${x.toFixed(1)} ${hi} ${(x + r).toFixed(1)} ${hi} ${(x + r * 1.6).toFixed(1)} ${hi} L${(x + w - r * 1.6).toFixed(1)} ${hi} C${(x + w - r).toFixed(1)} ${hi} ${(x + w).toFixed(1)} ${hi} ${(x + w).toFixed(1)} ${lo}`;
			} else d += ` L${(x + w).toFixed(1)} ${lo}`;
			x += w;
		});
		d += ` L${W} ${lo}`;
		wave.setAttribute("d", d);
		name.replaceChildren(`${n} `, h("small", {}, `${note} · ${p.filter((_, i) => i % 2 === 0).length} pulse${p.length > 1 ? "s" : ""}, ${total} ms`));
		return total;
	}

	function play(key, link) {
		const total = draw(key);
		const { p } = PATTERNS[key];
		if (on && canSense) navigator.vibrate(p);
		// playhead sweep across the scope
		anim?.cancel();
		if (!reducedMotion) {
			head.style.opacity = "1";
			anim = head.animate([{ transform: "translateX(0)" }, { transform: "translateX(300px)" }], { duration: Math.max(total, 120), easing: "linear" });
			anim.onfinish = () => (head.style.opacity = "0");
		}
		// underline buzz on the link, keyed to the pulses
		if (link && !reducedMotion) {
			let t = 0;
			const frames = [{ "--hs-p": "0px", offset: 0 }];
			p.forEach((ms, i) => {
				const a = t / total;
				const b = (t + ms) / total;
				frames.push({ "--hs-p": i % 2 === 0 ? "3px" : "0px", offset: Math.min(0.999, a + 0.0001) });
				t += ms;
			});
			frames.push({ "--hs-p": "0px", offset: 1 });
			// unique ascending offsets
			const seen = new Set();
			const clean = frames.filter((f) => (seen.has(f.offset) ? false : seen.add(f.offset)));
			try { link.animate(clean, { duration: Math.max(total, 120) }); } catch { /* @property unsupported */ }
		}
	}

	function kindOf(el) {
		for (const [sel, key] of KIND) if (el.matches(sel)) return key;
		return "tick";
	}
	const linkFrom = (t) => t.closest?.("a.site-link, a.site-nav-link, a.site-logo");
	let last;
	const over = (e) => {
		const a = linkFrom(e.target);
		if (!a || a === last) return;
		last = a;
		play(kindOf(a), a);
	};
	const out = (e) => { if (last && linkFrom(e.target) === last && !last.contains(e.relatedTarget)) last = null; };
	const focus = (e) => { const a = linkFrom(e.target); if (a) { last = a; play(kindOf(a), a); } };
	const click = (e) => {
		const a = linkFrom(e.target);
		if (a) { e.preventDefault(); play("confirm", a); }
	};
	root.addEventListener("pointerover", over);
	root.addEventListener("pointerout", out);
	root.addEventListener("focusin", focus);
	root.addEventListener("click", click);

	const ui = panel(root, {
		title: "Haptic squiggles",
		statusIdle: canSense ? "Hover or focus a link to see its pattern. Turn haptics on to feel it." : "No vibration motor here (desktop, iOS). Waveforms show what a phone would feel.",
		privacy: "Haptics never leave your device. Nothing is recorded or sent.",
		enable: { label: "Turn haptics on", run: enable },
		stopLabel: "Turn haptics off",
		onStop: stop,
		simLabel: "Play a pattern",
		controls: [
			{ type: "buttons", id: "pat", label: "Pattern", value: "", options: Object.entries(PATTERNS).map(([value, v]) => ({ value, label: v.name })), onPick: (v) => play(v) },
		],
	});
	ui.el.querySelector(".sx-sim").prepend(scope);
	draw("squiggle");

	async function enable() {
		if (!canSense) {
			ui.status("This device has no vibration support. The waveform preview still works.");
			return;
		}
		on = true;
		navigator.vibrate(18); // inside the click gesture, as a confirmation buzz
		ui.setActive(true);
		ui.status("Haptics on. Touch or focus a link to feel it.");
	}
	function stop() {
		on = false;
		navigator.vibrate?.(0);
		ui.setActive(false);
		ui.status("Haptics off. Waveforms still preview.");
	}

	return () => {
		root.removeEventListener("pointerover", over);
		root.removeEventListener("pointerout", out);
		root.removeEventListener("focusin", focus);
		root.removeEventListener("click", click);
		anim?.cancel();
		if (on) navigator.vibrate?.(0);
		ui.destroy();
	};
}

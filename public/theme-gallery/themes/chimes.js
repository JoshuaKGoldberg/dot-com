// 121 — Wind Chimes: a visible rack that sways as you hover links. Sound is OFF until you opt in.
const NOTES = 7;
const SEL = ".site-link, .site-nav-link, .site-logo";

export function activate({ root, reducedMotion }) {
	const rack = document.createElement("div");
	rack.className = "ch-rack";
	rack.innerHTML =
		'<div class="ch-bar"></div>' +
		Array.from({ length: NOTES }, (_, i) => `<button class="ch-tube" type="button" style="--i:${i}" aria-label="Chime ${i + 1} of ${NOTES}"><span></span></button>`).join("");
	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Sound is off. Enable soft pentatonic chimes on link hover.";
	chip.innerHTML = '<span aria-hidden="true" class="ch-ico">🔇</span><span class="ch-txt">Chimes: sound off</span><kbd>C</kbd>';
	root.append(rack, chip);

	const tubes = [...rack.querySelectorAll(".ch-tube")];
	const links = () => [...root.querySelectorAll(SEL)];
	let audio = null;
	let loading = false;
	let lastRing = 0;

	const sway = (i, vel = 1) => {
		const el = tubes[i];
		if (reducedMotion) {
			el.classList.add("ch-glow");
			clearTimeout(el._t);
			el._t = setTimeout(() => el.classList.remove("ch-glow"), 700);
			return;
		}
		const a = 11 * vel * (Math.random() < 0.5 ? -1 : 1);
		el.animate(
			[{ transform: "rotate(0)" }, { transform: `rotate(${a}deg)` }, { transform: `rotate(${-a * 0.62}deg)` }, { transform: `rotate(${a * 0.36}deg)` }, { transform: `rotate(${-a * 0.18}deg)` }, { transform: "rotate(0)" }],
			{ duration: 2400, easing: "ease-in-out" },
		);
		// neighbours get a little nudge, like a real rack
		for (const n of [i - 1, i + 1]) tubes[n]?.animate([{ transform: "rotate(0)" }, { transform: `rotate(${-a * 0.25}deg)` }, { transform: "rotate(0)" }], { duration: 1500, easing: "ease-in-out" });
	};
	const ring = (i, vel = 1, pan = 0) => {
		const now = performance.now();
		if (now - lastRing < 70) return;
		lastRing = now;
		sway(i, vel);
		audio?.ring(i, vel, pan);
	};

	const noteFor = (el) => {
		const idx = links().indexOf(el);
		return ((idx < 0 ? 0 : idx) * 3 + 1) % NOTES; // hop around the scale, not up it
	};
	const hover = (e) => {
		const el = e.target.closest?.(SEL);
		if (!el || el.contains(e.relatedTarget)) return;
		const r = el.getBoundingClientRect();
		ring(noteFor(el), 0.7 + Math.random() * 0.3, Math.max(-1, Math.min(1, ((r.left + r.width / 2) / innerWidth) * 2 - 1)));
	};
	root.addEventListener("pointerover", hover);
	root.addEventListener("focusin", hover);
	rack.addEventListener("click", (e) => {
		const t = e.target.closest(".ch-tube");
		if (t) ring(tubes.indexOf(t), 1, 0);
	});

	const setUi = (on) => {
		chip.setAttribute("aria-pressed", String(on));
		chip.querySelector(".ch-ico").textContent = on ? "🔔" : "🔇";
		chip.querySelector(".ch-txt").textContent = on ? "Chimes: sound on" : "Chimes: sound off";
		rack.classList.toggle("is-on", on);
	};
	const toggle = async () => {
		if (audio) {
			audio.close();
			audio = null;
			setUi(false);
			return;
		}
		if (loading) return;
		loading = true;
		try {
			const mod = await import("./chimes/audio.js");
			audio = mod.createAudio();
			setUi(true);
			[0, 2, 4].forEach((n, k) => setTimeout(() => { lastRing = 0; ring(n + k, 0.8, 0); }, k * 140));
		} finally {
			loading = false;
		}
	};
	chip.addEventListener("click", toggle);
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "c" || event.key === "C") {
			event.preventDefault();
			toggle();
		}
	};
	document.addEventListener("keydown", onKey);
	return () => {
		root.removeEventListener("pointerover", hover);
		root.removeEventListener("focusin", hover);
		document.removeEventListener("keydown", onKey);
		audio?.close();
		audio = null;
	};
}

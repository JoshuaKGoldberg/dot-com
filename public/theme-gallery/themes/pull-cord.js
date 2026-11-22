const NS = "http://www.w3.org/2000/svg";

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	const wrap = document.createElement("div");
	wrap.className = `pc-cord${reducedMotion ? "" : " is-sway"}`;
	wrap.innerHTML = `<svg class="pc-svg" viewBox="0 0 120 420" aria-hidden="true">
<defs><radialGradient id="pc-g" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#fff3c4"/><stop offset=".45" stop-color="#d5a640"/><stop offset="1" stop-color="#7a5a1c"/></radialGradient></defs>
<rect class="pc-plate" x="46" y="0" width="28" height="9" rx="3"/>
<g class="pc-sway"><path class="pc-shadow" d="M60 8V156"/><path class="pc-line" d="M60 8V156"/><path class="pc-twist" d="M60 8V156"/>
<g class="pc-bead-g"><path d="M-3 -12 h6 v8 h-6z" fill="#8a6a2a"/><circle class="pc-bead" cx="0" cy="9" r="9" fill="url(#pc-g)"/></g></g></svg>
<button class="pc-hit" type="button" aria-label="Pull the cord to toggle the lights" title="Pull me (or press Enter)"></button>
<span class="pc-label">pull the cord</span>`;
	root.append(wrap);
	const hit = wrap.querySelector(".pc-hit");

	const load = () => (loading ??= import(`./pull-cord/engine.js${v}`).then((m) => (engine = m.create(wrap, reducedMotion))));
	hit.addEventListener("pointerenter", load, { once: true });
	hit.addEventListener("focus", load, { once: true });
	hit.addEventListener("pointerdown", (event) => {
		const { clientX, clientY, pointerId } = event;
		hit.setPointerCapture(pointerId);
		load().then((e) => e.grab(clientX, clientY, pointerId));
	});
	hit.addEventListener("keydown", (event) => {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			load().then((e) => e.tug());
		}
	});

	return () => engine?.destroy();
}

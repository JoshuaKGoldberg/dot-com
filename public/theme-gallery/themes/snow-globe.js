const GLOBE = `<svg viewBox="0 0 62 78" aria-hidden="true">
<defs><radialGradient id="sw-glass" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#fff" stop-opacity=".6"/><stop offset=".6" stop-color="#cfe6fa" stop-opacity=".12"/><stop offset="1" stop-color="#7fb2e6" stop-opacity=".6"/></radialGradient>
<clipPath id="sw-clip"><circle cx="31" cy="30" r="25"/></clipPath></defs>
<path d="M12 62 Q31 52 50 62 L54 74 Q31 80 8 74Z" fill="#6b4a33"/><path d="M12 62 Q31 52 50 62" fill="none" stroke="#a97d57" stroke-width="2"/>
<circle cx="31" cy="30" r="25" fill="#2b4c7e" opacity=".92"/>
<g clip-path="url(#sw-clip)"><path d="M0 52 Q31 38 62 52 V62 H0Z" fill="#f4f8ff"/>
<path d="M22 46 l6 -13 l6 13z M25 38 l3 -9 l3 9z" fill="#2e7d5b"/><path d="M36 48 l5 -11 l5 11z" fill="#3a9a6f"/><rect x="27" y="46" width="2" height="4" fill="#5b3b25"/><rect x="39" y="47" width="2" height="3" fill="#5b3b25"/>
<g class="sw-dots"><circle cx="18" cy="26" r="1.3" style="--sx:6px"/><circle cx="26" cy="20" r="1.1" style="--sx:-5px"/><circle cx="35" cy="24" r="1.4" style="--sx:7px"/><circle cx="43" cy="30" r="1.1" style="--sx:-6px"/><circle cx="30" cy="31" r="1.2" style="--sx:4px"/><circle cx="22" cy="36" r="1" style="--sx:-4px"/><circle cx="40" cy="18" r="1.2" style="--sx:5px"/><circle cx="14" cy="34" r="1.1" style="--sx:6px"/></g></g>
<circle cx="31" cy="30" r="25" fill="url(#sw-glass)" stroke="#9cc3ea" stroke-width="1.2"/><path d="M15 20 A19 19 0 0 1 28 8" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".8"/></svg>`;

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	const footer = root.querySelector(".site-footer");

	const globe = document.createElement("button");
	globe.className = "sw-globe";
	globe.type = "button";
	globe.title = "Shake the snow globe";
	globe.setAttribute("aria-label", "Shake the snow globe");
	globe.innerHTML = GLOBE;
	footer?.prepend(globe);

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.title = "Jump to the snow globe in the footer";
	chip.innerHTML = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="9" r="6.5"/><path d="M6 17h8M10 5v8M6.6 7l6.8 4M13.4 7l-6.8 4"/></svg><span>shake the snow globe in the footer</span>';
	root.append(chip);

	const load = () => (loading ??= import(`./snow-globe/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, globe))));
	globe.addEventListener("pointerenter", load, { once: true });
	globe.addEventListener("focus", load, { once: true });
	globe.addEventListener("click", async () => {
		globe.classList.remove("is-shaking");
		void globe.offsetWidth;
		if (!reducedMotion) globe.classList.add("is-shaking");
		(await load()).shake();
	});
	chip.addEventListener("click", () => {
		footer?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "end" });
		load();
	});

	return () => engine?.destroy();
}

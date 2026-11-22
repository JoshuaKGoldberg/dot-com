const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h3l2.5-6 3 9 2.5-5H18"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let on = false;

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Live FPS, LCP, CLS, INP and resource bytes for this page";
	chip.innerHTML = `${ICON}<span>press</span><kbd>P</kbd><span>for perf HUD</span>`;
	root.append(chip);

	const load = () => (loading ??= import(`./perf-hud/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, () => {
		on = false;
		chip.setAttribute("aria-pressed", "false");
	}))));
	async function toggle() {
		const e = await load();
		on = !on;
		chip.setAttribute("aria-pressed", String(on));
		on ? e.open() : e.close();
	}
	chip.addEventListener("click", toggle);
	const onKey = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.key.toLowerCase() === "p") {
			event.preventDefault();
			toggle();
		} else if (event.key === "Escape" && on) toggle();
	};
	window.addEventListener("keydown", onKey);
	return () => {
		window.removeEventListener("keydown", onKey);
		engine?.destroy();
	};
}

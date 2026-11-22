const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M10 2l7 3.5-7 3.5-7-3.5z"/><path d="M3 9.5l7 3.5 7-3.5M3 13.5l7 3.5 7-3.5"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let on = false;

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Explode the page into its DOM layers";
	chip.innerHTML = `${ICON}<span>press</span><kbd>X</kbd><span>for x-ray</span>`;
	root.append(chip);

	const load = () => (loading ??= import(`./xray/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, () => {
		on = false;
		chip.setAttribute("aria-pressed", "false");
	}))));

	async function toggle() {
		const e = await load();
		on = !on;
		chip.setAttribute("aria-pressed", String(on));
		on ? e.enter() : e.exit();
	}

	chip.addEventListener("click", toggle);
	const onKey = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.key.toLowerCase() === "x") {
			event.preventDefault();
			toggle();
		} else if (event.key === "Escape" && on) {
			toggle();
		}
	};
	window.addEventListener("keydown", onKey);
	return () => {
		window.removeEventListener("keydown", onKey);
		engine?.destroy();
	};
}

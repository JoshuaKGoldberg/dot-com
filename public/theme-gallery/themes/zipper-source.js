const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M7 5L2 10l5 5M13 5l5 5-5 5"/></svg>';

export function activate({ root, reducedMotion, theme }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let on = false;

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Unzip the page to see its HTML and CSS";
	chip.innerHTML = `${ICON}<span>click “view source” or press</span><kbd>Z</kbd>`;
	root.append(chip);

	const load = () => (loading ??= import(`./zipper-source/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, theme, () => {
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
	const onClick = (event) => {
		const a = event.target.closest?.(".site-footer a");
		if (a && a.textContent.trim().toLowerCase() === "view source") {
			event.preventDefault();
			if (!on) toggle();
		}
	};
	root.addEventListener("click", onClick);
	const onKey = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) return;
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.key.toLowerCase() === "z") {
			event.preventDefault();
			toggle();
		} else if (event.key === "Escape" && on) toggle();
	};
	window.addEventListener("keydown", onKey);
	return () => {
		window.removeEventListener("keydown", onKey);
		root.removeEventListener("click", onClick);
		engine?.destroy();
	};
}

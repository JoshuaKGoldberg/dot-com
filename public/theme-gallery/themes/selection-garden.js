const FLOWER = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="#ff7aa8"><ellipse cx="12" cy="5" rx="3.2" ry="4.6"/><ellipse cx="12" cy="5" rx="3.2" ry="4.6" transform="rotate(72 12 10)"/><ellipse cx="12" cy="5" rx="3.2" ry="4.6" transform="rotate(144 12 10)"/><ellipse cx="12" cy="5" rx="3.2" ry="4.6" transform="rotate(216 12 10)"/><ellipse cx="12" cy="5" rx="3.2" ry="4.6" transform="rotate(288 12 10)"/></g><circle cx="12" cy="10" r="2.6" fill="#ffd34d"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	const chip = document.createElement("div");
	chip.className = "dx-chip";
	chip.innerHTML = `${FLOWER}<span>select some text to plant a garden</span>`;
	root.append(chip);

	const onSelect = () => {
		const sel = getSelection();
		if (engine) return engine.update();
		if (!sel || sel.isCollapsed || !root.contains(sel.anchorNode)) return;
		loading ??= import(`./selection-garden/engine.js${v}`).then((m) => {
			engine = m.create(root, reducedMotion);
			engine.update();
		});
	};
	document.addEventListener("selectionchange", onSelect);
	return () => {
		document.removeEventListener("selectionchange", onSelect);
		engine?.destroy();
	};
}

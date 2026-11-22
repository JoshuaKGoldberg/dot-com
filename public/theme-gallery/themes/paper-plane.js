const BLOCKS = ".site-about p, .site-item-description";
const ICON = '<svg viewBox="0 0 24 14" aria-hidden="true"><path d="M1 3l22 4-14 2z" fill="currentColor" opacity=".55"/><path d="M1 3l22 4-9 6-5-4z" fill="currentColor"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	const load = () => (loading ??= import(`./paper-plane/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion))));

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.title = "Double-click any paragraph (or click here) to fold it into a paper plane";
	chip.innerHTML = `${ICON}<span>double-click a paragraph</span>`;
	root.append(chip);

	const onDouble = (event) => {
		const block = event.target.closest?.(BLOCKS);
		if (!block || event.target.closest("a")) return;
		getSelection()?.removeAllRanges();
		load().then((e) => e.fold(block));
	};
	const onChip = () => {
		const mid = innerHeight / 2;
		const blocks = [...root.querySelectorAll(BLOCKS)].filter((b) => !b.classList.contains("pp-gone"));
		const best = blocks
			.map((b) => [Math.abs(b.getBoundingClientRect().top - mid), b])
			.sort((a, b) => a[0] - b[0])[0]?.[1];
		if (best) load().then((e) => e.fold(best));
	};
	root.addEventListener("dblclick", onDouble);
	chip.addEventListener("click", onChip);

	return () => {
		root.removeEventListener("dblclick", onDouble);
		engine?.destroy();
	};
}

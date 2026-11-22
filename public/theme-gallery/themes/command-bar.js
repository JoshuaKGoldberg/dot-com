// 125 — Command Bar: press / to fuzzy-search posts, projects and talks, toggle effects, copy email.
// The bar itself loads on first open.
export function activate({ root, reducedMotion }) {
	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.title = "Search the page, toggle effects, copy email";
	chip.innerHTML = '<span aria-hidden="true">⌕</span><span>Search &amp; commands</span><kbd>/</kbd>';
	root.append(chip);

	let bar = null;
	let loading = false;
	const open = async () => {
		if (!bar && !loading) {
			loading = true;
			const mod = await import("./command-bar/bar.js");
			loading = false;
			if (!chip.isConnected) return;
			bar = mod.create({ root, reducedMotion });
		}
		bar?.open();
	};
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "/") {
			event.preventDefault();
			open();
		}
	};
	chip.addEventListener("click", open);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("keydown", onKey);
		bar?.destroy();
	};
}

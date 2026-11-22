// 118 — Time Machine: a slider rewinds the page through imagined past designs. Engine loads on first open.
export function activate({ root, reducedMotion }) {
	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Rewind the site through imagined old designs";
	chip.innerHTML = '<span aria-hidden="true">⏳</span><span>Time machine</span><kbd>Y</kbd>';
	root.append(chip);

	let engine = null;
	let loading = false;
	const toggle = async () => {
		if (!engine && !loading) {
			loading = true;
			const mod = await import("./time-machine/engine.js");
			loading = false;
			if (!chip.isConnected) return;
			engine = mod.create({ root, reducedMotion, onChange: (open) => chip.setAttribute("aria-pressed", String(open)) });
		}
		engine?.toggle();
	};
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "y" || event.key === "Y") {
			event.preventDefault();
			toggle();
		}
	};
	chip.addEventListener("click", toggle);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("keydown", onKey);
		engine?.destroy();
	};
}

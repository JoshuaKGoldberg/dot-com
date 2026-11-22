// 116 — Doodle Pen: press P (or the chip) to draw; strokes fade. The engine loads on first use.
export function activate({ root, reducedMotion }) {
	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Doodle with a pressure-sensitive pen. Strokes fade.";
	chip.innerHTML = '<span aria-hidden="true">✎</span><span>Doodle</span><kbd>P</kbd>';
	root.append(chip);

	let engine = null;
	let loading = false;
	const toggle = async () => {
		if (engine) {
			engine.stop();
			engine = null;
			chip.setAttribute("aria-pressed", "false");
			return;
		}
		if (loading) return;
		loading = true;
		const mod = await import("./doodle/engine.js");
		loading = false;
		if (!root.isConnected || !chip.isConnected) return;
		engine = mod.start({ root, reducedMotion, onExit: () => { engine = null; chip.setAttribute("aria-pressed", "false"); } });
		chip.setAttribute("aria-pressed", "true");
	};
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "p" || event.key === "P") {
			event.preventDefault();
			toggle();
		} else if (event.key === "Escape" && engine) {
			engine.stop();
			engine = null;
			chip.setAttribute("aria-pressed", "false");
		}
	};
	chip.addEventListener("click", toggle);
	document.addEventListener("keydown", onKey);
	return () => {
		document.removeEventListener("keydown", onKey);
		engine?.stop();
		engine = null;
	};
}

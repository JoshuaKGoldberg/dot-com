// 120 — Rearrange: press R, grab a handle, drag sections. FLIP + springs, saved locally. Engine loads on first use.
const STORE = "rearrange-order";
const KEYS = ["site-hero", "site-about", "site-posts", "site-projects", "site-talks"];

export function activate({ root, reducedMotion }) {
	const main = root.querySelector(".site-main");
	if (!main) return;
	const items = () => KEYS.map((k) => main.querySelector("." + k)).filter(Boolean);

	// restore a saved layout (cheap: at most five insertBefore calls)
	try {
		const saved = JSON.parse(localStorage.getItem(STORE) || "null");
		if (Array.isArray(saved)) {
			const ordered = saved.map((k) => main.querySelector("." + k)).filter(Boolean);
			for (const el of items()) if (!ordered.includes(el)) ordered.push(el);
			for (const el of ordered) main.append(el);
		}
	} catch {}

	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Drag sections to reorder the homepage";
	chip.innerHTML = '<span aria-hidden="true">⠿</span><span>Rearrange</span><kbd>R</kbd>';
	root.append(chip);

	let engine = null;
	let loading = false;
	const toggle = async () => {
		if (!engine && !loading) {
			loading = true;
			const mod = await import("./rearrange/engine.js");
			loading = false;
			if (!chip.isConnected) return;
			engine = mod.create({ root, main, keys: KEYS, store: STORE, reducedMotion, onChange: (on) => chip.setAttribute("aria-pressed", String(on)) });
		}
		engine?.toggle();
	};
	const onKey = (event) => {
		const t = event.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "r" || event.key === "R") {
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

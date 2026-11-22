const KEY = "dx-sticky-notes-111";
const BLOCKED = ".site-item, p, h1, h2, a, li, button, img, picture, .sn-note, .dx-chip, .site-header, .site-footer, .site-nav";

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let saved = [];
	try { saved = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.title = "Double-click the page margin to place a sticky note. Notes are saved in this browser.";
	chip.innerHTML = "<i></i><span>double-click the margin for a note</span>";
	root.append(chip);

	const load = () => (loading ??= import(`./sticky-notes/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion, KEY, chip))));

	// Notes you already placed come back; with none saved, nothing is fetched.
	if (saved.length) load();

	const onDouble = (event) => {
		const t = event.target;
		if (!(t instanceof Element) || t.closest(BLOCKED)) return;
		getSelection()?.removeAllRanges();
		const { clientX, clientY } = event;
		load().then((e) => e.add(clientX, clientY));
	};
	root.addEventListener("dblclick", onDouble);
	chip.addEventListener("click", () => {
		const mid = innerWidth > 900 ? innerWidth - 150 : innerWidth / 2 - 88;
		load().then((e) => e.add(mid, innerHeight / 2 - 80));
	});

	return () => {
		root.removeEventListener("dblclick", onDouble);
		engine?.destroy();
	};
}

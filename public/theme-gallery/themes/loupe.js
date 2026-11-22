const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="8.5" cy="8.5" r="5.5"/><path d="M13 13l5 5"/></svg>';

export function activate({ root, reducedMotion }) {
	const v = new URL(import.meta.url).search;
	let engine;
	let loading;
	let held = false;
	let sticky = false;
	let x = innerWidth / 2;
	let y = innerHeight / 2;

	const chip = document.createElement("button");
	chip.className = "dx-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Hold Alt (Option) for a loupe; scroll to change zoom. Click here for a sticky loupe.";
	chip.innerHTML = `${ICON}<span>hold</span><kbd>Alt</kbd><span>for a loupe</span>`;
	root.append(chip);

	const load = () => (loading ??= import(`./loupe/engine.js${v}`).then((m) => (engine = m.create(root, reducedMotion))));
	const sync = async () => {
		const want = held || sticky;
		const e = engine ?? (want ? await load() : undefined);
		if (!e) return;
		want ? e.show(x, y) : e.hide();
	};

	const onMove = (event) => {
		x = event.clientX;
		y = event.clientY;
		engine?.move(x, y);
	};
	const onDown = (event) => {
		if (event.key === "Alt" && !event.repeat) {
			event.preventDefault();
			held = true;
			sync();
		}
	};
	const onUp = (event) => {
		if (event.key === "Alt") {
			held = false;
			sync();
		}
	};
	const onBlur = () => {
		held = false;
		sync();
	};
	chip.addEventListener("click", () => {
		sticky = !sticky;
		chip.setAttribute("aria-pressed", String(sticky));
		sync();
	});

	window.addEventListener("pointermove", onMove, { passive: true });
	window.addEventListener("keydown", onDown);
	window.addEventListener("keyup", onUp);
	window.addEventListener("blur", onBlur);
	return () => {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("keydown", onDown);
		window.removeEventListener("keyup", onUp);
		window.removeEventListener("blur", onBlur);
		engine?.destroy();
	};
}

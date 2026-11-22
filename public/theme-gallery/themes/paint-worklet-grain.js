const WORKLET = new URL("./paint-worklet-grain/grain.js", import.meta.url).href;

export function activate({ root }) {
	// Wrap each item's contents in a card so the texture has a surface to live on.
	for (const item of root.querySelectorAll(".site-post, .site-project, .site-talk")) {
		const card = document.createElement("div");
		card.className = "grain-card";
		card.append(...item.childNodes);
		item.append(card);
	}

	for (const link of root.querySelectorAll(".site-nav-link")) {
		const chip = document.createElement("span");
		chip.className = "nav-chip";
		link.replaceWith(chip);
		chip.append(link);
	}

	// Progressive enhancement: the CSS fallback (hard-offset second ink plus an SVG feTurbulence grain) is
	// the default; once the worklet loads we switch to the paint() version.
	let cancelled = false;
	if ("paintWorklet" in CSS) {
		CSS.paintWorklet
			.addModule(WORKLET)
			.then(() => {
				if (!cancelled) {
					root.classList.add("grain-paint");
				}
			})
			.catch(() => {});
	}

	return () => {
		cancelled = true;
		root.classList.remove("grain-paint");
	};
}

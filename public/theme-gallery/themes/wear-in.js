const TIERS = [
	{ min: 1, wear: 0, name: "first visit" },
	{ min: 2, wear: 0.25, name: "getting acquainted" },
	{ min: 6, wear: 0.5, name: "settled in" },
	{ min: 15, wear: 0.75, name: "regular" },
	{ min: 30, wear: 1, name: "old friend" },
];
const tierOf = (n) => TIERS.reduce((acc, t, i) => (n >= t.min ? i : acc), 0);

const svg = (w, h, path, extra = "") =>
	`<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" ${extra} aria-hidden="true">${path}</svg>`;

export function activate({ root, reducedMotion }) {
	const touch = (cls, html, parent, text) => {
		const el = document.createElement("span");
		el.className = `wi-touch ${cls}`;
		el.setAttribute("aria-hidden", "true");
		el.innerHTML = html ?? "";
		if (text) { el.textContent = text; el.classList.add("wi-hand"); }
		parent.append(el);
		return el;
	};

	// scribble under the hero name, ring round the active nav link
	const title = root.querySelector(".site-title");
	touch("wi-t2 wi-scribble", svg(300, 12, '<path d="M2 7 C40 2, 70 11, 110 6 S190 2, 230 7 S280 10, 298 4"/>', 'preserveAspectRatio="none" width="100%" height="100%"'), title);
	const active = root.querySelector(".site-nav-link.is-active");
	touch("wi-t2 wi-circle", svg(100, 40, '<path d="M8 22 C4 6, 40 0, 70 3 S100 18, 88 30 S40 42, 14 34 S2 18, 20 10"/>', 'preserveAspectRatio="none" width="100%" height="100%"'), active);
	// fave sticker on first post, heart by Speaking, star by the about text
	const first = root.querySelector(".site-posts .site-item");
	touch("wi-t3 wi-fave", null, first, "★ fave!");
	const speaking = root.querySelector(".site-talks .site-section-title");
	touch("wi-t3 wi-heart", svg(28, 26, '<path d="M14 23 C2 14, 2 4, 9 3 C12 3, 14 6, 14 8 C14 6, 17 3, 20 3 C27 4, 26 14, 14 23Z"/>'), speaking);
	const about = root.querySelector(".site-about");
	about.style.position = "relative";
	touch("wi-t2 wi-star", svg(20, 20, '<path d="M10 2 V18 M3 6 L17 14 M17 6 L3 14"/>'), about);

	const footer = root.querySelector(".site-footer");
	const visit = document.createElement("p");
	visit.className = "wi-visit";
	footer.prepend(visit);
	touch("wi-t4 wi-note", null, footer, "(thanks for coming back)");

	const sim = document.createElement("div");
	sim.className = "wi-sim";
	sim.innerHTML = `<label for="wi-range">Simulate visit count: 1 → 50</label>
		<input id="wi-range" type="range" min="1" max="50" step="1" value="7" />
		<output for="wi-range"></output><small></small>`;
	root.append(sim);
	const range = sim.querySelector("input");
	const out = sim.querySelector("output");
	const small = sim.querySelector("small");

	const set = (n) => {
		const i = tierOf(n);
		root.dataset.tier = String(i);
		root.style.setProperty("--wear", String(TIERS[i].wear));
		out.textContent = `visit ${n}`;
		small.textContent = `tier ${i + 1}/5 · ${TIERS[i].name}`;
		visit.textContent = n === 1 ? "visit 1, lovely to meet you" : `visit ${n}, welcome back`;
	};
	range.addEventListener("input", () => set(Number(range.value)));
	set(7);

	return () => {
		root.removeAttribute("data-tier");
		root.style.removeProperty("--wear");
		root.style.removeProperty("position");
	};
}

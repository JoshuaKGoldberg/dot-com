const ERAS = [
	{ year: "1999", note: "Under construction" },
	{ year: "2008", note: "Web 2.0 gloss" },
	{ year: "2016", note: "Flat and material" },
	{ year: "Today", note: "Squiggles" },
];

// [outer, page, fg, strong, muted, accent] per era; the last era is read from the live theme.
const PAL = {
	light: [
		["#008080", "#ffffff", "#000000", "#000000", "#333333", "#0000ee"],
		["#cddbe8", "#ffffff", "#333333", "#17406e", "#6f7b88", "#1f6fc5"],
		["#eceff1", "#ffffff", "#37474f", "#263238", "#78909c", "#00897b"],
	],
	dark: [
		["#000000", "#000000", "#c8c8c8", "#ffffff", "#9a9a9a", "#7a9cff"],
		["#0e141c", "#1a2330", "#ccd6e0", "#9cc8ff", "#8794a3", "#5aa5f0"],
		["#121212", "#1f1f1f", "#cfd8dc", "#eceff1", "#90a4ae", "#4db6ac"],
	],
};
// numeric knobs per era
const NUM = {
	"--siteMaxWidth": [[34, 46, 52, 52], "rem"],
	"--tm-radius": [[0, 7, 50, 50], "%"],
	"--tm-card": [[0, 0.35, 1, 0], ""],
	"--tm-title": [[2.1, 2.6, 3.1, 3.75], "rem"],
	"--tm-ul": [[1, 1, 0, 0], ""],
	"--tm-squig": [[0, 0, 0, 1], ""],
	"--tm-gloss": [[0, 1, 0, 0], ""],
	"--tm-era0": [[1, 0, 0, 0], ""],
	"--tm-pad": [[1.2, 1.6, 1.75, 1.75], "rem"],
	"--tm-frame": [[1, 1, 0, 0], ""],
};

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const rgb = (c) => {
	const m = c.match(/[\d.]+/g);
	return m ? m.slice(0, 3).map(Number) : [0, 0, 0];
};
const mix = (a, b, f) => a.map((v, i) => v + (b[i] - v) * f);
const css = (c) => `rgb(${c.map(Math.round).join(" ")})`;
const lerpAt = (arr, t) => {
	const i = Math.min(2, Math.floor(t));
	return arr[i] + (arr[i + 1] - arr[i]) * (t - i);
};

export function create({ root, reducedMotion, onChange }) {
	const dark = document.documentElement.classList.contains("dark");
	const cs = getComputedStyle(root);
	const read = (n) => rgb(cs.getPropertyValue(n) || "#000");
	const bg = rgb(cs.backgroundColor);
	const now = [bg, bg, read("--siteFg") ? rgb(cs.color) : [0, 0, 0], read("--siteFgStrong"), read("--siteMuted"), read("--siteAccent")];
	const pal = [...PAL[dark ? "dark" : "light"].map((row) => row.map(hex)), now];

	const panel = document.createElement("div");
	panel.className = "tm-panel";
	panel.hidden = true;
	panel.setAttribute("role", "group");
	panel.setAttribute("aria-label", "Time machine");
	panel.innerHTML =
		'<div class="tm-head"><strong>Time machine</strong><span class="tm-note" aria-live="polite"></span><button class="tm-close" type="button" aria-label="Close time machine">×</button></div>' +
		'<input class="tm-range" type="range" min="0" max="3" step="0.005" value="3" aria-label="Year" aria-valuetext="Today" />' +
		'<div class="tm-ticks">' +
		ERAS.map((e, i) => `<button type="button" data-i="${i}">${e.year}</button>`).join("") +
		"</div>";
	root.append(panel);
	const range = panel.querySelector(".tm-range");
	const note = panel.querySelector(".tm-note");
	let t = 3;
	let raf = 0;

	function apply(v) {
		t = v;
		const s = root.style;
		const i = Math.min(2, Math.floor(v));
		const f = v - i;
		const col = (k) => css(mix(pal[i][k], pal[i + 1][k], f));
		s.setProperty("--tm-outer", col(0));
		s.setProperty("--tm-page", col(1));
		s.setProperty("--siteFg", col(2));
		s.setProperty("--siteFgStrong", col(3));
		s.setProperty("--siteMuted", col(4));
		s.setProperty("--siteAccent", col(5));
		s.setProperty("--siteSquiggle", col(5));
		for (const [name, [arr, unit]] of Object.entries(NUM)) s.setProperty(name, lerpAt(arr, v).toFixed(3) + unit);
		const era = Math.round(v);
		root.dataset.era = String(era);
		note.textContent = ERAS[era].year + " · " + ERAS[era].note;
		range.setAttribute("aria-valuetext", ERAS[era].year);
		range.value = String(v);
	}

	function glide(to) {
		cancelAnimationFrame(raf);
		if (reducedMotion) return apply(to);
		const from = t;
		const t0 = performance.now();
		const dur = 350 + Math.abs(to - from) * 280;
		const step = (now) => {
			const k = Math.min(1, (now - t0) / dur);
			apply(from + (to - from) * (1 - Math.pow(1 - k, 3)));
			if (k < 1) raf = requestAnimationFrame(step);
		};
		raf = requestAnimationFrame(step);
	}

	const clear = () => {
		cancelAnimationFrame(raf);
		const s = root.style;
		for (const p of ["--tm-outer", "--tm-page", "--siteFg", "--siteFgStrong", "--siteMuted", "--siteAccent", "--siteSquiggle", ...Object.keys(NUM)]) s.removeProperty(p);
		delete root.dataset.era;
	};

	range.addEventListener("input", () => {
		cancelAnimationFrame(raf);
		root.classList.add("tm-live");
		apply(Number(range.value));
	});
	range.addEventListener("change", () => {
		root.classList.remove("tm-live");
		glide(Math.round(Number(range.value)));
	});
	panel.addEventListener("click", (e) => {
		const b = e.target.closest("button");
		if (!b) return;
		if (b.dataset.i) glide(Number(b.dataset.i));
		else if (b.classList.contains("tm-close")) api.toggle(false);
	});
	const onKey = (e) => {
		if (e.key === "Escape" && !panel.hidden) api.toggle(false);
	};
	document.addEventListener("keydown", onKey);

	const api = {
		toggle(force) {
			const open = force ?? panel.hidden;
			panel.hidden = !open;
			if (open) {
				// the first opening starts a tiny rewind so the effect is obvious
				if (!api.used) {
					api.used = true;
					apply(3);
					setTimeout(() => glide(1), 350);
				}
				range.focus({ preventScroll: true });
			} else {
				glide(3);
			}
			onChange(open);
		},
		destroy() {
			document.removeEventListener("keydown", onKey);
			clear();
		},
	};
	return api;
}

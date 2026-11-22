// 117 — Seedling: plant a seed in the footer; it grows a little on every visit (localStorage).
const KEY = "seedling-visits";
const DAY = "seedling-day";

export function activate({ root, reducedMotion }) {
	const footer = root.querySelector(".site-footer");
	if (!footer) return;
	const plot = document.createElement("div");
	plot.className = "seed-plot";
	plot.innerHTML =
		'<div class="seed-stage" aria-hidden="true"></div>' +
		'<div class="seed-ui"><button class="seed-plant" type="button">Plant a seed <span aria-hidden="true">🌱</span></button></div>';
	footer.prepend(plot);

	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.title = "Plant a seed in the footer. It grows every time you visit.";
	chip.innerHTML = '<span aria-hidden="true">🌱</span><span>Seedling</span>';
	root.append(chip);

	let engine = null;
	let loading = null;
	const load = () =>
		(loading ??= import("./seedling/engine.js").then((mod) => {
			if (!plot.isConnected) return null;
			engine = mod.mount({ plot, reducedMotion });
			return engine;
		}));

	const planted = localStorage.getItem(KEY) !== null;
	if (planted) {
		plot.classList.add("is-planted");
		const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 200));
		idle(async () => {
			const today = new Date().toDateString();
			let visits = Number(localStorage.getItem(KEY)) || 1;
			if (localStorage.getItem(DAY) !== today) {
				visits += 1;
				localStorage.setItem(KEY, String(visits));
				localStorage.setItem(DAY, today);
			}
			(await load())?.set(visits, false);
		});
	}

	plot.querySelector(".seed-plant").addEventListener("click", async () => {
		localStorage.setItem(KEY, "1");
		localStorage.setItem(DAY, new Date().toDateString());
		plot.classList.add("is-planted");
		const e = await load();
		e?.set(1, true);
	});
	chip.addEventListener("click", () => {
		plot.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
		plot.querySelector("button")?.focus({ preventScroll: true });
	});
	return () => engine?.destroy();
}

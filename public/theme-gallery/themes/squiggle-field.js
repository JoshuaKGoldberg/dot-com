// 15 — Squiggle Field: rows of out-of-phase squiggles that beat into slow moiré.
const WAVELENGTH = 36;
const PITCH = 13;

export function activate({ root, mode, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	if (!scenery) return;
	const field = document.createElement("div");
	field.className = "sqf-field";
	scenery.append(field);

	const dark = mode === "dark";
	const variant = (name) => `themes/squiggle-field/${name}-${dark ? "dark" : "light"}.svg`;
	const accents = new Map([
		[5, "acc1"],
		[14, "acc2"],
		[23, "acc1"],
		[34, "acc2"],
		[44, "acc1"],
		[52, "acc2"],
	]);

	const build = () => {
		field.replaceChildren();
		const rows = Math.ceil(window.innerHeight / PITCH) + 3;
		const fragment = document.createDocumentFragment();
		for (let i = 0; i < rows; i++) {
			const row = document.createElement("div");
			row.className = "sqf-row";
			// Two beating phase waves give broad diagonal moiré bands.
			const phase =
				WAVELENGTH * (i * 0.11 + 0.42 * Math.sin(i * 0.19) + 0.18 * Math.sin(i * 0.53 + 1));
			// Alternate wavelengths so neighbouring rows beat against each other along x.
			const wave = WAVELENGTH + (i % 2 ? 1.7 : 0) + 0.5 * Math.sin(i * 0.23);
			row.style.setProperty("--w", `${wave.toFixed(2)}px`);
			row.style.setProperty("--y", `${i * PITCH - 6}px`);
			row.style.setProperty("--phase", `${phase.toFixed(2)}px`);
			row.style.setProperty("--dur", `${(112 + ((i * 7) % 17)).toFixed(0)}s`);
			row.style.backgroundImage = `url("${variant(accents.get(i) ?? "row")}")`;
			fragment.append(row);
		}
		field.append(fragment);
	};

	build();
	let timer;
	const onResize = () => {
		clearTimeout(timer);
		timer = setTimeout(build, 150);
	};
	window.addEventListener("resize", onResize);
	return () => {
		window.removeEventListener("resize", onResize);
		clearTimeout(timer);
	};
}

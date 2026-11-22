function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

export function activate({ root }) {
	const rand = rng(31337);
	const bokehLayer = root.querySelector(".site-scenery .scenery-b");
	const dropLayer = root.querySelector(".site-overlay .overlay-a");
	const field = document.createElement("div");
	field.className = "rw-bokeh";
	// city lights mostly in the lower two thirds, like a skyline out of focus
	for (let i = 0; i < 34; i++) {
		const el = document.createElement("i");
		const size = 28 + rand() ** 1.6 * 110;
		el.className = `c${1 + Math.floor(rand() * 3)}`;
		el.style.width = el.style.height = `${size.toFixed(0)}px`;
		el.style.left = `${(rand() * 108 - 4).toFixed(1)}%`;
		el.style.top = `${(28 + rand() ** 0.8 * 72).toFixed(1)}%`;
		el.style.setProperty("--tw", `${(24 + rand() * 40).toFixed(0)}s`);
		el.style.setProperty("--td", `-${(rand() * 40).toFixed(0)}s`);
		el.style.transform = `translate(-50%, -50%)`;
		field.appendChild(el);
	}
	bokehLayer.appendChild(field);

	const drops = [
		{ x: "9%", w: 20, h: 26, dur: 95, delay: -30, y0: "-6vh", ys: "34%" },
		{ x: "86%", w: 16, h: 21, dur: 70, delay: -12, y0: "-8vh", ys: "62%" },
		{ x: "93%", w: 22, h: 28, dur: 120, delay: -80, y0: "-6vh", ys: "20%" },
		{ x: "4%", w: 13, h: 17, dur: 105, delay: -55, y0: "-8vh", ys: "74%" },
	];
	for (const d of drops) {
		const el = document.createElement("div");
		el.className = "rw-drop";
		el.style.setProperty("--x", d.x);
		el.style.setProperty("--w", `${d.w}px`);
		el.style.setProperty("--h", `${d.h}px`);
		el.style.setProperty("--dur", `${d.dur}s`);
		el.style.setProperty("--delay", `${d.delay}s`);
		el.style.setProperty("--y0", d.y0);
		el.style.setProperty("--ys", d.ys);
		el.innerHTML = '<span class="streak"></span><span class="bead"></span>';
		if (!d.noStatic) dropLayer.appendChild(el);
	}
	return undefined;
}

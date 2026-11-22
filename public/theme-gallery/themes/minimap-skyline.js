const NS = "http://www.w3.org/2000/svg";

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

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".site-scenery .scenery-b");
	const rand = rng(90210);
	const W = 1920;
	const H = 220;
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("class", "skyline");
	svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
	svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
	const parts = { body: [], bars: [], win: [] };
	const wins = [];
	const rect = (x, y, w, h, cls) =>
		`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="${cls}"/>`;
	let x = -10;
	while (x < W + 10) {
		const bw = 26 + Math.floor(rand() * 5) * 11;
		const tall = rand() < 0.18 ? 1 : 0.28 + rand() * 0.5;
		const bh = Math.round((H * (tall > 0.9 ? 0.98 : tall)) / 4) * 4;
		const top = H - bh;
		parts.body.push(rect(x, top, bw, bh, rand() < 0.5 ? "b0" : "b1"));
		const mainTone = Math.floor(rand() * 6);
		for (let y = top + 4; y < H - 2; y += 4) {
			let cx = x + 3 + Math.floor(rand() * 3) * 3;
			const end = x + bw - 3;
			let n = 0;
			while (cx < end - 3 && n < 5) {
				const len = Math.min(end - cx, 4 + Math.floor(rand() * 10) * 2);
				const tone = rand() < 0.5 ? mainTone : Math.floor(rand() * 6);
				if (rand() < 0.07 && len >= 4) {
					const id = wins.length;
					wins.push(id);
					parts.win.push(rect(cx, y - 1, 4.5, 4, `win${rand() < 0.4 ? " is-lit" : ""}`));
				} else {
					parts.bars.push(rect(cx, y, len, 2, `t${tone}`));
				}
				cx += len + 3 + Math.floor(rand() * 2) * 2;
				n++;
				if (rand() < 0.15) break;
			}
		}
		x += bw + (rand() < 0.3 ? 2 + Math.floor(rand() * 6) : 0);
	}
	svg.innerHTML = `<g class="bodies">${parts.body.join("")}</g><g class="bars">${parts.bars.join("")}</g><g class="wins">${parts.win.join("")}</g>`;
	layer.appendChild(svg);

	const windows = [...svg.querySelectorAll(".win")];
	let timer;
	if (!reducedMotion) {
		const tick = () => {
			if (document.documentElement.classList.contains("dark") && !document.hidden) {
				const w = windows[Math.floor(Math.random() * windows.length)];
				w.classList.toggle("is-lit");
			}
			timer = setTimeout(tick, 1800 + Math.random() * 2600);
		};
		timer = setTimeout(tick, 2000);
	}
	return () => clearTimeout(timer);
}

const GENERATIONS = 40;

function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function nextGeneration(cells, w, h) {
	const out = new Uint8Array(w * h);
	for (let y = 0; y < h; y++) {
		const up = ((y + h - 1) % h) * w;
		const row = y * w;
		const down = ((y + 1) % h) * w;
		for (let x = 0; x < w; x++) {
			const l = (x + w - 1) % w;
			const r = (x + 1) % w;
			const n = cells[up + l] + cells[up + x] + cells[up + r] + cells[row + l] + cells[row + r] + cells[down + l] + cells[down + x] + cells[down + r];
			out[row + x] = n === 3 || (n === 2 && cells[row + x]) ? 1 : 0;
		}
	}
	return out;
}

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const footer = root.querySelector(".site-footer");
	if (footer) {
		const note = document.createElement("p");
		note.className = "life-note";
		note.textContent = "Life, not lag.";
		footer.append(note);
	}
	if (!layer) {
		return;
	}

	const style = getComputedStyle(root);
	const cell = parseFloat(style.getPropertyValue("--cell")) || 12;
	let timer = 0;

	function build() {
		const width = Math.max(1, root.clientWidth);
		const height = Math.max(1, root.clientHeight);
		const w = Math.ceil(width / cell);
		const h = Math.ceil(height / cell);

		// Seeded soup.
		const rand = mulberry32(58);
		let cells = new Uint8Array(w * h);
		for (let i = 0; i < cells.length; i++) {
			cells[i] = rand() < 0.27 ? 1 : 0;
		}

		const sprite = document.createElement("canvas");
		sprite.width = w;
		sprite.height = h * GENERATIONS;
		const ctx = sprite.getContext("2d");
		const image = ctx.createImageData(w, h);

		// Resolve the OKLCH-derived tint to concrete RGB through a probe element.
		const probe = document.createElement("i");
		probe.style.color = "var(--lifeCell)";
		root.append(probe);
		const swatch = document.createElement("canvas");
		swatch.width = swatch.height = 1;
		const sctx = swatch.getContext("2d");
		sctx.fillStyle = getComputedStyle(probe).color;
		probe.remove();
		sctx.fillRect(0, 0, 1, 1);
		const [r, g, b] = sctx.getImageData(0, 0, 1, 1).data;

		for (let g2 = 0; g2 < GENERATIONS; g2++) {
			const d = image.data;
			for (let i = 0; i < cells.length; i++) {
				const o = i * 4;
				d[o] = r;
				d[o + 1] = g;
				d[o + 2] = b;
				d[o + 3] = cells[i] ? 255 : 0;
			}
			ctx.putImageData(image, 0, g2 * h);
			cells = nextGeneration(cells, w, h);
		}

		layer.style.setProperty("--lifeSprite", `url(${sprite.toDataURL("image/png")})`);
		layer.style.setProperty("--lifeW", `${w * cell}px`);
		layer.style.setProperty("--lifeH", `${h * cell}px`);
	}

	build();

	let resizeObserver;
	if (typeof ResizeObserver !== "undefined") {
		let first = true;
		resizeObserver = new ResizeObserver(() => {
			if (first) {
				first = false;
				return;
			}
			clearTimeout(timer);
			timer = setTimeout(build, 200);
		});
		resizeObserver.observe(root);
	}

	// CSS scroll-driven animation does the work where supported; otherwise set the generation from scroll.
	const cssDriven = CSS.supports("animation-timeline: scroll()");
	let onScroll;
	if (!reducedMotion && !cssDriven) {
		onScroll = () => {
			const range = Math.max(1, root.scrollHeight - root.clientHeight);
			const gen = Math.round((root.scrollTop / range) * (GENERATIONS - 1));
			layer.style.backgroundPositionY = `${(gen / (GENERATIONS - 1)) * 100}%`;
		};
		root.addEventListener("scroll", onScroll, { passive: true });
		onScroll();
	}

	return () => {
		clearTimeout(timer);
		resizeObserver?.disconnect();
		if (onScroll) {
			root.removeEventListener("scroll", onScroll);
		}
	};
}

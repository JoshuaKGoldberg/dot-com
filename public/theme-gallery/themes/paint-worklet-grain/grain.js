/* Risograph-style grain with misregistered two-ink edges. Loaded via CSS.paintWorklet.addModule(). */

function mulberry32(seed) {
	return () => {
		seed |= 0;
		seed = (seed + 0x6d2b79f5) | 0;
		let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function num(props, name, fallback) {
	const value = props.get(name);
	const parsed = value && "value" in value ? Number(value.value) : parseFloat(String(value));
	return Number.isFinite(parsed) ? parsed : fallback;
}

function str(props, name, fallback) {
	const value = props.get(name);
	const text = value === null || value === undefined ? "" : String(value).trim();
	return text || fallback;
}

registerPaint(
	"grain",
	class {
		static get inputProperties() {
			return ["--grain-ink-a", "--grain-ink-b", "--grain-seed", "--grain-shift", "--grain-density", "--grain-kind"];
		}

		paint(ctx, size, props) {
			const { width: w, height: h } = size;
			const inkA = str(props, "--grain-ink-a", "#2a55c8");
			const inkB = str(props, "--grain-ink-b", "#e0407a");
			const seed = num(props, "--grain-seed", 1);
			const shift = Math.min(3, Math.max(0, num(props, "--grain-shift", 1.2)));
			const density = num(props, "--grain-density", 1);
			const kind = str(props, "--grain-kind", "card");
			const rand = mulberry32(Math.round(seed * 9973) + Math.round(w) * 31 + Math.round(h) * 17);
			const pad = 3;

			if (kind === "rule") {
				// Two slightly offset ink strokes with a rough, broken edge.
				const thickness = Math.max(2, h / 2.2);
				ctx.globalAlpha = 0.9;
				ctx.fillStyle = inkA;
				ctx.fillRect(0, pad / 2, w, thickness);
				ctx.globalAlpha = 0.75;
				ctx.fillStyle = inkB;
				ctx.fillRect(shift * 2, pad / 2 + shift, w - shift * 2, thickness);
				ctx.globalAlpha = 1;
				ctx.globalCompositeOperation = "destination-out";
				for (let x = 0; x < w; x += 1) {
					if (rand() < 0.1 * density) {
						ctx.globalAlpha = 0.3 + rand() * 0.6;
						ctx.fillRect(x, rand() * h, 1 + rand() * 2, 1 + rand() * 1.5);
					}
				}
				return;
			}

			const wash = kind === "button" ? 0.15 : kind === "frame" ? 0.1 : 0.05;

			// Overprinted washes, offset by the misregistration.
			ctx.globalAlpha = wash;
			ctx.fillStyle = inkA;
			ctx.fillRect(pad, pad, w - pad * 2 - shift, h - pad * 2 - shift);
			ctx.fillStyle = inkB;
			ctx.fillRect(pad + shift, pad + shift, w - pad * 2 - shift, h - pad * 2 - shift);

			// Edge lines in each ink.
			ctx.lineWidth = 1.5;
			ctx.globalAlpha = 0.85;
			ctx.strokeStyle = inkA;
			ctx.strokeRect(pad + 0.75, pad + 0.75, w - pad * 2 - shift - 1.5, h - pad * 2 - shift - 1.5);
			ctx.globalAlpha = 0.6;
			ctx.strokeStyle = inkB;
			ctx.strokeRect(pad + shift + 0.75, pad + shift + 0.75, w - pad * 2 - shift - 1.5, h - pad * 2 - shift - 1.5);

			// Speckle grain in both inks.
			const area = w * h;
			const dots = Math.min(2600, Math.round((area / 260) * density));
			for (let i = 0; i < dots; i++) {
				ctx.globalAlpha = 0.1 + rand() * 0.28;
				ctx.fillStyle = rand() < 0.5 ? inkA : inkB;
				ctx.fillRect(rand() * w, rand() * h, 1 + (rand() < 0.2 ? 1 : 0), 1);
			}

			// Paper dropouts: little unprinted flecks that knock back the ink.
			ctx.globalCompositeOperation = "destination-out";
			const flecks = Math.min(1400, Math.round((area / 420) * density));
			for (let i = 0; i < flecks; i++) {
				ctx.globalAlpha = 0.25 + rand() * 0.6;
				ctx.fillRect(rand() * w, rand() * h, 1 + rand() * 1.5, 1);
			}
			ctx.globalCompositeOperation = "source-over";
			ctx.globalAlpha = 1;
		}
	},
);

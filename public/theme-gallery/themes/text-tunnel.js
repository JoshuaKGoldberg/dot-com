import { createJourney, stops, rng, clamp, lerp, smooth, hex, mix, rgb } from "./_scroll/lib.js";

const ZT = 30; // world length of the journey
const TITLES = ["Hello", "About", "Writing", "Projects", "Speaking", "Footer"];

export function activate({ root, mode, reducedMotion }) {
	const dark = mode === "dark";
	const pal = dark
		? { bg: [4, 8, 22], glow: [40, 70, 140], text: [150, 190, 255], strong: [230, 242, 255], accent: [255, 184, 96], line: [90, 140, 255] }
		: { bg: [238, 244, 252], glow: [255, 255, 255], text: [38, 70, 120], strong: [12, 30, 62], accent: [214, 90, 20], line: [40, 100, 190] };

	// Words come from the page itself
	const raw = (root.querySelector(".site-page")?.textContent || "").split(/[\s·]+/).map((w) => w.replace(/[^\p{L}\p{N}\-+#.']/gu, "")).filter((w) => w.length > 3 && w.length < 16);
	const seen = new Set();
	const words = [];
	for (const w of raw) if (!seen.has(w.toLowerCase())) (seen.add(w.toLowerCase()), words.push(w));
	const r = rng(3);
	for (let i = words.length - 1; i > 0; i--) {
		const j = (r() * (i + 1)) | 0;
		[words[i], words[j]] = [words[j], words[i]];
	}
	let rings = null;
	let camZ;

	function build(S) {
		rings = [];
		const rr = rng(11);
		let wi = 0;
		for (let k = 0; k < 46; k++) {
			const n = 10 + ((rr() * 4) | 0);
			const list = [];
			for (let i = 0; i < n; i++) list.push(words[wi++ % words.length]);
			rings.push({ z: 2 + k * 0.95, words: list, twist: rr() * 6.28, dir: k % 2 ? 1 : -1, gate: -1 });
		}
		camZ = stops(S.anchors, [0, 5.5, 11.5, 17.5, 23.5, 29]);
		S.anchors.forEach((a, i) => rings.push({ z: camZ(a) + 3.6, words: Array(6).fill(TITLES[i].toUpperCase()), twist: 0.2, dir: 1, gate: i }));
		rings.sort((a, b) => b.z - a.z);
	}

	function draw(S) {
		const c = S.ctx, W = S.cssW, H = S.cssH;
		if (!rings) build(S);
		c.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
		const cz = camZ(S.p);
		const vx = W * (W > 900 ? 0.5 : 0.5), vy = H * 0.5;
		const fov = Math.max(W, H) * 0.62;
		c.fillStyle = rgb(pal.bg);
		c.fillRect(0, 0, W, H);
		const g = c.createRadialGradient(vx, vy, 0, vx, vy, Math.max(W, H) * 0.65);
		g.addColorStop(0, rgb(pal.glow, dark ? 0.9 : 1));
		g.addColorStop(0.5, rgb(mix(pal.bg, pal.glow, 0.25), 1));
		g.addColorStop(1, rgb(pal.bg, 1));
		c.fillStyle = g;
		c.fillRect(0, 0, W, H);
		const roll = reducedMotion ? 0 : Math.sin(S.p * 7) * 0.12 + S.p * 0.5;
		// spokes
		c.strokeStyle = rgb(pal.line, 0.1);
		c.lineWidth = 1;
		c.beginPath();
		for (let i = 0; i < 16; i++) {
			const a = (i / 16) * Math.PI * 2 + roll;
			c.moveTo(vx + Math.cos(a) * 20, vy + Math.sin(a) * 20);
			c.lineTo(vx + Math.cos(a) * Math.max(W, H), vy + Math.sin(a) * Math.max(W, H));
		}
		c.stroke();
		c.textAlign = "center";
		c.textBaseline = "middle";
		for (const ring of rings) {
			const dz = ring.z - cz;
			if (dz < 0.25 || dz > 15) continue;
			const f = fov / dz;
			const R = 2.5;
			const fade = smooth(0.25, 1.1, dz) * (1 - smooth(5, 15, dz)) ;
			const gate = ring.gate >= 0;
			const size = (gate ? 0.38 : 0.26) * f;
			if (size < 3) continue;
			const col = gate ? pal.accent : pal.text;
			c.strokeStyle = rgb(gate ? pal.accent : pal.line, (gate ? 0.55 : 0.16) * fade);
			c.lineWidth = gate ? 3 : 1;
			c.beginPath();
			c.arc(vx, vy, R * f, 0, 7);
			c.stroke();
			c.font = `${gate ? 800 : 600} ${size.toFixed(1)}px "League Spartan", system-ui, sans-serif`;
			c.fillStyle = rgb(col, (gate ? 0.95 : 0.85) * fade);
			const n = ring.words.length;
			const tw = reducedMotion ? 0 : ring.dir * cz * 0.05;
			for (let i = 0; i < n; i++) {
				const a = (i / n) * Math.PI * 2 + ring.twist + tw + roll;
				const x = vx + Math.cos(a) * R * f, y = vy + Math.sin(a) * R * f;
				if (x < -size * 4 || x > W + size * 4 || y < -size * 4 || y > H + size * 4) continue;
				c.save();
				c.translate(x, y);
				c.rotate(a - Math.PI / 2);
				c.fillText(ring.words[i], 0, 0);
				c.restore();
			}
		}
		// speed streaks
		const sp = Math.min(1, Math.abs(S.vel) * 14);
		if (sp > 0.05 && !reducedMotion) {
			c.strokeStyle = rgb(pal.strong, 0.25 * sp);
			c.lineWidth = 1.2;
			c.beginPath();
			for (let i = 0; i < 34; i++) {
				const a = ((i * 2.399) % 6.283) + roll;
				const d1 = 80 + ((i * 97) % 300) + sp * 120;
				const d2 = d1 + 30 + sp * 120;
				c.moveTo(vx + Math.cos(a) * d1, vy + Math.sin(a) * d1);
				c.lineTo(vx + Math.cos(a) * d2, vy + Math.sin(a) * d2);
			}
			c.stroke();
		}
	}
	const journey = createJourney(root, { reducedMotion, dark, scale: 1, maxDpr: 1.25, maxPixels: 2.4e6, follow: 7, draw });
	return () => journey.destroy();
}

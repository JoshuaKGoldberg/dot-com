// Small, hand-drawn Adirondack birds (SVG, side view, facing right) plus a cheap flock scheduler.
// Wing flaps are CSS keyframes (compositor); flights are one Web Animation per hop.
import { rng } from "../two-skies-one-shore/lib.js";

const r1 = (n) => Math.round(n * 10) / 10;

// bl/bh: body half length/height, hr: head radius. Colors are plain fills.
export const SPECIES = {
	chickadee: {
		name: "Black-capped Chickadee", latin: "Poecile atricapillus", w: 34,
		bl: 8.5, bh: 6.5, hr: 5.4, beak: [2.4, 2.2, "#222"], tail: [10, 4.2, 0], wing: [11, 0.9],
		back: "#8a8f94", belly: "#efe6d4", wingc: "#6e7479", head: "#1d1d1f", cheek: "#fbfaf5", cap: "#1d1d1f", bib: "#1d1d1f",
		flap: 0.1, style: "bound", day: true,
		note: "Chick-a-dee-dee-dee! Year-round resident that remembers thousands of hidden seeds.",
	},
	jay: {
		name: "Blue Jay", latin: "Cyanocitta cristata", w: 52,
		bl: 12.5, bh: 8.5, hr: 6.6, beak: [4.4, 3, "#26272b"], tail: [17, 5.2, 0], wing: [17, 0.9],
		back: "#4a7fc4", belly: "#eef0f3", wingc: "#3b6bb0", head: "#5a8fd4", cheek: "#eef0f3", crest: [7, "#4a7fc4"], collar: "#1f2a44", bars: "#f4f6fa",
		flap: 0.14, style: "direct", day: true,
		note: "Loud, clever, and a famous acorn hoarder. It can mimic hawks.",
	},
	cardinal: {
		name: "Northern Cardinal", latin: "Cardinalis cardinalis", w: 46,
		bl: 11, bh: 7.6, hr: 6, beak: [4, 3.6, "#e8764a"], tail: [17, 4.4, 0], wing: [15, 0.9],
		back: "#c72f2c", belly: "#d94a3c", wingc: "#a82426", head: "#cf3631", mask: "#1c1a1a", crest: [7.5, "#c72f2c"],
		flap: 0.13, style: "direct", day: true,
		note: "Bright red against fresh snow. Males sing from the very top of a tree.",
	},
	goldfinch: {
		name: "American Goldfinch", latin: "Spinus tristis", w: 34,
		bl: 8.2, bh: 6, hr: 5, beak: [3.2, 2.8, "#e0a266"], tail: [10, 3.8, 1.5], wing: [11, 0.9],
		back: "#f2cf2f", belly: "#f7dc4f", wingc: "#1f1f22", head: "#f2cf2f", cap: "#1c1c1e", bars: "#fbf4d0",
		flap: 0.09, style: "wave", day: true,
		note: "Flies in a rollercoaster wave, calling po-ta-to-chip with each dip.",
	},
	nuthatch: {
		name: "Red-breasted Nuthatch", latin: "Sitta canadensis", w: 32,
		bl: 8.4, bh: 6, hr: 5, beak: [4.6, 1.8, "#35383b"], tail: [6.5, 4.2, 0], wing: [11, 0.9],
		back: "#6f8ca4", belly: "#d8895c", wingc: "#5f7d96", head: "#6f8ca4", cheek: "#f4f1ea", cap: "#1d1d1f", stripe: "#1d1d1f",
		flap: 0.1, style: "direct", day: true, pose: "down",
		note: "Walks headfirst down trunks, tooting like a tiny tin horn.",
	},
	woodpecker: {
		name: "Pileated Woodpecker", latin: "Dryocopus pileatus", w: 60,
		bl: 14, bh: 8, hr: 6.6, beak: [8.4, 3.2, "#c9c5b8"], tail: [14, 5, 0], wing: [20, 0.9],
		back: "#25262a", belly: "#2c2d31", wingc: "#1d1e22", head: "#25262a", cheek: "#f1efe8", crest: [9, "#d02d2a"], stripe: "#f1efe8",
		flap: 0.15, style: "direct", day: true, pose: "cling",
		note: "Crow-sized and unmistakable. Chisels rectangular holes in dead hemlocks.",
	},
	loon: {
		name: "Common Loon", latin: "Gavia immer", w: 62, swim: true,
		bl: 17, bh: 5.6, hr: 4.6, beak: [8.4, 2.4, "#26272b"], tail: [3, 3, 0], wing: [20, 0.9],
		back: "#1e2024", belly: "#f4f2ed", wingc: "#1e2024", head: "#12302b", collar: "#f4f2ed", spots: "#f4f2ed", eyec: "#c0262a",
		flap: 0.14, style: "direct", day: true, night: true,
		note: "The wail of the Adirondack night. Dives 200 feet for fish.",
	},
	eagle: {
		name: "Bald Eagle", latin: "Haliaeetus leucocephalus", w: 110, soar: true,
		back: "#3a2a20", head: "#f6f3ea", beak: "#e8b430", tail: "#f6f3ea",
		style: "soar", day: true, rare: true,
		note: "Soars on thermals over big lakes. Rare, but returning to the Adirondacks.",
	},
	swallow: {
		name: "Tree Swallow", latin: "Tachycineta bicolor", w: 36,
		bl: 9.4, bh: 5.4, hr: 4.6, beak: [2.4, 2, "#222"], tail: [10, 3.6, 3.4], wing: [18, 0.9],
		back: "#2d6f86", belly: "#f6f6f2", wingc: "#1f3f52", head: "#2a6a86", mask: "#12222c",
		flap: 0.07, style: "wave", day: true,
		note: "Skims the lake at dusk for midges, glossy blue-green in the light.",
	},
	owl: {
		name: "Barred Owl", latin: "Strix varia", w: 56,
		bl: 11, bh: 10.5, hr: 8.4, beak: [2.8, 2.8, "#e4b244"], tail: [12, 6, 0], wing: [20, 0.9],
		back: "#8c7a64", belly: "#d9ccb4", wingc: "#6f5f4b", head: "#8c7a64", disc: "#ddd2bd", eyec: "#241d17", bigeye: true, bars: "#5c4d3b",
		flap: 0.2, style: "glide", night: true, pose: "upright",
		note: "Who cooks for you? Who cooks for you-all? Calls day or night.",
	},
	sawwhet: {
		name: "Northern Saw-whet Owl", latin: "Aegolius acadicus", w: 34,
		bl: 7, bh: 7, hr: 6.2, beak: [2, 2.2, "#2b2a28"], tail: [6, 4, 0], wing: [12, 0.9],
		back: "#8a6b4c", belly: "#efe6d3", wingc: "#6f5239", head: "#8a6b4c", disc: "#efe6d3", eyec: "#e2b92f", bigeye: true, bars: "#ecdcc2",
		flap: 0.1, style: "glide", night: true, pose: "upright", rare: true,
		note: "No bigger than a coffee mug. Its call is a tireless toot, toot, toot.",
	},
};

export const DAY = Object.keys(SPECIES).filter((k) => SPECIES[k].day);
export const NIGHT = Object.keys(SPECIES).filter((k) => SPECIES[k].night);

function eagleSVG(s) {
	return `<svg viewBox="-60 -30 120 60" width="${s.w}" height="${s.w / 2}" aria-hidden="true">
	<g class="soar"><path d="M-58 -4 C-44 -14 -30 -17 -14 -10 C-8 -16 8 -16 14 -10 C30 -17 44 -14 58 -4 C46 -6 36 -3 28 2 L20 -3 L12 4 L6 -2 L0 6 L-6 -2 L-12 4 L-20 -3 L-28 2 C-36 -3 -46 -6 -58 -4Z" fill="${s.back}"/>
	<path d="M-14 4 L-9 21 L-4 14 L0 24 L4 14 L9 21 L14 4Z" fill="${s.tail}"/>
	<ellipse cx="0" cy="-2" rx="9" ry="4.6" fill="${s.back}"/><circle cx="8.5" cy="-5.4" r="4.4" fill="${s.head}"/>
	<path d="M12 -6.4 L18 -4.6 L12.4 -2.4Z" fill="${s.beak}"/><circle cx="10.2" cy="-6.2" r="0.9" fill="#222"/></g></svg>`;
}

// Build a bird as an SVG string. Perched pose shows the folded wing; .flying shows the open pair.
export function birdSVG(key, scale = 1) {
	const s = SPECIES[key];
	if (s.soar) return eagleSVG({ ...s, w: s.w * scale });
	const { bl, bh, hr } = s;
	const hx = bl * 0.64, hy = -bh * 0.78;
	const [bkL, bkH, bkC] = s.beak;
	const [tl, tw, fork] = s.tail;
	const W = s.wing[0];
	const sx = bl * 0.18, sy = -bh * 0.5;
	const p = (n) => r1(n);
	const tail = `<g class="b-tail"><path d="M${p(-bl * 0.55)} ${p(-bh * 0.45)} L${p(-bl - tl)} ${p(-bh * 0.1 - tw / 2 + 1)} ${fork ? `L${p(-bl - tl + fork)} ${p(-bh * 0.1 + 1)} ` : ""}L${p(-bl - tl)} ${p(-bh * 0.1 + tw / 2 + 2)} L${p(-bl * 0.5)} ${p(bh * 0.4)}Z" fill="${s.wingc}"/></g>`;
	const wingOpen = (cls) => `<g transform="translate(${p(sx)} ${p(sy)})"><g class="wflap ${cls}"><path d="M0 0 C${p(W * 0.12)} ${p(-W * 0.45)} ${p(-W * 0.08)} ${p(-W * 0.85)} ${p(-W * 0.42)} ${p(-W)} L${p(-W * 0.36)} ${p(-W * 0.8)} L${p(-W * 0.52)} ${p(-W * 0.72)} L${p(-W * 0.38)} ${p(-W * 0.54)} L${p(-W * 0.5)} ${p(-W * 0.38)} C${p(-W * 0.3)} ${p(-W * 0.12)} ${p(-W * 0.2)} 0 ${p(-W * 0.28)} ${p(bh * 0.3)}Z" fill="${s.wingc}"/></g></g>`;
	const fold = `<g class="wing-fold"><path d="M${p(bl * 0.55)} ${p(-bh * 0.5)} C${p(bl * 0.3)} ${p(-bh * 1.02)} ${p(-bl * 0.4)} ${p(-bh * 0.9)} ${p(-bl * 0.98)} ${p(bh * 0.05)} C${p(-bl * 0.45)} ${p(bh * 0.28)} ${p(bl * 0.2)} ${p(bh * 0.2)} ${p(bl * 0.55)} ${p(-bh * 0.5)}Z" fill="${s.wingc}"/>${
		s.bars ? `<path d="M${p(bl * 0.3)} ${p(-bh * 0.45)} Q${p(bl * 0.05)} ${p(-bh * 0.15)} ${p(-bl * 0.25)} ${p(-bh * 0.28)} M${p(bl * 0.12)} ${p(-bh * 0.18)} Q${p(-bl * 0.1)} ${p(bh * 0.06)} ${p(-bl * 0.4)} ${p(-bh * 0.04)}" stroke="${s.bars}" stroke-width="${p(bl * 0.07)}" fill="none" stroke-linecap="round" opacity="0.85"/>` : ""
	}</g>`;
	let body;
	if (s.swim) {
		body = `<ellipse cx="0" cy="0" rx="${bl}" ry="${bh}" fill="${s.back}"/><ellipse cx="${p(bl * 0.1)}" cy="${p(bh * 0.4)}" rx="${p(bl * 0.8)}" ry="${p(bh * 0.55)}" fill="${s.belly}"/>` +
			Array.from({ length: 9 }, (_, i) => `<circle cx="${p(-bl * 0.7 + i * bl * 0.15)}" cy="${p(-bh * 0.35 + (i % 3) * 1.6)}" r="0.8" fill="${s.spots}"/>`).join("");
	} else {
		body = `<ellipse cx="0" cy="0" rx="${bl}" ry="${bh}" fill="${s.back}"/><ellipse cx="${p(bl * 0.12)}" cy="${p(bh * 0.36)}" rx="${p(bl * 0.84)}" ry="${p(bh * 0.62)}" fill="${s.belly}"/>`;
	}
	const neckLen = s.swim ? hr * 1.2 : 0;
	const hx2 = s.swim ? bl * 0.78 : hx;
	const hy2 = s.swim ? -bh - neckLen * 0.7 : hy;
	const neck = s.swim
		? `<path d="M${p(bl * 0.6)} ${p(-bh * 0.6)} L${p(hx2 - hr * 0.7)} ${p(hy2)} L${p(hx2 + hr * 0.6)} ${p(hy2 + hr)} L${p(bl * 0.95)} ${p(-bh * 0.3)}Z" fill="${s.head}"/><path d="M${p(hx2 - hr * 0.5)} ${p(hy2 + hr * 1.5)} l${p(hr * 1.1)} ${p(-hr * 0.4)} l0.8 2.2 l${p(-hr * 1.1)} 0.2Z" fill="${s.collar}"/>`
		: `<ellipse cx="${p(bl * 0.4)}" cy="${p(-bh * 0.38)}" rx="${p(bl * 0.4)}" ry="${p(bh * 0.7)}" fill="${s.head === s.back ? s.back : s.head}" transform="rotate(-18 ${p(bl * 0.4)} ${p(-bh * 0.38)})"/>`;
	const hxx = hx2, hyy = hy2;
	let head = `<circle cx="${p(hxx)}" cy="${p(hyy)}" r="${hr}" fill="${s.head}"/>`;
	if (s.disc) head += `<ellipse cx="${p(hxx + hr * 0.3)}" cy="${p(hyy + hr * 0.1)}" rx="${p(hr * 0.88)}" ry="${p(hr * 0.84)}" fill="${s.disc}"/>`;
	if (s.cheek) head += `<ellipse cx="${p(hxx + hr * 0.08)}" cy="${p(hyy + hr * 0.46)}" rx="${p(hr * 0.84)}" ry="${p(hr * 0.5)}" fill="${s.cheek}"/>`;
	if (s.cap) head += `<path d="M${p(hxx - hr)} ${p(hyy + hr * 0.05)} A${hr} ${hr} 0 0 1 ${p(hxx + hr)} ${p(hyy + hr * 0.05)} Q${p(hxx + hr * 0.2)} ${p(hyy - hr * 0.2)} ${p(hxx - hr)} ${p(hyy + hr * 0.05)}Z" fill="${s.cap}"/>`;
	if (s.stripe) head += `<path d="M${p(hxx - hr * 0.8)} ${p(hyy - hr * 0.1)} L${p(hxx + hr * 0.9)} ${p(hyy - hr * 0.2)}" stroke="${s.stripe}" stroke-width="${p(hr * 0.3)}" stroke-linecap="round"/>`;
	if (s.mask) head += `<ellipse cx="${p(hxx + hr * 0.55)}" cy="${p(hyy + hr * 0.3)}" rx="${p(hr * 0.5)}" ry="${p(hr * 0.5)}" fill="${s.mask}"/>`;
	if (s.bib) head += `<ellipse cx="${p(hxx + hr * 0.3)}" cy="${p(hyy + hr * 1.0)}" rx="${p(hr * 0.5)}" ry="${p(hr * 0.42)}" fill="${s.bib}"/>`;
	if (s.collar && !s.swim) head += `<path d="M${p(hxx - hr * 0.9)} ${p(hyy + hr * 0.6)} Q${p(hxx - hr * 0.2)} ${p(hyy + hr * 1.5)} ${p(hxx + hr * 0.9)} ${p(hyy + hr * 0.9)}" stroke="${s.collar}" stroke-width="${p(hr * 0.28)}" fill="none" stroke-linecap="round"/>`;
	const crest = s.crest ? `<path d="M${p(hxx + hr * 0.1)} ${p(hyy - hr * 0.95)} L${p(hxx - hr * 1.3)} ${p(hyy - hr - s.crest[0] * 0.7)} L${p(hxx - hr * 0.9)} ${p(hyy - hr * 0.1)} L${p(hxx + hr * 0.6)} ${p(hyy - hr * 0.7)}Z" fill="${s.crest[1]}"/>` : "";
	const tufts = s.disc ? `<path d="M${p(hxx - hr * 0.7)} ${p(hyy - hr * 0.7)} L${p(hxx - hr * 0.5)} ${p(hyy - hr * 1.3)} L${p(hxx - hr * 0.1)} ${p(hyy - hr * 0.9)}Z" fill="${s.head}"/>` : "";
	const bx = hxx + hr * 0.8;
	const beak = s.bigeye
		? `<path d="M${p(hxx + hr * 0.42)} ${p(hyy + hr * 0.1)} l${p(bkL)} ${p(bkH * 0.55)} l${p(-bkL * 0.4)} ${p(bkH * 0.6)}Z" fill="${bkC}"/>`
		: `<path d="M${p(bx)} ${p(hyy - bkH / 2)} L${p(bx + bkL)} ${p(hyy + bkH * 0.2)} L${p(bx)} ${p(hyy + bkH / 2)}Z" fill="${bkC}"/>`;
	const er = s.bigeye ? hr * 0.3 : Math.max(1, hr * 0.2);
	const ex = hxx + (s.bigeye ? hr * 0.22 : hr * 0.38);
	const eye = `<circle cx="${p(ex)}" cy="${p(hyy - hr * 0.1)}" r="${p(er)}" fill="${s.eyec || "#17171a"}"/>${s.bigeye ? `<circle cx="${p(ex)}" cy="${p(hyy - hr * 0.1)}" r="${p(er * 0.55)}" fill="#0b0b0c"/>` : ""}<circle cx="${p(ex + er * 0.35)}" cy="${p(hyy - hr * 0.1 - er * 0.35)}" r="${p(Math.max(0.35, er * 0.3))}" fill="#fff"/>`;
	const legs = s.swim ? "" : `<g class="legs" stroke="#4a3d36" stroke-width="1.1" stroke-linecap="round" fill="none"><path d="M${p(bl * 0.1)} ${p(bh * 0.85)} l-0.5 ${p(bh * 0.7)} l-2 1M${p(bl * 0.3)} ${p(bh * 0.8)} l0.4 ${p(bh * 0.7)} l-2 1"/></g>`;
	const flap = `style="--flap:${s.flap}s"`;
	const rot = s.swim ? "" : "";
	return `<svg viewBox="-34 -32 68 62" width="${p(68 * scale * (s.w / 56))}" height="${p(62 * scale * (s.w / 56))}" aria-hidden="true" ${flap}>
	<g class="b-all">${wingOpen("far")}${tail}<g class="b-core">${body}${legs}${fold}</g>${neck}<g class="b-head">${head}${tufts}${crest}${beak}${eye}</g>${wingOpen("near")}</g></svg>`;
}

// ---------- flock ----------
// A flock owns a few birds in a positioned layer. Perches are {x, y} in 0..1 of the layer (y = feet),
// optional {face: 1|-1, pose: 'cling'|'down'}. Flights are single Web Animations.
const smooth = (t) => t * t * (3 - 2 * t);

function flightFrames(a, b, style, face, seedR) {
	const dx = b.x - a.x, dy = b.y - a.y;
	const dist = Math.hypot(dx, dy);
	const n = Math.max(10, Math.min(28, Math.round(dist / 22)));
	const lift = Math.min(70, dist * 0.18) * (style === "direct" ? 1 : 0.6);
	const cx = (a.x + b.x) / 2, cy = Math.min(a.y, b.y) - lift - 10;
	const frames = [];
	let prev = null;
	const amp = style === "wave" ? 11 : style === "bound" ? 7 : 0;
	const per = style === "wave" ? 9 : 5;
	for (let i = 0; i <= n; i++) {
		const t = i / n, s = smooth(t);
		let x = (1 - s) * (1 - s) * a.x + 2 * (1 - s) * s * cx + s * s * b.x;
		let y = (1 - s) * (1 - s) * a.y + 2 * (1 - s) * s * cy + s * s * b.y;
		if (amp) y += Math.sin(t * per * Math.PI) * amp * Math.sin(Math.PI * t);
		const dir = x - (prev ? prev.x : a.x) || dx;
		const f = { x, y, dir: Math.sign(dir) || face };
		frames.push(f);
		prev = f;
	}
	return frames.map((f, i) => {
		const nx = frames[Math.min(i + 1, frames.length - 1)], pv = frames[Math.max(i - 1, 0)];
		const pitch = Math.atan2(nx.y - pv.y, Math.abs(nx.x - pv.x) + 0.001) * (180 / Math.PI);
		const fl = Math.max(-35, Math.min(35, pitch)) * (i > n - 3 ? -1.3 : 1);
		const d = Math.sign(dx) || face;
		return { transform: `translate(${r1(f.x)}px, ${r1(f.y)}px) scaleX(${d}) rotate(${r1(d > 0 ? fl : fl)}deg)`, offset: i / n };
	});
}

export function createFlock(layer, o) {
	const { species, perches, count = species.length, reduced = false, seed = 7, onPick, size = 1, perchLabel = "bird", interval = [2200, 5200], rest = false } = o;
	const R = rng(seed);
	const birds = [];
	let timer = 0, stopped = false;
	const dims = () => ({ w: layer.clientWidth || innerWidth, h: layer.clientHeight || innerHeight });
	const pos = (pc) => {
		const { w, h } = dims();
		return { x: pc.x * w, y: pc.y * h };
	};
	const freePerch = (self) => {
		const free = perches.filter((pc) => (!self || (!!self.sp.swim === !!pc.water && !!pc.trunk === (self.sp.pose === "cling" || self.sp.pose === "down"))) && !birds.some((b) => b !== self && b.perch === pc));
		return free[Math.floor(R() * free.length)];
	};
	const setPose = (b, state) => {
		b.el.classList.toggle("flying", state === "fly");
		b.el.classList.toggle("perched", state !== "fly");
		const pc = b.perch;
		b.el.dataset.pose = state === "fly" ? "" : pc?.pose || b.sp.pose || "";
	};
	const place = (b, pc, face) => {
		const p = pos(pc);
		const sp = b.sp;
		const lift = sp.swim ? -2 : -(sp.bh || 6) * 0.95 * size * (sp.w / 56);
		b.pos = { x: p.x, y: p.y + lift };
		b.face = face ?? pc.face ?? 1;
		b.el.style.transform = `translate(${r1(b.pos.x)}px, ${r1(b.pos.y)}px) scaleX(${b.face})`;
	};

	function make(key, i) {
		const sp = SPECIES[key];
		const el = document.createElement("div");
		el.className = "bird perched";
		el.dataset.species = key;
		el.innerHTML = birdSVG(key, size);
		layer.appendChild(el);
		const b = { key, sp, el, perch: null, pos: { x: 0, y: 0 }, face: 1, busy: false, anim: null };
		const pc = freePerch(b) || perches.find((q) => !!q.water === !!sp.swim && !!q.trunk === (sp.pose === "cling" || sp.pose === "down")) || perches[0];
		b.perch = pc;
		place(b, pc, i % 2 ? -1 : 1);
		setPose(b, "perch");
		if (onPick) {
			el.classList.add("pickable");
			el.setAttribute("role", "button");
			el.tabIndex = 0;
			el.setAttribute("aria-label", `${sp.name}: log sighting`);
			const pick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				onPick(b);
			};
			el.addEventListener("click", pick);
			el.addEventListener("keydown", (e) => {
				if (e.key === "Enter" || e.key === " ") pick(e);
			});
		}
		el.style.setProperty("--blink", `${(3 + R() * 5).toFixed(1)}s`);
		el.style.setProperty("--blink-d", `${(-R() * 6).toFixed(1)}s`);
		return b;
	}

	function fly(b, to, opts = {}) {
		const { w, h } = dims();
		if (b.busy) return;
		b.busy = true;
		const sp = b.sp;
		const from = b.pos;
		let dest;
		if (to === "away") {
			const side = (from.x < w / 2 ? -1 : 1) * (R() < 0.8 ? 1 : -1);
			dest = { x: side < 0 ? -90 : w + 90, y: from.y - 40 - R() * h * 0.25 };
		} else {
			const p = pos(to);
			const lift = sp.swim ? -2 : -(sp.bh || 6) * 0.95 * size * (sp.w / 56);
			dest = { x: p.x, y: p.y + lift };
		}
		const dist = Math.hypot(dest.x - from.x, dest.y - from.y);
		const speed = (opts.speed || (sp.style === "soar" ? 90 : sp.style === "wave" ? 330 : 280)) * (0.85 + R() * 0.3);
		const dur = Math.max(500, (dist / speed) * 1000);
		const face = Math.sign(dest.x - from.x) || b.face;
		const frames = flightFrames(from, dest, sp.style === "glide" ? "direct" : sp.style, face, R);
		b.perch = to === "away" ? null : to;
		setPose(b, "fly");
		const flapScale = sp.style === "wave" ? 1 : 1;
		b.el.style.setProperty("--flap", `${sp.flap * flapScale}s`);
		b.anim = b.el.animate(frames, { duration: dur, easing: "cubic-bezier(.3,.05,.7,.95)", fill: "forwards" });
		b.anim.onfinish = () => {
			b.anim = null;
			b.busy = false;
			if (to === "away") {
				b.el.style.visibility = "hidden";
				b.away = true;
				b.pos = { x: dest.x, y: dest.y };
				return;
			}
			b.anim?.cancel?.();
			place(b, to, face);
			setPose(b, "perch");
			opts.onLand?.(b);
		};
	}

	function tick() {
		if (stopped) return;
		const b = birds[Math.floor(R() * birds.length)];
		if (b && !b.busy && !b.held) {
			if (b.away) {
				const to = freePerch(b);
				if (to) {
					const { w } = dims();
					b.pos = { x: R() < 0.5 ? -80 : w + 80, y: pos(to).y - 120 };
					b.away = false;
					b.el.style.visibility = "";
					b.el.style.transform = `translate(${r1(b.pos.x)}px, ${r1(b.pos.y)}px)`;
					fly(b, to);
				}
			} else if (b.sp.swim) {
				const to = freePerch(b);
				if (to) fly(b, to, { speed: 22 });
			} else if (R() < 0.18 && !rest) {
				fly(b, "away");
			} else {
				const to = freePerch(b);
				if (to) fly(b, to);
			}
		}
		timer = setTimeout(tick, interval[0] + R() * (interval[1] - interval[0]));
	}

	species.slice(0, count).forEach((k, i) => birds.push(make(k, i)));

	return {
		birds,
		perches,
		start() {
			if (reduced || stopped) return;
			timer = setTimeout(tick, 900 + R() * 1200);
		},
		stop() {
			stopped = true;
			clearTimeout(timer);
			birds.forEach((b) => b.anim?.cancel());
		},
		// Startle everything: used by lightning and clicks.
		scatter(only) {
			if (reduced) return;
			for (const b of birds) {
				if (b.busy || b.sp.swim || (only && !only(b))) continue;
				if (b.away) continue;
				fly(b, "away", { speed: 420 });
			}
		},
		fly,
		freePerch,
		place,
		pos,
		setPose,
		dims,
		restore(b) {
			b.away = false;
			b.el.style.visibility = "";
		},
	};
}

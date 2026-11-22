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

const el = (name, attrs, parent) => {
	const n = document.createElementNS(NS, name);
	for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
	parent?.appendChild(n);
	return n;
};

// Build a squiggle-wave stem path along a direction, returning points for leaves.
function stemPoints(x0, y0, angle, length, amp, wave, rand) {
	const pts = [];
	const dx = Math.cos(angle);
	const dy = Math.sin(angle);
	const nx = -dy;
	const ny = dx;
	const phase = rand() * 6;
	for (let d = 0; d <= length; d += 5) {
		const drift = Math.sin(d / 140 + phase) * 26;
		const off = Math.sin((d / wave) * Math.PI * 2 + phase) * amp + drift;
		pts.push([x0 + dx * d + nx * off, y0 + dy * d + ny * off, d]);
	}
	return pts;
}

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".site-scenery .scenery-b");
	const W = layer.clientWidth || 1280;
	const H = layer.clientHeight || 760;
	const rand = rng(424242);
	const svg = el("svg", { class: "garden", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none" }, layer);
	const side = Math.min(240, Math.max(60, (W - 832) / 2 - 8));
	const specs = [
		{ x: 6, y: H + 10, a: -1.45, len: H * 0.9 },
		{ x: W - 10, y: H + 10, a: -1.7, len: H * 0.8 },
		{ x: -6, y: H * 0.18, a: 0.5, len: Math.min(side + 60, 300) },
		{ x: W + 6, y: H * 0.5, a: Math.PI - 0.35, len: Math.min(side + 60, 280) },
		{ x: 30, y: H + 10, a: -1.1, len: H * 0.4 },
	];
	const vines = [];
	for (const spec of specs) {
		const pts = stemPoints(spec.x, spec.y, spec.a, spec.len, 10, 40, rand);
		// keep vines out of the text column
		const clamped = pts.map(([x, y, d]) => {
			if (x < W / 2) return [Math.min(x, side), y, d];
			return [Math.max(x, W - side), y, d];
		});
		const d = clamped.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
		const g = el("g", { class: "vine" }, svg);
		const path = el("path", { class: "stem", d, "stroke-width": (1.4 + rand() * 0.8).toFixed(2) }, g);
		const len = path.getTotalLength();
		const leaves = [];
		for (let i = 6; i < clamped.length - 1; i += 4 + Math.floor(rand() * 4)) {
			const [x, y] = clamped[i];
			const [px, py] = clamped[i - 1];
			const ang = Math.atan2(y - py, x - px);
			const dir = rand() < 0.5 ? 1 : -1;
			const la = ang + dir * (0.9 + rand() * 0.4);
			const s = 10 + rand() * 7;
			const leaf = el(
				"path",
				{
					class: "leaf",
					d: `M0 0C${s * 0.4} ${-s * 0.5} ${s * 0.9} ${-s * 0.4} ${s * 1.3} 0C${s * 0.9} ${s * 0.4} ${s * 0.4} ${s * 0.5} 0 0Z`,
					transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${((la * 180) / Math.PI).toFixed(0)})`,
				},
				g,
			);
			leaves.push({ el: leaf, at: i / clamped.length });
		}
		const buds = [];
		for (let k = 0; k < 2; k++) {
			const i = 10 + Math.floor(rand() * (clamped.length - 14));
			const [x, y] = clamped[i];
			buds.push({ el: el("circle", { class: "bud", cx: x.toFixed(1), cy: y.toFixed(1), r: 3.4 }, g), at: i / clamped.length });
		}
		vines.push({ g, path, len, leaves, buds, d });
	}

	if (reducedMotion) {
		for (const v of vines) {
			v.path.style.strokeDasharray = "none";
			v.leaves.forEach((l) => l.el.classList.add("is-on"));
			v.buds.forEach((b) => b.el.classList.add("is-on"));
		}
		return;
	}

	// Each vine: grow ~40s (rAF-free: use Web Animations), prune along a straight cut ~2s, regrow.
	const anims = [];
	let stopped = false;
	const timers = new Set();
	const later = (fn, ms) => {
		const t = setTimeout(() => {
			timers.delete(t);
			if (!stopped) fn();
		}, ms);
		timers.add(t);
	};
	const reducedHead = (idx) => 18000 + ((idx * 7919) % 5) * 4000;
	vines.forEach((v, idx) => {
		v.path.style.strokeDasharray = `${v.len}`;
		v.path.style.strokeDashoffset = `${v.len}`;
		const cut = el("line", { stroke: "none" }, v.g); // placeholder to keep structure simple
		cut.remove();
		// `head` skips ahead so the garden is already partly grown on first view.
		const cycle = (head = 0) => {
			v.leaves.forEach((l) => l.el.classList.remove("is-on"));
			v.buds.forEach((b) => b.el.classList.remove("is-on"));
			v.path.style.strokeDashoffset = `${v.len}`;
			const grow = v.path.animate([{ strokeDashoffset: v.len }, { strokeDashoffset: 0 }], {
				duration: 40000,
				easing: "ease-out",
				fill: "forwards",
			});
			grow.currentTime = head;
			anims.push(grow);
			v.leaves.forEach((l) => later(() => l.el.classList.add("is-on"), Math.max(0, l.at * 40000 * 0.8 + 800 - head)));
			v.buds.forEach((b) => later(() => b.el.classList.add("is-on"), Math.max(0, b.at * 40000 * 0.8 + 3000 - head)));
			// prune: retract the stem from the tip back along the cut in about 2s
			later(() => {
				v.leaves.forEach((l) => l.el.classList.remove("is-on"));
				v.buds.forEach((b) => b.el.classList.remove("is-on"));
				// cut from the tip toward the base, not all the way: leaves a short stub
				const stub = v.len * 0.12;
				const prune = v.path.animate([{ strokeDashoffset: 0 }, { strokeDashoffset: v.len - stub }], {
					duration: 2000,
					easing: "cubic-bezier(.6,0,.9,.4)",
					fill: "forwards",
				});
				anims.push(prune);
				prune.onfinish = () => {
					grow.cancel();
					prune.cancel();
					v.path.style.strokeDashoffset = `${v.len - stub}`;
					later(cycle, 1200);
				};
			}, 40000 + 9000 + idx * 3000 - head);
		};
		cycle(reducedHead(idx));
	});

	return () => {
		stopped = true;
		timers.forEach(clearTimeout);
		anims.forEach((a) => a.cancel());
	};
}

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

function el(name, attrs, parent) {
	const node = document.createElementNS(NS, name);
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
	parent?.appendChild(node);
	return node;
}

function buildTree(side, seed, height) {
	const rand = rng(seed);
	const w = 300;
	const svg = el("svg", { class: `ast-tree is-${side}`, viewBox: `0 0 ${w} ${height}`, preserveAspectRatio: "xMidYMax meet" });
	const g = el("g", { class: "ast-sway" }, svg);
	g.style.transformOrigin = `${w / 2}px ${height}px`;
	const tips = [];
	const lean = side === "left" ? -9 : 9;
	const trunkX = side === "left" ? 80 : w - 80; // lean away from the text column
	const maxDepth = 8;
	function grow(x, y, angle, len, depth) {
		const rad = ((angle - 90) * Math.PI) / 180;
		const x2 = x + Math.cos(rad) * len;
		const y2 = y + Math.sin(rad) * len;
		const sw = Math.max(0.5, 7 * Math.pow(0.68, depth));
		const bend = (rand() - 0.5) * len * 0.25;
		const mx = (x + x2) / 2 + Math.cos(rad + Math.PI / 2) * bend;
		const my = (y + y2) / 2 + Math.sin(rad + Math.PI / 2) * bend;
		el("path", { d: `M${x.toFixed(1)} ${y.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`, "stroke-width": sw.toFixed(2) }, g);
		if (depth >= maxDepth || len < 9) {
			tips.push(el("circle", { cx: x2.toFixed(1), cy: y2.toFixed(1), r: 1.5 }, g));
			return;
		}
		// binary fork; occasionally one child ends early
		const spread = 11 + rand() * 15;
		const shrink = 0.72 + rand() * 0.06;
		const skew = (rand() - 0.5) * 10;
		grow(x2, y2, angle - spread + skew, len * shrink, depth + 1);
		if (depth > 3 && rand() < 0.14) {
			tips.push(el("circle", { cx: x2.toFixed(1), cy: y2.toFixed(1), r: 1.5 }, g));
		} else {
			grow(x2, y2, angle + spread + skew, len * (shrink - 0.03 - rand() * 0.06), depth + 1);
		}
	}
	grow(trunkX, height + 6, lean, height * 0.14, 0);
	return { svg, tips };
}

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".site-scenery .scenery-b");
	const height = Math.max(500, Math.round(layer.clientHeight || 760));
	const trees = [buildTree("left", 20240117, height), buildTree("right", 7771031, height)];
	trees.forEach((t) => layer.appendChild(t.svg));

	let timer;
	const timeouts = new Set();
	if (!reducedMotion) {
		const visit = () => {
			const t = trees[Math.floor(Math.random() * 2)];
			const tip = t.tips[Math.floor(Math.random() * t.tips.length)];
			tip.classList.add("is-lit");
			const off = setTimeout(() => {
				tip.classList.remove("is-lit");
				timeouts.delete(off);
			}, 2200);
			timeouts.add(off);
			timer = setTimeout(visit, 5000 + Math.random() * 9000);
		};
		timer = setTimeout(visit, 1200);
	} else {
		trees[0].tips[Math.floor(trees[0].tips.length / 2)].classList.add("is-lit");
	}
	return () => {
		clearTimeout(timer);
		timeouts.forEach(clearTimeout);
	};
}

const PALETTE = [
	["#ff6f91", "#ffd34d"],
	["#ffb347", "#ff6f61"],
	["#b28dff", "#ffe27a"],
	["#5ec8ff", "#ffffff"],
	["#ff9ec7", "#ffd34d"],
	["#ffffff", "#ffb703"],
];
const MAX = 110;

const hash = (s) => {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
	return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
};

function head(colors, rot) {
	const petals = [0, 72, 144, 216, 288]
		.map((a) => `<ellipse cx="12" cy="5" rx="3.3" ry="4.8" transform="rotate(${a + rot} 12 10)"/>`)
		.join("");
	return `<g fill="${colors[0]}" stroke="rgb(0 0 0 / .12)" stroke-width=".4">${petals}</g><circle cx="12" cy="10" r="2.7" fill="${colors[1]}"/>`;
}

export function create(root, reduced) {
	const page = root.querySelector(".site-page");
	const layer = document.createElement("div");
	layer.className = "sg-layer";
	page.append(layer);
	const flowers = new Map();
	let raf = 0;

	function lines(range) {
		const rects = [...range.getClientRects()]
			.filter((r) => r.width >= 5 && r.height >= 8 && r.height <= 70)
			.sort((a, b) => a.bottom - b.bottom);
		const groups = [];
		for (const r of rects) {
			const g = groups.at(-1);
			if (g && r.bottom - g.bottom < 7) { g.segs.push([r.left, r.right, r.bottom]); g.bottom = Math.max(g.bottom, r.bottom); }
			else groups.push({ bottom: r.bottom, segs: [[r.left, r.right, r.bottom]] });
		}
		const out = [];
		for (const { segs, bottom } of groups) {
			for (const s of segs) s[2] = bottom;
			segs.sort((a, b) => a[0] - b[0]);
			let cur;
			for (const s of segs) {
				if (cur && s[0] <= cur[1] + 4) { cur[1] = Math.max(cur[1], s[1]); continue; }
				if (cur) out.push(cur);
				cur = [...s];
			}
			if (cur) out.push(cur);
		}
		return out;
	}

	function plant(key, x, y, i) {
		const r = hash(key);
		const r2 = hash(key + "b");
		const stemH = 6 + r * 14;
		const size = 16 + r2 * 9;
		const colors = PALETTE[Math.floor(hash(key + "c") * PALETTE.length)];
		const el = document.createElement("i");
		el.className = "sg-f";
		const w = size;
		const h = size + stemH;
		el.style.cssText = `--x:${(x - w / 2).toFixed(1)}px;--y:${(y - h + 3).toFixed(1)}px;--d:${Math.min(i * 22, 700)}ms;width:${w}px;height:${h}px`;
		el.innerHTML = `<svg viewBox="0 0 24 ${24 + stemH * (24 / size)}" width="${w}" height="${h}"><g class="sg-sway"><path d="M12 12 Q ${10 + r * 4} ${18 + stemH * 0.5} 12 ${24 + stemH * (24 / size)}" stroke="#4f9d5d" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M12 ${14 + stemH} q 6 -2 7 -7 q -6 0 -7 7z" fill="#5fb36c"/>${head(colors, r * 70)}</g></svg>`;
		layer.append(el);
		flowers.set(key, el);
	}

	function wilt(key) {
		const el = flowers.get(key);
		flowers.delete(key);
		if (reduced) return el.remove();
		el.classList.add("is-wilting");
		el.addEventListener("animationend", () => el.remove(), { once: true });
		setTimeout(() => el.remove(), 1200);
	}

	function sync() {
		raf = 0;
		const sel = getSelection();
		const want = new Set();
		if (sel && !sel.isCollapsed && sel.rangeCount && root.contains(sel.anchorNode)) {
			const o = page.getBoundingClientRect();
			let n = 0;
			for (const [l, r, bottom] of lines(sel.getRangeAt(0))) {
				const y = bottom - o.top;
				for (let x = l + 10; x < r - 6 && want.size < MAX; x += 26) {
					const key = `${Math.round(y / 4)}:${Math.round((x - o.left) / 26)}`;
					const jx = (hash(key) - 0.5) * 8;
					want.add(key);
					if (!flowers.has(key)) plant(key, x - o.left + jx, y, n++);
				}
			}
		}
		for (const key of [...flowers.keys()]) if (!want.has(key)) wilt(key);
	}

	return {
		update() { raf ||= requestAnimationFrame(sync); },
		destroy() { cancelAnimationFrame(raf); layer.remove(); flowers.clear(); },
	};
}

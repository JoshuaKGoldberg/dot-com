// 146: every post gets a generative cover seeded by its title (tile-based, one shared system).
import { loadData, hash, rng } from "./post-covers/lib.js";

const COLS = 8, ROWS = 4;

function palette(r) {
	const h = Math.floor(r() * 360);
	const sat = 55 + r() * 25;
	const c = (hh, s, l) => `hsl(${Math.round(hh) % 360} ${Math.round(s)}% ${Math.round(l)}%)`;
	return [c(h, sat, 18 + r() * 8), c(h + 20, sat, 40 + r() * 8), c(h - 25, sat - 10, 74 + r() * 8), c(h + 150 + r() * 40, sat + 10, 58 + r() * 8), c(h + 8, 30, 93)];
}

const shapes = [
	(x, y, a, b) => `<path d="M${x} ${y}h1a1 1 0 0 1-1 1z" fill="${a}"/>`,
	(x, y, a) => `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.42" fill="${a}"/>`,
	(x, y, a, b) => `<circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.46" fill="${a}"/><circle cx="${x + 0.5}" cy="${y + 0.5}" r="0.22" fill="${b}"/>`,
	(x, y, a) => `<path d="M${x} ${y + 1}a.5.5 0 0 1 1 0z" fill="${a}"/>`,
	(x, y, a) => `<path d="M${x} ${y}h1v1z" fill="${a}"/>`,
	(x, y, a) => `<path d="M${x + 0.5} ${y}l.5.5-.5.5-.5-.5z" fill="${a}"/>`,
	(x, y, a) => `<path d="M${x + 0.17} ${y}v1M${x + 0.5} ${y}v1M${x + 0.83} ${y}v1" stroke="${a}" stroke-width=".16"/>`,
	(x, y, a, b) => `<path d="M${x} ${y}h1v.5h-1z" fill="${a}"/><circle cx="${x + 0.5}" cy="${y + 0.75}" r=".2" fill="${b}"/>`,
];

export function coverSvg(title, { label = false } = {}) {
	const r = rng(hash(title));
	const p = palette(r);
	let out = `<svg viewBox="0 0 ${COLS} ${ROWS}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Generated cover for ${title.replace(/"/g, "")}" shape-rendering="geometricPrecision">`;
	for (let y = 0; y < ROWS; y++) {
		for (let x = 0; x < COLS; x++) {
			const bg = p[Math.floor(r() * 3)];
			let fg = p[Math.floor(r() * 5)];
			if (fg === bg) fg = p[4];
			const rot = Math.floor(r() * 4) * 90;
			const idx = Math.floor(r() * shapes.length);
			out += `<rect x="${x}" y="${y}" width="1.01" height="1.01" fill="${bg}"/>`;
			if (r() < 0.82) {
				out += `<g transform="rotate(${rot} ${x + 0.5} ${y + 0.5})">${shapes[idx](x, y, fg, p[3 + Math.floor(r() * 2)] === fg ? p[0] : p[3])}</g>`;
			}
		}
	}
	return out + "</svg>";
}

export function activate({ root }) {
	const posts = [...root.querySelectorAll(".site-post")];
	for (const post of posts) {
		const t = post.querySelector(".site-item-title");
		const cover = document.createElement("div");
		cover.className = "pc-cover";
		cover.innerHTML = coverSvg(t.textContent.trim());
		post.prepend(cover);
	}
	let cancelled = false;
	loadData().then(({ posts: all }) => {
		if (cancelled) return;
		const section = root.querySelector(".site-posts");
		const wrap = document.createElement("div");
		wrap.className = "pc-archive";
		wrap.innerHTML = `<h3 class="pc-archive-title">All ${all.length} posts, one cover each</h3>`;
		const grid = document.createElement("div");
		grid.className = "pc-grid";
		for (const p of [...all].reverse()) {
			const a = document.createElement("a");
			a.className = "pc-mini";
			a.href = "#";
			a.title = `${p.title} (${p.date})`;
			a.innerHTML = coverSvg(p.title);
			grid.append(a);
		}
		wrap.append(grid);
		section.append(wrap);
	});
	return () => { cancelled = true; };
}

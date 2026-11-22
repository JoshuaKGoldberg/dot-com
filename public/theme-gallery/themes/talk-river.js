// 151: a river down the right margin; every talk is a floating lantern placed by date along the current.
// Scroll the page to travel downstream through time. Data: themes/post-covers/site-data.json (speaking frontmatter).
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, hash, rng, MONTHS } from "./post-covers/lib.js";

const CATS = {
	Conferences: ["#ffb23e", "#ff8a1f"],
	Meetups: ["#ff7aa2", "#e04477"],
	Workshops: ["#7ddf7a", "#37b24a"],
	Podcasts: ["#b59cff", "#7a5cf0"],
	Documentaries: ["#6fd8ff", "#1c9fd6"],
};
const DAY = 864e5;

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let talks = [], d0, d1, L = 1, off = 0, dark, sprites = {}, hot = null, bgc;
	const PXDAY = 0.6;

	function sprite(cat) {
		const [a, b] = CATS[cat] ?? CATS.Conferences;
		const dpr = cv.dpr, S = 44 * dpr;
		const c = document.createElement("canvas");
		c.width = c.height = S;
		const g = c.getContext("2d");
		g.scale(dpr, dpr);
		const glow = g.createRadialGradient(22, 22, 1, 22, 22, 22);
		glow.addColorStop(0, a + "cc");
		glow.addColorStop(0.35, a + "44");
		glow.addColorStop(1, a + "00");
		g.fillStyle = glow;
		g.fillRect(0, 0, 44, 44);
		// lantern body
		g.fillStyle = b;
		g.beginPath();
		g.roundRect(17, 16.5, 10, 12, 4);
		g.fill();
		g.fillStyle = a;
		g.beginPath();
		g.roundRect(18.5, 18, 7, 9, 3);
		g.fill();
		g.fillStyle = "rgba(255,255,255,0.85)";
		g.fillRect(20.5, 20, 3, 5);
		g.fillStyle = "#3a2a18";
		g.fillRect(18, 15, 8, 2);
		g.fillRect(18, 28, 8, 1.6);
		return c;
	}

	function layout() {
		cv.fit();
		dark = document.documentElement.classList.contains("dark");
		bgc = { w0: dark ? "#10304f" : "#cfe9f7", w1: dark ? "#0a2038" : "#a9d6ef", bank: dark ? "#05121f" : "#e8f1e8", line: dark ? "rgba(140,210,255,0.22)" : "rgba(255,255,255,0.65)", text: cssVar(root, "--siteMuted") };
		sprites = {};
		for (const k of Object.keys(CATS)) sprites[k] = sprite(k);
	}

	const centerX = (s) => cv.w * 0.5 + Math.sin(s / 170) * cv.w * 0.17 + Math.sin(s / 61 + 1.3) * cv.w * 0.05;
	const halfW = (s) => cv.w * (0.2 + 0.05 * Math.sin(s / 230 + 2));

	function build({ talks: all }) {
		talks = all.map((t) => {
			const r = rng(hash(t.title + t.date));
			return { ...t, ms: new Date(t.date).getTime(), lat_: (r() - 0.5) * 1.5, ph: r() * 6.28 };
		});
		d0 = talks[0].ms - 20 * DAY;
		d1 = talks.at(-1).ms + 20 * DAY;
		L = ((d1 - d0) / DAY) * PXDAY;
	}

	const pos = (ms) => ((ms - d0) / (d1 - d0)) * L;
	const scrollOffset = () => {
		const max = Math.max(1, root.scrollHeight - root.clientHeight);
		return (root.scrollTop / max) * Math.max(0, L - cv.h);
	};

	function draw(t = 0) {
		const { w, h } = cv;
		ctx.clearRect(0, 0, w, h);
		off = scrollOffset();
		// banks + water
		const step = 10;
		const left = [], right = [];
		for (let y = -step; y <= h + step; y += step) {
			const s = y + off, cx = centerX(s), hw = halfW(s);
			left.push([cx - hw, y]);
			right.push([cx + hw, y]);
		}
		const water = new Path2D();
		left.forEach(([x, y], i) => (i ? water.lineTo(x, y) : water.moveTo(x, y)));
		for (let i = right.length - 1; i >= 0; i--) water.lineTo(right[i][0], right[i][1]);
		water.closePath();
		const g = ctx.createLinearGradient(0, 0, w, 0);
		g.addColorStop(0, bgc.w0);
		g.addColorStop(1, bgc.w1);
		ctx.fillStyle = g;
		ctx.fill(water);
		// current lines
		ctx.lineWidth = 1;
		ctx.strokeStyle = bgc.line;
		for (let k = -2; k <= 2; k++) {
			ctx.beginPath();
			for (let y = 0; y <= h; y += step) {
				const s = y + off;
				const x = centerX(s) + k * halfW(s) * 0.38 + Math.sin(s / 40 + t * 0.8 + k) * 3;
				y ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
			}
			ctx.setLineDash([14, 22]);
			ctx.lineDashOffset = -((t * 12 + k * 7 + off) % 36);
			ctx.stroke();
		}
		ctx.setLineDash([]);
		ctx.strokeStyle = dark ? "rgba(150,210,255,0.4)" : "rgba(40,120,170,0.35)";
		ctx.lineWidth = 1.5;
		ctx.stroke(water);
		// year markers on the near bank
		ctx.font = `700 11px ${cssVar(root, "--siteFont")}`;
		ctx.fillStyle = bgc.text;
		ctx.textAlign = "right";
		const y0 = new Date(d0).getUTCFullYear() + 1;
		for (let yr = y0; yr <= new Date(d1).getUTCFullYear(); yr++) {
			const sy = pos(Date.UTC(yr, 0, 1)) - off;
			if (sy < -10 || sy > h + 10) continue;
			const bx = centerX(sy + off) - halfW(sy + off);
			ctx.fillText(String(yr), bx - 8, sy + 4);
			ctx.fillRect(bx - 6, sy, 6, 1);
		}
		// lanterns
		const now = Date.now();
		const frame = [];
		for (const tk of talks) {
			const sy = pos(tk.ms) - off;
			if (sy < -30 || sy > h + 30) continue;
			const s = sy + off, bob = reducedMotion ? 0 : Math.sin(t * 1.1 + tk.ph) * 2.2;
			const x = centerX(s) + tk.lat_ * halfW(s) * 0.78 + (reducedMotion ? 0 : Math.sin(t * 0.7 + tk.ph * 2) * 2.5);
			const y = sy + bob;
			const spr = sprites[tk.category] ?? sprites.Conferences;
			const future = tk.ms > now;
			ctx.globalAlpha = future ? 0.45 : tk === hot ? 1 : 0.92;
			const sc = tk === hot ? 1.5 : 1;
			ctx.drawImage(spr, x - 22 * sc, y - 22 * sc, 44 * sc, 44 * sc);
			tk._x = x; tk._y = y;
			frame.push(tk);
		}
		ctx.globalAlpha = 1;
		// date at viewport middle
		const mid = new Date(d0 + ((off + h / 2) / L) * (d1 - d0));
		ctx.textAlign = "left";
		ctx.fillStyle = bgc.text;
		ctx.font = `700 12px ${cssVar(root, "--siteFont")}`;
		ctx.fillText(`${MONTHS[mid.getUTCMonth()]} ${mid.getUTCFullYear()}`, 6, h / 2 + 4);
		ctx.fillRect(6, h / 2 + 8, 22, 1.5);
	}

	function onMove(e) {
		if (!talks.length) return;
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		let best = null, bd = 12 * 12;
		if (x >= -4 && x <= r.width) for (const t of talks) {
			if (t._y == null || t._y < -30 || t._y > cv.h + 30) continue;
			const d = (t._x - x) ** 2 + (t._y - y) ** 2;
			if (d < bd) { bd = d; best = t; }
		}
		if (best !== hot) {
			hot = best;
			if (best) tip.show(`<b>${esc(best.title)}</b><small>${esc(best.venue)} · ${esc(best.date)}${best.city ? " · " + esc(best.city) : best.online ? " · Online" : ""} · ${esc(best.category)}</small>`, e.clientX, e.clientY);
			else tip.hide();
			if (reducedMotion) draw();
		} else if (best) tip.show(tip.el.innerHTML, e.clientX, e.clientY);
	}

	const redraw = () => { if (reducedMotion) draw(); else runner?.kick(); };
	const onResize = () => { layout(); redraw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	root.addEventListener("scroll", redraw, { passive: true });
	layout();

	const legend = document.createElement("div");
	legend.className = "tv-legend";
	legend.innerHTML = `<b>Talk river</b><small>scroll to drift downstream</small>` + Object.entries(CATS).map(([k, [a]]) => `<span><i style="background:${a}"></i>${k}</span>`).join("");
	root.querySelector(".overlay-a").append(legend);

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		if (reducedMotion) { draw(); return; }
		runner = loop((dt, t) => { draw(t); });
	});
	return () => {
		dead = true;
		runner?.stop();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
		root.removeEventListener("scroll", redraw);
	};
}

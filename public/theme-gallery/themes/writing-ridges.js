// 148: a mountain range of ridgelines. One ridge per year; each post raises a peak at its day of the year.
// Data: themes/post-covers/site-data.json (blog frontmatter pubDate).
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, rng, dayOfYear, MONTHS } from "./post-covers/lib.js";

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let rows = [], hot = -1, hotPost = null, bg, dark, geo, progress = reducedMotion ? 1 : 0;
	let accent;

	function layout() {
		cv.fit();
		const { w, h } = cv;
		dark = document.documentElement.classList.contains("dark");
		bg = cssVar(root, "--siteBg");
		accent = cssVar(root, "--siteAccent");
		const padX = Math.max(16, w * 0.03);
		const top = h * 0.28, bottom = h - 46;
		const sp = (bottom - top) / Math.max(1, rows.length);
		geo = { padX, top, bottom, sp, x0: padX, x1: w - padX };
	}

	const peakAt = (row, d) => {
		let y = row.base[Math.round(d) % 365] ?? 0;
		for (const p of row.posts) { const k = (d - p.doy) / 8; y += Math.exp(-k * k * 0.5) * (0.8 + Math.min(p.minutes, 20) / 20 * 0.7); }
		return y;
	};

	function build({ posts }) {
		const byYear = new Map();
		for (const p of posts) {
			const y = +p.date.slice(0, 4);
			(byYear.get(y) ?? byYear.set(y, []).get(y)).push({ ...p, doy: dayOfYear(p.date) });
		}
		const years = [...byYear.keys()];
		rows = years.map((year) => {
			const r = rng(year * 977);
			const f = [1, 2, 3].map((k) => ({ a: (0.1 / k) * (0.5 + r()), p: r() * 6.28, k: k * 2 + 1 }));
			const base = Array.from({ length: 365 }, (_, d) => f.reduce((s, q) => s + q.a * (0.5 + 0.5 * Math.sin((d / 365) * q.k * 6.28 + q.p)), 0));
			return { year, posts: byYear.get(year), base };
		});
	}

	function draw() {
		const { w, h } = cv, { x0, x1, sp, top } = geo;
		ctx.clearRect(0, 0, w, h);
		const n = rows.length;
		const scale = sp * 1.05;
		ctx.font = `600 11px ${cssVar(root, "--siteFont")}`;
		rows.forEach((row, i) => {
			const t = i / Math.max(1, n - 1);
			const ease = Math.max(0, Math.min(1, progress * (n + 3) - i * 0.9));
			const e = 1 - Math.pow(1 - ease, 3);
			const base = top + (i + 1) * sp + (1 - e) * 40;
			row.pts = [];
			const line = new Path2D();
			let first = true;
			for (let x = x0; x <= x1; x += 3) {
				const d = ((x - x0) / (x1 - x0)) * 364;
				const y = base - peakAt(row, d) * scale * e;
				first ? line.moveTo(x, y) : line.lineTo(x, y);
				first = false;
			}
			const fillP = new Path2D(line);
			ctx.beginPath();
			fillP.lineTo(x1, base);
			fillP.lineTo(x1, base + sp * 3);
			fillP.lineTo(x0, base + sp * 3);
			fillP.closePath();
			// fill: occlude the rows behind, with a faint tint toward the ridge colour
			const hl = hot === i;
			const hue = dark ? 190 - t * 60 : 215 - t * 40;
			const fg = ctx.createLinearGradient(0, base - sp * 2.2, 0, base + sp);
			fg.addColorStop(0, dark ? `hsla(${hue},55%,${12 + t * 8}%,1)` : `hsla(${hue},40%,${96 - t * 5}%,1)`);
			fg.addColorStop(1, bg);
			ctx.globalAlpha = e;
			ctx.fillStyle = fg;
			ctx.fill(fillP);
			ctx.strokeStyle = dark ? `hsla(${hue + 20},90%,${hl ? 80 : 62 + t * 10}%,${hl ? 1 : 0.4 + t * 0.55})` : `hsla(${hue},70%,${hl ? 32 : 40 - t * 10}%,${hl ? 1 : 0.35 + t * 0.6})`;
			ctx.lineWidth = hl ? 2.4 : 1.4;
			if (dark) {
				ctx.save();
				ctx.lineWidth = 5;
				ctx.globalAlpha = e * 0.1;
				ctx.stroke(line);
				ctx.restore();
			}
			ctx.globalAlpha = e;
			ctx.stroke(line);
			ctx.globalAlpha = e;
			// year label and peak dots
			ctx.fillStyle = cssVar(root, "--siteMuted");
			ctx.textAlign = "left";
			ctx.fillText(String(row.year), x0 + 2, base - 4);
			for (const p of row.posts) {
				const px = x0 + (p.doy / 364) * (x1 - x0);
				const py = base - peakAt(row, p.doy) * scale * e;
				p._x = px; p._y = py; p._i = i;
				ctx.beginPath();
				ctx.arc(px, py, p === hotPost ? 4 : 2, 0, 7);
				ctx.fillStyle = p === hotPost ? accent : dark ? "#fff" : "#142842";
				ctx.fill();
			}
			ctx.globalAlpha = 1;
		});
		// month ticks
		ctx.fillStyle = cssVar(root, "--siteMuted");
		ctx.textAlign = "center";
		MONTHS.forEach((m, k) => ctx.fillText(m, x0 + ((k * 30.4 + 15) / 365) * (x1 - x0), h - 16));
	}

	function onMove(e) {
		if (!rows.length || progress < 0.95) return;
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		let best = null, bd = 16 * 16;
		for (const row of rows) for (const p of row.posts) {
			if (p._x == null) continue;
			const d = (p._x - x) ** 2 + (p._y - y) ** 2;
			if (d < bd) { bd = d; best = p; }
		}
		if (best !== hotPost) {
			hotPost = best;
			hot = best ? best._i : -1;
			if (best) tip.show(`<b>${esc(best.title)}</b><small>${esc(best.date)} · ${best.minutes} min read</small>`, e.clientX, e.clientY);
			else tip.hide();
			draw();
		} else if (best) tip.show(tip.el.innerHTML, e.clientX, e.clientY);
	}

	const onResize = () => { layout(); if (rows.length) draw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	layout();
	const note = document.createElement("div");
	note.className = "wr-note";
	note.textContent = "One ridge per year · each peak is a post · hover a peak";
	root.querySelector(".overlay-a").append(note);

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		layout();
		if (reducedMotion) { draw(); return; }
		runner = loop((dt) => {
			progress = Math.min(1, progress + dt / 1.8);
			draw();
			return progress < 1;
		});
	});
	return () => {
		dead = true;
		runner?.stop();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
	};
}

// 153: a stitched quilt, one patch per week since Josh's first talk (Sep 2016), colored like an activity calendar.
// Activity = posts + talks that week (themes/post-covers/site-data.json). Ripples roll out from the pointer (or drift on their own).
import { loadData, mountCanvas, loop, makeTip, esc, cssVar } from "./post-covers/lib.js";

const WEEK = 6048e5;
const PAL = {
	light: { bg: "#f3ead9", thread: "#b7a98c", lv: ["#efe4cf", "#7fb6a8", "#3f8f9a", "#e8a23a", "#d9573e"], alt: ["#e6d9bf", "#a9d1c5", "#6bb0b6", "#f3c06a", "#ec8a6e"] },
	dark: { bg: "#141a26", thread: "#5a6580", lv: ["#1a2232", "#2f6f73", "#3c9aa0", "#d99a35", "#ef6a50"], alt: ["#202a3d", "#285a5e", "#2f7f85", "#b27a25", "#c9503a"] },
};

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let weeks = [], start, P = 40, cols = 1, rows = 1, pal, dark, ptr = null, src = { x: 0, y: 0 }, hot = -1, last = 0, t = 0;
	const smooth = { x: -1, y: -1 };

	function build({ posts, talks }) {
		const now = Date.now();
		const items = [
			...posts.map((p) => ({ ms: new Date(p.date).getTime(), title: p.title, kind: "post" })),
			...talks.map((p) => ({ ms: new Date(p.date).getTime(), title: p.title, kind: "talk" })),
		].filter((i) => i.ms <= now);
		start = Math.min(...items.map((i) => i.ms));
		start -= (new Date(start).getUTCDay() + 6) % 7 * 864e5; // Monday
		const n = Math.ceil((now - start) / WEEK) + 1;
		weeks = Array.from({ length: n }, () => ({ items: [] }));
		for (const it of items) weeks[Math.floor((it.ms - start) / WEEK)].items.push(it);
	}

	function layout() {
		cv.fit();
		dark = document.documentElement.classList.contains("dark");
		pal = dark ? PAL.dark : PAL.light;
		const n = Math.max(weeks.length + 6, 400);
		P = Math.max(26, Math.ceil(Math.sqrt((cv.w * cv.h) / n)));
		cols = Math.ceil(cv.w / P);
		rows = Math.ceil(cv.h / P);
		layer.style.opacity = cv.w >= 1000 ? "1" : "0.5";
	}

	const lvl = (c) => (c <= 0 ? 0 : Math.min(4, c));

	function patch(x, y, s, level, a, alt, w) {
		const b = pal.lv[level], c = pal.alt[level];
		const m = s / 2;
		ctx.fillStyle = b;
		ctx.fillRect(x, y, s, s);
		ctx.fillStyle = c;
		if (level === 1) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + s, y + s); ctx.lineTo(x, y + s); ctx.fill(); }
		else if (level === 2) { ctx.beginPath(); ctx.moveTo(x + m, y + 2); ctx.lineTo(x + s - 2, y + m); ctx.lineTo(x + m, y + s - 2); ctx.lineTo(x + 2, y + m); ctx.fill(); }
		else if (level === 3) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + m, y); ctx.lineTo(x + m, y + m); ctx.lineTo(x, y + m); ctx.fill(); ctx.fillRect(x + m, y + m, m, m); }
		else if (level === 4) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + m, y + m); ctx.lineTo(x + s, y); ctx.lineTo(x + m, y + m); ctx.lineTo(x + s, y + s); ctx.lineTo(x + m, y + m); ctx.lineTo(x, y + s); ctx.fill(); ctx.fillStyle = pal.lv[3]; ctx.beginPath(); ctx.arc(x + m, y + m, s * 0.14, 0, 7); ctx.fill(); }
		else if (alt) { ctx.fillRect(x, y, s, s * 0.5); }
		// stitching
		ctx.strokeStyle = pal.thread;
		ctx.globalAlpha = level ? 0.75 : 0.45;
		ctx.lineWidth = 1;
		ctx.setLineDash([3, 3]);
		ctx.strokeRect(x + 2.5, y + 2.5, s - 5, s - 5);
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
	}

	function draw() {
		const { w, h } = cv;
		ctx.fillStyle = pal.bg;
		ctx.fillRect(0, 0, w, h);
		const sx = smooth.x, sy = smooth.y;
		const total = cols * rows;
		for (let i = 0; i < total; i++) {
			const cx = i % cols, cy = Math.floor(i / cols);
			const x = cx * P, y = cy * P;
			const wk = weeks[i];
			const mx = x + P / 2, my = y + P / 2;
			let r = 0;
			if (!reducedMotion || sx >= 0) {
				const d1 = Math.hypot(mx - src.x, my - src.y);
				r = Math.sin(d1 / 46 - t * 2.6) * Math.exp(-d1 / 520);
				if (sx >= 0) { const d2 = Math.hypot(mx - sx, my - sy); r += Math.sin(d2 / 38 - t * 4) * Math.exp(-d2 / 260) * 1.2; }
			}
			const sc = 1 + r * 0.05;
			const s = P * sc;
			const o = (P - s) / 2;
			if (!wk) {
				// unsewn future patches: just outlined
				ctx.strokeStyle = pal.thread;
				ctx.globalAlpha = 0.3;
				ctx.setLineDash([3, 4]);
				ctx.strokeRect(x + 2.5, y + 2.5, P - 5, P - 5);
				ctx.setLineDash([]);
				ctx.globalAlpha = 1;
				continue;
			}
			const level = lvl(wk.items.length);
			patch(x + o, y + o, s, level, 1, (cx + cy) % 2 === 0);
			if (r > 0.45) { ctx.fillStyle = dark ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.4)"; ctx.fillRect(x + o, y + o, s, s); }
			else if (r < -0.5) { ctx.fillStyle = dark ? "rgba(0,0,0,0.18)" : "rgba(60,40,10,0.08)"; ctx.fillRect(x + o, y + o, s, s); }
			if (i === hot) { ctx.strokeStyle = dark ? "#fff" : "#142842"; ctx.lineWidth = 2; ctx.strokeRect(x + 1, y + 1, P - 2, P - 2); }
		}
	}

	function onMove(e) {
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		smooth.x = x; smooth.y = y;
		const overText = e.target.closest?.(".site-main, .site-header, .site-footer");
		let idx = -1;
		if (!overText && weeks.length) {
			const i = Math.floor(y / P) * cols + Math.floor(x / P);
			if (weeks[i]) idx = i;
		}
		if (idx !== hot) {
			hot = idx;
			if (idx >= 0) {
				const wk = weeks[idx];
				const d = new Date(start + idx * WEEK).toISOString().slice(0, 10);
				tip.show(`<b>Week of ${d}</b>` + (wk.items.length ? wk.items.slice(0, 4).map((q) => `<i>${q.kind === "post" ? "✎" : "🎤"} ${esc(q.title)}</i>`).join("") : "<small>a quiet week: plain cotton</small>"), e.clientX, e.clientY);
			} else tip.hide();
		} else if (idx >= 0) tip.show(tip.el.innerHTML, e.clientX, e.clientY);
		if (reducedMotion) draw();
	}
	const onLeave = () => { smooth.x = -1; hot = -1; tip.hide(); if (reducedMotion) draw(); };

	const onResize = () => { layout(); if (weeks.length) draw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	document.addEventListener("pointerleave", onLeave);
	layout();

	const legend = document.createElement("div");
	legend.className = "cq-legend";
	root.querySelector(".overlay-a").append(legend);

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		layout();
		const posts = data.posts.length, talks = data.talks.filter((t) => new Date(t.date) <= Date.now()).length;
		legend.innerHTML = `<b>Activity quilt</b> one patch per week · ${weeks.length} weeks · ${posts} posts + ${talks} talks <span class="cq-sw">${pal.lv.map((c) => `<i style="background:${c}"></i>`).join("")}</span>`;
		src = { x: cv.w * 0.3, y: cv.h * 0.4 };
		if (reducedMotion) { draw(); return; }
		runner = loop((dt, tt) => {
			t = tt;
			const now = performance.now();
			if (now - last < 33) return;
			last = now;
			src.x = cv.w * (0.5 + 0.35 * Math.sin(tt * 0.11));
			src.y = cv.h * (0.5 + 0.3 * Math.cos(tt * 0.083));
			draw();
		});
	});
	return () => {
		dead = true;
		runner?.stop();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
		document.removeEventListener("pointerleave", onLeave);
	};
}

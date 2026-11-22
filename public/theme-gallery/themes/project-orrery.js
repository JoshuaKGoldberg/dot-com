// 152: projects (from the page) as planets sized by GitHub stars, on a brass orrery. Moons are the posts and facts around each project.
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, hash, rng } from "./post-covers/lib.js";

const KEYS = { "typescript-eslint": ["eslint", "typescript-eslint", "linting"], "create-typescript-app": ["create-typescript-app"], flint: ["flint", "linter"], "emoji-blast": ["emoji"] };
const HUES = [212, 28, 158, 330, 268, 96];

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let planets = [], dark, hot = null, t = 0, S = 1, C;

	const projectEls = [...root.querySelectorAll(".site-project")];
	const parse = (el) => {
		const name = el.querySelector(".site-item-title").textContent.trim();
		const desc = el.querySelector(".site-item-description").textContent.trim();
		const meta = el.querySelector(".site-item-meta").textContent.trim();
		const m = meta.match(/([\d.]+)\s*k/i);
		return { name, desc, meta, stars: m ? parseFloat(m[1]) * 1000 : 0, el };
	};

	function build({ posts }) {
		planets = projectEls.map(parse).map((p, i) => {
			const kw = KEYS[p.name.toLowerCase()] ?? [p.name.toLowerCase()];
			const matched = posts.filter((q) => kw.some((k) => q.title.toLowerCase().includes(k) || q.tags.some((tg) => tg.toLowerCase().includes(k)))).slice(-4);
			const facts = p.meta.split("·").map((s) => s.trim()).filter(Boolean);
			const moons = [...facts.map((f) => ({ label: f, kind: "fact" })), ...matched.map((q) => ({ label: q.title.length > 24 ? q.title.slice(0, 23) + "…" : q.title, full: q.title, date: q.date, kind: "post" }))];
			const r = rng(hash(p.name));
			return { ...p, i, hue: HUES[i % HUES.length], radius: 9 + 5.2 * Math.log10(1 + p.stars / 80), orbit: 0.3 + i * 0.2, speed: (0.07 - i * 0.012) * (i % 2 ? -1 : 1), a0: r() * 6.28 + i * 1.7, moons: moons.map((m, k) => ({ ...m, a0: (k / moons.length) * 6.28 + r(), sp: 0.5 + r() * 0.5 })) };
		});
	}

	function layout() {
		cv.fit();
		dark = document.documentElement.classList.contains("dark");
		S = Math.min(cv.w / 1100, cv.h / 700);
		C = {
			brass: dark ? "#d6a85a" : "#a77a2c", brassHi: dark ? "#ffe3a1" : "#d9aa4e", brassLo: dark ? "#6e4d1a" : "#6e4d1a",
			sun0: dark ? "#fff4c0" : "#fff2b0", sun1: dark ? "#ff9a2e" : "#f08a1c", text: cssVar(root, "--siteFgStrong"), muted: cssVar(root, "--siteMuted"),
		};
	}

	function place(p, time) {
		const { w, h } = cv;
		const cx = w / 2, cy = h * (w > 1000 ? 0.74 : 0.7);
		const sq = 0.36;
		const R = Math.min(w * 0.44, 560) * (p.orbit + 0.12) * 1.25;
		const a = p.a0 + time * p.speed;
		p.x = cx + Math.cos(a) * R;
		p.y = cy + Math.sin(a) * R * sq;
		p.R = R; p.cx = cx; p.cy = cy; p.sq = sq; p.depth = Math.sin(a);
		p.r = p.radius * S * 1.7 * (0.9 + 0.12 * p.depth);
	}

	function draw() {
		const { w, h } = cv;
		ctx.clearRect(0, 0, w, h);
		if (!planets.length) return;
		for (const p of planets) place(p, t);
		const { cx, cy, sq } = planets[0];
		const outer = Math.min(w * 0.44, 560) * 1.3;
		// base disc with month ticks
		ctx.lineWidth = 1;
		ctx.strokeStyle = C.brass;
		ctx.globalAlpha = 0.55;
		ctx.beginPath();
		ctx.ellipse(cx, cy, outer * 1.12, outer * 1.12 * sq, 0, 0, 7);
		ctx.stroke();
		ctx.beginPath();
		ctx.ellipse(cx, cy, outer * 1.06, outer * 1.06 * sq, 0, 0, 7);
		ctx.stroke();
		ctx.beginPath();
		for (let k = 0; k < 72; k++) {
			const a = (k / 72) * 6.2832, l = k % 6 === 0 ? 1.12 : 1.09;
			ctx.moveTo(cx + Math.cos(a) * outer * 1.06, cy + Math.sin(a) * outer * 1.06 * sq);
			ctx.lineTo(cx + Math.cos(a) * outer * l, cy + Math.sin(a) * outer * l * sq);
		}
		ctx.stroke();
		ctx.globalAlpha = 1;
		// orbits
		ctx.lineWidth = 2;
		for (const p of planets) {
			ctx.strokeStyle = hot === p ? C.brassHi : C.brass;
			ctx.globalAlpha = hot === p ? 1 : 0.5;
			ctx.beginPath();
			ctx.ellipse(p.cx, p.cy, p.R, p.R * sq, 0, 0, 7);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		// sun
		const sr = 26 * S + 12;
		const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, sr * 3.2);
		halo.addColorStop(0, dark ? "rgba(255,190,80,0.5)" : "rgba(255,170,60,0.4)");
		halo.addColorStop(1, "rgba(255,170,60,0)");
		ctx.fillStyle = halo;
		ctx.fillRect(cx - sr * 3.2, cy - sr * 3.2, sr * 6.4, sr * 6.4);
		const sg = ctx.createRadialGradient(cx - sr * 0.3, cy - sr * 0.3, 1, cx, cy, sr);
		sg.addColorStop(0, C.sun0);
		sg.addColorStop(1, C.sun1);
		ctx.fillStyle = sg;
		ctx.beginPath();
		ctx.arc(cx, cy, sr, 0, 7);
		ctx.fill();
		// brass arms (center -> planet), drawn behind planets
		ctx.lineWidth = 2.5;
		for (const p of planets) {
			ctx.strokeStyle = C.brassLo;
			ctx.globalAlpha = 0.55;
			ctx.beginPath();
			ctx.moveTo(cx, cy);
			ctx.lineTo(p.x, p.y);
			ctx.stroke();
			ctx.strokeStyle = C.brassHi;
			ctx.lineWidth = 1;
			ctx.globalAlpha = 0.6;
			ctx.beginPath();
			ctx.moveTo(cx, cy - 1);
			ctx.lineTo(p.x, p.y - 1);
			ctx.stroke();
			ctx.lineWidth = 2.5;
		}
		ctx.globalAlpha = 1;
		// planets + moons, back to front
		const order = [...planets].sort((a, b) => a.depth - b.depth);
		ctx.font = `600 ${Math.max(11, 12 * S)}px ${cssVar(root, "--siteFont")}`;
		for (const p of order) {
			const lit = hot === p;
			const g = ctx.createRadialGradient(p.x - p.r * 0.4, p.y - p.r * 0.4, p.r * 0.1, p.x, p.y, p.r);
			g.addColorStop(0, `hsl(${p.hue} 75% ${dark ? 78 : 72}%)`);
			g.addColorStop(1, `hsl(${p.hue} 70% ${dark ? 34 : 38}%)`);
			if (lit) {
				ctx.fillStyle = `hsla(${p.hue} 90% 60% / .25)`;
				ctx.beginPath();
				ctx.arc(p.x, p.y, p.r * 1.8, 0, 7);
				ctx.fill();
			}
			// ring for the big one
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(p.x, p.y, p.r, 0, 7);
			ctx.fill();
			if (p.stars >= 10000) {
				ctx.strokeStyle = C.brassHi;
				ctx.lineWidth = 2;
				ctx.globalAlpha = 0.8;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, p.r * 1.7, p.r * 0.5, -0.25, 0, 7);
				ctx.stroke();
				ctx.globalAlpha = 1;
			}
			// moons
			p.moons.forEach((m, k) => {
				const mr = p.r * (1.9 + (k % 3) * 0.5) + 6;
				const a = m.a0 + t * m.sp * (k % 2 ? -1 : 1);
				const mx = p.x + Math.cos(a) * mr, my = p.y + Math.sin(a) * mr * 0.45;
				m.x = mx; m.y = my;
				ctx.strokeStyle = C.brass;
				ctx.globalAlpha = 0.25;
				ctx.lineWidth = 1;
				ctx.beginPath();
				ctx.ellipse(p.x, p.y, mr, mr * 0.45, 0, 0, 7);
				ctx.stroke();
				ctx.globalAlpha = 1;
				ctx.fillStyle = m.kind === "post" ? C.brassHi : C.muted;
				ctx.beginPath();
				ctx.arc(mx, my, 3.2 * Math.max(0.9, S), 0, 7);
				ctx.fill();
				if (lit || cv.w > 1000) {
					ctx.fillStyle = C.muted;
					ctx.globalAlpha = lit ? 1 : 0.0;
					ctx.font = `500 ${Math.max(10, 11 * S)}px ${cssVar(root, "--siteFont")}`;
					ctx.fillText(m.label, mx + 6, my + 3);
					ctx.globalAlpha = 1;
				}
			});
			ctx.font = `700 ${Math.max(12, 13 * S)}px ${cssVar(root, "--siteFont")}`;
			ctx.fillStyle = C.text;
			ctx.textAlign = "center";
			ctx.fillText(p.name, p.x, p.y + p.r + 16);
			ctx.textAlign = "left";
		}
	}

	function setHot(p, e) {
		if (hot === p) return;
		hot = p;
		projectEls.forEach((el) => el.classList.toggle("po-hot", !!p && el === p.el));
		if (p && e) {
			tip.show(`<b>${esc(p.name)}</b><small>${esc(p.meta)}</small><i>${esc(p.desc)}</i>` + p.moons.filter((m) => m.kind === "post").map((m) => `<i><small>☾ ${esc(m.full)} (${esc(m.date.slice(0, 4))})</small></i>`).join(""), e.clientX, e.clientY);
		} else if (!p) tip.hide();
		if (reducedMotion) draw();
	}

	function onMove(e) {
		if (!planets.length) return;
		const r = layer.getBoundingClientRect();
		const x = e.clientX - r.left, y = e.clientY - r.top;
		let best = null, bd = 1e9;
		for (const p of planets) {
			const d = Math.hypot(p.x - x, p.y - y);
			if (d < p.r + 14 && d < bd) { bd = d; best = p; }
		}
		if (best) setHot(best, e);
		else if (!e.target.closest?.(".site-project")) setHot(null);
		else if (hot) tip.show(tip.el.innerHTML, e.clientX, e.clientY);
	}
	function onOver(e) {
		const el = e.target.closest?.(".site-project");
		if (el) {
			const p = planets.find((q) => q.el === el);
			if (p) { setHot(p); tip.hide(); }
		}
	}
	function onOut(e) {
		if (e.target.closest?.(".site-project")) setHot(null);
	}

	const onResize = () => { layout(); if (reducedMotion) draw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	root.addEventListener("mouseover", onOver);
	root.addEventListener("mouseout", onOut);
	layout();

	let runner, dead = false;
	loadData().then((data) => {
		if (dead) return;
		build(data);
		t = reducedMotion ? 0 : 0;
		if (reducedMotion) { draw(); return; }
		runner = loop((dt) => { t += dt; draw(); });
	});
	return () => {
		dead = true;
		runner?.stop();
		window.removeEventListener("resize", onResize);
		window.removeEventListener("pointermove", onMove);
		root.removeEventListener("mouseover", onOver);
		root.removeEventListener("mouseout", onOut);
	};
}

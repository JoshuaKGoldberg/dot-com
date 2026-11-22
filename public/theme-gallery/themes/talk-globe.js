// 147: talk globe. Orthographic dotted globe, arcs from Boston to every city Josh has spoken in.
// Data: themes/post-covers/site-data.json (from the dot-com speaking frontmatter); land mask baked from Natural Earth 110m.
import { loadData, mountCanvas, loop, makeTip, esc, cssVar, rng } from "./post-covers/lib.js";

const RAD = Math.PI / 180;
const HOME = "Boston";
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function toVec(lat, lon) {
	const la = lat * RAD, lo = lon * RAD;
	return [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)];
}
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
function slerp(a, b, t) {
	const d = Math.min(1, Math.max(-1, dot(a, b)));
	const om = Math.acos(d), s = Math.sin(om) || 1;
	const k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
	return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
}

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	const cv = mountCanvas(layer);
	const tip = makeTip(root);
	const { ctx } = cv;
	let colors;
	const readColors = () => {
		const dark = document.documentElement.classList.contains("dark");
		colors = {
			dark,
			ocean0: dark ? "#10243d" : "#f3faff",
			ocean1: dark ? "#08111f" : "#cfe6f6",
			land: dark ? "rgba(140,205,255,0.85)" : "rgba(22,84,150,0.75)",
			grat: dark ? "rgba(120,180,255,0.10)" : "rgba(20,80,150,0.10)",
			arc: dark ? "255,196,92" : "214,92,28",
			city: dark ? "#ffd27a" : "#d4501a",
			home: dark ? "#9cf0ff" : "#0b6fd0",
			rim: dark ? "rgba(120,190,255,0.5)" : "rgba(20,100,190,0.35)",
			text: cssVar(root, "--siteFgStrong"),
			ring1: dark ? "180,150,255" : "110,70,200",
			ring2: dark ? "120,230,200" : "0,140,120",
		};
	};
	readColors();

	let talks = [], cities = [], land = null, landDots = [], rings = [];
	let lon0 = -35 * RAD, tilt = 24 * RAD;
	let spin = reducedMotion ? 0 : 0.05;
	let target = null, hovered = null, pointer = { x: -1e3, y: -1e3 }, ringHover = null;
	let geo = { cx: 0, cy: 0, R: 100, wide: true };
	let homeV;
	let t0 = 0;

	function layout() {
		cv.fit();
		const w = cv.w, h = cv.h;
		const wide = w >= 1100;
		let R, cx;
		if (wide) { R = Math.min(h * 0.4, (w - 760) / 2 - 10, 280); cx = w - R - 40; }
		else { R = Math.min(w * 0.42, h * 0.34); cx = w / 2; }
		geo = { cx, cy: wide ? h * 0.5 : h * 0.42, R, wide };
		layer.style.opacity = wide ? "1" : "0.5";
	}

	function project(v) {
		const cl = Math.cos(lon0), sl = Math.sin(lon0), ct = Math.cos(tilt), st = Math.sin(tilt);
		// rotate around Y by -lon0, then around X by tilt
		let x = v[0] * cl - v[2] * sl, z = v[0] * sl + v[2] * cl, y = v[1];
		const y2 = y * ct - z * st, z2 = y * st + z * ct;
		return [x, y2, z2];
	}
	const px = (p, k = 1) => [geo.cx + p[0] * geo.R * k, geo.cy - p[1] * geo.R * k];

	function build({ talks: all }) {
		talks = all;
		const map = new Map();
		for (const t of all) {
			if (!t.city) continue;
			const c = map.get(t.city) ?? { name: t.city, lat: t.lat, lon: t.lon, v: toVec(t.lat, t.lon), talks: [] };
			c.talks.push(t);
			map.set(t.city, c);
		}
		cities = [...map.values()];
		homeV = map.get(HOME).v;
		const r = rng(7);
		rings = [
			{ key: "Online", tilt: -0.5, rot: 0.9, scale: 1.2, rgb: "ring1", items: all.filter((t) => t.online) },
			{ key: "Podcasts", tilt: 0.35, rot: -0.45, scale: 1.38, rgb: "ring2", items: all.filter((t) => t.category === "Podcasts" && !t.online) },
		].map((ring) => ({ ...ring, phase: ring.items.map((_, i) => (i / ring.items.length) * Math.PI * 2 + r() * 0.05) }));
	}

	async function loadLand() {
		const j = await (await fetch(new URL("./talk-globe/land.json", import.meta.url))).json();
		land = j;
		const N = 9000, ga = Math.PI * (3 - Math.sqrt(5));
		for (let i = 0; i < N; i++) {
			const y = 1 - (2 * (i + 0.5)) / N, rr = Math.sqrt(1 - y * y), th = ga * i;
			const v = [Math.cos(th) * rr, y, Math.sin(th) * rr];
			const lat = Math.asin(y) / RAD, lon = Math.atan2(v[0], v[2]) / RAD;
			const xi = Math.min(j.w - 1, Math.floor(((lon + 180) / 360) * j.w));
			const yj = Math.min(j.h - 1, Math.floor(((90 - lat) / 180) * j.h));
			if (j.rows[yj][xi] === "1") landDots.push(v);
		}
	}

	function draw(time = 0) {
		const { w, h } = cv, { cx, cy, R } = geo;
		ctx.clearRect(0, 0, w, h);
		// sphere
		const g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
		g.addColorStop(0, colors.ocean0);
		g.addColorStop(1, colors.ocean1);
		ctx.beginPath();
		ctx.arc(cx, cy, R, 0, 7);
		ctx.fillStyle = g;
		ctx.fill();
		ctx.lineWidth = 1.5;
		ctx.strokeStyle = colors.rim;
		ctx.stroke();
		// atmosphere
		const ag = ctx.createRadialGradient(cx, cy, R * 0.98, cx, cy, R * 1.22);
		ag.addColorStop(0, colors.dark ? "rgba(90,160,255,0.22)" : "rgba(60,150,230,0.16)");
		ag.addColorStop(1, "rgba(90,160,255,0)");
		ctx.fillStyle = ag;
		ctx.beginPath();
		ctx.arc(cx, cy, R * 1.22, 0, 7);
		ctx.fill();
		// graticule
		ctx.strokeStyle = colors.grat;
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let la = -60; la <= 60; la += 30) {
			let pen = false;
			for (let lo = -180; lo <= 180; lo += 6) {
				const p = project(toVec(la, lo));
				if (p[2] <= 0) { pen = false; continue; }
				const [x, y] = px(p);
				pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
				pen = true;
			}
		}
		for (let lo = -180; lo < 180; lo += 30) {
			let pen = false;
			for (let la = -90; la <= 90; la += 6) {
				const p = project(toVec(la, lo));
				if (p[2] <= 0) { pen = false; continue; }
				const [x, y] = px(p);
				pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
				pen = true;
			}
		}
		ctx.stroke();
		// land
		ctx.fillStyle = colors.land;
		const s = Math.max(1.5, R / 170);
		for (const v of landDots) {
			const p = project(v);
			if (p[2] <= 0.02) continue;
			const k = 0.35 + 0.65 * p[2];
			ctx.globalAlpha = k;
			ctx.fillRect(geo.cx + p[0] * R - s / 2, geo.cy - p[1] * R - s / 2, s, s);
		}
		ctx.globalAlpha = 1;
		// back ring halves, then arcs, cities, front ring halves
		drawRings(time, false);
		const hot = hovered;
		for (const c of cities) {
			if (c.name === HOME) continue;
			const lit = hot === c;
			const dim = hot && !lit && hot.name !== HOME;
			const n = 44, lift = 0.085;
			const pts = [];
			for (let i = 0; i <= n; i++) {
				const tt = i / n;
				const v = slerp(homeV, c.v, tt);
				const hgt = 1 + Math.sin(Math.PI * tt) * lift * Math.acos(Math.min(1, Math.max(-1, dot(homeV, c.v)))) ;
				pts.push(project([v[0] * hgt, v[1] * hgt, v[2] * hgt]));
			}
			for (const pass of [0, 1]) {
				ctx.beginPath();
				let pen = false;
				for (let i = 0; i < pts.length; i++) {
					const p = pts[i];
					const vis = p[2] > 0 || p[0] * p[0] + p[1] * p[1] > 1;
					if (!vis) { pen = false; continue; }
					const [x, y] = px(p);
					pen ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
					pen = true;
				}
				ctx.lineWidth = pass ? (lit ? 1.8 : 1) : lit ? 5 : 3;
				ctx.strokeStyle = `rgba(${colors.arc},${pass ? (dim ? 0.18 : lit ? 1 : 0.65) : lit ? 0.25 : 0.08})`;
				ctx.stroke();
			}
			// traveling spark
			if (!reducedMotion) {
				const tt = (time * 0.18 + (c.lon * 0.013 + 7)) % 1;
				const idx = Math.floor(tt * n), p = pts[idx];
				if (p && (p[2] > 0 || p[0] * p[0] + p[1] * p[1] > 1)) {
					const [x, y] = px(p);
					ctx.fillStyle = `rgba(${colors.arc},${dim ? 0.2 : 0.95})`;
					ctx.beginPath();
					ctx.arc(x, y, 1.8, 0, 7);
					ctx.fill();
				}
			}
		}
		const labels = [];
		cities.sort((a, b) => (b === hovered) - (a === hovered) || (b.name === HOME) - (a.name === HOME));
		for (const c of cities) {
			const p = project(c.v);
			c.p = p;
			if (p[2] <= 0) continue;
			const [x, y] = px(p);
			c.sx = x; c.sy = y;
			const home = c.name === HOME;
			const rr = (home ? 5 : 2.6) + Math.min(3.5, Math.sqrt(c.talks.length) * 0.9);
			const lit = hovered === c;
			ctx.beginPath();
			ctx.arc(x, y, rr + (lit ? 5 : 3), 0, 7);
			ctx.fillStyle = `rgba(${home ? (colors.dark ? "156,240,255" : "11,111,208") : colors.arc},${lit ? 0.35 : 0.18})`;
			ctx.fill();
			ctx.beginPath();
			ctx.arc(x, y, rr * (lit ? 1.2 : 1), 0, 7);
			ctx.fillStyle = home ? colors.home : colors.city;
			ctx.fill();
			if (home || lit || (geo.wide && c.talks.length >= 2 && !labels.some((q) => Math.abs(q[0] - x) < 70 && Math.abs(q[1] - y) < 14))) {
				labels.push([x, y]);
				ctx.font = `600 ${geo.wide ? 12 : 10}px ${cssVar(root, "--siteFont")}`;
				ctx.fillStyle = colors.text;
				ctx.globalAlpha = lit || home ? 1 : 0.8;
				ctx.fillText(c.name, x + rr + 6, y + 4);
				ctx.globalAlpha = 1;
			}
		}
		drawRings(time, true);
	}

	function drawRings(time, front) {
		const { cx, cy, R } = geo;
		for (const ring of rings) {
			const rgb = colors[ring.rgb];
			const ct = Math.cos(ring.tilt), st = Math.sin(ring.tilt);
			const a0 = time * (reducedMotion ? 0 : 0.06) * (ring.key === "Online" ? 1 : -0.6);
			ring.items.forEach((t, i) => {
				const a = ring.phase[i] + a0;
				// orbit in plane, then tilt + view tilt
				let v = [Math.cos(a), Math.sin(a) * Math.sin(ring.tilt), Math.sin(a) * Math.cos(ring.tilt)];
				const cl = Math.cos(ring.rot), sl = Math.sin(ring.rot);
				v = [v[0] * cl - v[2] * sl, v[1], v[0] * sl + v[2] * cl];
				const ct2 = Math.cos(0.5), st2 = Math.sin(0.5);
				const y2 = v[1] * ct2 - v[2] * st2, z2 = v[1] * st2 + v[2] * ct2;
				const x = v[0] * ring.scale, y = y2 * ring.scale;
				const behind = z2 < 0 && x * x + y * y < 1 / 1;
				if (behind === front) return;
				const sx = cx + x * R, sy = cy - y * R;
				t._sx = sx; t._sy = sy; t._ring = ring.key;
				const hot = ringHover === t;
				ctx.fillStyle = `rgba(${rgb},${behind ? 0.22 : hot ? 1 : 0.6})`;
				ctx.beginPath();
				ctx.arc(sx, sy, hot ? 3.5 : 1.7, 0, 7);
				ctx.fill();
			});
		}
	}

	function onMove(e) {
		pointer = { x: e.clientX, y: e.clientY };
		if (!geo.wide || !cities.length || target != null) return;
		const rect = layer.getBoundingClientRect();
		const lx = e.clientX - rect.left, ly = e.clientY - rect.top;
		let best = null, bd = 14 * 14;
		for (const c of cities) {
			if (c.sx == null || c.p[2] <= 0) continue;
			const d = (c.sx - lx) ** 2 + (c.sy - ly) ** 2;
			if (d < bd) { bd = d; best = c; }
		}
		let rbest = null;
		if (!best) {
			let rd = 8 * 8;
			for (const ring of rings) for (const t of ring.items) {
				if (t._sx == null) continue;
				const d = (t._sx - lx) ** 2 + (t._sy - ly) ** 2;
				if (d < rd) { rd = d; rbest = t; }
			}
		}
		if (best !== hovered || rbest !== ringHover) {
			hovered = best;
			ringHover = rbest;
			if (best) {
				const sorted = [...best.talks].sort((a, b) => (a.date < b.date ? 1 : -1));
				tip.show(`<b>${esc(best.name)}</b><small>${best.talks.length} talk${best.talks.length > 1 ? "s" : ""}</small>` + sorted.slice(0, 4).map((t) => `<i>${esc(t.date.slice(0, 4))} · ${esc(t.title)} <small>@ ${esc(t.venue)}</small></i>`).join("") + (sorted.length > 4 ? `<small>+${sorted.length - 4} more</small>` : ""), e.clientX, e.clientY);
			} else if (rbest) {
				tip.show(`<b>${esc(rbest.title)}</b><small>${esc(rbest._ring === "Online" ? "Online" : "Podcast")} · ${esc(rbest.venue)} · ${esc(rbest.date.slice(0, 4))}</small>`, e.clientX, e.clientY);
			} else {
				tip.hide();
			}
			if (reducedMotion) draw();
		}
	}

	// hover a talk in the page -> fly to its city
	function onOver(e) {
		const item = e.target.closest?.(".site-talk");
		if (!item || !cities.length) return;
		const meta = norm(item.querySelector(".site-item-meta")?.textContent ?? "");
		const c = cities.find((c) => meta.includes(norm(c.name)));
		if (c) {
			target = c.lon * RAD;
			hovered = c;
			if (reducedMotion) { lon0 = target; draw(); }
		}
	}
	function onOut(e) {
		if (e.target.closest?.(".site-talk")) { hovered = null; target = null; if (reducedMotion) draw(); }
	}

	// affordance legend
	const legend = document.createElement("div");
	legend.className = "tg-legend";
	overlay.append(legend);

	const onResize = () => { layout(); if (reducedMotion) draw(); };
	window.addEventListener("resize", onResize);
	window.addEventListener("pointermove", onMove, { passive: true });
	root.addEventListener("mouseover", onOver);
	root.addEventListener("mouseout", onOut);
	layout();

	let runner;
	let dead = false;
	Promise.all([loadData(), loadLand()]).then(([data]) => {
		if (dead) return;
		build(data);
		const n = cities.length;
		const pod = data.talks.filter((t) => t.category === "Podcasts" && !t.online).length;
		const on = data.talks.filter((t) => t.online).length;
		legend.innerHTML = `<b>${data.talks.length} talks</b><span><i class="c1"></i>${n} cities</span><span><i class="c2"></i>${on} online</span><span><i class="c3"></i>${pod} podcasts</span><em>hover a city</em>`;
		if (reducedMotion) { draw(); return; }
		runner = loop((dt, t) => {
			if (target != null) {
				let d = ((target - lon0 + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
				lon0 += d * Math.min(1, dt * 3.2);
			} else if (!hovered && !ringHover) lon0 += spin * dt;
			draw(t);
		});
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

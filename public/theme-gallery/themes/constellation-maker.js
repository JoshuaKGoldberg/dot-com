// Constellation Maker: connect stars, name your constellation, and it stays in your sky.
import { createToy, clamp, rnd } from "./_toy/toy.js";

const STORE = "toy:constellations";
const NAMES = ["The Heron", "The Loon", "Lantern Pole", "Spruce Bough", "The Canoe", "Marten's Trail", "Lean-To", "The Fire Tower", "Beaver Pond", "Mink Run", "Birch Bark", "The Kettle", "Cairn", "Snowshoe", "Hemlock", "Tamarack"];
const load = () => { try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { return []; } };
const save = (list) => localStorage.setItem(STORE, JSON.stringify(list.slice(-12)));

export function activate({ root, reducedMotion }) {
	const layer = root.querySelector(".overlay-b");
	let idle = null;
	let idleResize = null;

	function renderIdle() {
		const list = load();
		if (!list.length || !layer) {
			idle?.remove(); idle = null;
			if (idleResize) { window.removeEventListener("resize", idleResize); idleResize = null; }
			return;
		}
		if (!idle) {
			idle = document.createElement("canvas");
			idle.setAttribute("aria-hidden", "true");
			Object.assign(idle.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });
			layer.append(idle);
			let timer = 0;
			idleResize = () => { clearTimeout(timer); timer = setTimeout(renderIdle, 150); };
			window.addEventListener("resize", idleResize);
		}
		const dark = document.documentElement.classList.contains("dark");
		const W = layer.clientWidth, H = layer.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
		idle.width = W * dpr; idle.height = H * dpr;
		const g = idle.getContext("2d");
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		const ink = dark ? "255,236,170" : "40,50,110";
		for (const c of list) {
			g.strokeStyle = `rgba(${ink},0.3)`; g.lineWidth = 1;
			g.beginPath();
			for (const [a, b] of c.edges) { g.moveTo(c.pts[a][0] * W, c.pts[a][1] * H); g.lineTo(c.pts[b][0] * W, c.pts[b][1] * H); }
			g.stroke();
			g.fillStyle = `rgba(${ink},0.8)`;
			for (const p of c.pts) { g.beginPath(); g.arc(p[0] * W, p[1] * H, 2.2, 0, 7); g.fill(); }
			g.font = "600 11px sans-serif"; g.fillStyle = `rgba(${ink},0.7)`;
			g.fillText(c.name, c.pts[0][0] * W + 8, c.pts[0][1] * H - 8);
		}
	}
	renderIdle();

	const dispose = createToy({
		root, reducedMotion, id: "constellation-maker", name: "Constellation Maker", startKey: "p", hz: 30, scoreLabel: "Stars ",
		make(api) {
			let stars, edges, last, hover, t, panel, nameInput, naming, saved, ridge, shooting;

			function pick(x, y) {
				const rad = api.pointer.touch ? 30 : 20;
				let best = -1, bd = rad;
				stars.forEach((s, i) => { const d = Math.hypot(s.x - x, s.y - y); if (d < bd) { bd = d; best = i; } });
				return best;
			}
			function used() { return new Set(edges.flatMap((e) => [e.a, e.b])); }
			function undo() { if (!edges.length || naming) return; const e = edges.pop(); last = e.a; api.score = used().size; api.beep(300, 0.05, "triangle", 0.03); }
			function finish() {
				if (edges.length < 1) { api.say("Connect at least two stars first."); return; }
				naming = true;
				const taken = new Set(load().map((c) => c.name));
				const options = NAMES.filter((n) => !taken.has(n));
				nameInput.value = options[Math.floor(Math.random() * options.length)] || `Constellation ${load().length + 1}`;
				panel.dataset.naming = "1";
				nameInput.hidden = false;
				for (const b of panel.querySelectorAll("button")) b.hidden = b.dataset.role !== "save" && b.dataset.role !== "cancel";
				nameInput.focus(); nameInput.select();
				api.say("Name it, then Enter to hang it in your sky");
			}
			function commit() {
				const ids = [...used()];
				const W = api.W, H = api.H;
				const c = { name: nameInput.value.trim().slice(0, 28) || "Untitled", pts: ids.map((i) => [+(stars[i].x / W).toFixed(4), +(stars[i].y / H).toFixed(4)]), edges: edges.map((e) => [ids.indexOf(e.a), ids.indexOf(e.b)]) };
				const list = load(); list.push(c); save(list);
				renderIdle();
				api.submit(ids.length);
				api.beep(784, 0.3, "triangle", 0.06, 300);
				api.burst(stars[ids[0]].x, stars[ids[0]].y, { n: 30, color: api.c.toy2, speed: 220, gravity: 0, life: 1 });
				api.say(`Saved "${c.name}". Your sky has ${list.length}. Esc to go back, or draw another.`);
				saved = c.name;
				edges = []; last = -1; naming = false; api.score = 0;
				endNaming();
			}
			function endNaming() {
				naming = false; nameInput.hidden = true; delete panel.dataset.naming;
				for (const b of panel.querySelectorAll("button")) b.hidden = b.dataset.role === "save" || b.dataset.role === "cancel";
				nameInput.blur();
			}

			return {
				start() {
					api.measure();
					const W = api.W, H = api.H;
					const n = clamp(Math.round((W * H) / 8500), 40, 150);
					stars = Array.from({ length: n }, () => ({ x: rnd(24, W - 24), y: rnd(70, H * 0.8), r: rnd(0.8, 2.4), ph: rnd(0, 6) }));
					// a few bigger bright ones so there is always something to connect
					for (let i = 0; i < 12; i++) stars[i].r = rnd(2.6, 3.8);
					edges = []; last = -1; hover = -1; t = 0; naming = false; saved = ""; shooting = null;
					ridge = Array.from({ length: Math.ceil(W / 14) + 2 }, (_, i) => 0.5 + 0.5 * Math.sin(i * 0.13 + 1) * 0.6 + 0.3 * Math.sin(i * 0.41) + 0.15 * Math.sin(i * 1.3));
					panel?.remove();
					panel = document.createElement("div");
					panel.className = "toy-panel";
					const mk = (label, role, fn, hide) => { const b = document.createElement("button"); b.type = "button"; b.textContent = label; b.dataset.role = role; b.hidden = !!hide; b.addEventListener("click", fn); panel.append(b); return b; };
					mk("Finish ⏎", "finish", finish);
					mk("Undo ⌫", "undo", undo);
					mk("Clear my sky", "clear", () => { localStorage.removeItem(STORE); renderIdle(); api.say("Sky cleared."); });
					nameInput = document.createElement("input");
					nameInput.type = "text"; nameInput.maxLength = 28; nameInput.hidden = true; nameInput.setAttribute("aria-label", "Constellation name");
					nameInput.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commit(); } else if (e.key === "Escape") { e.preventDefault(); endNaming(); api.say("Cancelled. Keep drawing."); } });
					panel.append(nameInput);
					mk("Hang it", "save", commit, true);
					mk("Cancel", "cancel", () => { endNaming(); api.say("Cancelled."); }, true);
					root.append(panel);
					api.say("Click stars in order to connect them · Enter finishes · Backspace undoes");
				},
				resize() { api.restart(); },
				stop() { panel?.remove(); panel = null; },
				key(k) {
					if (naming) return;
					if (k === "Enter") finish();
					else if (k === "Backspace" || k === "z") undo();
				},
				move(x, y) { hover = pick(x, y); },
				down(x, y) {
					if (naming) return;
					const i = pick(x, y);
					if (i < 0) return;
					if (last >= 0 && i !== last && !edges.some((e) => (e.a === last && e.b === i) || (e.a === i && e.b === last))) {
						edges.push({ a: last, b: i });
						api.beep(440 + edges.length * 40, 0.1, "triangle", 0.05);
						api.burst(stars[i].x, stars[i].y, { n: 8, color: api.c.toy2, speed: 90, gravity: 0, life: 0.5 });
					} else if (last < 0) api.beep(520, 0.08, "triangle", 0.04);
					last = i;
					api.score = used().size;
				},
				step(dt) {
					t += dt;
					if (!shooting && !reducedMotion && Math.random() < dt * 0.15) shooting = { x: rnd(0, api.W * 0.7), y: rnd(60, api.H * 0.3), age: 0 };
					if (shooting) { shooting.age += dt; if (shooting.age > 0.8) shooting = null; }
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H;
					const sky = g.createLinearGradient(0, 0, 0, H);
					sky.addColorStop(0, "rgba(6,10,32,0.93)"); sky.addColorStop(1, "rgba(24,22,60,0.9)");
					g.fillStyle = sky; g.fillRect(0, 0, W, H);
					// saved constellations, dim
					for (const s of load()) {
						g.strokeStyle = "rgba(255,230,160,0.22)"; g.lineWidth = 1; g.beginPath();
						for (const [a, b] of s.edges) { g.moveTo(s.pts[a][0] * W, s.pts[a][1] * H); g.lineTo(s.pts[b][0] * W, s.pts[b][1] * H); }
						g.stroke();
					}
					// stars
					const inUse = used();
					for (let i = 0; i < stars.length; i++) {
						const s = stars[i];
						const tw = reducedMotion ? 1 : 0.75 + 0.25 * Math.sin(t * 2 + s.ph);
						const hot = i === hover || i === last;
						g.fillStyle = inUse.has(i) || hot ? "#ffe9a8" : "#dfe8ff";
						g.globalAlpha = (inUse.has(i) ? 1 : 0.55 + s.r * 0.12) * tw;
						g.beginPath(); g.arc(s.x, s.y, s.r + (hot ? 1.5 : 0), 0, 7); g.fill();
						if (s.r > 2.5) { g.globalAlpha = 0.18 * tw; g.beginPath(); g.arc(s.x, s.y, s.r * 3.2, 0, 7); g.fill(); }
						if (hot) { g.globalAlpha = 0.9; g.strokeStyle = "#ffe9a8"; g.lineWidth = 1.5; g.beginPath(); g.arc(s.x, s.y, s.r + 7, 0, 7); g.stroke(); }
					}
					g.globalAlpha = 1;
					// your lines
					g.strokeStyle = "#ffe9a8"; g.lineWidth = 2; g.lineCap = "round";
					g.beginPath();
					for (const e of edges) { g.moveTo(stars[e.a].x, stars[e.a].y); g.lineTo(stars[e.b].x, stars[e.b].y); }
					g.stroke();
					if (last >= 0 && !naming && api.pointer.inside) {
						const tgt = hover >= 0 ? stars[hover] : api.pointer;
						g.strokeStyle = "rgba(255,233,168,0.5)"; g.setLineDash([4, 6]); g.lineWidth = 1.5;
						g.beginPath(); g.moveTo(stars[last].x, stars[last].y); g.lineTo(tgt.x, tgt.y); g.stroke(); g.setLineDash([]);
					}
					if (shooting) { const a = shooting.age / 0.8; g.strokeStyle = `rgba(255,255,255,${1 - a})`; g.lineWidth = 2; g.beginPath(); g.moveTo(shooting.x + a * 300, shooting.y + a * 140); g.lineTo(shooting.x + a * 300 - 50, shooting.y + a * 140 - 23); g.stroke(); }
					// Adirondack ridge
					g.fillStyle = "#070a1c";
					g.beginPath(); g.moveTo(0, H);
					ridge.forEach((v, i) => g.lineTo(i * 14, H - 40 - v * 70));
					g.lineTo(W, H); g.fill();
					g.fillStyle = "#0b1030";
					g.beginPath(); g.moveTo(0, H);
					ridge.forEach((v, i) => g.lineTo(i * 14, H - 14 - Math.abs(Math.sin(i * 0.31 + 2)) * 34));
					g.lineTo(W, H); g.fill();
					if (!edges.length && !saved) { g.fillStyle = "#ffe9a8"; g.font = "700 17px sans-serif"; g.textAlign = "center"; g.fillText("Click a star, then another, and another...", W / 2, H * 0.88 - 36); }
				},
			};
		},
	});
	return () => {
		dispose();
		if (idleResize) window.removeEventListener("resize", idleResize);
		idle?.remove();
	};
}

// Squiggle Snake: steer a growing squiggle around the page, eating the dots laid along its links.
import { createToy, clamp } from "./_toy/toy.js";

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "squiggle-snake", name: "Squiggle Snake", startKey: "p", hz: 120,
		make(api) {
			const CELL = 22;
			let cols, rows, body, dir, nextDir, queue, clock, grow, links, dots, tween, alive, wobble, stepEvery, flash;
			const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };

			function collectLinks() {
				const st = api.scrollTop;
				links = [];
				for (const node of root.querySelectorAll(".site-link, .site-nav-link, .site-logo")) {
					const r = api.rect(node);
					if (r.w < 24 || r.h < 8) continue;
					links.push({ docY: r.y + st, x: r.x, w: r.w, h: r.h, left: 0, total: 0 });
				}
			}
			function placeDots() {
				// Dots on the links currently in view, snapped to the grid.
				const st = api.scrollTop;
				dots = [];
				for (const l of links) {
					if (l.left === 0 && l.total > 0) continue;
					const y = l.docY - st + l.h / 2;
					if (y < 70 || y > api.H - 30) continue;
					const row = Math.round(y / CELL);
					const n = clamp(Math.round(l.w / (CELL * 1.5)), 1, 9);
					l.total = 0;
					for (let i = 0; i < n; i++) {
						const col = Math.round((l.x + (l.w * (i + 0.5)) / n) / CELL);
						if (!dots.some((d) => d.c === col && d.r === row)) { dots.push({ c: col, r: row, link: l, hot: 0 }); l.total++; }
					}
					l.left = l.total;
				}
			}
			function pendingLink() { return links.find((l) => l.total === 0 && l.left === 0 && !l.done); }

			function nextScreen() {
				const todo = links.filter((l) => !l.done && l.total === 0);
				if (!todo.length) { api.end("Every link eaten. Squiggle complete"); return; }
				const target = clamp(todo[0].docY - api.H * 0.3, 0, root.scrollHeight - api.H);
				tween = { from: api.scrollTop, to: target, t: 0 };
				api.say("Scrolling to the next links…");
			}

			function steer(k) {
				const d = DIRS[k];
				if (!d) return;
				const last = queue.length ? queue[queue.length - 1] : dir;
				if (d[0] === -last[0] && d[1] === -last[1]) return;
				if (d[0] === last[0] && d[1] === last[1]) return;
				if (queue.length < 3) queue.push(d);
			}

			return {
				start() {
					api.scrollTo(0);
					api.measure();
					cols = Math.floor(api.W / CELL);
					rows = Math.floor(api.H / CELL);
					collectLinks();
					for (const l of links) { l.left = 0; l.total = 0; l.done = false; }
					placeDots();
					const c0 = Math.floor(cols / 2), r0 = Math.floor(rows * 0.45);
					body = [];
					for (let i = 0; i < 5; i++) body.push({ c: c0 - i, r: r0 });
					dir = [1, 0];
					queue = [];
					clock = 0; grow = 0; tween = null; wobble = 0; flash = 0;
					stepEvery = 0.13;
					api.say("Arrows / WASD to steer, or tap a side. Eat the dots on links.");
				},
				resize() { api.restart(); },
				key(k) { steer(k.length === 1 ? k.toLowerCase() : k); },
				down(x, y) {
					const h = body[0];
					const dx = x - (h.c + 0.5) * CELL, dy = y - (h.r + 0.5) * CELL;
					if (Math.abs(dx) > Math.abs(dy)) steer(dx > 0 ? "ArrowRight" : "ArrowLeft");
					else steer(dy > 0 ? "ArrowDown" : "ArrowUp");
				},
				step(dt) {
					wobble += dt;
					flash = Math.max(0, flash - dt * 3);
					if (tween) {
						tween.t += dt / 0.55;
						const e = tween.t >= 1 ? 1 : 1 - Math.pow(1 - tween.t, 3);
						api.scrollTo(tween.from + (tween.to - tween.from) * e);
						if (tween.t >= 1) { tween = null; placeDots(); api.say(`${dots.length} dots on this screen`); }
						return;
					}
					clock += dt;
					if (clock < stepEvery) return;
					clock -= stepEvery;
					if (queue.length) dir = queue.shift();
					const h = body[0];
					const nh = { c: (h.c + dir[0] + cols) % cols, r: (h.r + dir[1] + rows) % rows };
					if (body.some((s, i) => i < body.length - 1 && s.c === nh.c && s.r === nh.r)) {
						api.shake(8);
						api.burst((h.c + 0.5) * CELL, (h.r + 0.5) * CELL, { n: 30, color: api.c.toy2, speed: 300 });
						api.beep(120, 0.4, "sawtooth", 0.05, -60);
						api.end("Tangled up");
						return;
					}
					body.unshift(nh);
					const i = dots.findIndex((d) => d.c === nh.c && d.r === nh.r);
					if (i >= 0) {
						const d = dots.splice(i, 1)[0];
						api.add(10);
						grow += 0.5;
						d.link.left--;
						api.burst((nh.c + 0.5) * CELL, (nh.r + 0.5) * CELL, { n: 8, color: api.c.toy2, speed: 140, size: 3 });
						api.beep(520 + (d.link.total - d.link.left) * 40, 0.06, "triangle", 0.045);
						if (d.link.left === 0) {
							d.link.done = true;
							api.add(50);
							flash = 1;
							api.beep(880, 0.15, "triangle", 0.06);
							api.burst((nh.c + 0.5) * CELL, (nh.r + 0.5) * CELL, { n: 24, color: api.c.toy, speed: 260 });
						}
						if (!dots.length) nextScreen();
					}
					if (grow >= 1) grow -= 1;
					else body.pop();
					stepEvery = Math.max(0.065, 0.13 - body.length * 0.0006);
				},
				draw(g) {
					const c = api.c;
					for (const d of dots) {
						const x = (d.c + 0.5) * CELL, y = (d.r + 0.5) * CELL;
						const pulse = reducedMotion ? 0 : Math.sin(wobble * 5 + d.c) * 1.2;
						g.fillStyle = c.toy2;
						g.beginPath(); g.arc(x, y, 5 + pulse, 0, 7); g.fill();
						g.strokeStyle = c.bg; g.lineWidth = 2; g.stroke();
					}
					// body as a smoothed squiggle
					const pts = body.map((s) => [(s.c + 0.5) * CELL, (s.r + 0.5) * CELL]);
					const prog = clamp(clock / stepEvery, 0, 1);
					if (pts.length > 1 && !tween) {
						// slide the tail toward its neighbour for smooth motion
						const t = pts[pts.length - 1], t2 = pts[pts.length - 2];
						if (Math.abs(t[0] - t2[0]) < CELL * 2 && Math.abs(t[1] - t2[1]) < CELL * 2) { t[0] += (t2[0] - t[0]) * prog; t[1] += (t2[1] - t[1]) * prog; }
					}
					g.lineCap = "round";
					g.lineJoin = "round";
					const wavy = pts.map((p, i) => {
						const n = pts[i + 1] || p, pr = pts[i - 1] || p;
						let dx = pr[0] - n[0], dy = pr[1] - n[1];
						const l = Math.hypot(dx, dy) || 1;
						const w = reducedMotion ? 0 : Math.sin(i * 1.1 - wobble * 9) * 3.2;
						return [p[0] + (-dy / l) * w, p[1] + (dx / l) * w];
					});
					const strokePath = (width, color) => {
						g.strokeStyle = color; g.lineWidth = width;
						g.beginPath();
						let started = false;
						for (let i = 0; i < wavy.length; i++) {
							const p = wavy[i];
							const prev = wavy[i - 1];
							if (!started || Math.abs(p[0] - prev[0]) > CELL * 2 || Math.abs(p[1] - prev[1]) > CELL * 2) { g.moveTo(p[0], p[1]); started = true; }
							else g.lineTo(p[0], p[1]);
						}
						g.stroke();
					};
					strokePath(13, c.bg);
					strokePath(9, flash > 0 ? c.toy2 : c.toy);
					const h = wavy[0];
					g.fillStyle = c.bg;
					g.beginPath(); g.arc(h[0], h[1], 8.5, 0, 7); g.fill();
					g.fillStyle = c.toy; g.beginPath(); g.arc(h[0], h[1], 6.5, 0, 7); g.fill();
					g.fillStyle = c.bg;
					g.beginPath(); g.arc(h[0] + dir[0] * 2 - dir[1] * 2.5, h[1] + dir[1] * 2 + dir[0] * 2.5, 1.8, 0, 7);
					g.arc(h[0] + dir[0] * 2 + dir[1] * 2.5, h[1] + dir[1] * 2 - dir[0] * 2.5, 1.8, 0, 7); g.fill();
				},
			};
		},
	});
}

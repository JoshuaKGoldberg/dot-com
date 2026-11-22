// Layout Golf: the page's own layout is the course. Putt from the header to a hole in the footer.
import { createToy, circleRect, roundRect, clamp } from "./_toy/toy.js";

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "layout-golf", name: "Layout Golf", startKey: "p", hz: 240, lowerIsBetter: true, scoreLabel: "Strokes ",
		make(api) {
			const BR = 7;
			let fair, walls, bumpers, hole, ball, strokes, tee, par, aim, charge, charging, drag, cam, sunk, sink, trail, docH;

			function build() {
				api.scrollTo(0);
				api.measure();
				docH = root.scrollHeight;
				walls = [];
				bumpers = [];
				const add = (node, list, extra = {}) => { const r = api.rect(node); if (r.w > 8 && r.h > 8) list.push({ ...r, ...extra }); };
				for (const n of root.querySelectorAll(".site-item, .site-about p, .site-title, .site-tagline")) add(n, walls);
				for (const n of root.querySelectorAll(".site-section-title")) { const r = api.rect(n); walls.push({ x: r.x - 8, y: r.y, w: Math.min(r.w, 220) + 16, h: r.h, round: false }); }
				const portrait = root.querySelector(".site-portrait img:not([style*='none'])");
				const pr = api.rect(root.querySelector(".site-portrait"));
				bumpers.push({ cx: pr.x + pr.w / 2, cy: pr.y + pr.h / 2, r: pr.w / 2 });
				void portrait;
				const fp = api.rect(root.querySelector(".site-footer p"));
				hole = { x: fp.x + fp.w / 2, y: fp.y + fp.h + 26, r: 13 };
				const mr = api.rect(root.querySelector(".site-page"));
				fair = { x: mr.x + 8, y: 0, w: mr.w - 16, h: docH };
				tee = { x: api.W / 2 + 120, y: 90 };
				par = Math.max(3, Math.round((hole.y - tee.y) / 650) + 2);
			}

			function shoot(angle, power) {
				if (sunk) return;
				const sp = 160 + power * 1200;
				ball.vx = Math.cos(angle) * sp;
				ball.vy = Math.sin(angle) * sp;
				strokes++;
				api.score = strokes;
				api.beep(220, 0.08, "triangle", 0.06, -80);
				api.burst(ball.x, ball.y, { n: 6, color: api.c.toy2, speed: 100, size: 2, gravity: 0 });
			}
			const moving = () => Math.hypot(ball.vx, ball.vy) > 8;

			return {
				start() {
					build();
					ball = { x: tee.x, y: tee.y, vx: 0, vy: 0 };
					strokes = 0; sunk = false; sink = 0; trail = [];
					aim = Math.PI / 2; charge = 0; charging = 0; drag = null;
					cam = 0;
					api.score = 0;
					api.say(`Par ${par} · drag back and release, or ← → aim + hold Space`);
				},
				resize() { api.restart(); },
				key(k) { if (k === " " && !moving() && !sunk) { charging = 1; charge = 0; } },
				keyup(k) {
					if (k === " " && charging) {
						charging = 0;
						if (!moving()) shoot(aim, Math.max(0.08, charge));
						charge = 0;
					}
				},
				down(x, y) { if (!moving() && !sunk) drag = { x, y }; },
				move(x, y) { if (drag) drag.cx = x, drag.cy = y; },
				up(x, y) {
					if (!drag) return;
					const dx = drag.x - x, dy = drag.y - y;
					const len = Math.hypot(dx, dy);
					if (len > 12 && !moving()) shoot(Math.atan2(dy, dx), clamp(len / 220, 0.05, 1));
					drag = null;
				},
				step(dt) {
					if (api.keys.has("ArrowLeft")) aim -= 2.2 * dt;
					if (api.keys.has("ArrowRight")) aim += 2.2 * dt;
					if (charging) charge = (charge + dt * 0.9) % 2; // ping-pong via draw
					if (sunk) { sink += dt; if (sink > 1.4) api.end(`Hole in ${strokes} (par ${par})`); return; }
					if (moving()) {
						ball.x += ball.vx * dt;
						ball.y += ball.vy * dt;
						const sp = Math.hypot(ball.vx, ball.vy);
						const dec = Math.min(sp, (380 + sp * 0.35) * dt);
						ball.vx -= (ball.vx / sp) * dec;
						ball.vy -= (ball.vy / sp) * dec;
						if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx) * 0.8; api.beep(160, 0.04, "square", 0.03); }
						if (ball.x > api.W - BR) { ball.x = api.W - BR; ball.vx = -Math.abs(ball.vx) * 0.8; api.beep(160, 0.04, "square", 0.03); }
						if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy) * 0.8; }
						if (ball.y > docH - BR) { ball.y = docH - BR; ball.vy = -Math.abs(ball.vy) * 0.8; }
						for (const w of walls) {
							const h = circleRect(ball.x, ball.y, BR, w);
							if (!h) continue;
							ball.x += h.nx * h.d; ball.y += h.ny * h.d;
							const vn = ball.vx * h.nx + ball.vy * h.ny;
							if (vn < 0) {
								ball.vx -= 1.75 * vn * h.nx; ball.vy -= 1.75 * vn * h.ny;
								if (-vn > 120) { api.beep(300, 0.04, "square", 0.03); api.burst(ball.x, ball.y, { n: 4, color: api.c.toy, speed: 120, size: 2, gravity: 0 }); }
							}
						}
						for (const b of bumpers) {
							const dx = ball.x - b.cx, dy = ball.y - b.cy;
							const d = Math.hypot(dx, dy);
							if (d < b.r + BR) {
								const nx = dx / d, ny = dy / d;
								ball.x = b.cx + nx * (b.r + BR); ball.y = b.cy + ny * (b.r + BR);
								const vn = ball.vx * nx + ball.vy * ny;
								if (vn < 0) { ball.vx -= 1.9 * vn * nx; ball.vy -= 1.9 * vn * ny; api.beep(420, 0.05, "triangle", 0.04); api.shake(2); }
							}
						}
						// the hole: slow balls drop, fast ones skip over; a gentle pull helps
						const hd = Math.hypot(hole.x - ball.x, hole.y - ball.y);
						if (hd < hole.r + 10) {
							const s2 = Math.hypot(ball.vx, ball.vy);
							if (hd < hole.r - 2 && s2 < 520) {
								sunk = true; ball.vx = ball.vy = 0; ball.x = hole.x; ball.y = hole.y;
								api.beep(660, 0.3, "triangle", 0.07, 400);
								api.shake(5);
								api.burst(hole.x, hole.y, { n: 40, color: api.c.toy2, speed: 320, gravity: 500 });
								api.burst(hole.x, hole.y, { n: 24, color: api.c.toy, speed: 240, gravity: 500 });
							} else if (s2 < 260) { ball.vx += ((hole.x - ball.x) / hd) * 900 * dt; ball.vy += ((hole.y - ball.y) / hd) * 900 * dt; }
						}
						if (!reducedMotion) { trail.push(ball.x, ball.y); if (trail.length > 24) trail.splice(0, 2); }
						if (!moving()) { ball.vx = ball.vy = 0; aim = Math.atan2(hole.y - ball.y, hole.x - ball.x); }
					} else if (trail.length) trail.length = 0;
					// camera follows the ball (smooth)
					const target = clamp(ball.y - api.H * 0.5, 0, Math.max(0, docH - api.H));
					const cur = api.scrollTop;
					api.scrollTo(Math.abs(target - cur) < 0.5 ? target : cur + (target - cur) * Math.min(1, dt * 5));
				},
				draw(g) {
					const c = api.c, sc = api.scrollTop;
					g.save();
					g.translate(0, -sc);
					// fairway tint behind the page column
					g.fillStyle = c.toy;
					g.globalAlpha = c.dark ? 0.07 : 0.09;
					roundRect(g, fair.x, fair.y, fair.w, fair.h, 24);
					g.fill();
					g.globalAlpha = 1;
					g.lineWidth = 1.5;
					g.strokeStyle = c.toy;
					for (const w of walls) {
						if (w.y - sc > api.H || w.y + w.h - sc < 0) continue;
						g.globalAlpha = 0.5;
						roundRect(g, w.x - 3, w.y - 3, w.w + 6, w.h + 6, 10);
						g.stroke();
					}
					for (const b of bumpers) { g.globalAlpha = 0.6; g.lineWidth = 3; g.beginPath(); g.arc(b.cx, b.cy, b.r + 2, 0, 7); g.stroke(); }
					g.globalAlpha = 1;
					// tee
					g.fillStyle = c.toy2; g.fillRect(tee.x - 9, tee.y + BR, 18, 3);
					// hole + flag
					g.fillStyle = c.dark ? "#000" : "#10261a";
					g.beginPath(); g.ellipse(hole.x, hole.y, hole.r, hole.r * 0.75, 0, 0, 7); g.fill();
					g.strokeStyle = c.strong; g.lineWidth = 2;
					g.beginPath(); g.moveTo(hole.x, hole.y); g.lineTo(hole.x, hole.y - 54); g.stroke();
					g.fillStyle = c.toy2;
					g.beginPath(); g.moveTo(hole.x, hole.y - 54); g.lineTo(hole.x + 26, hole.y - 45); g.lineTo(hole.x, hole.y - 36); g.fill();
					// trail
					for (let i = 0; i < trail.length; i += 2) { g.globalAlpha = (i / trail.length) * 0.3; g.fillStyle = c.toy; g.beginPath(); g.arc(trail[i], trail[i + 1], BR * 0.8, 0, 7); g.fill(); }
					g.globalAlpha = 1;
					// aim
					if (!moving() && !sunk) {
						let a = aim, p = 0;
						if (drag && drag.cx !== undefined) { a = Math.atan2(drag.y - drag.cy, drag.x - drag.cx); p = clamp(Math.hypot(drag.x - drag.cx, drag.y - drag.cy) / 220, 0, 1); }
						else if (charging) p = charge > 1 ? 2 - charge : charge;
						g.strokeStyle = c.toy2; g.lineWidth = 3; g.setLineDash([2, 8]); g.lineCap = "round";
						const len = 40 + (p || 0.25) * 150;
						g.beginPath(); g.moveTo(ball.x, ball.y); g.lineTo(ball.x + Math.cos(a) * len, ball.y + Math.sin(a) * len); g.stroke();
						g.setLineDash([]);
						if (p > 0) {
							g.fillStyle = c.bg; g.strokeStyle = c.toy2; g.lineWidth = 2;
							roundRect(g, ball.x - 30, ball.y + 16, 60, 8, 4); g.fill(); g.stroke();
							g.fillStyle = c.toy2; roundRect(g, ball.x - 30, ball.y + 16, 60 * p, 8, 4); g.fill();
						}
					}
					// ball
					const r = sunk ? BR * Math.max(0, 1 - sink * 2) : BR;
					g.fillStyle = "#fff"; g.strokeStyle = c.dark ? "#cfd8e8" : "#25304a"; g.lineWidth = 1.5;
					g.beginPath(); g.arc(ball.x, ball.y, r, 0, 7); g.fill(); g.stroke();
					g.restore();
				},
			};
		},
	});
}

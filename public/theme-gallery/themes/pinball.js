// Page Pinball: headings are bumpers, cards are drop targets, flippers sit at the bottom.
import { createToy, circleRect, closestOnSeg, roundRect, clamp, rnd } from "./_toy/toy.js";

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "pinball", name: "Page Pinball", startKey: "p", hz: 240,
		make(api) {
			const BALL_R = 9;
			const GRAV = 1050;
			let L, R, laneX, top, segs, bumpers, targets, flippers, ball, balls, trail, pointers;
			const flipKeysL = ["ArrowLeft", "z", "a"];
			const flipKeysR = ["ArrowRight", "/", "l"];

			function build() {
				const W = api.W, H = api.H;
				const tw = Math.min(W, 840);
				L = (W - tw) / 2;
				R = L + tw;
				top = 62;
				laneX = R - 34;
				const pw = laneX - L;
				const f = Math.min(92, pw * 0.2);
				const cxp = L + pw / 2;
				const off = f * Math.cos(0.5) + Math.min(46, pw * 0.07);
				const py = H - 82;
				flippers = [
					{ side: 1, px: cxp - off, py, len: f, a: 0.5, rest: 0.5, up: -0.5, w: 0, hit: 0 },
					{ side: -1, px: cxp + off, py, len: f, a: 0.5, rest: 0.5, up: -0.5, w: 0, hit: 0 },
				];
				const S = (ax, ay, bx, by, e = 0.55, kind = "wall") => ({ ax, ay, bx, by, e, kind });
				segs = [
					S(L, top + 70, L, H - 250),
					S(L, top + 70, L + 70, top),
					S(L + 70, top, R - 100, top),
					S(R - 100, top, R, top + 80, 0.7),
					S(R, top + 80, R, H - 150),
					S(laneX, H - 150, R, H - 150),
					S(laneX, H - 150, laneX, top + 140),
					S(L, H - 250, flippers[0].px, py, 0.4),
					S(laneX, H - 250, flippers[1].px, py, 0.4),
				];
				const inField = (r) => r.x + r.w > L + 6 && r.x < laneX - 6 && r.y > top - 4 && r.y + r.h < H - 120;
				bumpers = api.rects(".site-title, .site-section-title, .site-logo, .site-nav-link, .site-item-title").filter(inField).map((r) => ({ ...r, flash: 0 }));
				targets = api.rects(".site-item-description, .site-about p").filter(inField).map((r) => ({ ...r, lit: false, flash: 0 }));
				if (bumpers.length < 2) {
					for (const [fx, fy] of [[0.3, 0.35], [0.7, 0.35], [0.5, 0.5]]) {
						bumpers.push({ x: L + pw * fx - 24, y: top + (H - top - 300) * fy, w: 48, h: 48, flash: 0, round: true });
					}
				}
			}

			function newBall() {
				ball = { x: (laneX + R) / 2, y: api.H - 150 - BALL_R, vx: 0, vy: 0 };
				trail = [];
			}

			function launch() {
				if (ball.x > laneX && ball.y > api.H - 200 && Math.abs(ball.vy) < 60) {
					ball.vy = -(1330 + rnd(0, 120));
					api.beep(180, 0.25, "sawtooth", 0.04, 500);
					api.burst(ball.x, ball.y + 10, { n: 8, color: api.c.toy2, speed: 120, angle: Math.PI / 2, spread: 1, gravity: 300 });
				}
			}

			function flipperTip(fl, a = fl.a) {
				return [fl.px + fl.side * fl.len * Math.cos(a), fl.py + fl.len * Math.sin(a)];
			}

			function collideSeg(ax, ay, bx, by, e, thick, surf) {
				const cp = closestOnSeg(ball.x, ball.y, ax, ay, bx, by);
				const dx = ball.x - cp.x, dy = ball.y - cp.y;
				const d = Math.hypot(dx, dy);
				const rr = BALL_R + thick;
				if (d >= rr || d === 0) return false;
				const nx = dx / d, ny = dy / d;
				ball.x += nx * (rr - d);
				ball.y += ny * (rr - d);
				let sx = 0, sy = 0;
				if (surf) [sx, sy] = surf(cp);
				const vn = (ball.vx - sx) * nx + (ball.vy - sy) * ny;
				if (vn < 0) {
					ball.vx -= (1 + e) * vn * nx;
					ball.vy -= (1 + e) * vn * ny;
				}
				return Math.abs(vn);
			}

			function launchedBy(r, nx, ny, kick) {
				const sp = Math.hypot(ball.vx, ball.vy);
				const v = Math.max(sp * 0.9, kick);
				ball.vx = nx * v + ball.vx * 0.15;
				ball.vy = ny * v + ball.vy * 0.15;
			}

			return {
				start() {
					const about = api.page.querySelector(".site-about");
					api.scrollTo(Math.max(0, (about?.offsetTop ?? 300) - 180));
					api.measure();
					build();
					balls = 3;
					pointers = new Map();
					newBall();
					api.say("← → flip (or tap left/right) · Space launches · 3 balls");
				},
				resize() { api.restart(); },
				key(k) {
					if (k === " " || k === "Enter" || k === "ArrowUp") launch();
				},
				down(x, y, e) {
					pointers.set(e.pointerId, x < api.W / 2 ? 0 : 1);
					if (e.pointerType === "touch" || true) launch();
				},
				up(x, y, e) { pointers.delete(e.pointerId); },
				step(dt) {
					const kL = flipKeysL.some((k) => api.keys.has(k)) || [...pointers.values()].includes(0);
					const kR = flipKeysR.some((k) => api.keys.has(k)) || [...pointers.values()].includes(1);
					for (const fl of flippers) {
						const want = (fl.side === 1 ? kL : kR) ? fl.up : fl.rest;
						const dir = Math.sign(want - fl.a);
						const speed = dir < 0 ? 24 : 14;
						const prev = fl.a;
						fl.a += dir * speed * dt;
						if ((dir > 0 && fl.a > want) || (dir < 0 && fl.a < want)) fl.a = want;
						fl.w = (fl.a - prev) / dt;
						if (dir < 0 && fl.a === want && prev !== want) api.beep(140, 0.05, "square", 0.03);
					}
					ball.vy += GRAV * dt;
					const sp = Math.hypot(ball.vx, ball.vy);
					if (sp > 1900) { ball.vx *= 1900 / sp; ball.vy *= 1900 / sp; }
					ball.x += ball.vx * dt;
					ball.y += ball.vy * dt;
					for (const s of segs) {
						if (s.ay === s.by && s.ay === api.H - 150 && ball.x < laneX) continue;
						if (collideSeg(s.ax, s.ay, s.bx, s.by, s.e, 2)) {}
					}
					for (const fl of flippers) {
						const [tx, ty] = flipperTip(fl);
						const bAx = fl.px, bAy = fl.py;
						const side = fl.side;
						const hit = collideSeg(bAx, bAy, tx, ty, 0.35, 7, (cp) => {
							const l = Math.hypot(cp.x - fl.px, cp.y - fl.py);
							const a = fl.a;
							return side === 1 ? [l * fl.w * -Math.sin(a), l * fl.w * Math.cos(a)] : [l * fl.w * Math.sin(a), l * fl.w * Math.cos(a)];
						});
						if (hit && hit > 250) { api.beep(300, 0.04, "triangle", 0.03); }
					}
					for (const b of bumpers) {
						const h = b.round ? null : circleRect(ball.x, ball.y, BALL_R, b);
						let hit = h;
						if (b.round) {
							const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
							const d = Math.hypot(ball.x - cx, ball.y - cy);
							if (d < b.w / 2 + BALL_R) hit = { nx: (ball.x - cx) / d, ny: (ball.y - cy) / d, d: b.w / 2 + BALL_R - d };
						}
						if (hit) {
							ball.x += hit.nx * hit.d;
							ball.y += hit.ny * hit.d;
							launchedBy(b, hit.nx, hit.ny, 560);
							if (b.flash < 0.5) {
								api.add(100);
								api.beep(520 + Math.random() * 200, 0.09, "square", 0.035);
								api.burst(ball.x, ball.y, { n: 10, color: api.c.toy, speed: 260 });
								api.shake(3);
							}
							b.flash = 1;
						}
					}
					for (const t of targets) {
						const hit = circleRect(ball.x, ball.y, BALL_R, t);
						if (hit) {
							ball.x += hit.nx * hit.d;
							ball.y += hit.ny * hit.d;
							const vn = ball.vx * hit.nx + ball.vy * hit.ny;
							if (vn < 0) { ball.vx -= 1.55 * vn * hit.nx; ball.vy -= 1.55 * vn * hit.ny; }
							if (!t.lit) {
								t.lit = true;
								api.add(250);
								api.beep(784, 0.14, "triangle", 0.05);
								api.burst(ball.x, ball.y, { n: 16, color: api.c.toy2, speed: 300 });
								if (targets.every((q) => q.lit)) {
									api.add(2000);
									api.say("All targets! +2000");
									api.beep(1046, 0.4, "triangle", 0.06);
									api.shake(8);
									for (const q of targets) { q.lit = false; q.flash = 1; }
								}
							}
							t.flash = 1;
						}
					}
					for (const q of [...bumpers, ...targets]) q.flash = Math.max(0, q.flash - dt * 3);
					if (ball.y > api.H + 30) {
						balls--;
						api.beep(200, 0.4, "sawtooth", 0.04, -120);
						api.shake(6);
						if (balls <= 0) api.end("Game over");
						else { newBall(); api.say(`${balls} ball${balls === 1 ? "" : "s"} left · Space to launch`); }
					}
					if (!reducedMotion) { trail.push(ball.x, ball.y); if (trail.length > 20) trail.splice(0, 2); }
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H;
					// dim outside the table so the table reads as a mode
					g.fillStyle = c.dark ? "rgba(5,8,16,0.55)" : "rgba(255,250,240,0.6)";
					g.fillRect(0, 0, L, H);
					g.fillRect(R, 0, W - R, H);
					g.fillStyle = c.dark ? "rgba(5,8,16,0.18)" : "rgba(255,250,240,0.2)";
					g.fillRect(L, 0, R - L, H);
					g.lineCap = "round";
					g.strokeStyle = c.toy;
					g.lineWidth = 4;
					for (const s of segs) { g.beginPath(); g.moveTo(s.ax, s.ay); g.lineTo(s.bx, s.by); g.stroke(); }
					g.lineWidth = 1;
					for (const t of targets) {
						g.fillStyle = t.lit ? c.toy2 : "transparent";
						g.globalAlpha = t.lit ? 0.22 + t.flash * 0.3 : 1;
						roundRect(g, t.x - 4, t.y - 4, t.w + 8, t.h + 8, 10);
						if (t.lit) g.fill();
						g.globalAlpha = t.lit ? 0.9 : 0.55;
						g.strokeStyle = t.lit ? c.toy2 : c.muted;
						g.setLineDash(t.lit ? [] : [5, 5]);
						g.lineWidth = t.lit ? 2 : 1.5;
						g.stroke();
						g.setLineDash([]);
						g.globalAlpha = 1;
					}
					for (const b of bumpers) {
						g.strokeStyle = c.toy;
						g.lineWidth = 2 + b.flash * 3;
						g.fillStyle = c.toy;
						g.globalAlpha = 0.1 + b.flash * 0.35;
						if (b.round) { g.beginPath(); g.arc(b.x + b.w / 2, b.y + b.h / 2, b.w / 2, 0, 7); } else roundRect(g, b.x - 5, b.y - 3, b.w + 10, b.h + 6, 12);
						g.fill();
						g.globalAlpha = 1;
						g.stroke();
					}
					for (const fl of flippers) {
						const [tx, ty] = flipperTip(fl);
						g.strokeStyle = c.toy;
						g.lineWidth = 16;
						g.beginPath(); g.moveTo(fl.px, fl.py); g.lineTo(fl.px + (tx - fl.px) * 0.96, fl.py + (ty - fl.py) * 0.96); g.stroke();
						g.strokeStyle = c.toy2; g.lineWidth = 5;
						g.beginPath(); g.moveTo(fl.px, fl.py); g.lineTo(tx, ty); g.stroke();
						g.fillStyle = c.bg;
						g.beginPath(); g.arc(fl.px, fl.py, 3.5, 0, 7); g.fill();
					}
					// trail + ball
					for (let i = 0; i < trail.length; i += 2) {
						g.globalAlpha = (i / trail.length) * 0.35;
						g.fillStyle = c.toy2;
						g.beginPath(); g.arc(trail[i], trail[i + 1], BALL_R * (i / trail.length), 0, 7); g.fill();
					}
					g.globalAlpha = 1;
					const grad = g.createRadialGradient(ball.x - 3, ball.y - 3, 1, ball.x, ball.y, BALL_R);
					grad.addColorStop(0, "#fff");
					grad.addColorStop(1, c.dark ? "#9fb4d0" : "#3b4663");
					g.fillStyle = grad;
					g.beginPath(); g.arc(ball.x, ball.y, BALL_R, 0, 7); g.fill();
					g.strokeStyle = c.dark ? "#fff" : "#0b1220";
					g.lineWidth = 1.5; g.stroke();
					// balls remaining
					for (let i = 0; i < balls - 1; i++) {
						g.fillStyle = c.toy2;
						g.beginPath(); g.arc(R - 18, H - 24 - i * 18 - 0, 6, 0, 7); g.fill();
					}
					if (ball.x > laneX && Math.abs(ball.vy) < 60) {
						g.fillStyle = c.strong; g.font = "700 13px sans-serif"; g.textAlign = "center";
						g.fillText("SPACE", (laneX + R) / 2, H - 110);
					}
				},
			};
		},
	});
}

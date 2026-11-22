// Paper Boats: puff the wind (click, tap or keys) and race folded-paper boats down a stream in the margin.
import { createToy, clamp, rnd } from "./_toy/toy.js";

const RIVALS = [
	{ name: "Ember", hue: 8, mult: 1.0 },
	{ name: "Moss", hue: 120, mult: 0.96 },
	{ name: "Sky", hue: 205, mult: 1.03 },
];
const ord = (n) => ["1st", "2nd", "3rd", "4th"][n - 1];

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "paper-boats", name: "Paper Boats", startKey: "p", hz: 120, lowerIsBetter: true, scoreLabel: "Time ",
		make(api) {
			let hw, cx, sway, len, boats, rocks, gusts, t, race, cam, cool, finishedAt, place, flowT;
			const center = (y) => cx + Math.sin(y * 0.0042 + 1) * sway + Math.sin(y * 0.0113) * sway * 0.35;
			const bx = (b) => center(b.y) + b.u * hw * 0.78;

			function puff(x, y, power = 1) {
				gusts.push({ x, y, age: 0 });
				api.beep(180 + Math.random() * 60, 0.18, "sawtooth", 0.015, -60);
				for (const b of boats) {
					const dx = bx(b) - x, dy = b.y - y;
					const d = Math.hypot(dx, dy) || 1;
					if (d > 170) continue;
					const s = (1 - d / 170) ** 1.4 * power;
					b.vy = Math.min(230, b.vy + (dy / d) * s * 150);
					b.vu += (dx / d) * s * 3.2;
					b.spin = (dx / d) * s;
				}
				api.burst(x, y - cam, { n: 8, color: api.c.toy2, speed: 120, gravity: 0, size: 2, life: 0.4 });
			}

			return {
				start() {
					api.scrollTo(api.scrollTop);
					api.measure();
					hw = clamp((api.W - 840) / 4, 36, 66);
					cx = api.W - hw - 18;
					sway = Math.min(hw * 0.85, 44);
					len = api.H * 4.2;
					boats = [{ name: "You", you: true, hue: 24, mult: 1 }, ...RIVALS].map((r, i) => ({ ...r, y: 40, u: [-0.45, -0.15, 0.15, 0.45][i], vy: 0, vu: 0, spin: 0, done: false, time: 0, bob: rnd(0, 6) }));
					rocks = [];
					for (let y = 360; y < len - 260; y += rnd(190, 300)) rocks.push({ y, u: rnd(-0.6, 0.6), r: rnd(9, 15) });
					gusts = []; t = 0; race = -2.7; cam = 0; cool = 0; finishedAt = 0; place = 0; flowT = 0;
					api.say("Space puffs from behind · ← → puff sideways · or click/tap near your boat");
				},
				resize() { api.restart(); },
				key(k) {
					const me = boats[0];
					if (race < 0 || me.done || cool > 0) return;
					cool = 0.28;
					if (k === " " || k === "ArrowUp" || k === "ArrowDown") puff(bx(me), me.y - 50);
					else if (k === "ArrowLeft") puff(bx(me) + 46, me.y);
					else if (k === "ArrowRight") puff(bx(me) - 46, me.y);
				},
				down(x, y) { if (race >= 0 && !boats[0].done && cool <= 0) { cool = 0.25; puff(x, y + cam); } },
				step(dt) {
					t += dt; flowT += dt; cool -= dt;
					race += dt;
					for (const g of gusts) g.age += dt;
					gusts = gusts.filter((g) => g.age < 0.5);
					if (race < 0) return;
					let finished = 0;
					for (const b of boats) {
						if (b.done) { finished++; continue; }
						b.time = race;
					if (b.you && Math.floor(race * 10) !== Math.floor((race - dt) * 10)) api.score = Math.round(race * 10) / 10;
						if (!b.you) {
							// rivals nudge themselves toward open water
							if (Math.random() < dt * 1.6) { b.vu += rnd(-0.5, 0.5) - b.u * 0.5; b.vy = Math.min(200, b.vy + rnd(10, 55)); }
							const rock = rocks.find((r) => r.y > b.y && r.y - b.y < 90 && Math.abs(r.u - b.u) < 0.28);
							if (rock) b.vu += Math.sign(b.u - rock.u || 1) * 1.6 * dt * 4;
						}
						const flow = 84 * (1 - 0.5 * b.u * b.u) * b.mult;
						b.vy += (flow - b.vy) * (1 - Math.exp(-dt / 1.5));
						b.vu *= Math.exp(-1.7 * dt);
						b.u += b.vu * dt;
						b.y += b.vy * dt;
						b.spin *= Math.exp(-3 * dt);
						if (Math.abs(b.u) > 0.94) { b.u = Math.sign(b.u) * 0.94; b.vu = -b.vu * 0.4; b.vy *= 0.9; }
						const br = hw * 0.26;
						for (const r of rocks) {
							const dy = b.y - r.y, dx = (b.u - r.u) * hw * 0.78;
							const d = Math.hypot(dx, dy);
							if (d < r.r + br) {
								const nx = dx / (d || 1), ny = dy / (d || 1);
								b.vu += (nx / (hw * 0.78)) * 130;
								b.vy = Math.min(b.vy, 0) * 0 + Math.max(10, b.vy * 0.45) * (ny < 0 ? -0.2 : 1);
								b.y += ny * (r.r + br - d) * 0.5;
								if (b.you) { api.shake(3); api.beep(120, 0.1, "square", 0.04); api.burst(bx(b), b.y - cam, { n: 8, color: "#fff", speed: 120, gravity: 0, size: 2 }); }
							}
						}
						if (b.y >= len) { b.done = true; b.vy = 0; b.time = race; place = place || 0; b.rank = boats.filter((o) => o.done).length; if (b.you) { place = b.rank; finishedAt = t; } }
					}
					const me = boats[0];
					const targetCam = clamp(me.y - api.H * 0.5, 0, len - api.H + 60);
					cam += (targetCam - cam) * Math.min(1, dt * 4);
					if (me.done && t - finishedAt > 0.8) {
						api.score = Math.round(me.time * 10) / 10;
						api.end(`${ord(place)} place in ${me.time.toFixed(1)}s`);
					}
					const left = 4 - finished;
					void left;
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H;
					const y0 = cam - 40, y1 = cam + H + 40;
					// stream body
					g.fillStyle = c.dark ? "rgba(28,70,120,0.72)" : "rgba(120,190,235,0.7)";
					g.beginPath();
					const step = 24;
					const first = Math.floor(y0 / step) * step;
					for (let y = first; y <= y1; y += step) g.lineTo(center(y) - hw - cam * 0 , y - cam);
					for (let y = Math.floor(y1 / step) * step; y >= first; y -= step) g.lineTo(center(y) + hw, y - cam);
					g.closePath(); g.fill();
					g.strokeStyle = c.dark ? "rgba(160,210,255,0.5)" : "rgba(30,100,170,0.5)"; g.lineWidth = 2;
					for (const side of [-1, 1]) { g.beginPath(); for (let y = first; y <= y1; y += step) (y === first ? g.moveTo(center(y) + side * hw, y - cam) : g.lineTo(center(y) + side * hw, y - cam)); g.stroke(); }
					// flow streaks
					g.strokeStyle = c.dark ? "rgba(200,230,255,0.3)" : "rgba(255,255,255,0.65)"; g.lineWidth = 1.5; g.lineCap = "round";
					const off = reducedMotion ? 0 : (flowT * 60) % 60;
					for (let y = Math.floor(y0 / 60) * 60 - 60; y < y1; y += 60) for (let k = 0; k < 3; k++) {
						const yy = y + off + k * 17, u = ((k * 0.57 + y * 0.013) % 1.6) - 0.8;
						g.beginPath(); g.moveTo(center(yy) + u * hw * 0.8, yy - cam); g.lineTo(center(yy + 14) + u * hw * 0.8, yy + 14 - cam); g.stroke();
					}
					// rocks
					for (const r of rocks) {
						if (r.y < y0 || r.y > y1) continue;
						const x = center(r.y) + r.u * hw * 0.78, y = r.y - cam;
						g.fillStyle = c.dark ? "#2d3548" : "#8a8f9a"; g.beginPath(); g.ellipse(x, y, r.r, r.r * 0.8, 0, 0, 7); g.fill();
						g.fillStyle = "rgba(255,255,255,0.25)"; g.beginPath(); g.ellipse(x - r.r * 0.25, y - r.r * 0.3, r.r * 0.4, r.r * 0.25, 0, 0, 7); g.fill();
						g.strokeStyle = "rgba(255,255,255,0.4)"; g.lineWidth = 1; g.beginPath(); g.ellipse(x, y, r.r + 4 + Math.sin(t * 3 + r.y) * 1, r.r * 0.9 + 3, 0, 0, 7); g.stroke();
					}
					// start / finish
					const bandy = (yy, label) => { const y = yy - cam; if (y < -30 || y > H + 30) return; for (let i = 0; i < 12; i++) { g.fillStyle = (i + (label ? 1 : 0)) % 2 ? c.strong : c.bg; g.fillRect(center(yy) - hw + (i * 2 * hw) / 12, y - 5, (2 * hw) / 12, 10); } if (label) { g.fillStyle = c.strong; g.font = "800 12px sans-serif"; g.textAlign = "center"; g.fillText(label, center(yy), y - 12); } };
					bandy(len, "FINISH"); bandy(14, "");
					// boats (back to front)
					for (const b of [...boats].sort((a, z) => a.y - z.y)) drawBoat(g, b, c);
					// gust rings
					for (const gs of gusts) { g.strokeStyle = c.toy2; g.globalAlpha = (1 - gs.age / 0.5) * 0.6; g.lineWidth = 2; g.beginPath(); g.arc(gs.x, gs.y - cam, 12 + gs.age * 260, 0, 7); g.stroke(); g.globalAlpha = 1; }
					// countdown
					if (race < 0) { g.fillStyle = c.toy; g.font = "900 54px sans-serif"; g.textAlign = "center"; g.fillText(String(Math.ceil(-race)), cx - hw * 2 > 100 ? cx - hw * 2 : W / 2, H * 0.4); }
					else if (race < 0.7) { g.fillStyle = c.toy; g.font = "900 46px sans-serif"; g.textAlign = "center"; g.fillText("GO!", cx - hw * 2 > 100 ? cx - hw * 2 : W / 2, H * 0.4); }
					// standings
					const order = [...boats].sort((a, z) => (z.done ? 1e6 - z.time : z.y) - (a.done ? 1e6 - a.time : a.y));
					g.font = "700 13px sans-serif"; g.textAlign = "left";
					order.forEach((b, i) => { g.fillStyle = b.you ? c.toy : c.strong; g.globalAlpha = 0.9; g.fillText(`${i + 1}. ${b.name}${b.done ? " ✓" : ""}`, 16, H - 20 - (3 - i) * 18); });
					g.globalAlpha = 1;
					if (race >= 0 && race < 5) { g.fillStyle = c.muted; g.textAlign = "center"; g.font = "600 13px sans-serif"; g.fillText("puff behind your boat to speed up", Math.max(160, cx - hw * 3), H - 60); }
				},
			};

			function drawBoat(g, b, c) {
				const x = bx(b), y = b.y - cam;
				if (y < -60 || y > api.H + 60) return;
				const s = hw / 40 * 0.85;
				g.save();
				g.translate(x, y + Math.sin(t * 2 + b.bob) * (reducedMotion ? 0 : 1.2));
				g.rotate(Math.PI / 2 * 0 + clamp(b.vu * 0.25 + b.spin * 0.2, -0.4, 0.4));
				g.scale(s, s);
				// shadow ripple
				g.fillStyle = "rgba(0,0,0,0.15)"; g.beginPath(); g.ellipse(2, 20, 22, 6, 0, 0, 7); g.fill();
				const base = `hsl(${b.hue} 80% ${c.dark ? 62 : 58}%)`, shade = `hsl(${b.hue} 70% ${c.dark ? 48 : 44}%)`, hull = `hsl(${b.hue} 60% ${c.dark ? 78 : 92}%)`;
				// hull
				g.fillStyle = hull; g.beginPath(); g.moveTo(-26, 4); g.lineTo(26, 4); g.lineTo(16, 18); g.lineTo(-16, 18); g.closePath(); g.fill();
				g.fillStyle = "rgba(0,0,0,0.12)"; g.beginPath(); g.moveTo(-26, 4); g.lineTo(0, 4); g.lineTo(0, 18); g.lineTo(-16, 18); g.closePath(); g.fill();
				// sails
				g.fillStyle = base; g.beginPath(); g.moveTo(0, -26); g.lineTo(18, 4); g.lineTo(-18, 4); g.closePath(); g.fill();
				g.fillStyle = shade; g.beginPath(); g.moveTo(0, -26); g.lineTo(0, 4); g.lineTo(-18, 4); g.closePath(); g.fill();
				if (b.you) { g.strokeStyle = c.strong; g.lineWidth = 2; g.beginPath(); g.moveTo(-26, 4); g.lineTo(26, 4); g.stroke(); }
				g.restore();
			}
		},
	});
}

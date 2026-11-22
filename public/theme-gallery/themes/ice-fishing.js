// Ice Fishing: drill a hole in the frozen lake, jig a line, set the hook, reel in graceful original fish.
import { createToy, roundRect, clamp, rnd } from "./_toy/toy.js";

const SPECIES = [
	{ name: "Yellow perch", len: 46, h: 17, pts: 10, str: 0.5, depth: [0.15, 0.55], color: [200, 150, 40], tail: "fork", dorsal: 2, bars: true, w: 4 },
	{ name: "Brook trout", len: 62, h: 15, pts: 25, str: 0.8, depth: [0.2, 0.7], color: [90, 120, 90], tail: "square", dorsal: 1, spots: true, w: 3 },
	{ name: "Northern pike", len: 100, h: 14, pts: 40, str: 1.05, depth: [0.2, 0.6], color: [70, 110, 70], tail: "fork", dorsal: 3, w: 2 },
	{ name: "Lake trout", len: 124, h: 26, pts: 70, str: 1.35, depth: [0.5, 0.95], color: [60, 80, 100], tail: "fork", dorsal: 1, spots: true, w: 1 },
];
const ICE_T = 34;

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "ice-fishing", name: "Ice Fishing", startKey: "p", hz: 60,
		make(api) {
			let yI, bottom, hole, lure, fish, state, time, left, catches, reel, tgtY, jigT, drill, pines, t, sparkle, msg, msgT, bite, noHoleHint;

			function layout() {
				yI = Math.round(api.H * 0.42);
				bottom = api.H - 6;
			}
			function spawnFish(initial) {
				const roll = Math.random();
				const sp = roll < 0.42 ? SPECIES[0] : roll < 0.7 ? SPECIES[1] : roll < 0.9 ? SPECIES[2] : SPECIES[3];
				const dir = Math.random() < 0.5 ? 1 : -1;
				const top = yI + ICE_T + 30, span = bottom - 50 - top;
				const y = top + span * rnd(sp.depth[0], sp.depth[1]);
				const x = initial ? rnd(40, api.W - 40) : dir > 0 ? -sp.len : api.W + sp.len;
				return { sp, x, y, y0: y, dir, v: rnd(26, 52) * (sp.len > 90 ? 0.7 : 1), ph: rnd(0, 6), mode: "swim", timer: rnd(0, 3), hookedAt: 0, scale: rnd(0.85, 1.15) };
			}
			function toast(text) { msg = text; msgT = 2.2; }

			function pressAction() {
				if (state === "need-hole" || state === "drilling") return;
				if (state === "hooked") { reel.p = Math.min(1, reel.p + 0.085); api.beep(500 + reel.p * 500, 0.04, "triangle", 0.03); reel.tap = 0.15; return; }
				// jig
				if (jigT <= 0) {
					jigT = 0.35;
					lure.kick = -34;
					sparkle = 0.4;
					api.beep(700, 0.05, "sine", 0.03, 300);
				}
				if (bite) {
					// set the hook!
					const f = bite;
					bite = null;
					f.mode = "hooked";
					state = "hooked";
					reel = { p: 0.38, f, tap: 0, burst: 0 };
					toast(`Hooked a ${f.sp.name.toLowerCase()}! Tap Space / click to reel`);
					api.beep(300, 0.2, "sawtooth", 0.05, 400);
					api.shake(4);
					api.burst(hole.x, yI, { n: 10, color: "#fff", speed: 160, angle: -Math.PI / 2, spread: 1.4, gravity: 500, size: 3 });
				}
			}

			function drillAt(x) {
				hole = { x: clamp(x, 60, api.W - 60) };
				state = "drilling";
				drill = 0;
				lure = { y: yI + ICE_T + 60, vy: 0, kick: 0 };
				tgtY = lure.y;
				bite = null;
			}

			return {
				start() {
					api.measure();
					layout();
					fish = [];
					const n = clamp(Math.round((api.W * (bottom - yI)) / 90000) + 3, 4, 9);
					for (let i = 0; i < n; i++) fish.push(spawnFish(true));
					hole = null; state = "need-hole"; time = 0; left = 100; catches = {}; reel = null; jigT = 0; sparkle = 0; t = 0; msg = ""; msgT = 0; bite = null;
					pines = Array.from({ length: Math.max(6, Math.round(api.W / 120)) }, (_, i) => ({ x: (i + rnd(0.2, 0.8)) * (api.W / Math.max(6, Math.round(api.W / 120))), h: rnd(38, 78) }));
					api.say("Click the ice to drill a hole · mouse / ↑↓ move the lure · Space jigs");
				},
				resize() { api.restart(); },
				key(k) {
					if (k === " " || k === "Enter") pressAction();
					if ((k === "ArrowDown" || k === "ArrowUp") && state === "need-hole") drillAt(api.W / 2);
				},
				down(x, y) {
					if (state === "need-hole" || (y > yI - 50 && y < yI + ICE_T && state !== "hooked")) { if (y > yI - 60 && y < yI + ICE_T + 8) { drillAt(x); return; } }
					if (state === "need-hole") return;
					pressAction();
				},
				move(x, y) { if (hole && state !== "drilling" && y > yI + ICE_T + 10) tgtY = y; },
				step(dt) {
					t += dt;
					if (msgT > 0) msgT -= dt;
					if (state !== "need-hole") { left -= dt; }
					if (left <= 0) { api.end(`Daylight's gone. ${Object.values(catches).reduce((a, b) => a + b, 0)} fish`); return; }
					api.say(state === "need-hole" ? "Click the ice (or press ↓) to drill a hole" : `${Math.ceil(left)}s of daylight${msgT > 0 ? " · " + msg : ""}`);
					jigT = Math.max(0, jigT - dt);
					sparkle = Math.max(0, sparkle - dt);
					if (state === "drilling") {
						drill += dt;
						if (drill > 0.35 && drill < 1.0 && Math.random() < 0.5) api.burst(hole.x, yI, { n: 2, color: "#fff", speed: 120, angle: -Math.PI / 2, spread: 1.6, gravity: 500, size: 3 });
						if (drill >= 1.1) { state = "fishing"; api.beep(260, 0.15, "triangle", 0.05); toast("Hole drilled. Wiggle the lure near a fish"); }
					}
					if (hole && state !== "drilling") {
						if (api.keys.has("ArrowDown")) tgtY += 160 * dt;
						if (api.keys.has("ArrowUp")) tgtY -= 160 * dt;
						tgtY = clamp(tgtY, yI + ICE_T + 18, bottom - 30);
						if (state !== "hooked") {
							lure.y += (tgtY - lure.y) * Math.min(1, dt * 3.5);
							lure.kick *= Math.pow(0.02, dt);
						}
					}
					const lx = hole ? hole.x : -999;
					const ly = lure ? lure.y + lure.kick : 0;
					for (let i = 0; i < fish.length; i++) {
						const f = fish[i];
						f.ph += dt * (f.mode === "hooked" ? 14 : 3 + f.v / 14);
						if (f.mode === "swim") {
							f.x += f.dir * f.v * dt;
							f.y = f.y0 + Math.sin(t * 0.7 + f.ph) * 10;
							const jigged = jigT > 0 || sparkle > 0 || Math.abs(lure?.kick || 0) > 8;
							if (hole && state === "fishing" && jigged && Math.abs(f.x - lx) < 190 && Math.abs(f.y - ly) < 70 && Math.random() < dt * 1.3) f.mode = "curious";
							if (f.x < -f.sp.len * 1.6 || f.x > api.W + f.sp.len * 1.6) fish[i] = spawnFish(false);
						} else if (f.mode === "curious") {
							const mx = lx - f.dir * f.sp.len * 0.45 * f.scale;
							f.x += (mx - f.x) * Math.min(1, dt * 2.2);
							f.y += (ly - f.y) * Math.min(1, dt * 2.4);
							f.dir = lx > f.x ? 1 : -1;
							if (Math.abs(f.x - mx) < 14 && Math.abs(f.y - ly) < 12) {
								f.mode = "bite"; f.timer = 0.75;
								bite = f; api.beep(880, 0.12, "triangle", 0.06); toast("Bite! Press Space to set the hook");
							}
							if (state !== "fishing") f.mode = "swim";
						} else if (f.mode === "bite") {
							f.timer -= dt;
							if (f.timer <= 0) { f.mode = "spooked"; f.timer = 4; if (bite === f) bite = null; toast("Too slow. It slipped off"); f.dir = Math.random() < 0.5 ? -1 : 1; }
						} else if (f.mode === "spooked") {
							f.timer -= dt; f.x += f.dir * 140 * dt;
							if (f.timer < 3) { f.mode = "swim"; f.y0 = f.y; }
						} else if (f.mode === "hooked") {
							// pulled up toward the hole; fights side to side
							const p = reel.p;
							reel.burst -= dt;
							if (reel.burst <= 0 && Math.random() < dt * 0.9) reel.burst = 0.5;
							const decay = (0.08 + f.sp.str * 0.14) * (reel.burst > 0 ? 2.3 : 1);
							reel.p = Math.max(0, p - decay * dt);
							reel.tap = Math.max(0, reel.tap - dt);
							const surface = yI + ICE_T + 24;
							const depthY = lure.y;
							const targetY = depthY + (surface - depthY) * reel.p;
							f.y += (targetY - f.y) * Math.min(1, dt * 6);
							f.x = lx + Math.sin(t * 5 + f.ph) * (1 - reel.p) * 60 * (reel.burst > 0 ? 1.5 : 0.6) + f.dir * f.sp.len * 0.45 * (1 - reel.p);
							lure.y = f.y;
							if (reel.p >= 1) {
								state = "fishing";
								const pts = Math.round(f.sp.pts * f.scale);
								api.add(pts);
								catches[f.sp.name] = (catches[f.sp.name] || 0) + 1;
								toast(`Landed a ${f.sp.name.toLowerCase()}! +${pts}`);
								api.beep(660, 0.3, "triangle", 0.07, 330);
								api.burst(hole.x, yI - 10, { n: 26, color: "#fff", speed: 300, angle: -Math.PI / 2, spread: 1.8, gravity: 700, size: 3 });
								api.burst(hole.x, yI - 10, { n: 12, color: api.c.toy2, speed: 240, angle: -Math.PI / 2, spread: 2, gravity: 600, size: 3 });
								api.shake(3);
								fish[i] = spawnFish(false);
								lure.y = tgtY = yI + ICE_T + 80;
								reel = null;
							} else if (reel.p <= 0) {
								state = "fishing";
								f.mode = "spooked"; f.timer = 4; f.dir = Math.random() < 0.5 ? -1 : 1;
								toast("It got away!");
								api.beep(180, 0.25, "sawtooth", 0.04, -80);
								reel = null;
							}
						}
					}
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H, dark = c.dark;
					// water panel
					const wTop = yI;
					const grad = g.createLinearGradient(0, wTop, 0, H);
					if (dark) { grad.addColorStop(0, "#143a5c"); grad.addColorStop(1, "#020912"); } else { grad.addColorStop(0, "#9bd3ee"); grad.addColorStop(1, "#0b4a73"); }
					g.fillStyle = grad;
					g.fillRect(0, wTop, W, H - wTop);
					// light shaft
					if (hole && state !== "drilling") {
						const sh = g.createLinearGradient(0, wTop, 0, H);
						sh.addColorStop(0, dark ? "rgba(160,210,255,0.28)" : "rgba(255,255,255,0.45)");
						sh.addColorStop(1, "rgba(255,255,255,0)");
						g.fillStyle = sh;
						g.beginPath(); g.moveTo(hole.x - 18, wTop + ICE_T); g.lineTo(hole.x + 18, wTop + ICE_T); g.lineTo(hole.x + 150, H); g.lineTo(hole.x - 150, H); g.fill();
					}
					// lake bed
					g.fillStyle = dark ? "#04101c" : "#0a3556";
					g.beginPath(); g.moveTo(0, H);
					for (let x = 0; x <= W; x += 24) g.lineTo(x, H - 14 - Math.sin(x * 0.011 + 1) * 8 - Math.sin(x * 0.037) * 4);
					g.lineTo(W, H); g.fill();
					// weeds
					g.strokeStyle = dark ? "#0b3a3a" : "#14707a"; g.lineWidth = 3; g.lineCap = "round";
					for (let x = 30; x < W; x += 90) {
						g.beginPath(); g.moveTo(x, H - 12);
						for (let k = 1; k <= 4; k++) g.lineTo(x + Math.sin(k * 1.3 + x + (reducedMotion ? 0 : t * 0.8)) * 6 * k * 0.5, H - 12 - k * 11);
						g.stroke();
					}
					// fish
					for (const f of fish) drawFish(g, f, wTop, H, dark);
					// ice slab (with hole)
					g.fillStyle = dark ? "#cfe7f5" : "#f4fbff";
					g.globalAlpha = 0.96;
					const hw = hole ? (state === "drilling" ? Math.min(1, drill / 1.0) * 17 : 17) : 0;
					g.beginPath();
					g.rect(0, wTop - 6, hole ? hole.x - hw : W, ICE_T + 6);
					if (hole) g.rect(hole.x + hw, wTop - 6, W - hole.x - hw, ICE_T + 6);
					g.fill();
					g.globalAlpha = 1;
					g.fillStyle = dark ? "rgba(120,170,210,0.5)" : "rgba(120,190,230,0.55)";
					g.fillRect(0, wTop + ICE_T - 8, W, 8);
					// snow line
					g.fillStyle = dark ? "#e7f2fa" : "#ffffff";
					g.fillRect(0, wTop - 8, W, 4);
					// pines on the shore of the ice
					for (const p of pines) {
						g.fillStyle = dark ? "#06121c" : "#1d4b3a";
						g.beginPath(); g.moveTo(p.x, wTop - 8 - p.h); g.lineTo(p.x + p.h * 0.26, wTop - 8); g.lineTo(p.x - p.h * 0.26, wTop - 8); g.fill();
						g.fillStyle = "#fff"; g.globalAlpha = 0.85;
						g.beginPath(); g.moveTo(p.x, wTop - 8 - p.h); g.lineTo(p.x + p.h * 0.1, wTop - 8 - p.h * 0.7); g.lineTo(p.x - p.h * 0.1, wTop - 8 - p.h * 0.7); g.fill();
						g.globalAlpha = 1;
					}
					// drill hint / auger
					if (state === "need-hole") {
						g.fillStyle = c.toy2; g.font = "700 16px sans-serif"; g.textAlign = "center";
						g.fillText("Click the ice to drill a hole", W / 2, wTop + 22);
						const mx = clamp(api.pointer.x, 20, W - 20);
						if (api.pointer.inside) { g.strokeStyle = c.toy2; g.lineWidth = 2; g.setLineDash([4, 4]); g.beginPath(); g.ellipse(mx, wTop + 4, 17, 5, 0, 0, 7); g.stroke(); g.setLineDash([]); }
					}
					if (state === "drilling") {
						const a = drill * 40;
						g.strokeStyle = dark ? "#c3d4e2" : "#415166"; g.lineWidth = 4;
						const y = wTop - 56 + Math.min(1, drill) * 52;
						g.beginPath(); g.moveTo(hole.x, y - 90); g.lineTo(hole.x, y); g.stroke();
						g.beginPath(); g.moveTo(hole.x - 24, y - 90); g.lineTo(hole.x + 24, y - 90); g.stroke();
						g.lineWidth = 3;
						for (let k = 0; k < 4; k++) { const yy = y - k * 12; const o = Math.sin(a + k) * 13; g.beginPath(); g.moveTo(hole.x - o, yy); g.lineTo(hole.x + o, yy - 8); g.stroke(); }
					}
					// line, lure
					if (hole && state !== "drilling") {
						const ly = lure.y + (state === "hooked" ? 0 : lure.kick);
						// rod tip planted by the hole
						g.strokeStyle = dark ? "#e0c9a0" : "#6b4a2a"; g.lineWidth = 3;
						g.beginPath(); g.moveTo(hole.x + 46, wTop - 6); g.quadraticCurveTo(hole.x + 38, wTop - 52, hole.x + 4, wTop - 62); g.stroke();
						g.strokeStyle = dark ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.9)"; g.lineWidth = 1;
						g.beginPath(); g.moveTo(hole.x + 4, wTop - 62); g.lineTo(hole.x, wTop + 4); g.lineTo(hole.x, ly); g.stroke();
						g.fillStyle = c.toy2;
						g.beginPath(); g.arc(hole.x, ly + 4, 5, 0, 7); g.fill();
						g.fillStyle = "#fff"; g.beginPath(); g.arc(hole.x - 1.5, ly + 2.5, 1.5, 0, 7); g.fill();
						if (sparkle > 0) { g.strokeStyle = "#fff"; g.lineWidth = 2; g.globalAlpha = sparkle * 2; g.beginPath(); g.arc(hole.x, ly + 4, 8 + (0.4 - sparkle) * 40, 0, 7); g.stroke(); g.globalAlpha = 1; }
						if (bite) { g.fillStyle = c.toy2; g.font = "900 30px sans-serif"; g.textAlign = "center"; g.fillText("!", hole.x + 18, wTop - 36 - Math.sin(t * 30) * 2); }
					}
					if (reel) {
						const bw = 180, bx = W / 2 - bw / 2, by = H - 40;
						g.fillStyle = "rgba(0,0,0,0.45)"; roundRect(g, bx - 4, by - 4, bw + 8, 22, 11); g.fill();
						g.fillStyle = reel.p < 0.25 ? "#ff6b6b" : c.toy2; roundRect(g, bx, by, bw * reel.p, 14, 7); g.fill();
						g.fillStyle = "#fff"; g.font = "700 12px sans-serif"; g.textAlign = "center"; g.fillText("REEL: tap Space / click", W / 2, by - 10);
					}
					// catch tally
					g.font = "600 13px sans-serif"; g.textAlign = "left"; g.fillStyle = "#fff"; g.globalAlpha = 0.9;
					let ty = H - 18;
					for (const sp of SPECIES) if (catches[sp.name]) { g.fillText(`${sp.name} ×${catches[sp.name]}`, 14, ty); ty -= 18; }
					g.globalAlpha = 1;
				},
			};

			function drawFish(g, f, wTop, H, dark) {
				const sp = f.sp, L = sp.len * f.scale, hh = sp.h * f.scale;
				const N = 10, seg = L / N;
				const depthT = clamp((f.y - wTop) / (H - wTop), 0, 1);
				const a = dark ? 0.55 : 0.8;
				const [r, gg, b] = sp.color;
				const dk = dark ? 1.5 - depthT * 0.3 : 1 - depthT * 0.55;
				const m = dark ? 1 : 0.6;
				g.fillStyle = `rgba(${Math.min(255, Math.round(r * dk * m))},${Math.min(255, Math.round(gg * dk * m))},${Math.min(255, Math.round(b * dk * m))},${a + 0.15})`;
				const amp = f.mode === "hooked" ? 9 : f.mode === "bite" ? 1.5 : 4 + f.v / 14;
				const pts = [];
				for (let i = 0; i <= N; i++) {
					const u = i / N;
					const prof = Math.sin(Math.PI * Math.pow(u, 0.7)) ** 0.9 * (1 - u * 0.2);
					const sway = Math.sin(f.ph - i * 0.55) * amp * u * u * f.scale * 0.8;
					pts.push([f.x - f.dir * u * L + f.dir * L * 0.5, f.y + sway, Math.max(0.5, prof * hh * 0.5)]);
				}
				const top = [], bot = [];
				for (const [x, y, w] of pts) { top.push([x, y - w]); bot.push([x, y + w]); }
				g.beginPath();
				g.moveTo(top[0][0], top[0][1]);
				for (const p of top) g.lineTo(p[0], p[1]);
				const tail = pts[N];
				const tl = sp.len * 0.2 * f.scale;
				const tx = tail[0] - f.dir * tl;
				if (sp.tail === "fork") { g.lineTo(tx, tail[1] - tl * 0.7); g.lineTo(tail[0] - f.dir * tl * 0.45, tail[1]); g.lineTo(tx, tail[1] + tl * 0.7); }
				else { g.lineTo(tx, tail[1] - tl * 0.6); g.lineTo(tx, tail[1] + tl * 0.6); }
				for (let i = N; i >= 0; i--) g.lineTo(bot[i][0], bot[i][1]);
				g.closePath();
				g.fill();
				// dorsal fins
				for (let k = 0; k < sp.dorsal; k++) {
					const i = sp.dorsal === 3 ? 6 + k * 0 : 3 + k * 2; // pike: single fin far back
					const ii = sp.dorsal === 3 ? 7 : i;
					const p = pts[Math.min(N - 1, ii)], q = pts[Math.min(N, ii + 2)];
					if (sp.dorsal === 3 && k > 0) break;
					g.beginPath(); g.moveTo(p[0], p[1] - p[2] + 1); g.lineTo(p[0] - f.dir * seg * 0.4, p[1] - p[2] - hh * 0.4); g.lineTo(q[0], q[1] - q[2] + 1); g.fill();
				}
				// pectoral fin
				const pp = pts[2];
				g.beginPath(); g.moveTo(pp[0], pp[1] + pp[2] * 0.4); g.lineTo(pp[0] - f.dir * seg * 1.2, pp[1] + pp[2] + hh * 0.25); g.lineTo(pp[0] - f.dir * seg * 0.3, pp[1] + pp[2] * 0.2); g.fill();
				// markings
				if (sp.spots) {
					g.fillStyle = `rgba(255,${dark ? 210 : 235},200,${0.35 - depthT * 0.2})`;
					for (let i = 2; i < 9; i++) { g.beginPath(); g.arc(pts[i][0], pts[i][1] - pts[i][2] * 0.35, 1.5, 0, 7); g.fill(); }
				}
				if (sp.bars) {
					g.fillStyle = "rgba(0,0,0,0.25)";
					for (let i = 3; i < 8; i += 2) g.fillRect(pts[i][0] - 2, pts[i][1] - pts[i][2], 4, pts[i][2] * 2);
				}
				// eye
				g.fillStyle = `rgba(255,255,255,${0.8 - depthT * 0.4})`;
				g.beginPath(); g.arc(pts[0][0] - f.dir * seg * 1.1, pts[0][1] - pts[0][2] * 0.2 - 1, Math.max(1.4, hh * 0.09), 0, 7); g.fill();
			}
		},
	});
}

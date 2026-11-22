// Lint Defense: squiggles crawl along the page's real text lines; place fixers to clear them.
import { createToy, roundRect, clamp, rnd } from "./_toy/toy.js";

const TOWERS = [
	{ key: "1", name: "Autofix", glyph: "A", cost: 40, range: 120, rate: 0.42, dmg: 1.6, splash: 0, desc: "fast single target" },
	{ key: "2", name: "Prettier", glyph: "P", cost: 70, range: 95, rate: 1.1, dmg: 1.2, splash: 52, desc: "area damage" },
	{ key: "3", name: "Type-check", glyph: "T", cost: 100, range: 190, rate: 1.5, dmg: 6, splash: 0, desc: "long range, heavy" },
];
const KINDS = {
	warn: { hp: 4, speed: 105, color: "#f59f00", reward: 6, len: 22 },
	error: { hp: 9, speed: 88, color: "#e03131", reward: 9, len: 26 },
	info: { hp: 3, speed: 150, color: "#1c7ed6", reward: 4, len: 18 },
	boss: { hp: 70, speed: 62, color: "#9c36b5", reward: 70, len: 44 },
};
const LAST_WAVE = 10;

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "lint-defense", name: "Lint Defense", startKey: "p", hz: 60,
		make(api) {
			let path, total, towers, enemies, shots, coins, lives, wave, queue, spawnT, between, sel, hover, bolts, t, palette, nextBtn, started, kills;

			function buildPath() {
				api.scrollTo(Math.max(0, (api.page.querySelector(".site-about")?.offsetTop ?? 200) - 110));
				api.measure();
				const H = api.H;
				let lines = [];
				for (const n of root.querySelectorAll(".site-about p, .site-item-description, .site-item-title, .site-tagline")) for (const l of api.lines(n)) if (l.w > 140 && l.y > 80 && l.y + l.h < H - 90) lines.push(l);
				lines.sort((a, b) => a.y - b.y);
				const picked = [];
				for (const l of lines) if (!picked.length || l.y - picked[picked.length - 1].y > 24) picked.push(l);
				const pts = [];
				let len = 0;
				picked.slice(0, 9).forEach((l, i) => {
					const y = l.y + l.h * 0.55;
					const a = i % 2 === 0 ? [l.x, y] : [l.x + l.w, y];
					const b = i % 2 === 0 ? [l.x + l.w, y] : [l.x, y];
					pts.push(a, b);
				});
				path = [];
				for (const p of pts) path.push({ x: p[0], y: p[1] });
				// start just off the left of the first line
				path.unshift({ x: path[0].x - 40, y: path[0].y });
				total = 0;
				for (let i = 1; i < path.length; i++) { path[i].d = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y); total += path[i].d; }
				path[0].d = 0;
			}
			function at(dist) {
				let d = dist;
				for (let i = 1; i < path.length; i++) {
					if (d <= path[i].d || i === path.length - 1) {
						const k = clamp(d / (path[i].d || 1), 0, 1);
						return { x: path[i - 1].x + (path[i].x - path[i - 1].x) * k, y: path[i - 1].y + (path[i].y - path[i - 1].y) * k, ang: Math.atan2(path[i].y - path[i - 1].y, path[i].x - path[i - 1].x) };
					}
					d -= path[i].d;
				}
				return { x: 0, y: 0, ang: 0 };
			}
			function distToPath(x, y) {
				let best = 1e9;
				for (let i = 1; i < path.length; i++) {
					const a = path[i - 1], b = path[i];
					const abx = b.x - a.x, aby = b.y - a.y;
					const tt = clamp(((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby || 1), 0, 1);
					best = Math.min(best, Math.hypot(x - (a.x + abx * tt), y - (a.y + aby * tt)));
				}
				return best;
			}
			function startWave() {
				if (queue.length || wave >= LAST_WAVE) return;
				wave++;
				between = 0;
				started = true;
				const n = 5 + wave * 2;
				const q = [];
				for (let i = 0; i < n; i++) {
					const r = Math.random();
					q.push(wave > 2 && r < 0.18 + wave * 0.02 ? "error" : r < 0.45 ? "info" : "warn");
				}
				if (wave % 5 === 0) q.push("boss");
				queue = q;
				spawnT = 0;
				api.say(`Wave ${wave} of ${LAST_WAVE}: ${n} diagnostics incoming`);
			}
			function placeable(x, y) {
				return y > 70 && y < api.H - 70 && distToPath(x, y) > 20 && !towers.some((tw) => Math.hypot(tw.x - x, tw.y - y) < 30);
			}
			function tapPlace(x, y) {
				// palette chips
				for (const p of palette) if (x > p.x && x < p.x + p.w && y > p.y && y < p.y + p.h) { if (p.next) startWave(); else sel = p.i; return; }
				const ex = towers.find((tw) => Math.hypot(tw.x - x, tw.y - y) < 18);
				if (ex) {
					const cost = Math.round(TOWERS[ex.type].cost * 0.7 * ex.lvl);
					if (ex.lvl < 3 && coins >= cost) { coins -= cost; ex.lvl++; api.beep(660, 0.1, "triangle", 0.05); api.burst(ex.x, ex.y, { n: 10, color: api.c.toy2, speed: 120, gravity: 0 }); }
					return;
				}
				const T = TOWERS[sel];
				if (coins >= T.cost && placeable(x, y)) {
					coins -= T.cost;
					towers.push({ x, y, type: sel, lvl: 1, cd: 0, aim: 0 });
					api.beep(440, 0.1, "square", 0.04);
					api.burst(x, y, { n: 10, color: api.c.toy2, speed: 140, gravity: 0 });
				} else api.beep(130, 0.1, "sawtooth", 0.03);
			}

			return {
				start() {
					buildPath();
					towers = []; enemies = []; bolts = []; coins = 120; lives = 10; wave = 0; queue = []; spawnT = 0; between = 6; sel = 0; hover = null; t = 0; started = false; kills = 0;
					const W = api.W, H = api.H;
					const cw = clamp((W - 170) / 3, 70, 150), nw = Math.min(130, W * 0.24), cx0 = W / 2 - (cw * 3 + nw + 24) / 2;
					palette = TOWERS.map((tw, i) => ({ i, x: cx0 + i * (cw + 8), y: H - 52, w: cw, h: 40 }));
					palette.push({ next: true, x: cx0 + 3 * (cw + 8), y: H - 52, w: nw, h: 40 });
					api.say("Click a spot beside the text to place a fixer · 1 2 3 choose · click a fixer to upgrade · Space next wave");
				},
				resize() { api.restart(); },
				key(k) {
					if (k === "1" || k === "2" || k === "3") sel = Number(k) - 1;
					else if (k === " " || k === "Enter") startWave();
				},
				move(x, y) { hover = { x, y }; },
				down(x, y) { hover = { x, y }; tapPlace(x, y); },
				step(dt) {
					t += dt;
					if (!queue.length && !enemies.length && started && wave < LAST_WAVE) {
						between += dt;
						if (between > 8) startWave();
					}
					if (queue.length) {
						spawnT -= dt;
						if (spawnT <= 0) {
							const k = queue.shift();
							const K = KINDS[k];
							const hp = K.hp * (1 + wave * 0.16);
							enemies.push({ k, K, d: 0, hp, max: hp, flash: 0, ph: rnd(0, 6) });
							spawnT = k === "boss" ? 1 : Math.max(0.45, 1.1 - wave * 0.05);
						}
					}
					for (let i = enemies.length - 1; i >= 0; i--) {
						const e = enemies[i];
						e.d += e.K.speed * dt;
						e.flash = Math.max(0, e.flash - dt * 6);
						if (e.d >= total) {
							enemies.splice(i, 1);
							lives -= e.k === "boss" ? 5 : 1;
							api.shake(5);
							api.beep(140, 0.25, "sawtooth", 0.05, -50);
							if (lives <= 0) { api.score = Math.max(api.score, 0); api.end(`The page got linted to death on wave ${wave}`); return; }
							api.say(`${lives} life${lives === 1 ? "" : "s"} left`);
						}
					}
					for (const tw of towers) {
						const T = TOWERS[tw.type];
						tw.cd -= dt;
						if (tw.cd > 0) continue;
						const range = T.range * (1 + (tw.lvl - 1) * 0.12);
						let tgt = null, bd = -1;
						for (const e of enemies) {
							const p = at(e.d);
							if (Math.hypot(p.x - tw.x, p.y - tw.y) <= range && e.d > bd) { tgt = e; bd = e.d; }
						}
						if (!tgt) continue;
						tw.cd = T.rate / (1 + (tw.lvl - 1) * 0.2);
						const tp = at(tgt.d);
						tw.aim = Math.atan2(tp.y - tw.y, tp.x - tw.x);
						const dmg = T.dmg * (1 + (tw.lvl - 1) * 0.35);
						bolts.push({ x1: tw.x, y1: tw.y, x2: tp.x, y2: tp.y, life: 0.12, type: tw.type });
						api.beep(tw.type === 2 ? 300 : tw.type === 1 ? 420 : 600, 0.04, "square", 0.02);
						const hit = T.splash ? enemies.filter((e) => { const p = at(e.d); return Math.hypot(p.x - tp.x, p.y - tp.y) < T.splash; }) : [tgt];
						for (const e of hit) {
							e.hp -= dmg; e.flash = 1;
							if (e.hp <= 0 && !e.dead) {
								e.dead = true;
								const p = at(e.d);
								coins += e.K.reward;
								kills++;
								api.add(e.K.reward * 2);
								api.burst(p.x, p.y, { n: e.k === "boss" ? 40 : 10, color: e.K.color, speed: 200, size: 3 });
								api.beep(880, 0.06, "triangle", 0.03);
							}
						}
						enemies = enemies.filter((e) => !e.dead);
					}
					for (let i = bolts.length - 1; i >= 0; i--) { bolts[i].life -= dt; if (bolts[i].life <= 0) bolts.splice(i, 1); }
					if (wave >= LAST_WAVE && !queue.length && !enemies.length) {
						api.add(lives * 50 + coins);
						api.end("All diagnostics cleared! Zero errors");
					}
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H;
										// track under the text lines
					g.lineCap = "round"; g.lineJoin = "round";
					g.strokeStyle = c.dark ? "rgba(255,255,255,0.10)" : "rgba(20,40,66,0.09)";
					g.lineWidth = 12;
					g.beginPath();
					path.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
					g.stroke();
					g.fillStyle = c.toy; g.font = "700 11px sans-serif"; g.textAlign = "left";
					g.fillText("▶ IN", path[0].x - 2, path[0].y - 12);
					const end = path[path.length - 1];
					g.fillText("OUT", end.x + (end.x > path[path.length - 2].x ? 6 : -30), end.y - 12);
					// ghost
					if (hover && !api.over) {
						const T = TOWERS[sel];
						const ok = placeable(hover.x, hover.y) && coins >= T.cost;
						g.strokeStyle = ok ? c.toy2 : "#e03131"; g.lineWidth = 2; g.setLineDash([5, 5]); g.globalAlpha = 0.7;
						g.beginPath(); g.arc(hover.x, hover.y, T.range, 0, 7); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
					}
					for (const tw of towers) {
						const T = TOWERS[tw.type];
						g.fillStyle = c.bg; g.strokeStyle = c.toy2; g.lineWidth = 3;
						roundRect(g, tw.x - 15, tw.y - 15, 30, 30, 8); g.fill(); g.stroke();
						g.fillStyle = c.toy2; g.font = "800 15px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
						g.fillText(T.glyph, tw.x, tw.y + 1);
						g.textBaseline = "alphabetic";
						for (let i = 0; i < tw.lvl; i++) { g.fillStyle = c.toy; g.fillRect(tw.x - 12 + i * 9, tw.y + 18, 6, 3); }
					}
					for (const b of bolts) {
						g.strokeStyle = b.type === 1 ? c.toy : c.toy2; g.lineWidth = b.type === 2 ? 4 : 2; g.globalAlpha = b.life * 8;
						g.beginPath(); g.moveTo(b.x1, b.y1); g.lineTo(b.x2, b.y2); g.stroke(); g.globalAlpha = 1;
						if (b.type === 1) { g.strokeStyle = c.toy; g.beginPath(); g.arc(b.x2, b.y2, 52 * (1 - b.life * 6), 0, 7); g.globalAlpha = b.life * 5; g.stroke(); g.globalAlpha = 1; }
					}
					for (const e of enemies) {
						const p = at(e.d);
						g.save(); g.translate(p.x, p.y); g.rotate(p.ang);
						g.strokeStyle = e.flash > 0 ? "#fff" : e.K.color; g.lineWidth = e.k === "boss" ? 5 : 3;
						g.beginPath();
						const L = e.K.len;
						for (let i = 0; i <= 10; i++) {
							const x = (i / 10 - 0.5) * L * 2, y = Math.sin(i * 1.6 + e.ph + (reducedMotion ? 0 : t * 12)) * (e.k === "boss" ? 6 : 3.5);
							i ? g.lineTo(x, y) : g.moveTo(x, y);
						}
						g.stroke();
						g.restore();
						if (e.hp < e.max) { g.fillStyle = "rgba(0,0,0,0.35)"; g.fillRect(p.x - 12, p.y - 14, 24, 3); g.fillStyle = e.K.color; g.fillRect(p.x - 12, p.y - 14, 24 * (e.hp / e.max), 3); }
					}
					// palette
					g.textAlign = "center";
					for (const p of palette) {
						const T = TOWERS[p.i];
						const active = !p.next && p.i === sel;
						g.fillStyle = active ? c.toy2 : c.bg;
						g.strokeStyle = c.toy2; g.lineWidth = 2;
						roundRect(g, p.x, p.y, p.w, p.h, 12); g.fill(); g.stroke();
						g.fillStyle = active ? c.bg : c.strong; g.font = "700 12px sans-serif";
						if (p.next) { g.fillText(wave >= LAST_WAVE ? "Final wave" : queue.length ? "Wave on…" : `▶ Wave ${wave + 1}`, p.x + p.w / 2, p.y + 25); }
						else { g.fillText(`${T.key} ${T.name}`, p.x + p.w / 2, p.y + 17); g.font = "600 11px sans-serif"; g.fillText(p.w > 120 ? `$${T.cost} · ${T.desc}` : `$${T.cost}`, p.x + p.w / 2, p.y + 31); }
					}
					g.fillStyle = c.strong; g.font = "800 14px sans-serif"; g.textAlign = "left";
					g.fillText(`$ ${coins}   ♥ ${lives}   wave ${wave}/${LAST_WAVE}`, 14, H - 62 + 4 > 0 ? H - 68 : 20);
					if (!started) { g.textAlign = "center"; g.fillStyle = c.toy; g.font = "800 18px sans-serif"; g.fillText("Place a few fixers, then press Space or ▶ Wave 1", W / 2, 96); }
				},
			};
		},
	});
}

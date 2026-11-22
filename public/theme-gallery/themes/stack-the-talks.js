// Stack the Talks: your real talk titles drop in as Matter.js blocks. Stack them as high as you can.
import { createToy, roundRect, clamp, rnd } from "./_toy/toy.js";

let matterPromise;
const loadMatter = () => (matterPromise ||= import("https://esm.sh/matter-js@0.20.0").then((m) => m.default ?? m));

export function activate({ root, reducedMotion }) {
	return createToy({
		root, reducedMotion, id: "stack-the-talks", name: "Stack the Talks", startKey: "p", hz: 60, scoreLabel: "Height ",
		make(api) {
			let hy = 400, M, engine, blocks, base, hang, titles, lives, cam, t, nextIn, maxH, ready, floorY, swing, wait, started, dead;
			const hues = [18, 172, 38, 205, 340, 95];

			function pickTitle() { return titles[Math.floor(Math.random() * titles.length)]; }
			function newHang() {
				const w = clamp(Math.round(rnd(0.5, 1.15) * Math.min(150, api.W * 0.3)), 70, 190);
				hang = { w, h: rnd(34, 46), title: pickTitle(), hue: hues[Math.floor(Math.random() * hues.length)] };
			}
			function drop() {
				if (!ready || !hang || wait > 0) return;
				const x = swingX();
				const y = hy - cam;
				const body = M.Bodies.rectangle(x, y, hang.w, hang.h, { friction: 0.9, frictionStatic: 1.2, restitution: 0.02, density: 0.0025, sleepThreshold: 40, chamfer: { radius: 4 } });
				M.Body.setAngularVelocity(body, rnd(-0.01, 0.01));
				body.meta = hang;
				M.Composite.add(engine.world, body);
				blocks.push(body);
				api.beep(200, 0.1, "triangle", 0.04, -60);
				hang = null;
				wait = 0.7;
				started = true;
			}
			const range = () => Math.min(api.W / 2 - 70, 250);
			const swingX = () => api.W / 2 + Math.sin(t * (1.15 + Math.min(blocks.length, 14) * 0.045)) * range();

			return {
				start() {
					api.measure();
					floorY = api.H - 64;
					titles = [...root.querySelectorAll(".site-talk .site-item-title")].map((n) => n.textContent.trim()).filter(Boolean);
					if (!titles.length) titles = ["A Talk"];
					hy = Math.max(100, floorY - 190); blocks = []; lives = 3; cam = 0; t = 0; maxH = 0; wait = 0; started = false; dead = false;
					ready = false;
					newHang();
					api.say("Loading physics…");
					loadMatter().then((m) => {
						if (!api.running) return;
						M = m;
						engine = M.Engine.create({ enableSleeping: true, positionIterations: 8, velocityIterations: 6 });
						engine.gravity.y = 1.1;
						const pw = Math.min(300, api.W * 0.55);
						base = M.Bodies.rectangle(api.W / 2, floorY + 30, pw, 60, { isStatic: true, friction: 1, label: "stage" });
						base.pw = pw;
						M.Composite.add(engine.world, base);
						ready = true;
						api.say("Space / click / tap drops the talk. Stack them high. 3 falls ends the show.");
					}).catch(() => api.say("Couldn't load matter-js (offline?)"));
				},
				resize() { api.restart(); },
				key(k) { if (k === " " || k === "Enter" || k === "ArrowDown") drop(); },
				down() { drop(); },
				stop() { if (engine) { M.World.clear(engine.world); M.Engine.clear(engine); } engine = null; },
				step(dt) {
					if (!ready) return;
					t += dt;
					wait -= dt;
					if (wait <= 0 && !hang) newHang();
					M.Engine.update(engine, 1000 * dt);
					let top = floorY;
					for (let i = blocks.length - 1; i >= 0; i--) {
						const b = blocks[i];
						if (b.position.y > floorY + 260) {
							M.Composite.remove(engine.world, b);
							blocks.splice(i, 1);
							lives--;
							api.shake(6);
							api.beep(110, 0.35, "sawtooth", 0.05, -40);
							api.burst(b.position.x, floorY + 100 + cam, { n: 10, color: api.c.toy, speed: 160 });
							api.say(`${lives} fall${lives === 1 ? "" : "s"} left`);
							if (lives <= 0 && !dead) { dead = true; api.end("The tower fell"); }
							continue;
						}
						// settled blocks (speed low) on the stage count toward height
						const sp = Math.hypot(b.velocity.x, b.velocity.y);
						if ((sp < 0.25 || b.isSleeping) && Math.abs(b.position.x - base.position.x) < base.pw / 2 + 140 && b.position.y < floorY) top = Math.min(top, b.bounds.min.y);
					}
					const h = Math.round((floorY - top) / 10);
					if (h > maxH) {
						maxH = h;
						api.score = maxH;
						api.beep(520 + Math.min(maxH, 40) * 12, 0.07, "triangle", 0.04);
					}
					// camera: keep the tower top in the upper-middle of the screen
					const want = Math.max(0, api.H * 0.55 - (floorY - Math.max(0, maxH * 10)));
					cam += (want - cam) * Math.min(1, dt * 2);
					const hyWant = Math.max(100, floorY + cam - maxH * 10 - 190);
					hy += (hyWant - hy) * Math.min(1, dt * 3);
				},
				draw(g) {
					const c = api.c, W = api.W, H = api.H;
					g.fillStyle = c.dark ? "rgba(8,12,22,0.86)" : "rgba(253,250,245,0.88)";
					g.fillRect(0, 0, W, H);
					if (!ready) return;
					g.save();
					g.translate(0, cam);
					// stage
					g.fillStyle = c.dark ? "#2a3550" : "#3b2f2a";
					roundRect(g, base.position.x - base.pw / 2, floorY, base.pw, 60, 6); g.fill();
					g.fillStyle = c.toy2; g.fillRect(base.position.x - base.pw / 2, floorY - 3, base.pw, 6);
					// height ruler
					g.fillStyle = c.muted; g.font = "600 11px sans-serif"; g.textAlign = "left"; g.globalAlpha = 0.7;
					for (let m = 10; m <= 400; m += 10) {
						const y = floorY - m * 10;
						if (y + cam < -10 || y + cam > H) continue;
						g.fillRect(14, y, m % 50 === 0 ? 22 : 10, 1);
						if (m % 50 === 0) g.fillText(`${m}`, 40, y + 4);
					}
					g.globalAlpha = 1;
					for (const b of blocks) drawBlock(g, b.position.x, b.position.y, b.angle, b.meta, c);
					// target line for best
					g.restore();
					// crane + hanging block
					const x = swingX();
					g.strokeStyle = c.muted; g.lineWidth = 2;
					g.beginPath(); g.moveTo(x, 54); g.lineTo(x, hy - (hang ? hang.h / 2 : 0)); g.stroke();
					g.beginPath(); g.moveTo(W / 2 - range() - 20, 54); g.lineTo(W / 2 + range() + 20, 54); g.globalAlpha = 0.35; g.stroke(); g.globalAlpha = 1;
					if (hang) drawBlock(g, x, hy, 0, hang, c);
					if (!started) {
						g.fillStyle = c.strong; g.font = "700 15px sans-serif"; g.textAlign = "center";
						g.fillText("Space / click to drop", W / 2, hy - 40);
					}
					for (let i = 0; i < lives; i++) { g.fillStyle = c.toy; g.beginPath(); g.arc(18 + i * 18, H - 22, 6, 0, 7); g.fill(); }
				},
			};

			function drawBlock(g, x, y, ang, m, c) {
				g.save();
				g.translate(x, y); g.rotate(ang);
				const l = c.dark ? 52 : 42;
				g.fillStyle = `hsl(${m.hue} ${c.dark ? 55 : 62}% ${l}%)`;
				roundRect(g, -m.w / 2, -m.h / 2, m.w, m.h, 5); g.fill();
				g.fillStyle = "rgba(255,255,255,0.18)"; roundRect(g, -m.w / 2, -m.h / 2, m.w, m.h * 0.4, 5); g.fill();
				g.fillStyle = "#fff"; g.font = "700 12px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
				let s = m.title;
				while (s.length > 3 && g.measureText(s).width > m.w - 10) s = s.slice(0, -2);
				g.fillText(s === m.title ? s : s.trimEnd() + "…", 0, 1);
				g.textBaseline = "alphabetic";
				g.restore();
			}
		},
	});
}

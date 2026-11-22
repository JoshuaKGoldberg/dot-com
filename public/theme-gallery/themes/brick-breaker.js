// Word Breaker: a paddle and ball break the page's real words like bricks; they reassemble on exit.
import { createToy, circleRect, roundRect, clamp } from "./_toy/toy.js";

const SELECTOR = ".site-about p, .site-tagline, .site-item-title, .site-item-description, .site-section-title, .site-title, .site-item-meta";

export function activate({ root, reducedMotion }) {
	let snapshot = null;
	let restoreTimer = 0;

	function restoreNow() {
		clearTimeout(restoreTimer);
		restoreTimer = 0;
		if (snapshot) {
			snapshot.page.innerHTML = snapshot.html;
			snapshot = null;
		}
		delete root.dataset.wb;
	}

	function wrapWords(page) {
		for (const host of page.querySelectorAll(SELECTOR)) {
			const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
			const nodes = [];
			while (walker.nextNode()) nodes.push(walker.currentNode);
			for (const node of nodes) {
				if (!node.nodeValue.trim()) continue;
				const frag = document.createDocumentFragment();
				for (const part of node.nodeValue.split(/(\s+)/)) {
					if (!part) continue;
					if (/^\s+$/.test(part)) frag.append(part);
					else {
						const span = document.createElement("span");
						span.className = "wb-word";
						span.textContent = part;
						frag.append(span);
					}
				}
				node.replaceWith(frag);
			}
		}
	}

	const dispose = createToy({
		root, reducedMotion, id: "brick-breaker", name: "Word Breaker", startKey: "p", hz: 240,
		make(api) {
			let bricks, paddle, ball, lives, level, speed, combo, held, aliveCount;
			const PW = () => (api.W < 500 ? 96 : 140);

			function serve() {
				ball = { x: paddle.x, y: paddle.y - 11, vx: 0, vy: 0, r: 7, stuck: true };
				combo = 0;
			}
			function launch() {
				if (!ball.stuck) return;
				ball.stuck = false;
				const a = -Math.PI / 2 + (Math.random() - 0.5) * 0.7;
				ball.vx = Math.cos(a) * speed;
				ball.vy = Math.sin(a) * speed;
				api.beep(330, 0.08, "triangle", 0.04);
			}
			function setStatus() {
				api.say(`${"● ".repeat(lives).trim()} · move mouse / ← → · Space or tap to serve`);
			}

			return {
				start() {
					if (!snapshot) {
						const page = api.page;
						snapshot = { page, html: page.innerHTML };
						wrapWords(page);
					} else {
						for (const w of api.page.querySelectorAll(".wb-gone")) w.classList.remove("wb-gone");
					}
					root.dataset.wb = "1";
					const about = api.page.querySelector(".site-about");
					api.scrollTo(Math.max(0, (about?.offsetTop ?? 200) - 150));
					api.measure();
					const H = api.H;
					bricks = api.rects(".wb-word").filter((r) => r.y > 50 && r.y + r.h < H * 0.78).map((r) => ({ ...r, alive: true }));
					aliveCount = bricks.length;
					paddle = { x: api.W / 2, y: H - 46, w: PW(), h: 12 };
					lives = 3;
					level = 1;
					speed = 440;
					held = 0;
					serve();
					setStatus();
				},
				stop() {
					// Words fade back in, then the original markup is restored.
					for (const w of api.page.querySelectorAll(".wb-gone")) w.classList.remove("wb-gone");
					restoreTimer = setTimeout(restoreNow, reducedMotion ? 0 : 450);
				},
				key(k) { if (k === " " || k === "Enter" || k === "ArrowUp") launch(); },
				down() { launch(); },
				move(x, y, e) { if (e.pointerType !== "touch" || true) paddle.x = clamp(x, paddle.w / 2, api.W - paddle.w / 2); },
				step(dt) {
					const dir = (api.keys.has("ArrowRight") ? 1 : 0) - (api.keys.has("ArrowLeft") ? 1 : 0);
					if (dir) paddle.x = clamp(paddle.x + dir * 900 * dt, paddle.w / 2, api.W - paddle.w / 2);
					if (ball.stuck) { ball.x = paddle.x; ball.y = paddle.y - 11; return; }
					ball.x += ball.vx * dt;
					ball.y += ball.vy * dt;
					if (ball.x < ball.r) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
					if (ball.x > api.W - ball.r) { ball.x = api.W - ball.r; ball.vx = -Math.abs(ball.vx); }
					if (ball.y < ball.r + 4) { ball.y = ball.r + 4; ball.vy = Math.abs(ball.vy); }
					// paddle
					const hit = circleRect(ball.x, ball.y, ball.r, { x: paddle.x - paddle.w / 2, y: paddle.y, w: paddle.w, h: paddle.h });
					if (hit && ball.vy > 0) {
						const t = clamp((ball.x - paddle.x) / (paddle.w / 2), -1, 1);
						const a = -Math.PI / 2 + t * 1.1;
						ball.vx = Math.cos(a) * speed;
						ball.vy = Math.sin(a) * speed;
						ball.y = paddle.y - ball.r - 0.5;
						combo = 0;
						api.beep(260, 0.05, "triangle", 0.04);
					}
					for (const b of bricks) {
						if (!b.alive) continue;
						const h = circleRect(ball.x, ball.y, ball.r, b);
						if (!h) continue;
						ball.x += h.nx * h.d;
						ball.y += h.ny * h.d;
						if (h.nx) ball.vx = Math.abs(ball.vx) * Math.sign(h.nx);
						if (h.ny) ball.vy = Math.abs(ball.vy) * Math.sign(h.ny);
						b.alive = false;
						aliveCount--;
						b.el.classList.add("wb-gone");
						combo++;
						api.add(Math.round(b.el.textContent.length * 10 * Math.min(combo, 8)));
						speed = Math.min(760, speed + 5);
						const s = Math.hypot(ball.vx, ball.vy);
						ball.vx *= speed / s; ball.vy *= speed / s;
						api.burst(b.x + b.w / 2, b.y + b.h / 2, { n: Math.min(18, 5 + b.w / 12), color: Math.random() < 0.5 ? api.c.toy : api.c.toy2, speed: 200, size: 3 });
						api.beep(440 + Math.min(combo, 12) * 55, 0.07, "square", 0.03);
						if (combo > 3) api.shake(2);
						break;
					}
					if (aliveCount <= 0) {
						api.add(500 * level);
						api.say("Page cleared! Words reassembling…");
						api.beep(880, 0.4, "triangle", 0.06);
						level++;
						speed += 60;
						setTimeout(() => {
							if (!api.running) return;
							for (const w of api.page.querySelectorAll(".wb-gone")) w.classList.remove("wb-gone");
							for (const b of bricks) b.alive = true;
							aliveCount = bricks.length;
							serve();
							setStatus();
						}, 900);
						ball.stuck = true; ball.x = -999;
					}
					if (ball.y > api.H + 20) {
						lives--;
						api.shake(6);
						api.beep(150, 0.3, "sawtooth", 0.04, -80);
						if (lives <= 0) api.end("Out of balls");
						else { serve(); setStatus(); }
					}
				},
				draw(g) {
					const c = api.c;
					g.lineWidth = 1;
					g.strokeStyle = c.toy;
					g.globalAlpha = 0.28;
					for (const b of bricks) {
						if (!b.alive) continue;
						roundRect(g, b.x - 2, b.y + 1, b.w + 4, b.h - 2, 4);
						g.stroke();
					}
					g.globalAlpha = 1;
					g.fillStyle = c.toy;
					roundRect(g, paddle.x - paddle.w / 2, paddle.y, paddle.w, paddle.h, 6);
					g.fill();
					g.fillStyle = c.toy2;
					roundRect(g, paddle.x - 14, paddle.y, 28, paddle.h, 6);
					g.fill();
					if (ball.x > 0) {
						g.fillStyle = c.strong;
						g.beginPath(); g.arc(ball.x, ball.y, ball.r, 0, 7); g.fill();
						g.strokeStyle = c.toy2; g.lineWidth = 2; g.stroke();
					}
					if (combo > 2) {
						g.fillStyle = c.toy2; g.font = "800 18px sans-serif"; g.textAlign = "center";
						g.fillText(`x${Math.min(combo, 8)} combo`, api.W / 2, api.H - 14);
					}
				},
			};
		},
	});
	return () => {
		restoreNow();
		dispose();
	};
}

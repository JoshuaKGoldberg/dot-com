// Shared scaffolding for the page toys (#186-195).
// Before Play: one chip + one key listener. Nothing else exists (no canvas, no loop, no audio).

const DPR = () => Math.min(window.devicePixelRatio || 1, 1.5);
const el = (tag, cls, text) => {
	const node = document.createElement(tag);
	if (cls) node.className = cls;
	if (text) node.textContent = text;
	return node;
};

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const rnd = (a, b) => a + Math.random() * (b - a);

/** Circle vs axis-aligned rect. Returns {nx,ny,d} (push-out normal and penetration) or null. */
export function circleRect(cx, cy, r, rc) {
	const px = clamp(cx, rc.x, rc.x + rc.w);
	const py = clamp(cy, rc.y, rc.y + rc.h);
	let dx = cx - px;
	let dy = cy - py;
	const d2 = dx * dx + dy * dy;
	if (d2 > r * r) return null;
	if (d2 === 0) {
		const l = cx - rc.x, rr = rc.x + rc.w - cx, t = cy - rc.y, b = rc.y + rc.h - cy;
		const m = Math.min(l, rr, t, b);
		if (m === l) return { nx: -1, ny: 0, d: r + l };
		if (m === rr) return { nx: 1, ny: 0, d: r + rr };
		if (m === t) return { nx: 0, ny: -1, d: r + t };
		return { nx: 0, ny: 1, d: r + b };
	}
	const d = Math.sqrt(d2);
	return { nx: dx / d, ny: dy / d, d: r - d };
}

/** Closest point on segment, for circle-vs-segment tests. */
export function closestOnSeg(px, py, ax, ay, bx, by) {
	const abx = bx - ax, aby = by - ay;
	const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby || 1), 0, 1);
	return { x: ax + abx * t, y: ay + aby * t, t };
}

export function roundRect(g, x, y, w, h, r) {
	r = Math.min(r, w / 2, h / 2);
	g.beginPath();
	g.moveTo(x + r, y);
	g.arcTo(x + w, y, x + w, y + h, r);
	g.arcTo(x + w, y + h, x, y + h, r);
	g.arcTo(x, y + h, x, y, r);
	g.arcTo(x, y, x + w, y, r);
	g.closePath();
}

/**
 * make(api) => game: { start(), step(dt), draw(g), key(k,e), keyup(k), down(x,y,e), move(x,y,e), up(x,y,e), resize(), stop() }
 */
export function createToy(o) {
	const { root, id, name, reducedMotion, make } = o;
	const startKey = o.startKey || "p";
	const hz = o.hz || 120;
	const bestKey = `toy:${id}:best`;
	const lowerIsBetter = !!o.lowerIsBetter;
	let best = Number(localStorage.getItem(bestKey)) || 0;
	let score = 0;
	let running = false;
	let over = false;
	let raf = 0;
	let last = 0;
	let acc = 0;
	let canvas, g, hud, game, scoreEl, bestEl, statusEl, soundBtn;
	let W = 0, H = 0, ox = 0, oy = 0, dpr = 1;
	let particles = [];
	let shakeA = 0, shakeT = 0;
	let audio = null;
	let soundOn = false;
	let savedScroll = 0;
	let savedOverflow = "";
	const keys = new Set();
	const pointer = { x: -999, y: -999, down: false, inside: false, touch: false };
	let c = {};

	const readColors = () => {
		const cs = getComputedStyle(root);
		const v = (n, f) => cs.getPropertyValue(n).trim() || f;
		c = {
			bg: v("--siteBg", "#fff"),
			fg: v("--siteFg", "#222"),
			strong: v("--siteFgStrong", "#000"),
			muted: v("--siteMuted", "#666"),
			accent: v("--siteAccent", "#07f"),
			squiggle: v("--siteSquiggle", "#0af"),
			subtle: v("--siteSubtle", "#ddd"),
			toy: v("--toyAccent", v("--siteAccent", "#07f")),
			toy2: v("--toyAccent2", v("--siteSquiggle", "#0af")),
			dark: document.documentElement.classList.contains("dark"),
		};
		api.c = c;
	};

	const fmt = (n) => (Math.round(n * 10) / 10).toLocaleString();

	const api = {
		root,
		reduced: reducedMotion,
		keys,
		pointer,
		c,
		get W() { return W; },
		get H() { return H; },
		get g() { return g; },
		get hud() { return hud; },
		get page() { return root.querySelector(".site-page"); },
		get score() { return score; },
		set score(v) { score = v; paint(); },
		get best() { return best; },
		get running() { return running; },
		get over() { return over; },
		add(n) { score += n; paint(); },
		say(text) { if (statusEl) statusEl.textContent = text; },
		scrollTo(y) { root.scrollTop = y; },
		get scrollTop() { return root.scrollTop; },
		/** Rect of an element in canvas coordinates. */
		rect(node) {
			const r = node.getBoundingClientRect();
			return { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height, el: node };
		},
		/** Visible (on-screen) rects for a selector. */
		rects(sel, parent = root) {
			const out = [];
			for (const node of parent.querySelectorAll(sel)) {
				const r = api.rect(node);
				if (r.w > 2 && r.h > 2 && r.y + r.h > 0 && r.y < H && r.x + r.w > 0 && r.x < W) out.push(r);
			}
			return out;
		},
		/** One rect per rendered line of text inside a node. */
		lines(node) {
			const range = document.createRange();
			range.selectNodeContents(node);
			const out = [];
			for (const r of range.getClientRects()) {
				if (r.width < 4 || r.height < 4) continue;
				out.push({ x: r.left - ox, y: r.top - oy, w: r.width, h: r.height });
			}
			// Merge fragments that share a line (links split text into several boxes).
			out.sort((a, b) => a.y - b.y || a.x - b.x);
			const merged = [];
			for (const r of out) {
				const m = merged.find((q) => Math.abs(q.y + q.h / 2 - (r.y + r.h / 2)) < Math.min(q.h, r.h) * 0.4);
				if (m) {
					const x2 = Math.max(m.x + m.w, r.x + r.w);
					m.x = Math.min(m.x, r.x);
					m.w = x2 - m.x;
					m.h = Math.max(m.h, r.h);
				} else merged.push({ ...r });
			}
			return merged;
		},
		burst(x, y, { n = 14, color = c.toy, speed = 220, life = 0.6, size = 3, gravity = 400, spread = Math.PI * 2, angle = 0 } = {}) {
			if (reducedMotion) return;
			for (let i = 0; i < n && particles.length < 360; i++) {
				const a = angle + (Math.random() - 0.5) * spread;
				const s = speed * (0.35 + Math.random() * 0.75);
				particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life * (0.6 + Math.random() * 0.6), size: size * (0.6 + Math.random() * 0.8), color, gravity });
			}
		},
		shake(a = 5) {
			if (reducedMotion) return;
			shakeA = Math.max(shakeA, a);
			shakeT = 0.25;
		},
		beep(freq = 440, dur = 0.08, type = "sine", vol = 0.05, slide = 0) {
			if (!soundOn || !audio) return;
			try {
				const t = audio.currentTime;
				const osc = audio.createOscillator();
				const gain = audio.createGain();
				osc.type = type;
				osc.frequency.setValueAtTime(freq, t);
				if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
				gain.gain.setValueAtTime(vol, t);
				gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
				osc.connect(gain).connect(audio.destination);
				osc.start(t);
				osc.stop(t + dur + 0.02);
			} catch {}
		},
		end(message) {
			if (over) return;
			over = true;
			const better = lowerIsBetter ? best === 0 || score < best : score > best;
			let extra = "";
			if (better && score > 0) {
				best = score;
				localStorage.setItem(bestKey, String(best));
				extra = " New best!";
			}
			paint();
			api.say(`${message || "Game over"}.${extra} R to play again, Esc to exit.`);
		},
		restart() {
			over = false;
			score = 0;
			particles = [];
			keys.clear();
			game.start();
			paint();
		},
		/** For toys with no losing state: persist best without ending. */
		submit(value) {
			const better = lowerIsBetter ? best === 0 || value < best : value > best;
			if (better) {
				best = value;
				localStorage.setItem(bestKey, String(best));
				paint();
			}
			return better;
		},
	};

	function paint() {
		if (!scoreEl) return;
		scoreEl.textContent = fmt(score);
		bestEl.textContent = best ? fmt(best) : "–";
	}

	// ---- chip (the only thing that exists before Play) ----
	const chip = el("button", "toy-chip");
	chip.type = "button";
	chip.innerHTML = `▶ Play <kbd>${startKey.toUpperCase()}</kbd>`;
	chip.title = `Play ${name} (${startKey.toUpperCase()}); Esc exits`;
	chip.setAttribute("aria-label", `Play ${name}`);
	root.append(chip);
	chip.addEventListener("click", () => start());

	function isTyping(e) {
		const t = e.target;
		return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
	}

	function onKeyDown(e) {
		if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
		const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		if (!running) {
			if (k === startKey) {
				e.preventDefault();
				start();
			}
			return;
		}
		// Running: this mode owns the keyboard (capture phase, so the gallery's shortcuts never fire).
		if (k === "Escape") {
			e.preventDefault();
			stop();
			return;
		}
		if (k === "r" && over) {
			e.preventDefault();
			api.restart();
			return;
		}
		if (k === "M" || k === "m" || k === "d" || k === "t" || k === "i" || k === "h" || k.startsWith("Arrow") || k === " ") e.preventDefault();
		if (k === "m") {
			toggleSound();
			return;
		}
		if (e.repeat) {
			keys.add(k);
			return;
		}
		keys.add(k);
		if (!over) game.key?.(k, e);
	}
	function onKeyUp(e) {
		const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		keys.delete(k);
		if (running && !over) game.keyup?.(k, e);
	}

	function local(e) {
		pointer.x = e.clientX - ox;
		pointer.y = e.clientY - oy;
		pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= W && pointer.y <= H;
		pointer.touch = e.pointerType === "touch";
	}
	function onDown(e) {
		if (!running || e.target.closest?.(".toy-hud")) return;
		local(e);
		pointer.down = true;
		if (over) return;
		game.down?.(pointer.x, pointer.y, e);
	}
	function onMove(e) {
		if (!running) return;
		local(e);
		if (!over) game.move?.(pointer.x, pointer.y, e);
	}
	function onUp(e) {
		if (!running) return;
		local(e);
		pointer.down = false;
		if (!over) game.up?.(pointer.x, pointer.y, e);
	}
	function onResize() {
		if (!running) return;
		fit();
		if (game.resize) game.resize();
		else api.restart();
	}
	function onVisibility() {
		if (!running) return;
		if (document.hidden) {
			cancelAnimationFrame(raf);
			raf = 0;
		} else if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(frame);
		}
	}

	window.addEventListener("keydown", onKeyDown, true);
	window.addEventListener("keyup", onKeyUp, true);

	function fit() {
		dpr = DPR();
		const rect = root.getBoundingClientRect();
		const top = parseFloat(getComputedStyle(root).top) || 0;
		W = Math.round(rect.width);
		H = Math.round(rect.height);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		const cr = canvas.getBoundingClientRect();
		ox = cr.left;
		oy = cr.top;
		void top;
	}

	function toggleSound() {
		soundOn = !soundOn;
		if (soundOn && !audio) {
			try { audio = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
		}
		if (audio?.state === "suspended") audio.resume();
		soundBtn.textContent = soundOn ? "♪ Sound on" : "♪ Sound off";
		soundBtn.setAttribute("aria-pressed", String(soundOn));
		if (soundOn) api.beep(660, 0.1, "triangle", 0.06);
	}

	function start() {
		if (running) return;
		running = true;
		over = false;
		score = 0;
		particles = [];
		keys.clear();
		savedScroll = root.scrollTop;
		savedOverflow = root.style.overflow;
		root.style.overflow = "hidden";
		chip.hidden = true;
		canvas = el("canvas", "toy-canvas");
		canvas.setAttribute("aria-hidden", "true");
		root.append(canvas);
		g = canvas.getContext("2d");
		hud = el("div", "toy-hud");
		if (o.hudBottom) hud.dataset.pos = "bottom";
		hud.setAttribute("role", "group");
		hud.setAttribute("aria-label", name);
		const title = el("span", "", name);
		const scoreWrap = el("span");
		scoreWrap.append(o.scoreLabel || "Score ", (scoreEl = el("b", "", "0")));
		const bestWrap = el("span");
		bestWrap.append("Best ", (bestEl = el("b", "", "–")));
		statusEl = el("span", "toy-status");
		statusEl.setAttribute("role", "status");
		soundBtn = el("button", "", "♪ Sound off");
		soundBtn.type = "button";
		soundBtn.setAttribute("aria-pressed", "false");
		soundBtn.title = "Sound is off until you turn it on (M)";
		soundBtn.addEventListener("click", toggleSound);
		const exit = el("button", "", "Exit Esc");
		exit.type = "button";
		exit.addEventListener("click", stop);
		hud.append(title, scoreWrap, bestWrap, statusEl, soundBtn, exit);
		root.append(hud);
		fit();
		readColors();
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		window.addEventListener("resize", onResize);
		document.addEventListener("visibilitychange", onVisibility);
		game = make(api);
		game.start();
		paint();
		last = performance.now();
		acc = 0;
		raf = requestAnimationFrame(frame);
	}

	function frame(now) {
		raf = requestAnimationFrame(frame);
		const dt = Math.min(0.1, (now - last) / 1000);
		last = now;
		acc += dt;
		const step = 1 / hz;
		let n = 0;
		while (acc >= step && n < 8) {
			if (!over) game.step(step);
			acc -= step;
			n++;
		}
		if (n === 8) acc = 0;
		// particles
		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.life -= dt;
			if (p.life <= 0) { particles.splice(i, 1); continue; }
			p.vy += p.gravity * dt;
			p.x += p.vx * dt;
			p.y += p.vy * dt;
		}
		if (shakeT > 0) shakeT -= dt;
		g.setTransform(dpr, 0, 0, dpr, 0, 0);
		g.clearRect(0, 0, W, H);
		g.save();
		if (shakeT > 0 && shakeA) g.translate((Math.random() - 0.5) * shakeA * (shakeT * 4), (Math.random() - 0.5) * shakeA * (shakeT * 4));
		game.draw(g, dt);
		for (const p of particles) {
			g.globalAlpha = Math.max(0, p.life / p.max);
			g.fillStyle = p.color;
			g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
		}
		g.globalAlpha = 1;
		g.restore();
	}

	function stop() {
		if (!running) return;
		running = false;
		cancelAnimationFrame(raf);
		raf = 0;
		try { game.stop?.(); } catch {}
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		window.removeEventListener("resize", onResize);
		document.removeEventListener("visibilitychange", onVisibility);
		canvas?.remove();
		hud?.remove();
		canvas = hud = null;
		root.style.overflow = savedOverflow;
		root.scrollTop = savedScroll;
		chip.hidden = false;
		if (audio) { audio.close?.(); audio = null; soundOn = false; }
		keys.clear();
		particles = [];
	}

	api.stop = stop;
	api.readColors = readColors;
	api.measure = () => { fit(); readColors(); };

	return () => {
		stop();
		window.removeEventListener("keydown", onKeyDown, true);
		window.removeEventListener("keyup", onKeyUp, true);
		chip.remove();
	};
}

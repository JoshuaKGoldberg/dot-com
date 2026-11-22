const BIN = 2;
const MAX_H = 4.5;
const MAX_FLAKES = 420;

export function create(root, reduced, globe) {
	const canvas = document.createElement("canvas");
	canvas.className = "sw-canvas";
	canvas.setAttribute("aria-hidden", "true");
	root.append(canvas);
	const ctx = canvas.getContext("2d");
	const page = root.querySelector(".site-page");
	const dark = () => document.documentElement.classList.contains("dark");

	let W = 0;
	let H = 0;
	let dpr = 1;
	let ledges = [];
	let flakes = [];
	let raf = 0;
	let last = 0;
	let spawnLeft = 0;
	let idleSince = 0;
	let melting = false;
	let scrollBound = false;
	let sprites;
	let sceneKey = "";

	function size() {
		dpr = Math.min(devicePixelRatio || 1, 1.5);
		const r = root.getBoundingClientRect();
		W = Math.round(r.width);
		H = Math.round(r.height);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		sprites = undefined;
	}

	function makeSprites() {
		const light = !dark();
		sprites = [2.6, 3.8, 5].map((r) => {
			const c = document.createElement("canvas");
			const s = Math.ceil((r + 2) * 2 * dpr);
			c.width = c.height = s;
			const g = c.getContext("2d");
			const cx = s / 2;
			const grad = g.createRadialGradient(cx, cx, 0, cx, cx, r * dpr);
			grad.addColorStop(0, "#fff");
			grad.addColorStop(0.55, light ? "#bcd6f3" : "#fff");
			grad.addColorStop(1, light ? "rgb(95 145 205 / 1)" : "rgb(255 255 255 / 0)");
			g.fillStyle = grad;
			g.beginPath();
			g.arc(cx, cx, r * dpr, 0, 6.283);
			g.fill();
			return { c, r: s / dpr };
		});
	}

	function measure() {
		const rr = root.getBoundingClientRect();
		const st = root.scrollTop;
		const out = [];
		const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT, {
			acceptNode: (n) => (n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT),
		});
		const range = document.createRange();
		const old = new Map(ledges.map((l) => [`${Math.round(l.x0)}:${Math.round(l.y)}`, l]));
		while (walker.nextNode()) {
			range.selectNodeContents(walker.currentNode);
			for (const r of range.getClientRects()) {
				if (r.width < 10 || r.height < 8 || r.height > 90) continue;
				const x0 = r.left - rr.left;
				const y = r.top - rr.top + st + r.height * 0.02;
				const key = `${Math.round(x0)}:${Math.round(y)}`;
				const prev = old.get(key);
				out.push(prev ?? { x0, x1: x0 + r.width, y, h: new Float32Array(Math.ceil(r.width / BIN) + 1) });
			}
		}
		ledges = out;
	}

	function spawn(n, fromGlobe, seed) {
		for (let i = 0; i < n && flakes.length < MAX_FLAKES; i++) {
			if (fromGlobe) {
				const gr = globe.getBoundingClientRect();
				const rr = root.getBoundingClientRect();
				const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
				const sp = 160 + Math.random() * 260;
				flakes.push({ x: gr.left - rr.left + gr.width / 2, y: gr.top - rr.top + 25, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, s: (Math.random() * 3) | 0, ph: Math.random() * 6.28, burst: 0.6 });
			} else {
				flakes.push({ x: Math.random() * (W + 80) - 40, y: seed ? Math.random() * H * 0.55 - H * 0.1 : -8 - Math.random() * 30, vx: 0, vy: 110 + Math.random() * 90, s: (Math.random() * 3) | 0, ph: Math.random() * 6.28, burst: 0 });
			}
		}
	}

	function addSnow(l, x) {
		const c = Math.round((x - l.x0) / BIN);
		for (let k = -4; k <= 4; k++) {
			const i = c + k;
			if (i < 0 || i >= l.h.length) continue;
			l.h[i] = Math.min(MAX_H, l.h[i] + 0.8 * Math.exp(-(k * k) / 5));
		}
	}

	function step(dt, now) {
		const st = root.scrollTop;
		const active = ledges.filter((l) => l.y - st > -30 && l.y - st < H + 30);
		const t = now / 1000;
		let alive = 0;
		for (const f of flakes) {
			if (f.dead) continue;
			const py = f.y;
			if (f.burst > 0) {
				f.burst -= dt;
				f.vx *= 1 - 3 * dt;
				f.vy += 520 * dt;
				if (f.burst <= 0) f.vy = Math.max(f.vy, 90);
			} else {
				f.vy += (130 + f.s * 35 - f.vy) * Math.min(1, 2 * dt);
				f.vx = Math.sin(t * 0.9 + f.ph) * 22 + 10;
			}
			f.x += f.vx * dt;
			f.y += f.vy * dt;
			if (f.vy > 0) {
				for (const l of active) {
					if (f.x < l.x0 || f.x > l.x1) continue;
					const bi = Math.min(l.h.length - 1, Math.max(0, Math.round((f.x - l.x0) / BIN)));
					const top = l.y - st - l.h[bi];
					if (py <= top + 1 && f.y >= top) {
						if (Math.random() < 0.8 && l.h[bi] < MAX_H - 0.2) { addSnow(l, f.x); f.dead = true; }
						break;
					}
				}
			}
			if (f.y > H + 10 || f.x > W + 60 || f.x < -60) f.dead = true;
			if (!f.dead) alive++;
		}
		if (alive !== flakes.length) flakes = flakes.filter((f) => !f.dead);
	}

	function draw() {
		ctx.clearRect(0, 0, W, H);
		const st = root.scrollTop;
		const light = !dark();
		const key = light ? "l" : "d";
		if (!sprites || sceneKey !== key) { sceneKey = key; makeSprites(); }
		// piles
		ctx.fillStyle = "#fff";
		ctx.strokeStyle = light ? "rgb(120 165 215 / 0.85)" : "rgb(255 255 255 / 0.6)";
		ctx.lineWidth = 1;
		ctx.lineJoin = "round";
		for (const l of ledges) {
			const y = l.y - st;
			if (y < -20 || y > H + 20) continue;
			let i = 0;
			while (i < l.h.length) {
				if (l.h[i] <= 0.12) { i++; continue; }
				const a = i;
				while (i < l.h.length && l.h[i] > 0.12) i++;
				ctx.beginPath();
				ctx.moveTo(l.x0 + a * BIN, y + 0.5);
				for (let k = a; k < i; k++) ctx.lineTo(l.x0 + k * BIN, y - l.h[k]);
				ctx.lineTo(l.x0 + (i - 1) * BIN, y + 0.5);
				ctx.closePath();
				ctx.fill();
				if (light) ctx.stroke();
			}
		}
		for (const f of flakes) {
			const s = sprites[f.s];
			ctx.drawImage(s.c, f.x - s.r / 2, f.y - s.r / 2, s.r, s.r);
		}
	}

	function hasSnow() {
		return ledges.some((l) => l.h.some((h) => h > 0.05));
	}

	function frame(now) {
		raf = 0;
		if (document.hidden) { last = 0; raf = requestAnimationFrame(frame); return; }
		const dt = Math.min(0.04, last ? (now - last) / 1000 : 0.016);
		last = now;
		if (spawnLeft > 0) {
			const n = Math.min(spawnLeft, 130 * dt);
			spawn(Math.round(n + (Math.random() < n % 1 ? 1 : 0)));
			spawnLeft -= 130 * dt;
		}
		step(dt, now);
		if (melting) {
			let any = false;
			for (const l of ledges) for (let i = 0; i < l.h.length; i++) if (l.h[i] > 0) { l.h[i] = Math.max(0, l.h[i] - 0.5 * dt); any = true; }
			if (!any) melting = false;
		}
		draw();
		globe.classList.toggle("is-snowing", flakes.length > 0 || spawnLeft > 0);
		if (flakes.length || spawnLeft > 0 || melting) {
			idleSince = 0;
			raf = requestAnimationFrame(frame);
		} else {
			last = 0;
			idleSince = now;
			bindScroll();
			setTimeout(() => meltLater(now), 22000);
		}
	}
	const start = () => { raf ||= requestAnimationFrame(frame); };

	let meltTimer = 0;
	function meltLater() {
		clearTimeout(meltTimer);
		meltTimer = setTimeout(() => {
			if (!flakes.length && !spawnLeft && hasSnow()) { melting = true; start(); }
		}, 1);
	}

	function bindScroll() {
		if (scrollBound) return;
		scrollBound = true;
		root.addEventListener("scroll", onScroll, { passive: true });
	}
	let scrollRaf = 0;
	function onScroll() {
		if (raf || scrollRaf) return;
		scrollRaf = requestAnimationFrame(() => { scrollRaf = 0; draw(); });
	}
	function onResize() { size(); measure(); draw(); }
	addEventListener("resize", onResize);

	function staticSnow() {
		for (const l of ledges) {
			for (let k = 0; k < l.h.length / 4; k++) addSnow(l, l.x0 + Math.random() * (l.x1 - l.x0));
		}
		bindScroll();
		draw();
	}

	size();
	return {
		shake() {
			measure();
			if (reduced) {
				for (const l of ledges) l.h.fill(0);
				staticSnow();
				return;
			}
			melting = false;
			spawnLeft = Math.min(spawnLeft + 6.5, 12);
			spawn(50, true);
			spawn(170, false, true);
			start();
		},
		destroy() {
			cancelAnimationFrame(raf);
			cancelAnimationFrame(scrollRaf);
			clearTimeout(meltTimer);
			removeEventListener("resize", onResize);
			root.removeEventListener("scroll", onScroll);
			canvas.remove();
			void idleSince;
		},
	};
}

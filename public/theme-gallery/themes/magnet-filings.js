// Thousands of iron filings on a fixed canvas. Each filing is a tiny rigid body (position + angle):
// torque aligns it with the dipole field of bar magnets, a gradient force pulls it toward the poles
// once it beats static friction, and a spatial hash keeps clumps from collapsing to a point.

const STEP = 1 / 60;
const R0 = 110; // field normalisation radius
const SOFT = 12; // pole softening
const MU = 0.18; // static friction threshold
const MIN_DIST = 5.4;
const NEAR = 150;
const CELL = 6;

export function activate({ root, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-b");
	if (!scenery || !overlay) return undefined;

	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	scenery.append(canvas);
	const ctx = canvas.getContext("2d", { alpha: true });

	const css = getComputedStyle(root);
	const iron = css.getPropertyValue("--mfIron").trim().split(/\s+/).join(",") || "52,56,68";
	const dark = document.documentElement.classList.contains("dark");
	const colN = css.getPropertyValue("--mfN").trim() || "#e5484d";
	const colS = css.getPropertyValue("--mfS").trim() || "#3d78f7";

	// ---- paper grain (baked once) ----
	{
		const g = document.createElement("canvas");
		g.width = g.height = 128;
		const gc = g.getContext("2d");
		const img = gc.createImageData(128, 128);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = 200 + Math.random() * 55;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
			img.data[i + 3] = 255;
		}
		gc.putImageData(img, 0, 0);
		root.style.setProperty("--mfGrain", `url(${g.toDataURL("image/png")})`);
	}

	let width = 0;
	let height = 0;
	let dpr = 1;
	let count = 0;
	let fx;
	let fy;
	let fa;
	let fl;
	let fs; // strength bucket
	let fnear;
	let grid;
	let gridNext;
	let gridW = 0;
	let gridH = 0;

	function fit() {
		const rect = root.getBoundingClientRect();
		width = Math.round(rect.width);
		height = Math.round(rect.height);
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		gridW = Math.ceil(width / CELL) + 1;
		gridH = Math.ceil(height / CELL) + 1;
		grid = new Int32Array(gridW * gridH);
	}

	function scatter() {
		fit();
		count = Math.max(1500, Math.min(6500, Math.round((width * height) / 140)));
		fx = new Float32Array(count);
		fy = new Float32Array(count);
		fa = new Float32Array(count);
		fl = new Float32Array(count);
		fs = new Uint8Array(count);
		fnear = new Uint8Array(count);
		gridNext = new Int32Array(count);
		// stratified jitter so the dust looks even
		const cols = Math.ceil(Math.sqrt((count * width) / height));
		const rows = Math.ceil(count / cols);
		for (let i = 0; i < count; i++) {
			const c = i % cols;
			const r = Math.floor(i / cols);
			fx[i] = ((c + Math.random()) / cols) * width;
			fy[i] = ((r + Math.random()) / rows) * height;
			fa[i] = Math.random() * Math.PI;
			fl[i] = 8 + Math.random() * 5;
		}
	}

	// ---- magnets ----
	const cursor = { x: width * 0.72, y: height * 0.32, angle: -0.35, tx: 0, ty: 0, vx: 0, vy: 0, on: true, half: 40, q: 1 };
	const placed = [];
	const MAX_PLACED = 4;
	let shake = 0;
	let pointerSeen = false;
	let lastMoveAt = 0;
	let magnetsMoved = true;

	const polesX = new Float32Array(2 * (MAX_PLACED + 1));
	const polesY = new Float32Array(2 * (MAX_PLACED + 1));
	const polesQ = new Float32Array(2 * (MAX_PLACED + 1));
	let poleCount = 0;

	function rebuildPoles() {
		poleCount = 0;
		const all = cursor.on ? [cursor, ...placed] : placed;
		for (const m of all) {
			const cx = Math.cos(m.angle) * m.half;
			const cy = Math.sin(m.angle) * m.half;
			polesX[poleCount] = m.x + cx;
			polesY[poleCount] = m.y + cy;
			polesQ[poleCount++] = m.q;
			polesX[poleCount] = m.x - cx;
			polesY[poleCount] = m.y - cy;
			polesQ[poleCount++] = -m.q;
		}
	}

	// ---- sprites ----
	function makeMagnetSprite() {
		const w = 76;
		const h = 34;
		const s = 2;
		const c = document.createElement("canvas");
		c.width = (w + 24) * s;
		c.height = (h + 24) * s;
		const g = c.getContext("2d");
		g.scale(s, s);
		g.translate(12, 12);
		g.shadowColor = "rgba(0,0,0,0.35)";
		g.shadowBlur = 8;
		g.shadowOffsetY = 4;
		g.fillStyle = colN;
		g.beginPath();
		g.roundRect(0, 0, w / 2 + 1, h, [6, 0, 0, 6]);
		g.fill();
		g.fillStyle = colS;
		g.beginPath();
		g.roundRect(w / 2, 0, w / 2, h, [0, 6, 6, 0]);
		g.fill();
		g.shadowColor = "transparent";
		const shine = g.createLinearGradient(0, 0, 0, h);
		shine.addColorStop(0, "rgba(255,255,255,0.5)");
		shine.addColorStop(0.4, "rgba(255,255,255,0.06)");
		shine.addColorStop(1, "rgba(0,0,0,0.28)");
		g.fillStyle = shine;
		g.beginPath();
		g.roundRect(0, 0, w, h, 6);
		g.fill();
		g.fillStyle = "rgba(255,255,255,0.9)";
		g.font = "700 15px 'IBM Plex Mono', monospace";
		g.textAlign = "center";
		g.textBaseline = "middle";
		g.fillText("N", w * 0.25, h / 2 + 1);
		g.fillText("S", w * 0.75, h / 2 + 1);
		g.strokeStyle = "rgba(0,0,0,0.25)";
		g.lineWidth = 1;
		g.beginPath();
		g.roundRect(0.5, 0.5, w - 1, h - 1, 6);
		g.stroke();
		return { c, w, h, s };
	}
	const sprite = makeMagnetSprite();

	// ---- simulation ----
	let maxChange = 1;

	function step(dt) {
		// cursor magnet follows the pointer with a little inertia
		if (cursor.on) {
			const k = 1 - Math.exp(-dt * (reducedMotion ? 40 : 16));
			const ox = cursor.x;
			const oy = cursor.y;
			cursor.x += (cursor.tx - cursor.x) * k;
			cursor.y += (cursor.ty - cursor.y) * k;
			const mvx = (cursor.x - ox) / dt;
			const mvy = (cursor.y - oy) / dt;
			const sp = Math.hypot(mvx, mvy);
			if (sp > 40) {
				const target = Math.atan2(mvy, mvx);
				let d = target - cursor.angle;
				d -= Math.PI * 2 * Math.round(d / (Math.PI * 2));
				cursor.angle += d * (1 - Math.exp(-dt * 7));
			}
			magnetsMoved = sp > 4 || magnetsMoved;
		}
		rebuildPoles();

		const mu = MU * (1 - 0.92 * shake);
		let change = 0;
		const fieldScale = R0 * R0;
		let anyNear = false;
		for (let i = 0; i < count; i++) {
			const x = fx[i];
			const y = fy[i];
			let bx = 0;
			let by = 0;
			let ax = 0;
			let ay = 0;
			let nearest = 1e9;
			for (let p = 0; p < poleCount; p++) {
				const dx = x - polesX[p];
				const dy = y - polesY[p];
				const r2 = dx * dx + dy * dy + SOFT * SOFT;
				const inv = 1 / (r2 * Math.sqrt(r2));
				bx += polesQ[p] * dx * inv;
				by += polesQ[p] * dy * inv;
				const pull = (fieldScale / r2) / Math.sqrt(r2);
				ax -= dx * pull;
				ay -= dy * pull;
				if (r2 < nearest) nearest = r2;
			}
			const bm = Math.hypot(bx, by);
			const strength = bm * fieldScale;
			const b = strength > 1.5 ? 3 : strength > 0.5 ? 2 : strength > 0.15 ? 1 : 0;
			fs[i] = b;

			// torque: align with the local field (a filing is a line: mod pi)
			if (bm > 0) {
				const target = Math.atan2(by, bx);
				let d = target - fa[i];
				d -= Math.PI * Math.round(d / Math.PI);
				const rate = reducedMotion ? 1 : 1 - Math.exp(-dt * (0.7 + 34 * Math.min(strength, 3)));
				d *= rate;
				fa[i] += d;
				change += Math.abs(d);
			}
			if (shake > 0.02) {
				fa[i] += (Math.random() - 0.5) * shake * 0.5;
				fx[i] += (Math.random() - 0.5) * shake * 2.2;
				fy[i] += (Math.random() - 0.5) * shake * 2.2;
				change += 1;
			}

			// force: slides only when it beats friction
			const fm = Math.hypot(ax, ay);
			if (fm > mu && !(reducedMotion && !pointerSeen)) {
				let speed = Math.min(900, (fm - mu) * 220);
				const toPole = Math.sqrt(nearest);
				const move = Math.min(speed * dt, Math.max(0, toPole - 3));
				const nx = ax / fm;
				const ny = ay / fm;
				fx[i] += nx * move;
				fy[i] += ny * move;
				change += move;
			}
			const isNear = nearest < NEAR * NEAR;
			fnear[i] = isNear ? 1 : 0;
			if (isNear) anyNear = true;
		}

		if (anyNear) {
			grid.fill(-1);
			for (let i = 0; i < count; i++) {
				if (!fnear[i]) continue;
				const cx = Math.max(0, Math.min(gridW - 1, (fx[i] / CELL) | 0));
				const cy = Math.max(0, Math.min(gridH - 1, (fy[i] / CELL) | 0));
				const key = cy * gridW + cx;
				gridNext[i] = grid[key];
				grid[key] = i;
			}
			for (let i = 0; i < count; i++) {
				if (!fnear[i]) continue;
				const cx = (fx[i] / CELL) | 0;
				const cy = (fy[i] / CELL) | 0;
				for (let oy = -1; oy <= 1; oy++) {
					const yy = cy + oy;
					if (yy < 0 || yy >= gridH) continue;
					for (let ox = -1; ox <= 1; ox++) {
						const xx = cx + ox;
						if (xx < 0 || xx >= gridW) continue;
						let j = grid[yy * gridW + xx];
						while (j !== -1) {
							if (j > i) {
								const dx = fx[j] - fx[i];
								const dy = fy[j] - fy[i];
								const d2 = dx * dx + dy * dy;
								if (d2 < MIN_DIST * MIN_DIST) {
									const d = Math.sqrt(d2) || 0.001;
									const push = ((MIN_DIST - d) / d) * 0.5;
									const ux = d2 === 0 ? Math.random() - 0.5 : dx;
									const uy = d2 === 0 ? Math.random() - 0.5 : dy;
									fx[i] -= ux * push;
									fy[i] -= uy * push;
									fx[j] += ux * push;
									fy[j] += uy * push;
									change += 0.5;
								}
							}
							j = gridNext[j];
						}
					}
				}
			}
		}
		shake = Math.max(0, shake - dt * 0.9);
		maxChange = change / count;
	}

	// ---- drawing ----
	const alphas = dark ? [0.16, 0.3, 0.52, 0.85] : [0.2, 0.36, 0.6, 0.88];
	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		// pole glows
		for (let p = 0; p < poleCount; p++) {
			const g = ctx.createRadialGradient(polesX[p], polesY[p], 0, polesX[p], polesY[p], 90);
			const col = polesQ[p] > 0 ? "229,72,77" : "61,120,247";
			g.addColorStop(0, `rgba(${col},${dark ? 0.28 : 0.2})`);
			g.addColorStop(1, `rgba(${col},0)`);
			ctx.fillStyle = g;
			ctx.fillRect(polesX[p] - 90, polesY[p] - 90, 180, 180);
		}

		// magnets sit under the paper; the dust lies on top
		const all = cursor.on ? [cursor, ...placed] : placed;
		for (const m of all) {
			ctx.save();
			ctx.translate(m.x, m.y);
			ctx.rotate(m.angle);
			ctx.drawImage(sprite.c, -(sprite.w + 24) / 2, -(sprite.h + 24) / 2, sprite.w + 24, sprite.h + 24);
			ctx.restore();
		}
		ctx.lineCap = "round";
		ctx.lineWidth = 1.35;
		for (let b = 0; b < 4; b++) {
			ctx.strokeStyle = `rgba(${iron},${alphas[b]})`;
			ctx.beginPath();
			for (let i = 0; i < count; i++) {
				if (fs[i] !== b) continue;
				const h = fl[i] * 0.5 * (b === 3 ? 1.25 : 1);
				const c = Math.cos(fa[i]) * h;
				const s = Math.sin(fa[i]) * h;
				ctx.moveTo(fx[i] - c, fy[i] - s);
				ctx.lineTo(fx[i] + c, fy[i] + s);
			}
			ctx.stroke();
		}

	}

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let calmFrames = 0;
	let hintGone = false;

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(0.1, (now - last) / 1000);
		last = now;
		let steps = 0;
		while (acc >= STEP && steps < 3) {
			step(STEP);
			acc -= STEP;
			steps++;
		}
		draw();
		const idle = maxChange < 0.0008 && shake <= 0.02 && performance.now() - lastMoveAt > 200;
		calmFrames = idle ? calmFrames + 1 : 0;
		if (calmFrames > 20) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function wake() {
		calmFrames = 0;
		if (running || document.hidden) return;
		running = true;
		last = performance.now();
		acc = 0;
		raf = requestAnimationFrame(frame);
	}

	function stop() {
		running = false;
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
	}

	function relaxInstantly() {
		// reduced motion: align every filing to the field once, no travel
		rebuildPoles();
		const save = reducedMotion;
		step(STEP);
		maxChange = 0;
		draw();
		void save;
	}

	// ---- controls ----
	const controls = document.createElement("div");
	controls.className = "mf-controls";
	const hint = document.createElement("span");
	hint.className = "mf-hint";
	hint.textContent = "Move the cursor: it is the magnet";
	const bCursor = button("Cursor magnet", "");
	bCursor.setAttribute("aria-pressed", "true");
	const bPlace = button("Place magnet", "P");
	const bTap = button("Tap table", "X");
	const bReset = button("Reset", "");
	controls.append(hint, bCursor, bPlace, bTap, bReset);
	overlay.append(controls);

	function button(label, key) {
		const el = document.createElement("button");
		el.type = "button";
		el.className = "mf-btn";
		el.append(label);
		if (key) {
			const kbd = document.createElement("kbd");
			kbd.textContent = key;
			el.append(kbd);
		}
		return el;
	}

	function dismissHint() {
		if (hintGone) return;
		hintGone = true;
		hint.classList.add("is-gone");
	}

	function placeMagnet(x, y) {
		if (placed.length >= MAX_PLACED) placed.shift();
		placed.push({
			x,
			y,
			angle: -0.6 + (placed.length % 2 ? 2.2 : 0) + (Math.random() - 0.5) * 0.6,
			half: 40,
			q: 0.9,
		});
		magnetsMoved = true;
		dismissHint();
		wake();
	}

	bCursor.addEventListener("click", () => {
		cursor.on = !cursor.on;
		bCursor.setAttribute("aria-pressed", String(cursor.on));
		magnetsMoved = true;
		wake();
	});
	bPlace.addEventListener("click", () => {
		placeMagnet(width * (0.22 + Math.random() * 0.56), height * (0.25 + Math.random() * 0.5));
	});
	bTap.addEventListener("click", tap);
	bReset.addEventListener("click", () => {
		placed.length = 0;
		cursor.on = true;
		bCursor.setAttribute("aria-pressed", "true");
		scatter();
		cursor.x = cursor.tx = width * 0.72;
		cursor.y = cursor.ty = height * 0.32;
		cursor.angle = -0.35;
		if (reducedMotion) relaxInstantly();
		wake();
	});

	function tap() {
		shake = reducedMotion ? 0.4 : 1;
		dismissHint();
		wake();
	}

	// ---- pointer / keys ----
	let rect = root.getBoundingClientRect();
	function onMove(event) {
		cursor.tx = event.clientX - rect.left;
		cursor.ty = event.clientY - rect.top;
		if (!pointerSeen) {
			pointerSeen = true;
			cursor.x = cursor.tx;
			cursor.y = cursor.ty;
		}
		lastMoveAt = performance.now();
		if (cursor.on) wake();
		if (pointerSeen && !hintGone && performance.now() > 4000) dismissHint();
	}

	function onKey(event) {
		const t = event.target;
		if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		if (event.key === "p" || event.key === "P") {
			event.preventDefault();
			placeMagnet(cursor.tx || cursor.x, cursor.ty || cursor.y);
		} else if (event.key === "x" || event.key === "X") {
			event.preventDefault();
			tap();
		}
	}

	function onResize() {
		rect = root.getBoundingClientRect();
		const oldW = width;
		const oldH = height;
		fit();
		if (oldW && oldH) {
			const sx = width / oldW;
			const sy = height / oldH;
			for (let i = 0; i < count; i++) {
				fx[i] *= sx;
				fy[i] *= sy;
			}
			for (const m of [cursor, ...placed]) {
				m.x *= sx;
				m.y *= sy;
			}
			cursor.tx *= sx;
			cursor.ty *= sy;
		}
		draw();
		wake();
	}

	function onVisibility() {
		if (document.hidden) stop();
		else wake();
	}

	scatter();
	cursor.x = cursor.tx = width * 0.72;
	cursor.y = cursor.ty = height * 0.32;
	if (reducedMotion) {
		cursor.on = true;
		relaxInstantly();
	} else {
		wake();
	}

	window.addEventListener("pointermove", onMove, { passive: true });
	window.addEventListener("keydown", onKey);
	window.addEventListener("resize", onResize);
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		stop();
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("keydown", onKey);
		window.removeEventListener("resize", onResize);
		document.removeEventListener("visibilitychange", onVisibility);
	};
}

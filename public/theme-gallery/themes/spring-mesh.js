// A real mass-spring mesh: structural + shear springs with pretension, pinned at the viewport
// border, integrated with symplectic Euler at a fixed 120 Hz. The pointer presses a Gaussian dent
// into it, links pluck it on hover, clicks drop ripples. When the energy is gone, the loop stops.

const DT = 1 / 120;
const K = 850; // spring constant (unit mass)
const PRESTRESS = 0.8; // rest length / lattice spacing (under tension)
const ANCHOR = 5; // weak pull back toward the lattice
const Z_SHIFT = 0.62; // how far depth moves a node on screen

export function activate({ root, reducedMotion }) {
	const scenery = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-b");
	if (!scenery || !overlay) return undefined;

	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	scenery.append(canvas);
	const ctx = canvas.getContext("2d");

	const css = getComputedStyle(root);
	const rgb = (name, fallback) => css.getPropertyValue(name).trim().split(/\s+/).join(",") || fallback;
	const lineRGB = rgb("--meshLine", "38,52,120");
	const hotRGB = rgb("--meshHot", "40,70,230");
	const litRGB = rgb("--meshLit", "255,255,255");
	const shadeRGB = rgb("--meshShade", "20,30,90");
	const dark = document.documentElement.classList.contains("dark");

	let width = 0;
	let height = 0;
	let dpr = 1;
	let cols = 0;
	let rows = 0;
	let sp = 36;
	let n = 0;
	let X, Y, Z, VX, VY, VZ, RX, RY, FX, FY, FZ, pinned;
	let L1 = 0;
	let L2 = 0;

	function build() {
		const rect = root.getBoundingClientRect();
		width = Math.round(rect.width);
		height = Math.round(rect.height);
		dpr = Math.min(1.5, window.devicePixelRatio || 1);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		canvas.style.width = `${width}px`;
		canvas.style.height = `${height}px`;
		sp = Math.max(34, Math.sqrt((width * height) / 1000));
		cols = Math.ceil(width / sp) + 3;
		rows = Math.ceil(height / sp) + 3;
		n = cols * rows;
		X = new Float32Array(n);
		Y = new Float32Array(n);
		Z = new Float32Array(n);
		VX = new Float32Array(n);
		VY = new Float32Array(n);
		VZ = new Float32Array(n);
		RX = new Float32Array(n);
		RY = new Float32Array(n);
		FX = new Float32Array(n);
		FY = new Float32Array(n);
		FZ = new Float32Array(n);
		pinned = new Uint8Array(n);
		const ox = (width - (cols - 3) * sp) / 2 - sp;
		const oy = (height - (rows - 3) * sp) / 2 - sp;
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				RX[i] = X[i] = ox + c * sp;
				RY[i] = Y[i] = oy + r * sp;
				if (r === 0 || c === 0 || r === rows - 1 || c === cols - 1) pinned[i] = 1;
			}
		}
		L1 = sp * PRESTRESS;
		L2 = sp * Math.SQRT2 * PRESTRESS;
	}

	// ---- input ----
	const pointer = { x: -999, y: -999, in: false, lastMove: 0 };
	const DENT = 26000;
	const DENT_R = 100;
	let gamma = reducedMotion ? 14 : 2.4;
	let hot = false;

	function spring(a, b, rest) {
		const dx = X[b] - X[a];
		const dy = Y[b] - Y[a];
		const dz = Z[b] - Z[a];
		const len = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
		const f = (K * (len - rest)) / len;
		const fx = dx * f;
		const fy = dy * f;
		const fz = dz * f;
		FX[a] += fx;
		FY[a] += fy;
		FZ[a] += fz;
		FX[b] -= fx;
		FY[b] -= fy;
		FZ[b] -= fz;
	}

	function step() {
		FX.fill(0);
		FY.fill(0);
		FZ.fill(0);
		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols; c++) {
				const i = r * cols + c;
				if (c < cols - 1) spring(i, i + 1, L1);
				spring(i, i + cols, L1);
				if (c < cols - 1) spring(i, i + cols + 1, L2);
				if (c > 0) spring(i, i + cols - 1, L2);
			}
		}
		// last row horizontals
		for (let c = 0; c < cols - 1; c++) spring((rows - 1) * cols + c, (rows - 1) * cols + c + 1, L1);

		// pointer dent
		if (pointer.in) {
			const R2 = DENT_R * DENT_R;
			const c0 = Math.max(1, Math.floor((pointer.x - DENT_R) / sp) + 1);
			const c1 = Math.min(cols - 2, Math.ceil((pointer.x + DENT_R) / sp) + 2);
			const r0 = Math.max(1, Math.floor((pointer.y - DENT_R) / sp) + 1);
			const r1 = Math.min(rows - 2, Math.ceil((pointer.y + DENT_R) / sp) + 2);
			for (let r = r0; r <= r1; r++) {
				for (let c = c0; c <= c1; c++) {
					const i = r * cols + c;
					const dx = X[i] - pointer.x;
					const dy = Y[i] - pointer.y;
					const d2 = dx * dx + dy * dy;
					if (d2 > R2) continue;
					const g = 1 - d2 / R2;
					FZ[i] -= DENT * g * g;
				}
			}
		}

		let energy = 0;
		const damp = Math.exp(-gamma * DT);
		for (let i = 0; i < n; i++) {
			if (pinned[i]) continue;
			VX[i] = (VX[i] + (FX[i] + ANCHOR * (RX[i] - X[i])) * DT) * damp;
			VY[i] = (VY[i] + (FY[i] + ANCHOR * (RY[i] - Y[i])) * DT) * damp;
			VZ[i] = (VZ[i] + (FZ[i] - ANCHOR * Z[i]) * DT) * damp;
			X[i] += VX[i] * DT;
			Y[i] += VY[i] * DT;
			Z[i] += VZ[i] * DT;
			if (Z[i] > 90) {
				Z[i] = 90;
				VZ[i] = 0;
			} else if (Z[i] < -90) {
				Z[i] = -90;
				VZ[i] = 0;
			}
			energy += VX[i] * VX[i] + VY[i] * VY[i] + VZ[i] * VZ[i];
		}
		return energy / n;
	}

	// ---- impulses ----
	function impulse(cx, cy, radius, strength) {
		const R2 = radius * radius;
		for (let i = 0; i < n; i++) {
			if (pinned[i]) continue;
			const dx = RX[i] - cx;
			const dy = RY[i] - cy;
			const d2 = dx * dx + dy * dy;
			if (d2 > R2) continue;
			const g = 1 - d2 / R2;
			VZ[i] += strength * g * g;
		}
		wake();
	}

	function pluck(rect) {
		const pad = 14;
		const x0 = rect.left - pad;
		const x1 = rect.right + pad;
		const y0 = rect.top - pad;
		const y1 = rect.bottom + pad;
		for (let i = 0; i < n; i++) {
			if (pinned[i]) continue;
			if (RX[i] < x0 || RX[i] > x1 || RY[i] < y0 || RY[i] > y1) continue;
			VZ[i] -= 520;
		}
		// a ring of opposite sign makes it feel like a string being plucked, not just pressed
		wake();
	}

	// ---- drawing ----
	const idx = (r, c) => r * cols + c;
	const sx = (i) => X[i];
	const sy = (i) => Y[i] - Z[i] * Z_SHIFT;

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, width, height);

		// lighting: quads facing the light (upper left) get brighter, away ones darker
		const lits = [new Path2D(), new Path2D(), new Path2D()];
		const shades = [new Path2D(), new Path2D(), new Path2D()];
		const used = [false, false, false];
		for (let r = 0; r < rows - 1; r++) {
			for (let c = 0; c < cols - 1; c++) {
				const a = idx(r, c);
				const b = a + 1;
				const d = a + cols;
				const e = d + 1;
				const slopeX = (Z[b] + Z[e] - Z[a] - Z[d]) * 0.5;
				const slopeY = (Z[d] + Z[e] - Z[a] - Z[b]) * 0.5;
				const light = -(slopeX + slopeY);
				const m = Math.abs(light);
				if (m < 1.5) continue;
				const k = m > 12 ? 2 : m > 5 ? 1 : 0;
				used[k] = true;
				const p = (light > 0 ? lits : shades)[k];
				p.moveTo(sx(a), sy(a));
				p.lineTo(sx(b), sy(b));
				p.lineTo(sx(e), sy(e));
				p.lineTo(sx(d), sy(d));
				p.closePath();
			}
		}
		const litA = dark ? [0.03, 0.06, 0.1] : [0.25, 0.4, 0.6];
		const shadeA = dark ? [0.12, 0.2, 0.3] : [0.025, 0.05, 0.085];
		for (let k = 0; k < 3; k++) {
			if (!used[k]) continue;
			ctx.fillStyle = `rgba(${litRGB},${litA[k]})`;
			ctx.fill(lits[k]);
			ctx.fillStyle = `rgba(${shadeRGB},${shadeA[k]})`;
			ctx.fill(shades[k]);
		}

		// base lattice, one polyline per row and column
		ctx.lineJoin = "round";
		ctx.lineWidth = 1;
		ctx.strokeStyle = `rgba(${lineRGB},${dark ? 0.2 : 0.2})`;
		ctx.beginPath();
		for (let r = 0; r < rows; r++) {
			ctx.moveTo(sx(idx(r, 0)), sy(idx(r, 0)));
			for (let c = 1; c < cols; c++) ctx.lineTo(sx(idx(r, c)), sy(idx(r, c)));
		}
		for (let c = 0; c < cols; c++) {
			ctx.moveTo(sx(idx(0, c)), sy(idx(0, c)));
			for (let r = 1; r < rows; r++) ctx.lineTo(sx(idx(r, c)), sy(idx(r, c)));
		}
		ctx.stroke();

		// excited segments glow in three buckets
		const buckets = [new Path2D(), new Path2D(), new Path2D()];
		const hit = [false, false, false];
		const seg = (a, b) => {
			const m = Math.abs(Z[a]) + Math.abs(Z[b]);
			if (m < 5) return;
			const k = m > 40 ? 2 : m > 16 ? 1 : 0;
			buckets[k].moveTo(sx(a), sy(a));
			buckets[k].lineTo(sx(b), sy(b));
			hit[k] = true;
		};
		for (let r = 0; r < rows; r++) {
			for (let c = 0; c < cols; c++) {
				const i = idx(r, c);
				if (c < cols - 1) seg(i, i + 1);
				if (r < rows - 1) seg(i, i + cols);
			}
		}
		const widths = [1.1, 1.5, 2];
		const alphas = [0.4, 0.65, 0.95];
		for (let k = 0; k < 3; k++) {
			if (!hit[k]) continue;
			ctx.lineWidth = widths[k];
			ctx.strokeStyle = `rgba(${hotRGB},${alphas[k]})`;
			ctx.stroke(buckets[k]);
		}

		// nodes
		ctx.fillStyle = `rgba(${lineRGB},${dark ? 0.55 : 0.5})`;
		ctx.beginPath();
		for (let r = 1; r < rows - 1; r++) {
			for (let c = 1; c < cols - 1; c++) {
				const i = idx(r, c);
				const px = sx(i);
				const py = sy(i);
				ctx.rect(px - 1.1, py - 1.1, 2.2, 2.2);
			}
		}
		ctx.fill();
		ctx.fillStyle = `rgba(${hotRGB},0.95)`;
		ctx.beginPath();
		for (let r = 1; r < rows - 1; r++) {
			for (let c = 1; c < cols - 1; c++) {
				const i = idx(r, c);
				if (Math.abs(Z[i]) < 14) continue;
				const rad = 1.6 + Math.min(2.4, Math.abs(Z[i]) / 18);
				ctx.rect(sx(i) - rad, sy(i) - rad, rad * 2, rad * 2);
			}
		}
		ctx.fill();
	}

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let calm = 0;

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		let energy = 0;
		let steps = 0;
		while (acc >= DT && steps < 4) {
			energy = step();
			acc -= DT;
			steps++;
		}
		draw();
		const pointerBusy = pointer.in && now - pointer.lastMove < 500;
		calm = energy < 0.02 && !pointerBusy ? calm + 1 : 0;
		if (calm > 15) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function wake() {
		calm = 0;
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

	// ---- controls ----
	const controls = document.createElement("div");
	controls.className = "sm-controls";
	const hint = document.createElement("span");
	hint.className = "sm-hint";
	hint.textContent = "Move across the mesh · hover links to pluck · click for a ripple";
	const calmButton = document.createElement("button");
	calmButton.type = "button";
	calmButton.className = "sm-btn";
	calmButton.textContent = "Calm the mesh";
	controls.append(hint, calmButton);
	overlay.append(controls);
	let hintTimer = setTimeout(() => hint.classList.add("is-gone"), 9000);

	calmButton.addEventListener("click", () => {
		for (let i = 0; i < n; i++) {
			X[i] = RX[i];
			Y[i] = RY[i];
			Z[i] = 0;
			VX[i] = VY[i] = VZ[i] = 0;
		}
		draw();
		wake();
	});

	// ---- events ----
	let rect = root.getBoundingClientRect();
	function onMove(event) {
		pointer.x = event.clientX - rect.left;
		pointer.y = event.clientY - rect.top;
		pointer.in = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= width && pointer.y <= height && event.pointerType !== "touch";
		pointer.lastMove = performance.now();
		if (pointer.in) wake();
	}

	function onDown(event) {
		if (event.target.closest?.(".sm-controls")) return;
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		impulse(x, y, 150, reducedMotion ? -500 : -1500);
		if (event.pointerType === "touch") {
			pointer.x = x;
			pointer.y = y;
			pointer.in = false;
		}
	}

	function onLeave() {
		pointer.in = false;
		wake();
	}

	function onOver(event) {
		const link = event.target.closest?.("a");
		if (!link || !root.contains(link) || link.closest(".sm-controls")) return;
		const r = link.getBoundingClientRect();
		pluck({ left: r.left - rect.left, right: r.right - rect.left, top: r.top - rect.top, bottom: r.bottom - rect.top });
	}

	function onResize() {
		rect = root.getBoundingClientRect();
		build();
		draw();
	}

	function onScrollOrVis() {
		if (document.hidden) stop();
		else wake();
	}

	let dropTimer = 0;
	function scheduleDrop() {
		dropTimer = setTimeout(
			() => {
				if (!document.hidden) {
					const x = width * (0.1 + Math.random() * 0.8);
					const y = height * (0.1 + Math.random() * 0.8);
					impulse(x, y, 70, -1100);
				}
				scheduleDrop();
			},
			4500 + Math.random() * 5000,
		);
	}

	build();
	draw();
	if (!reducedMotion) {
		setTimeout(() => impulse(width * 0.5, height * 0.38, 120, -1600), 450);
		scheduleDrop();
	}

	window.addEventListener("pointermove", onMove, { passive: true });
	window.addEventListener("pointerdown", onDown);
	document.documentElement.addEventListener("pointerleave", onLeave);
	root.addEventListener("pointerover", onOver);
	window.addEventListener("resize", onResize);
	document.addEventListener("visibilitychange", onScrollOrVis);

	return () => {
		stop();
		clearTimeout(dropTimer);
		clearTimeout(hintTimer);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		document.documentElement.removeEventListener("pointerleave", onLeave);
		window.removeEventListener("resize", onResize);
		document.removeEventListener("visibilitychange", onScrollOrVis);
	};
}

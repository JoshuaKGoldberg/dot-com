// Talk Billiards: circle-circle elastic collisions (restitution 0.96), cushion bounces, rolling
// friction, pockets and a 3D-ish rolling number disc, integrated at a fixed 240 Hz. The four talks
// are real <li>/<a> elements that ride on the balls; the rest of the rack is decorative.

const DT = 1 / 240;
const REST_BALL = 0.96;
const REST_WALL = 0.8;
const RACK = [[1], [6, 2], [7, 3, 8], [9, 4, 10, 5]];
const COLORS = {
	1: "#2f7be0",
	2: "#e8503e",
	3: "#e9a81c",
	4: "#1fa97f",
	5: "#8b5bd6",
	6: "#d9468f",
	7: "#e5722a",
	8: "#2b3a55",
	9: "#6ab04c",
	10: "#14a3b8",
	0: "#f7f4ea",
};

export function activate({ root, reducedMotion }) {
	const section = root.querySelector(".site-talks");
	const list = section?.querySelector(".site-list");
	if (!section || !list) return undefined;
	const talks = [...list.querySelectorAll(".site-item")];

	// ---- DOM ----
	const wrap = document.createElement("div");
	wrap.className = "bl-wrap";
	const table = document.createElement("div");
	table.className = "bl-table";
	table.setAttribute("role", "group");
	table.setAttribute("aria-label", "Billiards table. Drag back from the white ball and release to shoot.");
	const felt = document.createElement("div");
	felt.className = "bl-felt";
	table.append(felt);
	const canvas = document.createElement("canvas");
	canvas.className = "bl-canvas";
	canvas.setAttribute("aria-hidden", "true");
	const ctx = canvas.getContext("2d");
	const ballsEl = document.createElement("ul");
	ballsEl.className = "bl-balls";
	const cueEl = document.createElement("div");
	cueEl.className = "bl-cue";
	cueEl.setAttribute("aria-hidden", "true");

	const legend = document.createElement("ol");
	legend.className = "bl-legend";
	legend.setAttribute("aria-hidden", "true");
	const bar = document.createElement("div");
	bar.className = "bl-bar";
	const status = document.createElement("span");
	status.className = "bl-status";
	status.setAttribute("role", "status");
	const hint = document.createElement("p");
	hint.className = "bl-hint";
	hint.textContent = "Drag back from the white ball and let go to shoot.";
	const btns = document.createElement("div");
	btns.className = "bl-btns";
	const bBreak = mkBtn("Break", true);
	const bRack = mkBtn("Re-rack", false);
	btns.append(bBreak, bRack);
	bar.append(status, hint, btns);
	wrap.append(table, legend, bar);
	list.replaceWith(wrap);

	function mkBtn(label, ghost) {
		const b = document.createElement("button");
		b.type = "button";
		b.className = `bl-btn${ghost ? " is-ghost" : ""}`;
		b.textContent = label;
		return b;
	}

	// jump pill (the table lives far down the page)
	const overlayB = root.querySelector(".overlay-b");
	const jump = document.createElement("button");
	jump.type = "button";
	jump.className = "bl-jump";
	jump.textContent = "Pool table in Speaking ↓";
	if (overlayB) overlayB.append(jump);
	jump.addEventListener("click", () => {
		table.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "center" });
	});

	// ---- geometry ----
	let W = 640;
	let H = 320;
	let r = 15;
	let dpr = 1;
	let pockets = [];
	const pocketEls = [];

	function geometry() {
		const rail = parseFloat(getComputedStyle(table).paddingLeft) || 30;
		const avail = Math.min(704, root.clientWidth - 24);
		table.style.width = `${avail}px`;
		W = Math.round(avail - rail * 2);
		H = Math.round(W / 2);
		felt.style.height = `${H}px`;
		r = Math.max(10, Math.round(W / 43));
		felt.style.setProperty("--d", `${r * 2}px`);
		canvas.width = Math.round(W * dpr);
		canvas.height = Math.round(H * dpr);
		canvas.style.width = `${W}px`;
		canvas.style.height = `${H}px`;
		const corner = r * 0.55;
		const cr = r * 2.25;
		const sr = r * 1.7;
		pockets = [
			{ x: -corner, y: -corner, c: cr, v: cr * 0.66 },
			{ x: W + corner, y: -corner, c: cr, v: cr * 0.66 },
			{ x: -corner, y: H + corner, c: cr, v: cr * 0.66 },
			{ x: W + corner, y: H + corner, c: cr, v: cr * 0.66 },
			{ x: W / 2, y: -r * 0.35, c: sr, v: sr * 0.78 },
			{ x: W / 2, y: H + r * 0.35, c: sr, v: sr * 0.78 },
		];
		pockets.forEach((p, i) => {
			const el = pocketEls[i];
			el.style.width = el.style.height = `${p.v * 2}px`;
			el.style.left = `${p.x - p.v}px`;
			el.style.top = `${p.y - p.v}px`;
		});
	}

	for (let i = 0; i < 6; i++) {
		const el = document.createElement("div");
		el.className = "bl-pocket";
		el.setAttribute("aria-hidden", "true");
		felt.append(el);
		pocketEls.push(el);
	}
	for (const [fx, fy] of [[0.25, 0.5], [0.72, 0.5]]) {
		const s = document.createElement("div");
		s.className = "bl-spot";
		s.style.left = `${fx * 100}%`;
		s.style.top = `calc(${fy * 100}% - 2px)`;
		felt.append(s);
	}
	felt.append(canvas, ballsEl, cueEl);

	// felt grain, baked once
	{
		const g = document.createElement("canvas");
		g.width = g.height = 96;
		const gc = g.getContext("2d");
		const img = gc.createImageData(96, 96);
		for (let i = 0; i < img.data.length; i += 4) {
			const v = Math.random() * 255;
			img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
			img.data[i + 3] = 20;
		}
		gc.putImageData(img, 0, 0);
		root.style.setProperty("--bl-grain", `url(${g.toDataURL("image/png")})`);
	}

	// ---- balls ----
	const balls = [];

	function makeBall(num, el, kind) {
		const b = {
			num,
			el,
			kind,
			x: 0,
			y: 0,
			vx: 0,
			vy: 0,
			state: "live", // live | sinking | out
			t: 0,
			pocket: null,
			disc: null,
			n: [0, 0, 1],
			written: "",
			discWritten: "",
			scale: 1,
		};
		return b;
	}

	function buildBalls() {
		ballsEl.textContent = "";
		balls.length = 0;
		legend.textContent = "";
		const cueLi = document.createElement("li");
		cueLi.className = "bl-ball bl-cue-ball";
		cueLi.setAttribute("aria-hidden", "true");
		cueLi.style.setProperty("--bc", COLORS[0]);
		cueLi.innerHTML = '<span class="bl-body"><i class="bl-shine"></i></span>';
		ballsEl.append(cueLi);
		const cue = makeBall(0, cueLi, "cue");
		cue.n = [0, 0, 1];
		balls.push(cue);

		for (const row of RACK) {
			for (const num of row) {
				let el;
				let kind;
				if (num <= talks.length) {
					el = talks[num - 1];
					kind = "talk";
					el.className = "bl-ball bl-talk";
					const title = el.querySelector(".site-item-title");
					const desc = el.querySelector(".site-item-description")?.textContent ?? "";
					const metaText = el.querySelector(".site-item-meta")?.textContent ?? "";
					title.classList.add("bl-body");
					title.draggable = false;
					const name = document.createElement("span");
					name.className = "bl-name";
					const label = document.createElement("span");
					label.textContent = title.textContent;
					const sub = document.createElement("small");
					sub.textContent = `${desc} · ${metaText}`;
					name.append(label, sub);
					const text = title.textContent;
					title.textContent = "";
					const sr = document.createElement("span");
					sr.style.cssText = "position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap";
					sr.textContent = text;
					const disc = document.createElement("span");
					disc.className = "bl-num";
					disc.textContent = String(num);
					disc.setAttribute("aria-hidden", "true");
					const shine = document.createElement("i");
					shine.className = "bl-shine";
					title.append(sr, disc, shine, name);
					el.querySelector(".site-item-description")?.remove();
					el.querySelector(".site-item-meta")?.remove();
					el.style.setProperty("--bc", COLORS[num]);
					ballsEl.append(el);
					const ball = makeBall(num, el, "talk");
					ball.disc = disc;
					ball.n = randomFace();
					balls.push(ball);
					legendRow(num, title.querySelector("span").textContent, desc, metaText);
					continue;
				}
				el = document.createElement("li");
				el.className = "bl-ball";
				el.setAttribute("aria-hidden", "true");
				el.style.setProperty("--bc", COLORS[num]);
				el.innerHTML = `<span class="bl-body"><span class="bl-num">${num}</span><i class="bl-shine"></i></span>`;
				ballsEl.append(el);
				kind = "decor";
				const ball = makeBall(num, el, kind);
				ball.disc = el.querySelector(".bl-num");
				ball.n = randomFace();
				balls.push(ball);
			}
		}
	}

	function randomFace() {
		const a = Math.random() * Math.PI * 2;
		const z = 0.82 + Math.random() * 0.15;
		const s = Math.sqrt(1 - z * z);
		return [Math.cos(a) * s, Math.sin(a) * s, z];
	}

	function legendRow(num, title, desc, meta) {
		const li = document.createElement("li");
		li.dataset.num = String(num);
		li.style.setProperty("--bc", COLORS[num]);
		li.innerHTML = '<span class="bl-chip"></span><span><span class="t"></span><small></small></span>';
		li.querySelector(".bl-chip").textContent = String(num);
		li.querySelector(".t").textContent = title;
		li.querySelector("small").textContent = `${desc} · ${meta}`;
		legend.append(li);
	}

	function rack() {
		const foot = W * 0.72;
		const dx = r * Math.sqrt(3) + 0.6;
		const dy = r * 2 + 0.6;
		const placed = new Map();
		RACK.forEach((row, k) => {
			row.forEach((num, i) => {
				placed.set(num, [foot + k * dx, H / 2 + (i - (row.length - 1) / 2) * dy]);
			});
		});
		for (const b of balls) {
			b.vx = b.vy = 0;
			b.state = "live";
			b.scale = 1;
			b.el.hidden = false;
			b.el.style.opacity = "";
			if (b.num === 0) {
				b.x = W * 0.25;
				b.y = H / 2;
			} else {
				[b.x, b.y] = placed.get(b.num);
			}
			b.n = b.num === 0 ? [0, 0, 1] : randomFace();
		}
		respawnIn = 0;
		for (const li of legend.children) li.classList.remove("is-down");
		renderAll(true);
		updateStatus();
	}

	// ---- simulation ----
	let respawnIn = 0;
	let simBusy = false;

	function isMoving() {
		return balls.some((b) => b.state === "live" && (b.vx !== 0 || b.vy !== 0));
	}

	function stepSim() {
		// motion + friction
		for (const b of balls) {
			if (b.state === "sinking") {
				b.t += DT;
				if (b.t >= 0.28) {
					b.state = "out";
					b.el.hidden = true;
				}
				continue;
			}
			if (b.state !== "live") continue;
			if (b.vx === 0 && b.vy === 0) continue;
			b.x += b.vx * DT;
			b.y += b.vy * DT;
			let speed = Math.hypot(b.vx, b.vy);
			// rolling resistance: constant + proportional
			speed = speed * Math.exp(-0.38 * DT) - 70 * DT;
			if (speed < 7) {
				b.vx = b.vy = 0;
			} else {
				const k = speed / Math.hypot(b.vx, b.vy);
				b.vx *= k;
				b.vy *= k;
				// roll the number disc: surface velocity of the top equals v
				const w = speed / r;
				const ang = w * DT;
				const ax = -b.vy / speed;
				const ay = b.vx / speed;
				const [nx, ny, nz] = b.n;
				const c = Math.cos(ang);
				const s = Math.sin(ang);
				const dot = ax * nx + ay * ny;
				// Rodrigues, axis (ax, ay, 0)
				const cx = ay * nz;
				const cy = -ax * nz;
				const cz = ax * ny - ay * nx;
				const rx = nx * c + cx * s + ax * dot * (1 - c);
				const ry = ny * c + cy * s + ay * dot * (1 - c);
				const rz = nz * c + cz * s;
				b.n = [rx, ry, rz];
			}
			// pockets
			for (let i = 0; i < pockets.length; i++) {
				const p = pockets[i];
				if (Math.hypot(b.x - p.x, b.y - p.y) < p.c) {
					sink(b, p);
					break;
				}
			}
			if (b.state !== "live") continue;
			// cushions
			if (b.x < r) {
				b.x = r;
				b.vx = Math.abs(b.vx) * REST_WALL;
			} else if (b.x > W - r) {
				b.x = W - r;
				b.vx = -Math.abs(b.vx) * REST_WALL;
			}
			if (b.y < r) {
				b.y = r;
				b.vy = Math.abs(b.vy) * REST_WALL;
			} else if (b.y > H - r) {
				b.y = H - r;
				b.vy = -Math.abs(b.vy) * REST_WALL;
			}
		}

		// ball-ball
		for (let i = 0; i < balls.length; i++) {
			const a = balls[i];
			if (a.state !== "live") continue;
			for (let j = i + 1; j < balls.length; j++) {
				const b = balls[j];
				if (b.state !== "live") continue;
				if (a.vx === 0 && a.vy === 0 && b.vx === 0 && b.vy === 0) continue;
				let dx = b.x - a.x;
				let dy = b.y - a.y;
				const d2 = dx * dx + dy * dy;
				const min = r * 2;
				if (d2 >= min * min || d2 === 0) continue;
				const d = Math.sqrt(d2);
				dx /= d;
				dy /= d;
				const push = (min - d) / 2;
				a.x -= dx * push;
				a.y -= dy * push;
				b.x += dx * push;
				b.y += dy * push;
				const vn = (b.vx - a.vx) * dx + (b.vy - a.vy) * dy;
				if (vn < 0) {
					const jn = (-(1 + REST_BALL) * vn) / 2;
					a.vx -= jn * dx;
					a.vy -= jn * dy;
					b.vx += jn * dx;
					b.vy += jn * dy;
				}
			}
		}
	}

	function sink(b, p) {
		b.state = "sinking";
		b.t = 0;
		b.pocket = p;
		b.sx = b.x;
		b.sy = b.y;
		b.vx = b.vy = 0;
		if (b.num === 0) {
			respawnIn = 1.1;
			hint.textContent = "Scratch! The cue ball returns in a moment.";
		} else {
			const row = legend.querySelector(`[data-num="${b.num}"]`);
			row?.classList.add("is-down");
		}
		updateStatus();
	}

	function updateStatus() {
		const talksDown = balls.filter((b) => b.kind === "talk" && b.state !== "live").length;
		const others = balls.filter((b) => b.kind !== "cue" && b.state !== "live").length;
		const total = balls.length - 1;
		status.textContent = others >= total ? "Table cleared!" : `Talks pocketed ${talksDown}/${talks.length} · balls ${others}/${total}`;
	}

	// ---- rendering ----
	function renderBall(b, force) {
		let x = b.x;
		let y = b.y;
		let s = 1;
		if (b.state === "sinking") {
			const p = Math.min(1, b.t / 0.28);
			const e = p * p;
			x = b.sx + (b.pocket.x - b.sx) * e;
			y = b.sy + (b.pocket.y - b.sy) * e;
			s = 1 - e * 0.5;
			b.el.style.opacity = String(1 - e);
		} else if (b.scale !== 1) {
			s = b.scale;
		}
		const value = `translate3d(${(x - r).toFixed(2)}px, ${(y - r).toFixed(2)}px, 0) scale(${s.toFixed(3)})`;
		if (force || value !== b.written) {
			b.written = value;
			b.el.style.transform = value;
		}
		if (b.disc) {
			const [nx, ny, nz] = b.n;
			const a = Math.atan2(ny, nx);
			const vis = nz > 0.02;
			const m = 0.78 * (1 - 0.35 * (1 - nz));
			const dv = vis
				? `translate(${(nx * r * m * 1.25).toFixed(2)}px, ${(ny * r * m * 1.25).toFixed(2)}px) rotate(${a.toFixed(3)}rad) scale(${Math.max(0.12, nz).toFixed(3)}, 1) rotate(${(-a).toFixed(3)}rad)`
				: "scale(0)";
			if (force || dv !== b.discWritten) {
				b.discWritten = dv;
				b.disc.style.transform = dv;
				b.disc.style.opacity = vis ? String(Math.min(1, nz * 4)) : "0";
			}
		}
	}

	function renderAll(force) {
		for (const b of balls) renderBall(b, force);
	}

	// ---- aiming ----
	let aim = null; // {pointer: [x,y], pull, theta}
	const cue = () => balls[0];

	function feltPoint(event) {
		const rect = felt.getBoundingClientRect();
		return [event.clientX - rect.left, event.clientY - rect.top];
	}

	function raycast(x, y, dx, dy) {
		let best = { t: Infinity, kind: "none" };
		// cushions
		if (dx > 0) best = take(best, (W - r - x) / dx, "wall");
		if (dx < 0) best = take(best, (r - x) / dx, "wall");
		if (dy > 0) best = take(best, (H - r - y) / dy, "wall");
		if (dy < 0) best = take(best, (r - y) / dy, "wall");
		for (const b of balls) {
			if (b.num === 0 || b.state !== "live") continue;
			const fx = x - b.x;
			const fy = y - b.y;
			const B = fx * dx + fy * dy;
			const C = fx * fx + fy * fy - 4 * r * r;
			const disc = B * B - C;
			if (disc < 0) continue;
			const t = -B - Math.sqrt(disc);
			if (t > 0) best = take(best, t, "ball", b);
		}
		return best;
	}
	function take(best, t, kind, ball) {
		return t > 0 && t < best.t ? { t, kind, ball } : best;
	}

	function drawGuide() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		if (!aim) return;
		const c = cue();
		const dx = Math.cos(aim.theta);
		const dy = Math.sin(aim.theta);
		const hit = raycast(c.x, c.y, dx, dy);
		const power = Math.min(1, aim.pull / 150);
		ctx.lineCap = "round";
		ctx.setLineDash([2, 8]);
		ctx.strokeStyle = "rgba(255,255,255,0.8)";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.moveTo(c.x + dx * r, c.y + dy * r);
		const ex = c.x + dx * hit.t;
		const ey = c.y + dy * hit.t;
		ctx.lineTo(ex, ey);
		ctx.stroke();
		ctx.setLineDash([]);
		// ghost ball
		ctx.strokeStyle = "rgba(255,255,255,0.75)";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(ex, ey, r, 0, Math.PI * 2);
		ctx.stroke();
		if (hit.kind === "ball") {
			const b = hit.ball;
			let nx = b.x - ex;
			let ny = b.y - ey;
			const nl = Math.hypot(nx, ny) || 1;
			nx /= nl;
			ny /= nl;
			ctx.strokeStyle = "rgba(255,255,255,0.9)";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(b.x, b.y);
			ctx.lineTo(b.x + nx * (24 + power * 60), b.y + ny * (24 + power * 60));
			ctx.stroke();
			// cue ball continues along the tangent
			const dot = dx * nx + dy * ny;
			const tx = dx - dot * nx;
			const ty = dy - dot * ny;
			ctx.setLineDash([3, 6]);
			ctx.strokeStyle = "rgba(255,255,255,0.55)";
			ctx.beginPath();
			ctx.moveTo(ex, ey);
			ctx.lineTo(ex + tx * 50, ey + ty * 50);
			ctx.stroke();
			ctx.setLineDash([]);
		}
		// power meter
		const mx = c.x - dx * (r + 30);
		const my = c.y - dy * (r + 30);
		ctx.fillStyle = "rgba(0,0,0,0.45)";
		ctx.beginPath();
		ctx.roundRect(mx - 24, my - 9, 48, 18, 9);
		ctx.fill();
		ctx.fillStyle = `hsl(${120 - power * 120} 85% 55%)`;
		ctx.beginPath();
		ctx.roundRect(mx - 21, my - 6, Math.max(6, 42 * power), 12, 6);
		ctx.fill();
	}

	function positionCue() {
		const c = cue();
		if (!aim) {
			cueEl.classList.remove("is-on");
			return;
		}
		const gap = r + 5 + aim.pull * 0.55;
		cueEl.classList.add("is-on");
		cueEl.style.transform = `translate(${c.x}px, ${c.y}px) rotate(${aim.theta}rad) translate(${-(gap + 300)}px, -3px)`;
	}

	function onDown(event) {
		const body = event.target.closest?.(".bl-cue-ball .bl-body");
		if (!body || event.button !== 0) return;
		const c = cue();
		if (c.state !== "live" || isMoving()) return;
		const [px, py] = feltPoint(event);
		aim = { pointer: [px, py], pull: 0, theta: 0, id: event.pointerId };
		body.classList.add("is-aiming");
		hintDone();
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onCancel);
		event.preventDefault();
		updateAim(event);
		wake();
	}

	function updateAim(event) {
		const c = cue();
		const [px, py] = feltPoint(event);
		const ux = px - c.x;
		const uy = py - c.y;
		const d = Math.hypot(ux, uy);
		aim.pull = Math.min(150, d);
		if (d > 2) aim.theta = Math.atan2(-uy, -ux);
	}

	function onMove(event) {
		if (!aim) return;
		updateAim(event);
		drawGuide();
		positionCue();
	}

	function endAim() {
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onCancel);
		cue().el.querySelector(".bl-body")?.classList.remove("is-aiming");
	}

	function onCancel() {
		endAim();
		aim = null;
		drawGuide();
		positionCue();
	}

	function onUp() {
		const a = aim;
		endAim();
		if (!a) return;
		if (a.pull > 12) shoot(a.theta, Math.min(1, a.pull / 150));
		aim = null;
		drawGuide();
		positionCue();
	}

	function shoot(theta, power) {
		const c = cue();
		const v = 260 + power * 1900;
		c.vx = Math.cos(theta) * v;
		c.vy = Math.sin(theta) * v;
		wake();
	}

	let hinted = false;
	function hintDone() {
		if (hinted) return;
		hinted = true;
		hint.textContent = "Drag back further for more power.";
	}

	bBreak.addEventListener("click", () => {
		const c = cue();
		if (c.state !== "live" || isMoving()) return;
		const jitter = (Math.random() - 0.5) * 0.04;
		const target = Math.atan2(H / 2 - c.y, W * 0.72 - c.x);
		shoot(target + jitter, 0.82 + Math.random() * 0.18);
		hintDone();
	});
	bRack.addEventListener("click", () => {
		rack();
		hint.textContent = "Drag back from the white ball and let go to shoot.";
		hinted = false;
		wake();
	});

	// ---- loop ----
	let raf = 0;
	let running = false;
	let last = 0;
	let acc = 0;
	let visible = true;

	function frame(now) {
		raf = 0;
		if (!running) return;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		let steps = 0;
		while (acc >= DT && steps < 12) {
			stepSim();
			acc -= DT;
			steps++;
		}
		if (respawnIn > 0) {
			respawnIn -= steps * DT;
			if (respawnIn <= 0) respawn();
		}
		const c = cue();
		if (c.state === "live" && c.scale < 1) c.scale = Math.min(1, c.scale + 0.1);
		renderAll(false);
		if (aim) {
			positionCue();
			drawGuide();
		}
		const animating = balls.some((b) => b.state === "sinking" || (b.state === "live" && b.scale < 1));
		if (!isMoving() && !animating && respawnIn <= 0 && !aim) {
			running = false;
			return;
		}
		raf = requestAnimationFrame(frame);
	}

	function respawn() {
		const c = cue();
		let x = W * 0.25;
		const y = H / 2;
		for (let tries = 0; tries < 20; tries++) {
			if (!balls.some((b) => b !== c && b.state === "live" && Math.hypot(b.x - x, b.y - y) < r * 2.1)) break;
			x -= r * 2.2;
			if (x < r) x = W * 0.4;
		}
		c.x = x;
		c.y = y;
		c.vx = c.vy = 0;
		c.state = "live";
		c.scale = reducedMotion ? 1 : 0.2;
		c.el.hidden = false;
		c.el.style.opacity = "";
		c.n = [0, 0, 1];
		hint.textContent = "Drag back from the white ball and let go to shoot.";
		updateStatus();
	}

	function wake() {
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

	// ---- boot ----
	dpr = Math.min(1.5, window.devicePixelRatio || 1);
	buildBalls();
	geometry();
	rack();

	const resizeObserver = new ResizeObserver(() => {
		const before = W;
		geometry();
		if (W !== before) {
			const k = W / before;
			for (const b of balls) {
				b.x *= k;
				b.y *= k;
			}
			renderAll(true);
		}
	});
	resizeObserver.observe(root);

	const intersection = new IntersectionObserver(
		([entry]) => {
			visible = entry.isIntersecting;
			jump.hidden = visible;
			if (!visible) stop();
			else if (isMoving()) wake();
		},
		{ rootMargin: "0px" },
	);
	intersection.observe(table);

	const onVisibility = () => {
		if (document.hidden) stop();
		else if (visible && isMoving()) wake();
	};
	table.addEventListener("pointerdown", onDown);
	document.addEventListener("visibilitychange", onVisibility);

	return () => {
		stop();
		endAim();
		resizeObserver.disconnect();
		intersection.disconnect();
		document.removeEventListener("visibilitychange", onVisibility);
	};
}

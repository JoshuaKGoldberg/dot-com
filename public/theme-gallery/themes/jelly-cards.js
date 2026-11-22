// #63 Jelly Cards: every card is a pressure soft body (springs + gas pressure + card/card collisions).
// The card's text follows the best-fit affine of its jelly outline, so it wobbles and shears with it.
import { clamp, createLoop, createPill, dprCap } from "./physics-kit/kit.js";

const HUES = { "site-post": 335, "site-project": 160, "site-talk": 258 };

export function activate({ root, reducedMotion, mode }) {
	const dark = mode === "dark";
	const items = [...root.querySelectorAll(".site-item")];
	const scenery = root.querySelector(".scenery-a");
	if (!items.length || !scenery) return undefined;

	const canvas = document.createElement("canvas");
	canvas.setAttribute("aria-hidden", "true");
	scenery.append(canvas);
	const ctx = canvas.getContext("2d");
	root.classList.add("jelly-on");

	let dpr = 1;
	let VW = 0;
	let VH = 0;
	let cards = [];
	let rootTop = 0;
	let time = 0;
	let lastScroll = root.scrollTop;
	let scrollSpeed = 0;
	const pointer = { x: -999, y: -999, vx: 0, vy: 0, t: 0, down: null };
	let still = 0;

	function measure() {
		const rr = root.getBoundingClientRect();
		rootTop = rr.top;
		VW = rr.width;
		VH = rr.height;
		dpr = dprCap(1.5);
		canvas.width = Math.round(VW * dpr);
		canvas.height = Math.round(VH * dpr);
		const sc = root.scrollTop;
		cards = items.map((el, idx) => {
			el.style.transform = "";
			const r = el.getBoundingClientRect();
			const w = r.width;
			const h = r.height;
			const cls = [...el.classList].find((c) => HUES[c]) ?? "site-post";
			const prev = cards[idx];
			const card = {
				el,
				x0: r.left - rr.left + w / 2,
				y0: r.top - rr.top + sc + h / 2, // content coords
				w,
				h,
				hue: HUES[cls] + (idx % 4) * 9 - 14,
				cx: 0,
				cy: 0,
				cvx: 0,
				cvy: 0,
				off: { x: 0, y: 0 },
				written: "",
				...(prev && prev.pts ? {} : {}),
			};
			// Perimeter points along a rounded rect.
			const rad = Math.min(26, h / 2.2, w / 6);
			const perim = 2 * (w + h);
			const n = clamp(Math.round(perim / 30), 18, 44);
			card.rest = [];
			for (let i = 0; i < n; i++) {
				const t = (i / n) * perim;
				card.rest.push(perimeterPoint(t, w, h, rad));
			}
			card.n = n;
			card.px = new Float32Array(n);
			card.py = new Float32Array(n);
			card.vx = new Float32Array(n);
			card.vy = new Float32Array(n);
			card.edge = [];
			for (let i = 0; i < n; i++) {
				const a = card.rest[i];
				const b = card.rest[(i + 1) % n];
				card.edge.push(Math.hypot(a.x - b.x, a.y - b.y));
			}
			card.area0 = polyArea(card.rest.map((p) => p.x), card.rest.map((p) => p.y));
			card.cx = card.x0;
			card.cy = card.y0 - sc;
			for (let i = 0; i < n; i++) {
				card.px[i] = card.cx + card.rest[i].x;
				card.py[i] = card.cy + card.rest[i].y;
			}
			return card;
		});
	}

	function perimeterPoint(t, w, h, r) {
		// Walk the rectangle perimeter (clockwise from top-left) and inset the corners by r.
		const hw = w / 2;
		const hh = h / 2;
		const sides = [w, h, w, h];
		let s = t;
		let side = 0;
		while (s > sides[side] && side < 3) {
			s -= sides[side];
			side++;
		}
		let x;
		let y;
		if (side === 0) [x, y] = [-hw + s, -hh];
		else if (side === 1) [x, y] = [hw, -hh + s];
		else if (side === 2) [x, y] = [hw - s, hh];
		else [x, y] = [-hw, hh - s];
		// Pull corner points toward the centre so the blob is round-cornered.
		const ix = hw - r;
		const iy = hh - r;
		const cx = clamp(x, -ix, ix);
		const cy = clamp(y, -iy, iy);
		const dx = x - cx;
		const dy = y - cy;
		const d = Math.hypot(dx, dy);
		if (d > 0) return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
		return { x, y };
	}

	function polyArea(xs, ys) {
		let a = 0;
		for (let i = 0; i < xs.length; i++) {
			const j = (i + 1) % xs.length;
			a += xs[i] * ys[j] - xs[j] * ys[i];
		}
		return Math.abs(a) / 2;
	}

	function slotY(card) {
		return card.y0 - root.scrollTop;
	}

	// ------------------------------------------------------------ physics

	function step(dt) {
		time += dt;
		let energy = 0;
		for (const card of cards) {
			const sy = slotY(card);
			const near = sy > -card.h - 260 && sy < VH + card.h + 260;
			if (!near) {
				snap(card, sy);
				continue;
			}
			const grabbed = pointer.down && pointer.down.card === card && pointer.down.active;
			// Centre body: spring to its layout slot (or the pointer, while dragged).
			let tx = card.x0;
			let ty = sy;
			if (grabbed) {
				tx = pointer.x - pointer.down.gx;
				ty = pointer.y - pointer.down.gy;
			}
			const k = grabbed ? 220 : 70;
			const c = grabbed ? 22 : 7.5;
			card.cvx += (k * (tx - card.cx) - c * card.cvx) * dt;
			card.cvy += (k * (ty - card.cy) - c * card.cvy) * dt;
			card.cx += card.cvx * dt;
			card.cy += card.cvy * dt;
			// Pointer wobble on hover.
			const sp = Math.hypot(pointer.vx, pointer.vy);
			const pa = !reducedMotion && time - pointer.t < 0.12 && sp > 80;
			// Perimeter points.
			let area = 0;
			const n = card.n;
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n;
				area += card.px[i] * card.py[j] - card.px[j] * card.py[i];
			}
			area = Math.abs(area) / 2;
			const press = clamp(card.area0 / Math.max(area, 1) - 1, -0.5, 0.8);
			for (let i = 0; i < n; i++) {
				const pi = (i + n - 1) % n;
				const ni = (i + 1) % n;
				const tgx = card.cx + card.rest[i].x;
				const tgy = card.cy + card.rest[i].y;
				let ax = 260 * (tgx - card.px[i]);
				let ay = 260 * (tgy - card.py[i]);
				// neighbour length springs
				for (const [j, L] of [[pi, card.edge[pi]], [ni, card.edge[i]]]) {
					const dx = card.px[j] - card.px[i];
					const dy = card.py[j] - card.py[i];
					const d = Math.hypot(dx, dy) || 1;
					const f = 420 * (d - L) / d;
					ax += dx * f;
					ay += dy * f;
				}
				// gas pressure along the outward normal
				const nxv = card.py[ni] - card.py[pi];
				const nyv = -(card.px[ni] - card.px[pi]);
				const nl = Math.hypot(nxv, nyv) || 1;
				ax += (nxv / nl) * press * 3200;
				ay += (nyv / nl) * press * 3200;
				if (pa) {
					const dx = card.px[i] - pointer.x;
					const dy = card.py[i] - pointer.y;
					const d = Math.hypot(dx, dy);
					if (d < 90) {
						const w = (1 - d / 90) ** 2;
						ax += pointer.vx * w * 14 + (dx / (d || 1)) * w * Math.min(sp, 1500) * 4;
						ay += pointer.vy * w * 14 + (dy / (d || 1)) * w * Math.min(sp, 1500) * 4;
					}
				}
				card.vx[i] += ax * dt;
				card.vy[i] += ay * dt;
				const damp = Math.exp(-9 * dt);
				card.vx[i] *= damp;
				card.vy[i] *= damp;
			}
			for (let i = 0; i < n; i++) {
				card.px[i] += card.vx[i] * dt;
				card.py[i] += card.vy[i] * dt;
				energy += Math.abs(card.vx[i]) + Math.abs(card.vy[i]);
			}
			let sa = 0;
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n;
				sa += card.px[i] * card.py[j] - card.px[j] * card.py[i];
			}
			const ratio = Math.abs(sa) / 2 / card.area0;
			if (ratio < 0.55 || ratio > 1.8 || !Number.isFinite(ratio)) {
				// Tangled: let the card relax straight back to its shape.
				for (let i = 0; i < n; i++) {
					card.px[i] += (card.cx + card.rest[i].x - card.px[i]) * 0.2;
					card.py[i] += (card.cy + card.rest[i].y - card.py[i]) * 0.2;
					card.vx[i] *= 0.5;
					card.vy[i] *= 0.5;
				}
			}
			energy += Math.abs(card.cvx) + Math.abs(card.cvy) + Math.hypot(card.cx - tx, card.cy - ty) * 4;
		}
		collide();
		energy /= cards.length * 20;
		if (pointer.down?.active || scrollSpeed > 20) energy += 5;
		scrollSpeed *= 0.8;
		return energy > 0.05;
	}

	function snap(card, sy) {
		card.cx = card.x0;
		card.cy = sy;
		card.cvx = card.cvy = 0;
		for (let i = 0; i < card.n; i++) {
			card.px[i] = card.cx + card.rest[i].x;
			card.py[i] = card.cy + card.rest[i].y;
			card.vx[i] = card.vy[i] = 0;
		}
	}

	function inside(card, x, y) {
		let c = false;
		const n = card.n;
		for (let i = 0, j = n - 1; i < n; j = i++) {
			const yi = card.py[i];
			const yj = card.py[j];
			if (yi > y !== yj > y && x < ((card.px[j] - card.px[i]) * (y - yi)) / (yj - yi) + card.px[i]) c = !c;
		}
		return c;
	}

	function bounds(card) {
		let x0 = 1e9;
		let y0 = 1e9;
		let x1 = -1e9;
		let y1 = -1e9;
		for (let i = 0; i < card.n; i++) {
			x0 = Math.min(x0, card.px[i]);
			x1 = Math.max(x1, card.px[i]);
			y0 = Math.min(y0, card.py[i]);
			y1 = Math.max(y1, card.py[i]);
		}
		card.b = [x0, y0, x1, y1];
	}

	function collide() {
		for (const card of cards) bounds(card);
		for (let a = 0; a < cards.length; a++) {
			for (let b = a + 1; b < cards.length; b++) {
				const A = cards[a];
				const B = cards[b];
				if (A.b[2] < B.b[0] - 2 || B.b[2] < A.b[0] - 2 || A.b[3] < B.b[1] - 2 || B.b[3] < A.b[1] - 2) continue;
				push(A, B);
				push(B, A);
			}
		}
	}

	// Push points of A that sit inside B out through B's nearest edge; B's edge and body take the reaction.
	function push(A, B) {
		for (let i = 0; i < A.n; i++) {
			const x = A.px[i];
			const y = A.py[i];
			if (!inside(B, x, y)) continue;
			let best = 1e9;
			let bx = 0;
			let by = 0;
			let bj = 0;
			for (let j = 0; j < B.n; j++) {
				const k = (j + 1) % B.n;
				const ex = B.px[k] - B.px[j];
				const ey = B.py[k] - B.py[j];
				const t = clamp(((x - B.px[j]) * ex + (y - B.py[j]) * ey) / (ex * ex + ey * ey || 1), 0, 1);
				const qx = B.px[j] + ex * t;
				const qy = B.py[j] + ey * t;
				const d = (x - qx) ** 2 + (y - qy) ** 2;
				if (d < best) {
					best = d;
					bx = qx;
					by = qy;
					bj = j;
				}
			}
			const dx = bx - x;
			const dy = by - y;
			const d = Math.sqrt(best) || 0.001;
			const nx = dx / d;
			const ny = dy / d;
			// Shallow, capped correction so deep tangles cannot explode.
			const corr = Math.min(d + 0.5, 3);
			A.px[i] += nx * corr;
			A.py[i] += ny * corr;
			A.vx[i] *= 0.6;
			A.vy[i] *= 0.6;
			const k = (bj + 1) % B.n;
			for (const m of [bj, k]) {
				B.vx[m] -= nx * corr * 6;
				B.vy[m] -= ny * corr * 6;
			}
			B.cvx -= nx * corr * 1.2;
			B.cvy -= ny * corr * 1.2;
		}
	}

	// ------------------------------------------------------------ rendering

	function fit(card) {
		// Centroid and best-fit linear map from rest offsets to current offsets.
		let mx = 0;
		let my = 0;
		const n = card.n;
		for (let i = 0; i < n; i++) {
			mx += card.px[i];
			my += card.py[i];
		}
		mx /= n;
		my /= n;
		let sxx = 0;
		let sxy = 0;
		let syy = 0;
		let qxx = 0;
		let qxy = 0;
		let qyx = 0;
		let qyy = 0;
		for (let i = 0; i < n; i++) {
			const rx = card.rest[i].x;
			const ry = card.rest[i].y;
			const qx = card.px[i] - mx;
			const qy = card.py[i] - my;
			sxx += rx * rx;
			sxy += rx * ry;
			syy += ry * ry;
			qxx += qx * rx;
			qxy += qx * ry;
			qyx += qy * rx;
			qyy += qy * ry;
		}
		const det = sxx * syy - sxy * sxy || 1;
		const i00 = syy / det;
		const i01 = -sxy / det;
		const i11 = sxx / det;
		let a = qxx * i00 + qxy * i01;
		let c = qxx * i01 + qxy * i11;
		let b = qyx * i00 + qyy * i01;
		let d = qyx * i01 + qyy * i11;
		// Soften so text never gets mangled.
		a = 1 + (a - 1) * 0.85;
		d = 1 + (d - 1) * 0.85;
		b *= 0.85;
		c *= 0.85;
		card.m = [a, b, c, d, mx - card.x0, my - slotY(card)];
	}

	function writeDom(card) {
		fit(card);
		const [a, b, c, d, tx, ty] = card.m;
		const settled = Math.abs(a - 1) + Math.abs(d - 1) + Math.abs(b) + Math.abs(c) + Math.abs(tx) + Math.abs(ty) < 0.002;
		const value = settled ? "" : `matrix(${a.toFixed(4)},${b.toFixed(4)},${c.toFixed(4)},${d.toFixed(4)},${tx.toFixed(2)},${ty.toFixed(2)})`;
		if (value !== card.written) {
			card.written = value;
			card.el.style.transform = value;
		}
	}

	function blobPath(card, dy = 0) {
		const n = card.n;
		const P = (i) => [card.px[(i + n) % n], card.py[(i + n) % n] + dy];
		ctx.beginPath();
		let [x0, y0] = P(0);
		let [x1, y1] = P(1);
		ctx.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
		for (let i = 1; i <= n; i++) {
			const [cx, cy] = P(i);
			const [nx, ny] = P(i + 1);
			ctx.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
		}
		ctx.closePath();
	}

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, VW, VH);
		for (const card of cards) {
			const sy = slotY(card);
			if (sy < -card.h - 120 || sy > VH + card.h + 120) {
				if (card.written) {
					card.written = "";
					card.el.style.transform = "";
				}
				continue;
			}
			writeDom(card);
			const h = card.hue;
			const hovered = pointer.hover === card;
			// Soft contact shadow.
			blobPath(card, 7);
			ctx.fillStyle = dark ? "rgb(0 0 0 / 0.35)" : `hsl(${h} 60% 40% / 0.16)`;
			ctx.fill();
			blobPath(card);
			const bounds = card.b ?? [0, 0, 0, 0];
			const y0 = (card.b ? card.b[1] : sy - card.h / 2) - 2;
			const grad = ctx.createLinearGradient(0, y0, 0, y0 + card.h + 10);
			if (dark) {
				grad.addColorStop(0, `hsl(${h} 55% ${hovered ? 30 : 26}% / 0.96)`);
				grad.addColorStop(1, `hsl(${h + 14} 60% ${hovered ? 22 : 18}% / 0.96)`);
			} else {
				grad.addColorStop(0, `hsl(${h} 100% ${hovered ? 94 : 92}%)`);
				grad.addColorStop(1, `hsl(${h + 14} 95% ${hovered ? 86 : 83}%)`);
			}
			ctx.fillStyle = grad;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = dark ? `hsl(${h} 90% 66% / 0.8)` : `hsl(${h} 85% 62% / 0.85)`;
			ctx.stroke();
			// Gloss.
			ctx.save();
			blobPath(card);
			ctx.clip();
			const gloss = ctx.createLinearGradient(0, y0, 0, y0 + card.h * 0.55);
			gloss.addColorStop(0, dark ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.75)");
			gloss.addColorStop(1, "rgb(255 255 255 / 0)");
			ctx.fillStyle = gloss;
			ctx.fillRect(0, y0, VW, card.h * 0.55);
			// inner bottom glow
			const glow = ctx.createLinearGradient(0, y0 + card.h * 0.75, 0, y0 + card.h + 8);
			glow.addColorStop(0, `hsl(${h} 100% 70% / 0)`);
			glow.addColorStop(1, dark ? `hsl(${h} 100% 65% / 0.28)` : `hsl(${h} 100% 70% / 0.35)`);
			ctx.fillStyle = glow;
			ctx.fillRect(0, y0 + card.h * 0.7, VW, card.h);
			ctx.restore();
			void bounds;
		}
	}

	const loop = createLoop({
		hz: 120,
		maxSteps: 3,
		step: (dt) => step(dt),
		render: draw,
		onStop: () => {
			for (const card of cards) {
				// Settle exactly on the slot so text is crisp at rest.
				snap(card, slotY(card));
			}
			draw();
		},
	});

	function wake() {
		loop.start();
	}

	// ------------------------------------------------------------ input

	function local(event) {
		return { x: event.clientX - root.getBoundingClientRect().left, y: event.clientY - rootTop };
	}

	function cardAt(x, y) {
		for (const card of cards) {
			if (inside(card, x, y)) return card;
		}
		return undefined;
	}

	let lastMove = 0;
	function onMove(event) {
		const { x, y } = local(event);
		const now = performance.now();
		if (lastMove && now - lastMove < 100) {
			const dt = Math.max(1, now - lastMove) / 1000;
			pointer.vx = pointer.vx * 0.4 + ((x - pointer.x) / dt) * 0.6;
			pointer.vy = pointer.vy * 0.4 + ((y - pointer.y) / dt) * 0.6;
		}
		lastMove = now;
		pointer.x = x;
		pointer.y = y;
		pointer.t = time;
		const hov = cardAt(x, y);
		if (hov !== pointer.hover) {
			pointer.hover = hov;
			if (reducedMotion) draw();
		}
		const down = pointer.down;
		if (down && !down.active && Math.hypot(event.clientX - down.sx, event.clientY - down.sy) > 5) {
			down.active = true;
			down.card.el.classList.add("is-grabbed");
			getSelection()?.removeAllRanges();
		}
		if (!reducedMotion || down?.active) wake();
	}

	function onDown(event) {
		if (event.button !== 0 || event.target.closest?.("a, button, .phys-pill")) return;
		const { x, y } = local(event);
		const card = cardAt(x, y);
		if (!card) return;
		pointer.down = { card, sx: event.clientX, sy: event.clientY, gx: x - card.cx, gy: y - card.cy, active: false };
		// A press squishes the card where it was touched.
		for (let i = 0; i < card.n; i++) {
			const dx = card.px[i] - x;
			const dy = card.py[i] - y;
			const d = Math.hypot(dx, dy);
			if (d < 120) {
				const w = (1 - d / 120) ** 2;
				card.vx[i] += (dx / (d || 1)) * -90 * w + dx * -0.6 * w;
				card.vy[i] += (dy / (d || 1)) * -90 * w;
			}
		}
		card.cvy += 30;
		wake();
	}

	function onUp() {
		const down = pointer.down;
		if (!down) return;
		down.card.el.classList.remove("is-grabbed");
		// release: keep momentum for a satisfying fling-and-wobble
		if (down.active) {
			down.card.cvx += clamp(pointer.vx, -900, 900) * 0.4;
			down.card.cvy += clamp(pointer.vy, -900, 900) * 0.4;
		}
		pointer.down = undefined;
		wake();
	}

	function onScroll() {
		const s = root.scrollTop;
		const d = s - lastScroll;
		lastScroll = s;
		if (reducedMotion) {
			for (const card of cards) snap(card, slotY(card));
			draw();
			return;
		}
		scrollSpeed += Math.abs(d) * 4;
		if (Math.abs(d) > 240) {
			// Jumps (anchors, programmatic scrolls): no jelly, just snap.
			for (const card of cards) snap(card, slotY(card));
			wake();
			return;
		}
		// Cards lag the scroll like gelatin on a moving tray: inertia on their centres.
		const lag = clamp(d, -60, 60);
		for (const card of cards) {
			card.cy += lag * 0.6;
			for (let i = 0; i < card.n; i++) card.py[i] += lag * (0.6 + 0.2 * Math.sin(i * 1.7));
		}
		wake();
	}

	const ro = new ResizeObserver(() => {
		measure();
		draw();
	});

	const ui = createPill(root, {
		pos: "left",
		hint: "Drag a card to squish it into its neighbours",
		items: [{ id: "jiggle", label: "Jiggle", key: "j", primary: true, title: "Wobble every card", onClick: () => jiggle() }],
	});
	function jiggle() {
		for (const card of cards) {
			card.cvy -= 140 + Math.random() * 80;
			card.cvx += (Math.random() - 0.5) * 120;
			for (let i = 0; i < card.n; i++) card.vy[i] -= 60 + Math.random() * 60;
		}
		wake();
	}
	const onKey = (e) => {
		if (e.key.toLowerCase() === "j" && !e.metaKey && !e.ctrlKey && !e.altKey && !/^(INPUT|TEXTAREA)$/.test(e.target.tagName)) {
			e.preventDefault();
			jiggle();
		}
	};
	window.addEventListener("keydown", onKey);

	let cancelled = false;
	(async () => {
		try {
			await document.fonts.ready;
		} catch {
			/* ignore */
		}
		if (cancelled) return;
		measure();
		draw();
		ro.observe(root);
		root.addEventListener("scroll", onScroll, { passive: true });
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		if (!reducedMotion) {
			// A hello wobble: cards drop in from slightly above and settle.
			for (const card of cards) {
				card.cvy += 60;
				for (let i = 0; i < card.n; i++) card.vy[i] += 30;
			}
			wake();
		}
	})();

	return () => {
		cancelled = true;
		loop.stop();
		ro.disconnect();
		window.removeEventListener("keydown", onKey);
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		root.removeEventListener("scroll", onScroll);
		canvas.remove();
	};
}

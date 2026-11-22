// #64 Rope-Hung Nav: each nav link is a rigid tag hanging from two Verlet ropes off a brass rail.
// Drag, flick, or pull a tag down to navigate. Tags and ropes collide, so flicking can bunch them up.
import { bindKeys, clamp, createLoop, createPill, dprCap } from "./physics-kit/kit.js";

const SEG = 8;
const GRAV = 1900;
const ITER = 14;

export function activate({ root, reducedMotion }) {
	const links = [...root.querySelectorAll(".site-nav-link")];
	const header = root.querySelector(".site-header");
	const overlay = root.querySelector(".overlay-b");
	if (!links.length || !header || !overlay) return undefined;

	const canvas = document.createElement("canvas");
	canvas.className = "rope-canvas";
	canvas.setAttribute("aria-hidden", "true");
	overlay.append(canvas);
	const ctx = canvas.getContext("2d");
	root.classList.add("rope-on");

	let dpr = 1;
	let VW = 0;
	let VH = 0;
	let tags = [];
	let P = { x: [], y: [], px: [], py: [], im: [] };
	let cons = [];
	let rail = { x0: 0, x1: 0, y: 0 };
	let time = 0;
	let lastScroll = root.scrollTop;
	let drag; // {kind:'tag'|'node', tag, idx, sx, sy, active, ox, oy}
	const pointer = { x: 0, y: 0 };
	let suppressClick = false;
	let calm = 0;

	function cssVar(name) {
		return getComputedStyle(root).getPropertyValue(name).trim();
	}

	function addP(x, y, im) {
		P.x.push(x);
		P.y.push(y);
		P.px.push(x);
		P.py.push(y);
		P.im.push(im);
		return P.x.length - 1;
	}

	function measure() {
		for (const l of links) l.style.transform = "";
		const rr = root.getBoundingClientRect();
		VW = rr.width;
		VH = rr.height;
		dpr = dprCap(1.5);
		canvas.width = Math.round(VW * dpr);
		canvas.height = Math.round(VH * dpr);
		const hr = header.getBoundingClientRect();
		const sc = root.scrollTop;
		P = { x: [], y: [], px: [], py: [], im: [] };
		cons = [];
		rail = { x0: hr.left - rr.left, x1: hr.right - rr.left, y: hr.top - rr.top + sc + 6 }; // content y
		tags = links.map((el, i) => {
			const r = el.getBoundingClientRect();
			const w = r.width - 18;
			const h = r.height - 18;
			const cx = r.left - rr.left + r.width / 2;
			const cy = r.top - rr.top + r.height / 2;
			const tag = { el, i, cx0: cx, cy0: cy + sc, w: r.width, h: r.height, written: "" };
			const L = [cx - w / 2, cy - h / 2];
			const TL = addP(cx - w / 2, cy - h / 2, 0.4);
			const TR = addP(cx + w / 2, cy - h / 2, 0.4);
			const BL = addP(cx - w / 2, cy + h / 2, 0.4);
			const BR = addP(cx + w / 2, cy + h / 2, 0.4);
			void L;
			tag.c = [TL, TR, BL, BR];
			const link = (a, b) => cons.push([a, b, Math.hypot(P.x[a] - P.x[b], P.y[a] - P.y[b])]);
			link(TL, TR);
			link(BL, BR);
			link(TL, BL);
			link(TR, BR);
			link(TL, BR);
			link(TR, BL);
			// Two ropes from one hook on the rail to the top grommets.
			const ax = cx;
			const ay = rail.y - sc + 6;
			tag.anchor = [];
			tag.rope = [];
			tag.hookX = ax;
			for (const corner of [TL, TR]) {
				const nodes = [];
				const dx = P.x[corner] - ax;
				const dy = P.y[corner] - ay;
				for (let s = 0; s <= SEG; s++) {
					const f = s / SEG;
					const pi = addP(ax + dx * f, ay + dy * f, s === 0 ? 0 : 1);
					nodes.push(pi);
				}
				const segLen = Math.hypot(dx, dy) / SEG;
				for (let s = 0; s < SEG; s++) cons.push([nodes[s], nodes[s + 1], segLen]);
				// last node IS the corner: tie it rigidly.
				cons.push([nodes[SEG], corner, 0.01]);
				tag.anchor.push(nodes[0]);
				tag.rope.push(nodes);
			}
			return tag;
		});
	}

	function anchorY() {
		return rail.y - root.scrollTop + 6;
	}

	// ------------------------------------------------------------ simulation

	function tagCircles(tag) {
		const [TL, TR, BL, BR] = tag.c;
		const out = [];
		const r = tag.h * 0.42;
		for (const t of [0.14, 0.38, 0.62, 0.86]) {
			const lx = (P.x[TL] + P.x[BL]) / 2;
			const ly = (P.y[TL] + P.y[BL]) / 2;
			const rx = (P.x[TR] + P.x[BR]) / 2;
			const ry = (P.y[TR] + P.y[BR]) / 2;
			out.push({ x: lx + (rx - lx) * t, y: ly + (ry - ly) * t, r, t });
		}
		return out;
	}

	function pushTagPoint(tag, t, dx, dy) {
		const [TL, TR, BL, BR] = tag.c;
		const wl = (1 - t) / 2;
		const wr = t / 2;
		P.x[TL] += dx * wl * 2;
		P.y[TL] += dy * wl * 2;
		P.x[BL] += dx * wl * 2;
		P.y[BL] += dy * wl * 2;
		P.x[TR] += dx * wr * 2;
		P.y[TR] += dy * wr * 2;
		P.x[BR] += dx * wr * 2;
		P.y[BR] += dy * wr * 2;
	}

	function step(dt) {
		time += dt;
		const g = GRAV * dt * dt;
		const ay = anchorY();
		const n = P.x.length;
		const amb = reducedMotion ? 0 : 1;
		for (let i = 0; i < n; i++) {
			if (P.im[i] === 0) continue;
			const x = P.x[i];
			const y = P.y[i];
			const damp = P.im[i] < 1 ? 0.9975 : 0.994;
			const vx = (x - P.px[i]) * damp;
			const vy = (y - P.py[i]) * damp;
			P.px[i] = x;
			P.py[i] = y;
			const sway = amb * Math.sin(time * 0.85 + i * 0.07 + (y - ay) * 0.004) * 55 * dt * dt;
			P.x[i] = x + vx + sway;
			P.y[i] = y + vy + g;
		}
		// Anchors follow the rail (it scrolls with the page: ropes trail it).
		for (const tag of tags) {
			for (const a of tag.anchor) {
				P.x[a] = tag.hookX;
				P.y[a] = ay;
				P.px[a] = tag.hookX;
				P.py[a] = ay;
			}
		}
		// Pointer grab.
		if (drag?.active) {
			if (drag.kind === "tag") {
				const tag = drag.tag;
				const [TL, TR, BL, BR] = tag.c;
				const mx = (P.x[TL] + P.x[TR] + P.x[BL] + P.x[BR]) / 4;
				const my = (P.y[TL] + P.y[TR] + P.y[BL] + P.y[BR]) / 4;
				const tx = pointer.x - drag.ox;
				const ty = pointer.y - drag.oy;
				const k = 0.35;
				for (const c of tag.c) {
					P.x[c] += (tx - mx) * k;
					P.y[c] += (ty - my) * k;
				}
			} else {
				P.x[drag.idx] = pointer.x;
				P.y[drag.idx] = pointer.y;
				P.px[drag.idx] = pointer.x;
				P.py[drag.idx] = pointer.y;
			}
		}
		for (let it = 0; it < ITER; it++) {
			for (const [a, b, L] of cons) {
				const dx = P.x[b] - P.x[a];
				const dy = P.y[b] - P.y[a];
				const d = Math.hypot(dx, dy) || 1e-4;
				const diff = (d - L) / d;
				const ia = P.im[a];
				const ib = P.im[b];
				const s = ia + ib;
				if (s === 0) continue;
				P.x[a] += (dx * diff * ia) / s;
				P.y[a] += (dy * diff * ia) / s;
				P.x[b] -= (dx * diff * ib) / s;
				P.y[b] -= (dy * diff * ib) / s;
			}
			if (it % 3 === 0) collide();
			for (let i = 0; i < n; i++) if (P.im[i] > 0 && P.y[i] < ay + 3) P.y[i] = ay + 3; // can't pass through the rail
		}
		// Settle detection.
		let e = 0;
		for (let i = 0; i < n; i++) e += Math.abs(P.x[i] - P.px[i]) + Math.abs(P.y[i] - P.py[i]);
		e /= n;
		if (reducedMotion) {
			calm = e < 0.03 && !drag?.active ? calm + 1 : 0;
			return calm < 30;
		}
		return true;
	}

	function collide() {
		const circles = tags.map(tagCircles);
		// rope nodes vs other tags' body circles
		for (let a = 0; a < tags.length; a++) {
			for (let b = 0; b < tags.length; b++) {
				if (a === b) continue;
				for (const rope of tags[a].rope) {
					for (let s = 2; s <= SEG; s++) {
						const idx = rope[s];
						for (const c of circles[b]) {
							const dx = P.x[idx] - c.x;
							const dy = P.y[idx] - c.y;
							const d = Math.hypot(dx, dy);
							const min = c.r + 3;
							if (d < min && d > 1e-4) {
								const push = (min - d) / d;
								P.x[idx] += dx * push * 0.6;
								P.y[idx] += dy * push * 0.6;
								pushTagPoint(tags[b], c.t, -dx * push * 0.2, -dy * push * 0.2);
							}
						}
					}
				}
			}
		}
		// tag vs tag
		for (let a = 0; a < tags.length; a++) {
			for (let b = a + 1; b < tags.length; b++) {
				for (const ca of circles[a]) {
					for (const cb of circles[b]) {
						const dx = cb.x - ca.x;
						const dy = cb.y - ca.y;
						const d = Math.hypot(dx, dy);
						const min = ca.r + cb.r;
						if (d < min && d > 1e-4) {
							const push = ((min - d) / d) * 0.5 * 0.5;
							pushTagPoint(tags[a], ca.t, -dx * push, -dy * push);
							pushTagPoint(tags[b], cb.t, dx * push, dy * push);
						}
					}
				}
			}
		}
		// rope vs rope (different tags), soft
		for (let a = 0; a < tags.length; a++) {
			for (let b = a + 1; b < tags.length; b++) {
				for (const ra of tags[a].rope) {
					for (const rb of tags[b].rope) {
						for (let s = 2; s <= SEG; s++) {
							const i = ra[s];
							const j = rb[s];
							const dx = P.x[j] - P.x[i];
							const dy = P.y[j] - P.y[i];
							const d = Math.hypot(dx, dy);
							if (d < 7 && d > 1e-4) {
								const push = ((7 - d) / d) * 0.25;
								P.x[i] -= dx * push;
								P.y[i] -= dy * push;
								P.x[j] += dx * push;
								P.y[j] += dy * push;
							}
						}
					}
				}
			}
		}
	}

	// ------------------------------------------------------------ rendering

	function write(tag) {
		const [TL, TR, BL, BR] = tag.c;
		const mx = (P.x[TL] + P.x[TR] + P.x[BL] + P.x[BR]) / 4;
		const my = (P.y[TL] + P.y[TR] + P.y[BL] + P.y[BR]) / 4;
		const ang = Math.atan2(P.y[TR] - P.y[TL] + (P.y[BR] - P.y[BL]), P.x[TR] - P.x[TL] + (P.x[BR] - P.x[BL]));
		tag.pose = { mx, my, ang };
		const tx = mx - tag.cx0;
		const ty = my - (tag.cy0 - root.scrollTop);
		const v = `translate(${tx.toFixed(2)}px,${ty.toFixed(2)}px) rotate(${ang.toFixed(4)}rad)`;
		if (v !== tag.written) {
			tag.written = v;
			tag.el.style.transform = v;
		}
	}

	function draw() {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, VW, VH);
		const y = rail.y - root.scrollTop;
		const ropeCol = cssVar("--rn-rope") || "#b58d52";
		const ropeHi = cssVar("--rn-rope-hi") || "#e2c791";
		const railA = cssVar("--rn-rail-a") || "#f1d58a";
		const railB = cssVar("--rn-rail-b") || "#a57a2c";
		// Rail.
		if (y > -40 && y < VH + 40) {
			ctx.fillStyle = "rgb(0 0 0 / 0.2)";
			ctx.beginPath();
			ctx.roundRect(rail.x0, y - 1, rail.x1 - rail.x0, 12, 6);
			ctx.fill();
			const g = ctx.createLinearGradient(0, y - 7, 0, y + 5);
			g.addColorStop(0, railA);
			g.addColorStop(0.5, railB);
			g.addColorStop(1, railA);
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.roundRect(rail.x0, y - 7, rail.x1 - rail.x0, 12, 6);
			ctx.fill();
			for (const x of [rail.x0 + 10, rail.x1 - 10]) {
				ctx.fillStyle = "rgb(0 0 0 / 0.45)";
				ctx.beginPath();
				ctx.arc(x, y - 1, 2.6, 0, 7);
				ctx.fill();
			}
		}
		for (const tag of tags) {
			write(tag);
			// Hook ring on the rail.
			ctx.strokeStyle = railB;
			ctx.lineWidth = 2.4;
			ctx.beginPath();
			ctx.arc(tag.hookX, y + 6, 4.4, 0, 7);
			ctx.stroke();
			for (const rope of tag.rope) {
				ctx.lineJoin = "round";
				ctx.lineCap = "round";
				ctx.beginPath();
				ctx.moveTo(P.x[rope[0]], P.y[rope[0]]);
				for (let s = 1; s < rope.length - 1; s++) {
					const xc = (P.x[rope[s]] + P.x[rope[s + 1]]) / 2;
					const yc = (P.y[rope[s]] + P.y[rope[s + 1]]) / 2;
					ctx.quadraticCurveTo(P.x[rope[s]], P.y[rope[s]], xc, yc);
				}
				ctx.lineTo(P.x[rope[SEG]], P.y[rope[SEG]]);
				ctx.strokeStyle = "rgb(0 0 0 / 0.25)";
				ctx.lineWidth = 5.6;
				ctx.stroke();
				ctx.strokeStyle = ropeCol;
				ctx.lineWidth = 4;
				ctx.stroke();
				ctx.strokeStyle = ropeHi;
				ctx.lineWidth = 2.6;
				ctx.setLineDash([2.5, 4.5]);
				ctx.lineDashOffset = -tag.i * 2;
				ctx.stroke();
				ctx.setLineDash([]);
			}
			// Grommets on the tag corners.
			for (const c of [tag.c[0], tag.c[1]]) {
				ctx.fillStyle = railA;
				ctx.strokeStyle = railB;
				ctx.lineWidth = 1.6;
				ctx.beginPath();
				ctx.arc(P.x[c], P.y[c], 4.2, 0, 7);
				ctx.fill();
				ctx.stroke();
			}
		}
	}

	const loop = createLoop({ hz: 60, maxSteps: 2, step, render: draw });

	// ------------------------------------------------------------ input

	function local(e) {
		const r = root.getBoundingClientRect();
		return { x: e.clientX - r.left, y: e.clientY - r.top };
	}

	function onMove(e) {
		const p = local(e);
		pointer.x = p.x;
		pointer.y = p.y;
		if (drag && !drag.active && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) {
			drag.active = true;
			if (drag.tag) drag.tag.el.classList.add("is-dragging");
			getSelection()?.removeAllRanges();
		}
		if (drag?.active) loop.start();
	}

	function onDown(e) {
		if (e.button !== 0 || e.target.closest?.(".phys-pill")) return;
		const p = local(e);
		pointer.x = p.x;
		pointer.y = p.y;
		const linkEl = e.target.closest?.(".site-nav-link");
		let hit;
		if (linkEl) {
			const tag = tags.find((t) => t.el === linkEl);
			if (tag?.pose) hit = { kind: "tag", tag, ox: p.x - tag.pose.mx, oy: p.y - tag.pose.my };
		} else {
			// Grab a rope node near the pointer.
			let bd = 16 * 16;
			for (const tag of tags) {
				for (const rope of tag.rope) {
					for (let s = 1; s < SEG; s++) {
						const d = (P.x[rope[s]] - p.x) ** 2 + (P.y[rope[s]] - p.y) ** 2;
						if (d < bd) {
							bd = d;
							hit = { kind: "node", idx: rope[s], tag };
						}
					}
				}
			}
		}
		if (hit) {
			drag = { ...hit, sx: e.clientX, sy: e.clientY, active: false };
			if (hit.kind === "node") {
				drag.active = true;
				e.preventDefault();
			}
			loop.start();
		}
	}

	function onUp() {
		if (!drag) return;
		const d = drag;
		drag = undefined;
		d.tag?.el.classList.remove("is-dragging");
		if (d.active && d.kind === "tag") {
			suppressClick = true;
			setTimeout(() => (suppressClick = false), 0);
			const pulled = d.tag.pose.my - (d.tag.cy0 - root.scrollTop);
			if (pulled > 58) {
				// Tugged all the way down: navigate.
				activateLink(d.tag.el);
				// A bell-like bounce.
				for (const c of d.tag.c) P.py[c] -= 14;
			}
		}
		loop.start();
	}

	function activateLink(el) {
		for (const l of links) l.classList.toggle("is-active", l === el);
		el.click();
	}

	function onClickCapture(e) {
		if (suppressClick) {
			e.preventDefault();
			e.stopPropagation();
			return;
		}
		const l = e.target.closest?.(".site-nav-link");
		if (l) {
			for (const k of links) k.classList.toggle("is-active", k === l);
			const tag = tags.find((t) => t.el === l);
			if (tag) for (const c of tag.c) P.px[c] -= 6; // a little knock
			loop.start();
		}
	}

	function onScroll() {
		const d = root.scrollTop - lastScroll;
		lastScroll = root.scrollTop;
		if (Math.abs(d) > 400) {
			measure();
		}
		if (root.scrollTop < 400) loop.start();
		else draw();
	}

	function flick() {
		for (const tag of tags) {
			const dir = Math.random() < 0.5 ? -1 : 1;
			for (const c of tag.c) {
				P.px[c] -= dir * (14 + Math.random() * 16);
				P.py[c] -= Math.random() * 8;
			}
			for (const rope of tag.rope) for (const n of rope) P.px[n] -= dir * 6 * (Math.random() + 0.2);
		}
		loop.start();
	}

	function untangle() {
		measure();
		for (const tag of tags) tag.written = "";
		draw();
		loop.start();
	}

	const ui = createPill(root, {
		pos: "center",
		hint: "Drag a tag or rope · pull a tag down to navigate · flick to tangle",
		items: [
			{ id: "flick", label: "Flick", key: "f", primary: true, title: "Whip the ropes around", onClick: flick },
			{ id: "untangle", label: "Untangle", key: "u", onClick: untangle },
		],
	});
	const removeKeys = bindKeys({ f: flick, u: untangle });

	const ro = new ResizeObserver(() => {
		measure();
		draw();
	});

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
		window.addEventListener("pointermove", onMove, { passive: true });
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("pointerup", onUp);
		window.addEventListener("pointercancel", onUp);
		root.addEventListener("click", onClickCapture, true);
		root.addEventListener("scroll", onScroll, { passive: true });
		if (!reducedMotion) {
			// A first gentle swing.
			for (const tag of tags) for (const c of tag.c) P.px[c] -= 5 + tag.i * 1.5;
			loop.start();
		}
	})();

	return () => {
		cancelled = true;
		loop.stop();
		ro.disconnect();
		removeKeys();
		window.removeEventListener("pointermove", onMove);
		window.removeEventListener("pointerdown", onDown);
		window.removeEventListener("pointerup", onUp);
		window.removeEventListener("pointercancel", onUp);
		root.removeEventListener("click", onClickCapture, true);
		root.removeEventListener("scroll", onScroll);
		canvas.remove();
	};
}

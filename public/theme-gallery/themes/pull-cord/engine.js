const NS = "http://www.w3.org/2000/svg";
const N = 11; // segments
const SEG = 14; // rest length per segment
const AX = 60;
const AY = 8;
const STEP = 1 / 120;
const THRESHOLD = 44;
const MAX_PULL = 130;

export function create(wrap, reduced) {
	const svg = wrap.querySelector(".pc-svg");
	const hit = wrap.querySelector(".pc-hit");
	const lines = [...svg.querySelectorAll(".pc-line, .pc-twist, .pc-shadow")];
	const bead = svg.querySelector(".pc-bead-g");
	const beadDot = svg.querySelector(".pc-bead");
	const html = document.documentElement;
	const restY = AY + N * SEG;

	const pts = Array.from({ length: N + 1 }, (_, i) => ({ x: AX, y: AY + i * SEG, px: AX, py: AY + i * SEG, w: i === N ? 0.18 : 1 }));
	pts[0].w = 0;
	let drag = null;
	let raf = 0;
	let last = 0;
	let acc = 0;
	let calm = 0;
	let armed = true;
	let style;

	svg.querySelector(".pc-sway").style.animation = "none";
	wrap.classList.remove("is-sway");

	const stiff = reduced ? 1 : 0.55;
	const damp = reduced ? 0.9 : 0.992;

	function step() {
		for (let i = 1; i <= N; i++) {
			const p = pts[i];
			const vx = (p.x - p.px) * damp;
			const vy = (p.y - p.py) * damp;
			p.px = p.x;
			p.py = p.y;
			p.x += vx;
			p.y += vy + (reduced ? 0 : 1500 * STEP * STEP) + 0.012;
		}
		if (drag) {
			const h = pts[N];
			const dx = drag.x - AX;
			const dy = Math.max(10, drag.y - AY);
			const d = Math.hypot(dx, dy);
			const max = N * SEG + MAX_PULL;
			const k = d > max ? max / d : 1;
			h.x = AX + dx * k;
			h.y = AY + dy * k;
			h.px = h.x;
			h.py = h.y;
		}
		for (let it = 0; it < 10; it++) {
			for (let i = 0; i < N; i++) {
				const a = pts[i];
				const b = pts[i + 1];
				if (drag && i + 1 === N) b.w = 0;
				else if (i + 1 === N) b.w = 0.18;
				const wsum = a.w + b.w;
				if (!wsum) continue;
				const dx = b.x - a.x;
				const dy = b.y - a.y;
				const d = Math.hypot(dx, dy) || 0.0001;
				const diff = ((d - SEG) / d) * stiff;
				a.x += dx * diff * (a.w / wsum);
				a.y += dy * diff * (a.w / wsum);
				b.x -= dx * diff * (b.w / wsum);
				b.y -= dy * diff * (b.w / wsum);
			}
		}
	}

	function render() {
		let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
		for (let i = 1; i < N; i++) {
			const mx = (pts[i].x + pts[i + 1].x) / 2;
			const my = (pts[i].y + pts[i + 1].y) / 2;
			d += `Q${pts[i].x.toFixed(1)} ${pts[i].y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
		}
		d += `L${pts[N].x.toFixed(1)} ${pts[N].y.toFixed(1)}`;
		for (const l of lines) l.setAttribute("d", d);
		const h = pts[N];
		const a = Math.atan2(h.x - pts[N - 1].x, h.y - pts[N - 1].y);
		bead.style.transform = `translate(${h.x.toFixed(1)}px,${h.y.toFixed(1)}px) rotate(${(-a * 57.3).toFixed(1)}deg)`;
		hit.style.transform = `translate(${(h.x - AX).toFixed(1)}px,${(h.y - 22 + 9).toFixed(1)}px)`;
	}

	function frame(now) {
		raf = 0;
		acc += Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;
		while (acc >= STEP) { acc -= STEP; step(); }
		const h = pts[N];
		const dy = h.y - restY;
		if (armed && drag && dy > THRESHOLD) { armed = false; toggle(h.x + wrap.getBoundingClientRect().left - AX + 60 - 60, h.y); }
		if (!armed && dy < THRESHOLD * 0.4) armed = true;
		render();
		const energy = Math.abs(h.x - h.px) + Math.abs(h.y - h.py) + Math.abs(pts[5].x - pts[5].px);
		calm = !drag && energy < 0.02 && Math.abs(dy) < 1.5 ? calm + 1 : 0;
		if (calm > 30) { last = 0; return; }
		raf = requestAnimationFrame(frame);
	}
	const wake = () => { calm = 0; raf ||= requestAnimationFrame(frame); };

	function toggle(x, y) {
		wrap.classList.add("is-used");
		navigator.vibrate?.(8);
		beadDot.classList.remove("pc-flash");
		void beadDot.getBoundingClientRect();
		beadDot.classList.add("pc-flash");
		const bx = wrap.getBoundingClientRect().left + (pts[N].x - AX);
		const by = pts[N].y;
		const flip = () => html.classList.toggle("dark");
		if (reduced || !document.startViewTransition) return flip();
		style ??= Object.assign(document.createElement("style"), {
			textContent: "::view-transition-old(root),::view-transition-new(root){animation:none;mix-blend-mode:normal}",
		});
		document.head.append(style);
		const t = document.startViewTransition(flip);
		t.ready.then(() => {
			const r = Math.hypot(Math.max(bx, innerWidth - bx), Math.max(by, innerHeight - by));
			html.animate(
				{ clipPath: [`circle(0px at ${bx}px ${by}px)`, `circle(${r}px at ${bx}px ${by}px)`] },
				{ duration: 700, easing: "cubic-bezier(0.3, 0.7, 0.2, 1)", pseudoElement: "::view-transition-new(root)" },
			);
		}).catch(() => {});
		t.finished.finally(() => style?.remove());
		void x;
	}

	function grab(cx, cy) {
		const r = svg.getBoundingClientRect();
		const sx = 120 / r.width;
		drag = { x: (cx - r.left) * sx, y: (cy - r.top) * sx };
		hit.style.cursor = "grabbing";
		wake();
	}
	const onMove = (e) => {
		if (!drag) return;
		const r = svg.getBoundingClientRect();
		drag.x = (e.clientX - r.left) * (120 / r.width);
		drag.y = (e.clientY - r.top) * (120 / r.width);
		wake();
	};
	const onUp = () => {
		if (!drag) return;
		drag = null;
		hit.style.cursor = "";
		wake();
	};
	hit.addEventListener("pointermove", onMove);
	hit.addEventListener("pointerup", onUp);
	hit.addEventListener("pointercancel", onUp);
	hit.addEventListener("lostpointercapture", onUp);

	render();
	return {
		grab,
		tug() {
			pts[N].y += 38;
			armed = false;
			toggle();
			wake();
		},
		destroy() {
			cancelAnimationFrame(raf);
			style?.remove();
		},
	};
}

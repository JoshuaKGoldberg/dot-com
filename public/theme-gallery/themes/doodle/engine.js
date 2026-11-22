const HOLD = 2400; // ms a point stays fully inked
const FADE = 3200; // ms it then takes to dissolve (tail first)
const MAX_POINTS = 2600;

export function start({ root, reducedMotion, onExit }) {
	const host = root.querySelector(".overlay-a") ?? root;
	const canvas = document.createElement("canvas");
	canvas.className = "doodle-canvas";
	host.append(canvas);
	const ctx = canvas.getContext("2d");
	const dark = document.documentElement.classList.contains("dark");
	const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
	let w = 0, h = 0;
	const size = () => {
		w = canvas.clientWidth;
		h = canvas.clientHeight;
		canvas.width = Math.round(w * dpr);
		canvas.height = Math.round(h * dpr);
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
	};
	size();
	window.addEventListener("resize", size);

	/** @type {{x:number,y:number,w:number,t:number,hue:number,brk:boolean}[]} */
	let pts = [];
	let raf = 0, timer = 0, drawing = false, last = null, lw = 4, dist = 0;

	const hueAt = (d) => 205 + 55 * Math.sin(d / 140);

	const render = (now) => {
		raf = 0;
		ctx.clearRect(0, 0, w, h);
		const life = HOLD + FADE;
		// drop dead points from the front
		let cut = 0;
		while (cut < pts.length && now - pts[cut].t > life) cut++;
		if (cut) pts = pts.slice(cut);
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i];
			if (b.brk) continue;
			const age = now - b.t;
			const alpha = reducedMotion ? 1 : age < HOLD ? 1 : 1 - (age - HOLD) / FADE;
			if (alpha <= 0.02) continue;
			ctx.globalAlpha = alpha * alpha * 0.95;
			ctx.strokeStyle = `hsl(${b.hue} 85% ${dark ? 68 : 46}%)`;
			ctx.lineWidth = b.w * (reducedMotion ? 1 : 0.55 + 0.45 * alpha);
			ctx.beginPath();
			ctx.moveTo(a.x, a.y);
			ctx.lineTo(b.x, b.y);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;
		if (!pts.length) return;
		if (reducedMotion) {
			clearTimeout(timer);
			if (!drawing) timer = setTimeout(() => { pts = []; ctx.clearRect(0, 0, w, h); }, 7000);
		} else raf = requestAnimationFrame(render);
	};
	const kick = () => { if (!raf) raf = requestAnimationFrame(render); };

	const add = (e) => {
		const now = performance.now();
		const x = e.clientX - canvas.getBoundingClientRect().left;
		const y = e.clientY - canvas.getBoundingClientRect().top;
		let target;
		if (e.pointerType === "pen" && e.pressure > 0) target = 1.2 + e.pressure * 9;
		else if (last) {
			// no pressure on mouse/touch: slow = fat, fast = thin, like a loaded brush
			const speed = Math.hypot(x - last.x, y - last.y) / Math.max(1, now - last.t);
			target = 2 + 7.5 * Math.max(0, 1 - speed / 2.2);
		} else target = 6;
		lw += (target - lw) * 0.35;
		if (last) dist += Math.hypot(x - last.x, y - last.y);
		const p = { x, y, w: lw, t: now, hue: hueAt(dist), brk: !last };
		pts.push(p);
		if (pts.length > MAX_POINTS) pts.splice(0, pts.length - MAX_POINTS);
		last = p;
	};

	const down = (e) => {
		if (e.button !== 0) return;
		drawing = true;
		last = null;
		lw = 5;
		canvas.setPointerCapture(e.pointerId);
		add(e);
		// a dab so a click still leaves a dot
		pts.push({ ...last, brk: false, x: last.x + 0.01, t: last.t });
		render(performance.now());
		if (!reducedMotion) kick();
	};
	const move = (e) => {
		if (!drawing) return;
		for (const c of e.getCoalescedEvents?.() ?? [e]) add(c);
		if (reducedMotion) render(performance.now());
		else kick();
	};
	const up = () => { drawing = false; last = null; };
	canvas.addEventListener("pointerdown", down);
	canvas.addEventListener("pointermove", move);
	canvas.addEventListener("pointerup", up);
	canvas.addEventListener("pointercancel", up);

	return {
		stop() {
			cancelAnimationFrame(raf);
			clearTimeout(timer);
			window.removeEventListener("resize", size);
			canvas.remove();
			onExit?.();
		},
	};
}

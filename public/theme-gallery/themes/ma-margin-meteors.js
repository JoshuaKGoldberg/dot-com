import { createStage, createAurora, fitCanvas, el, rgba, clamp } from "./_medium-d/kit.js";

export function activate({ root, reducedMotion }) {
	const st = createStage({ root, reducedMotion });
	const aur = createAurora(st, st.topWrap(st.layers.b), { topFrac: 0.34, gain: 1.05 });
	const hint = st.hint("Click the empty margins for a meteor");
	let fx = null, fxx = null, meteors = [], raf = 0, last = 0, autoT = 0, clearT = 0;

	function ensureFx() {
		if (fx) return;
		fx = el("canvas", "position:absolute;left:0;top:0;pointer-events:none", st.layers.oa);
		size();
		st.sizers.push(size);
	}
	function size() { if (fx) fxx = fitCanvas(fx, st.W, st.H, st.dpr); }

	function launch(x, y, strength = 1) {
		ensureFx();
		const dirx = x < st.W / 2 ? 1 : -1; // streak inward-ish from the edge
		const ang = 0.4 + Math.random() * 0.35;
		const dx = Math.cos(ang) * dirx, dy = Math.sin(ang);
		const speed = 900 + Math.random() * 400, dur = 0.7 + Math.random() * 0.3;
		meteors.push({ x: x - dx * speed * dur * 0.5, y: y - dy * speed * dur * 0.5, dx, dy, speed, dur, age: 0, len: 130 + Math.random() * 90 });
		if (meteors.length > 5) meteors.shift();
		aur.flash(0.45 * strength);
		if (st.reduced) { draw(meteors[meteors.length - 1], 0.5); clearTimeout(clearT); clearT = setTimeout(() => fxx?.clearRect(0, 0, st.W, st.H), 1400); return; }
		if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
	}
	function draw(m, f) {
		const age = m.dur * f, a = Math.max(0, Math.sin(clamp(f) * Math.PI)) ** 0.6;
		const hx = m.x + m.dx * m.speed * age, hy = m.y + m.dy * m.speed * age;
		const tl = m.len * Math.min(1, age / 0.12 + 0.2), tx = hx - m.dx * tl, ty = hy - m.dy * tl;
		const dark = st.dark, c = dark ? [225, 240, 255] : [80, 70, 170];
		const g = fxx.createLinearGradient(tx, ty, hx, hy);
		g.addColorStop(0, rgba(c, 0)); g.addColorStop(1, rgba(c, 0.85 * a));
		fxx.strokeStyle = g; fxx.lineWidth = 1.8; fxx.lineCap = "round";
		fxx.beginPath(); fxx.moveTo(tx, ty); fxx.lineTo(hx, hy); fxx.stroke();
		fxx.fillStyle = rgba(dark ? [255, 255, 255] : [255, 200, 120], a);
		fxx.beginPath(); fxx.arc(hx, hy, 2, 0, 6.3); fxx.fill();
		const rg = fxx.createRadialGradient(hx, hy, 0, hx, hy, 14);
		rg.addColorStop(0, rgba(dark ? [190, 230, 255] : [255, 190, 120], 0.3 * a)); rg.addColorStop(1, rgba([255, 255, 255], 0));
		fxx.fillStyle = rg; fxx.fillRect(hx - 14, hy - 14, 28, 28);
	}
	function loop(now) {
		raf = 0;
		if (st.dead) return;
		const dt = Math.min(0.05, (now - last) / 1000); last = now;
		fxx.clearRect(0, 0, st.W, st.H);
		meteors = meteors.filter((m) => (m.age += dt) < m.dur);
		for (const m of meteors) draw(m, m.age / m.dur);
		if (meteors.length) raf = requestAnimationFrame(loop); else fxx.clearRect(0, 0, st.W, st.H);
	}

	// Opt-in click: only on empty margin space; never on links/text/selection.
	st.on(root, "click", (e) => {
		if (e.target.closest?.("a,button,input,textarea,select,summary,label,[role=button]")) return;
		const sel = window.getSelection?.();
		if (sel && !sel.isCollapsed) return;
		const x = e.clientX - st.ox, y = e.clientY - st.oy, col = st.column();
		if (x > col.l + 6 && x < col.r - 6) return;
		hint.hide();
		launch(x, y);
	});
	// occasional automatic meteors in the margins
	const auto = () => {
		autoT = setTimeout(() => {
			if (!document.hidden) {
				const col = st.column(), left = Math.random() < 0.5;
				const mw = left ? col.marginL : col.marginR;
				const x = mw > 80 ? (left ? Math.random() * mw : st.W - Math.random() * mw) : (left ? 20 : st.W - 20);
				launch(x, st.H * (0.06 + Math.random() * 0.4), 0.7);
			}
			auto();
		}, 6500 + Math.random() * 7000);
	};
	if (!reducedMotion) { auto(); autoT = setTimeout(() => launch(st.column().marginL * 0.5 + 20, st.H * 0.2, 0.7), 2200); }
	st.start();
	return () => { clearTimeout(autoT); clearTimeout(clearT); cancelAnimationFrame(raf); fx?.remove(); st.destroy(); };
}

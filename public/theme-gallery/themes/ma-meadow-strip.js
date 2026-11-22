// #288 Meadow Strip: a low meadow along the bottom of the window. #135 fireflies rise from it into the margins,
// scatter from a moving cursor, gather round a resting one, all under a faint aurora.
import { addAurora, canvasAt, clamp, disposer, drawFlies, el, glowSprite, hex, makeFlies, mix, paintRidge, pointer, rgba, rng, stepFlies, ticker, TAU } from "./_medium-b/kit.js";

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const dark = mode === "dark";
	const sceneryA = root.querySelector(".scenery-a");
	const overlay = root.querySelector(".overlay-a");
	if (!sceneryA || !overlay) return;
	addAurora(d, root, { dark, reduced: reducedMotion, height: "52%", intensity: dark ? 0.8 : 0.85, top: 0.96 });
	const wrap = el(sceneryA, "inset:0;overflow:hidden");
	const sprite = glowSprite(dark ? [214, 255, 120] : [232, 160, 20]);
	let W = 0, H = 0, mh = 0, flies = [], fx = null, px = 0, cols = [];
	const R = rng(288);
	const ptr = pointer(d, () => { px = clamp((ptr.x / Math.max(1, W)) * 2 - 1, -1, 1); moveMeadow(); loop.wake(); });
	let loop = { wake() {} };

	const ROWS = dark
		? [["#17463a", "#0f3030"], ["#143c35", "#0e2c2e"], ["#10322f", "#0b2326"]]
		: [["#cde8b8", "#b4daa6"], ["#b8e0a6", "#9fd294"], ["#a4d598", "#8ac98a"]];
	const FLOWERS = dark ? ["rgba(200,190,255,.7)", "rgba(255,235,170,.7)", "rgba(240,244,255,.65)"] : ["#ffffff", "#f7bdd6", "#ffd978", "#d8c6f6"];

	function blades(x, w, h, row, n, hMin, hMax, col) {
		const g = x.createLinearGradient(0, h - hMax, 0, h);
		g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
		x.strokeStyle = g; x.lineCap = "round";
		for (let i = 0; i < n; i++) {
			const bx = R() * w, bh = hMin + R() * (hMax - hMin), lean = (R() - 0.5) * bh * 0.5;
			x.lineWidth = 1 + R() * 1.4;
			x.beginPath(); x.moveTo(bx, h + 2); x.quadraticCurveTo(bx + lean * 0.2, h - bh * 0.6, bx + lean, h - bh); x.stroke();
		}
	}

	function build() {
		W = root.clientWidth; H = root.clientHeight;
		if (!W || !H) return;
		wrap.textContent = ""; overlay.querySelectorAll(".mms").forEach((n) => n.remove());
		mh = Math.round(clamp(H * 0.19, 100, 180));
		const lw = W + 60;
		cols = [];
		// back hill: soft, no blades
		const hill = canvasAt(wrap, "left:-30px;bottom:0;", lw, mh);
		paintRidge(hill.x, lw, mh, { base: mh * 0.5, amp: mh * 0.4, scale: lw * 0.12, seed: 2.2, top: hex(dark ? "#102d33" : "#cfe6c4"), bottom: hex(dark ? "#0b2026" : "#b8dcab"), alpha: dark ? 0.9 : 0.85 });
		for (let i = 0; i < 3; i++) {
			const box = el(wrap, `left:-30px;bottom:0;width:${lw}px;height:${mh}px;will-change:translate`);
			const c = canvasAt(box, `left:0;top:0;transform-origin:50% 100%;will-change:transform;`, lw, mh);
			c.c.className = "mms-sway";
			c.c.style.animationDuration = `${7 + i * 2.3}s`; c.c.style.animationDelay = `-${i * 2.1}s`;
			const topY = mh * (0.5 - i * 0.12);
			c.x.save(); c.x.beginPath(); c.x.rect(0, 0, lw, mh); c.x.clip();
			// ground fill under blades so there are no gaps
			c.x.fillStyle = ROWS[i][1]; c.x.fillRect(0, mh * (0.78 - i * 0.08), lw, mh);
			blades(c.x, lw, mh, i, Math.round(lw * (0.55 + i * 0.25)), mh * (0.16 + i * 0.06), mh * (0.34 + i * 0.12), ROWS[i]);
			for (let k = 0; k < lw / (30 - i * 5); k++) {
				c.x.fillStyle = FLOWERS[(R() * FLOWERS.length) | 0];
				const fx2 = R() * lw, fy = mh - (0.2 + R() * (0.3 + i * 0.12)) * mh * 0.9;
				c.x.beginPath(); c.x.arc(fx2, fy, 1 + R() * 1.4 + i * 0.4, 0, TAU); c.x.fill();
			}
			c.x.restore();
			box.depth = 6 + i * 10;
			cols.push(box);
		}
		fx = canvasAt(overlay, "left:0;top:0", W, H, 1);
		fx.c.classList.add("mms");
		const n = clamp(Math.round((W * H) / 36000), 14, 30);
		flies = makeFlies(n, { w: W, y0: H * 0.3, y1: H - 6 }, R, { size: dark ? [12, 24] : [12, 22] });
		for (const f of flies) respawn(f, true);
		moveMeadow(); draw(2);
	}
	function respawn(f, first) {
		const m = W > 900 ? colL() : 0; // start in a margin when there is one
		f.x = m && R() < 0.9 ? (R() < 0.5 ? R() * m : W - R() * m) : R() * W; f.y = first ? H * (0.3 + R() * 0.7) : H - 8 - R() * mh * 0.4; f.vx = f.vy = 0;
		f.ty = H * (0.28 + R() * 0.6); f.life = first ? R() * 20 : 0; f.max = 18 + R() * 16;
	}
	function moveMeadow() { for (const b of cols) b.style.translate = `${(-px * b.depth).toFixed(1)}px 0`; }
	function draw(t) {
		fx.x.clearRect(0, 0, W, H);
		for (const f of flies) {
			const a = Math.min(1, f.life / 2.5, (f.max - f.life) / 2.5);
			fx.x.globalAlpha = (dark ? 0.9 : 0.9) * clamp(a) * (reducedMotion ? 0.75 : Math.pow(Math.max(0, Math.sin(t * f.bl + f.ph)), 3) * 0.85 + 0.15);
			const s = f.sz * 1;
			fx.x.drawImage(sprite, f.x - s, f.y - s, s * 2, s * 2);
		}
		fx.x.globalAlpha = 1;
	}
	const colL = () => (W - 832) / 2 + 24;
	if (!reducedMotion) {
		loop = ticker(d, (dt, t) => {
			const now = performance.now();
			const area = { w: W, y0: H * 0.22, y1: H - 6 };
			for (const f of flies) { f.life += dt; if (f.life > f.max) respawn(f, false); }
			stepFlies(flies, dt, t, area, ptr, now, { margin: W > 900 ? [colL(), W - colL()] : null, lift: 0, floorPush: 0.3 });
			for (const f of flies) f.vy += (f.ty - f.y) * 0.2 * dt;
			draw(t);
			return true;
		}, { fps: 30, el: wrap });
	}
	const ro = new ResizeObserver(() => { clearTimeout(ro.t); ro.t = setTimeout(() => { build(); loop.wake(); }, 120); });
	ro.observe(root);
	d.add(() => { ro.disconnect(); clearTimeout(ro.t); wrap.remove(); overlay.querySelectorAll(".mms").forEach((n) => n.remove()); });
	build(); loop.wake();
	return () => d.run();
}

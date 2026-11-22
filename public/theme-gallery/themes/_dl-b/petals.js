/* #346: a few petals hang in the margins, tumble on the cursor's wake, and settle back. */
import { clamp, marginStrips, mountCanvas, onResize, pointerV, simLoop } from "./util.js";

const TONES = {
	dark: [["#ffc4d8", "#e89ab8"], ["#e6d2ff", "#b99cf0"], ["#ffd9c0", "#f0a888"]],
	light: [["#f7a8c4", "#e0789e"], ["#cdb4f2", "#a284dc"], ["#fcc6a6", "#ee9a70"]],
};

function petalSprite(c0, c1) {
	const S = 48, c = document.createElement("canvas");
	c.width = c.height = S;
	const x = c.getContext("2d");
	x.translate(S / 2, S / 2);
	const g = x.createLinearGradient(0, -20, 0, 20);
	g.addColorStop(0, c0); g.addColorStop(1, c1);
	x.fillStyle = g;
	x.beginPath();
	x.moveTo(0, 20);
	x.bezierCurveTo(-17, 8, -15, -14, -2, -20);
	x.quadraticCurveTo(0, -18, 2, -20);
	x.bezierCurveTo(15, -14, 17, 8, 0, 20);
	x.fill();
	x.strokeStyle = "rgba(255,255,255,0.35)"; x.lineWidth = 1;
	x.beginPath(); x.moveTo(0, 17); x.quadraticCurveTo(1, 0, 0, -15); x.stroke();
	return c;
}

export function petals(root, d, { dark, reducedMotion }) {
	const host = root.querySelector(".scenery-c");
	if (!host) return;
	const cv = mountCanvas(host, "dl-petals", d);
	const ctx = cv.getContext("2d");
	const sprites = TONES[dark ? "dark" : "light"].map(([a, b]) => petalSprite(a, b));
	const pt = pointerV(d, () => { if (nearPetals()) loop.wake(); });
	let W = 0, H = 0, dpr = 1, list = [], strips = [];
	const R = 170;

	const build = () => {
		const m = marginStrips(host, 260);
		W = m.W; H = m.H; strips = m.strips;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
		let seed = 346;
		const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
		list = [];
		const per = clamp(Math.round(H / 140), 3, 7);
		for (const s of strips) {
			for (let i = 0; i < per; i++) {
				const x = s.x0 + 22 + rnd() * (s.w - 44), y = H * (0.1 + 0.82 * ((i + rnd() * 0.8) / per));
				list.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, th: (rnd() - 0.5) * 2.4, th0: 0, w: 0, fl: rnd() * 1.2, fl0: 0, fw: 0, size: 0.6 + rnd() * 0.45, tone: Math.floor(rnd() * 3), ph: rnd() * 6.28 });
				const p = list[list.length - 1];
				p.th0 = p.th; p.fl0 = p.fl;
			}
		}
		draw();
	};
	const nearPetals = () => {
		if (!pt.has) return false;
		const r = host.getBoundingClientRect(), x = pt.x - r.left;
		return strips.some((s) => x > s.x0 - R && x < s.x0 + s.w + R);
	};

	let t = 0;
	const step = (h) => {
		t += h;
		pt.relax(h);
		const r = host.getBoundingClientRect();
		const px = pt.x - r.left, py = pt.y - r.top;
		let busy = pt.speed > 2;
		for (const p of list) {
			// settle: a soft tether home plus air drag, so a shove becomes a slow swing and drift back
			let ax = (p.hx - p.x) * 1.5 - p.vx * 0.85, ay = (p.hy - p.y) * 1.5 - p.vy * 0.85;
			let torque = (p.th0 - p.th) * 3 - p.w * 1.3, ftorque = (p.fl0 - p.fl) * 4 - p.fw * 1.5;
			if (pt.has) {
				const dx = p.x - px, dy = p.y - py, dl = Math.hypot(dx, dy);
				if (dl < R) {
					const f = (1 - dl / R) ** 2;
					ax += pt.vx * f * 9 + (dx / (dl + 1)) * f * 900;
					ay += pt.vy * f * 9 + (dy / (dl + 1)) * f * 900;
					torque += (pt.vx * dy - pt.vy * dx) / (dl + 20) * f * 0.2; // swirl from the wake
					ftorque += pt.speed * f * 0.012 * Math.sin(p.ph + t * 3);
				}
			}
			// a little flutter while moving
			const sp = Math.hypot(p.vx, p.vy);
			ax += Math.sin(t * 4.1 + p.ph) * sp * 0.5; ay += Math.cos(t * 3.3 + p.ph) * sp * 0.25;
			p.vx += ax * h; p.vy += ay * h;
			const cap = 640, vs = Math.hypot(p.vx, p.vy);
			if (vs > cap) { p.vx *= cap / vs; p.vy *= cap / vs; }
			p.x += p.vx * h; p.y += p.vy * h;
			p.w += torque * h; p.th += p.w * h;
			p.fw += ftorque * h; p.fl += p.fw * h;
			if (Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > 0.15 || sp > 1 || Math.abs(p.w) > 0.01 || Math.abs(p.th0 - p.th) > 0.01 || Math.abs(p.fw) > 0.01 || Math.abs(p.fl0 - p.fl) > 0.01) busy = true;
		}
		return busy;
	};

	const draw = () => {
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, cv.width, cv.height);
		for (const p of list) {
			const sz = 30 * p.size, flip = Math.cos(p.fl);
			const s = Math.max(0.12, Math.abs(flip));
			const c = Math.cos(p.th), sn = Math.sin(p.th);
			ctx.setTransform(c * dpr, sn * dpr, -sn * s * dpr, c * s * dpr, p.x * dpr, p.y * dpr);
			ctx.globalAlpha = (dark ? 0.85 : 0.82) * (flip < 0 ? 0.85 : 1);
			ctx.drawImage(sprites[p.tone], -sz * 0.5, -sz * 0.5, sz, sz);
		}
		ctx.globalAlpha = 1;
	};

	const loop = simLoop(d, { step, draw, fps: 30 });
	build();
	onResize(host, build, d);
	void reducedMotion;
}

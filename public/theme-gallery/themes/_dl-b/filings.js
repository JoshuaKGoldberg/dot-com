/* #359: faint star-dust filings in the side margins align to the cursor like iron filings around a magnet, then relax. */
import { clamp, marginStrips, mountCanvas, onResize, pointerV, simLoop } from "./util.js";

const wrapPi = (a) => { a = (a + Math.PI / 2) % Math.PI; if (a < 0) a += Math.PI; return a - Math.PI / 2; };

export function filings(root, d, { dark, reducedMotion }) {
	const host = root.querySelector(".scenery-c");
	if (!host) return;
	const cv = mountCanvas(host, "dl-filings", d);
	const ctx = cv.getContext("2d");
	const pt = pointerV(d, () => { if (near()) loop.wake(); });
	let W = 0, H = 0, list = [], strips = [], dpr = 1, alpha = 0, mAng = Math.PI / 2, mAngV = 0, drive = 0;
	let hostLeft = 0, hostTop = 0;
	const R = 230;

	const build = () => {
		const m = marginStrips(host, 320);
		W = m.W; H = m.H; strips = m.strips;
		dpr = Math.min(1.5, devicePixelRatio || 1);
		cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
		list = [];
		let seed = 359;
		const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
		for (const s of strips) {
			const step = 36;
			for (let y = 14; y < H - 6; y += step) {
				for (let x = s.x0 + 8; x < s.x0 + s.w - 4; x += step) {
					const px = x + (rnd() - 0.5) * step * 0.85, py = y + (rnd() - 0.5) * step * 0.85;
					const th = rnd() * Math.PI;
					list.push({ x: px, y: py, th, th0: th, w: 0, len: 5 + rnd() * 5.5, tone: rnd(), base: 0.1 + rnd() * 0.06, a: 0, s: 0, ox: 0, oy: 0, vx: 0, vy: 0 });
				}
			}
		}
		for (const f of list) f.a = f.base;
		draw();
	};
	const near = () => {
		if (!pt.has) return false;
		const r = host.getBoundingClientRect();
		const x = pt.x - r.left;
		return strips.some((s) => x > s.x0 - R && x < s.x0 + s.w + R);
	};

	const step = (h) => {
		pt.relax(h);
		const r = host.getBoundingClientRect();
		hostLeft = r.left; hostTop = r.top;
		const px = pt.x - r.left, py = pt.y - r.top, has = pt.has;
		// the magnet's axis turns toward the direction of travel; strength follows how lively the pointer is
		if (pt.speed > 60) {
			const target = Math.atan2(pt.vy, pt.vx);
			mAngV = wrapPi(target - mAng);
			mAng += mAngV * Math.min(1, h * 5);
		}
		drive += (clamp(pt.speed / 700) - drive) * Math.min(1, h * (pt.speed / 700 > drive ? 6 : 1.1));
		const cx = Math.cos(mAng), cy = Math.sin(mAng);
		let busy = drive > 0.01 || pt.speed > 2;
		for (const f of list) {
			let target = f.th0, k = 5, s = 0;
			if (has) {
				const dx = f.x - px, dy = f.y - py, d2 = dx * dx + dy * dy;
				s = Math.exp(-d2 / (R * R * 0.55)) * (0.42 + 0.58 * drive);
				if (s > 0.01) {
					// dipole field direction at this point: B ~ 3(m.r)r - m
					const rl = Math.sqrt(d2) + 0.001, rx = dx / rl, ry = dy / rl, md = cx * rx + cy * ry;
					target = Math.atan2(3 * md * ry - cy, 3 * md * rx - cx);
					k = 5 + 90 * s;
				}
			}
			const diff = wrapPi(target - f.th);
			const c = 2 * Math.sqrt(k) * 0.38; // slightly underdamped so alignment overshoots and wobbles
			f.w += (k * diff - c * f.w) * h;
			f.th += f.w * h;
			// a faint hop toward the magnet that springs back
			let fx = -f.ox * 40 - f.vx * 4.5, fy = -f.oy * 40 - f.vy * 4.5;
			if (s > 0.05) {
				const dx = px - f.x, dy = py - f.y, dl = Math.hypot(dx, dy) + 1;
				fx += (dx / dl) * s * 90 * drive; fy += (dy / dl) * s * 90 * drive;
			}
			f.vx += fx * h; f.vy += fy * h; f.ox += f.vx * h; f.oy += f.vy * h;
			const ta = clamp(f.base + s * 0.8); f.s = s;
			f.a += (ta - f.a) * Math.min(1, h * 6);
			if (Math.abs(diff) > 0.004 || Math.abs(f.w) > 0.01 || Math.abs(f.ox) + Math.abs(f.oy) > 0.05 || Math.abs(ta - f.a) > 0.004) busy = true;
		}
		return busy;
	};

	const draw = () => {
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx.clearRect(0, 0, W, H);
		ctx.lineCap = "round";
		ctx.lineWidth = 1.2;
		const warm = dark ? "255,232,196" : "176,110,70", cool = dark ? "200,218,255" : "60,84,130";
		for (const f of list) {
			const a = clamp(f.a * (dark ? 1 : 0.9));
			if (a < 0.01) continue;
			const L = f.len * (1 + 0.5 * f.s), dx = Math.cos(f.th) * L * 0.5, dy = Math.sin(f.th) * L * 0.5;
			const x = f.x + f.ox, y = f.y + f.oy;
			ctx.strokeStyle = `rgba(${f.tone < 0.22 ? warm : cool},${a.toFixed(3)})`;
			ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
		}
	};

	const loop = simLoop(d, { step, draw, fps: 30 });
	build();
	onResize(host, build, d);
	void alpha; void hostLeft; void hostTop;
	if (reducedMotion) { /* static frame; pointer still reaches in via the loop */ }
}

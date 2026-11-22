import { isDark, rgba, rng, trackPointer, createLoop, makeCanvas, sizeCanvas, idle, onResize } from "./_quiet-e/kit.js";

const BAND = 26; // flock lives in the top 26px: above the header text, never over it

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const overlay = root.querySelector(".site-overlay") || root;
	const header = root.querySelector(".site-header");
	const glint = document.createElement("div");
	glint.className = "qa-glint";
	glint.setAttribute("aria-hidden", "true");
	glint.innerHTML = '<i class="qa-glint-spot"></i>';
	header.append(glint);
	const spot = glint.firstChild;

	let dead = false, W = 0, ctx = null, canvas = null, flock = null, timer = 0;
	const rand = rng(Date.now() & 0xffff);
	let spotX = 0.5, glow = 0, spotTarget = 0.5;

	// Glint: leans toward the cursor along the border, brightens with movement.
	const ptr = trackPointer(() => glintLoop.wake());
	const glintLoop = createLoop((dt) => {
		const r = glint.getBoundingClientRect();
		const near = ptr.p.seen && Math.abs(ptr.p.y - r.top) < 220;
		spotTarget = near ? Math.min(Math.max((ptr.p.x - r.left) / r.width, 0), 1) : spotTarget;
		spotX += (spotTarget - spotX) * 0.07;
		const g = ptr.p.energy;
		glow += (g - glow) * 0.1;
		spot.style.transform = `translateX(${spotX * (r.width - 180)}px)`;
		spot.style.opacity = String(0.45 + glow * 0.5);
		ptr.decay(dt);
		const moving = Math.abs(spotTarget - spotX) > 0.002 || ptr.p.energy > 0 || glow > 0.02;
		if (!moving) spot.style.opacity = "";
		return moving;
	}, { fps: 30, el: glint });
	// Resting position drifts once per visit so it isn't stuck dead-centre.
	spot.style.transform = `translateX(${0.3 * Math.max(0, 800 - 180)}px)`;

	const makeFlock = () => {
		const n = 5 + Math.floor(rand() * 3);
		const dir = rand() < 0.5 ? 1 : -1;
		const y0 = 9 + rand() * 6;
		return {
			dir, x: dir > 0 ? -60 : W + 60, speed: 34 + rand() * 12,
			birds: Array.from({ length: n }, (_, i) => ({
				ox: -dir * (i * (14 + rand() * 6) + rand() * 8),
				oy: (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 2.2 + (rand() - 0.5) * 2,
				ph: rand() * 6.28, s: 0.8 + rand() * 0.45,
			})),
			y0, t: 0,
		};
	};

	const drawBird = (x, y, flap, s) => {
		const w = 5.5 * s, up = (1.2 + 2 * flap) * s;
		ctx.beginPath();
		ctx.moveTo(x - w, y - up);
		ctx.quadraticCurveTo(x - w * 0.4, y - up * 0.2 + 1, x, y);
		ctx.quadraticCurveTo(x + w * 0.4, y - up * 0.2 + 1, x + w, y - up);
		ctx.stroke();
	};

	const flockLoop = createLoop((dt) => {
		if (!flock) return false;
		flock.t += dt;
		flock.x += flock.dir * flock.speed * dt;
		ctx.clearRect(0, 0, W, BAND);
		const orr = overlay.getBoundingClientRect();
		const mouseNear = ptr.p.seen && ptr.p.y - orr.top < 80;
		ctx.lineWidth = 1.1;
		ctx.lineCap = "round";
		ctx.strokeStyle = dark ? "rgba(205,218,242,0.5)" : "rgba(55,72,100,0.42)";
		for (const b of flock.birds) {
			const bx = flock.x + b.ox;
			let by = flock.y0 + b.oy + Math.sin(flock.t * 0.8 + b.ph) * 1.2;
			if (mouseNear && Math.abs(ptr.p.x - bx) < 90) by = Math.max(3, by - 3); // lifts away from the cursor
			const flap = reducedMotion ? 0.4 : 0.5 + 0.5 * Math.sin(flock.t * 7 + b.ph);
			drawBird(bx, by, flap, b.s);
		}
		const done = flock.dir > 0 ? flock.x + flock.birds.at(-1).ox > W + 20 : flock.x + flock.birds.at(-1).ox < -20;
		if (done) { ctx.clearRect(0, 0, W, BAND); flock = null; schedule(35000 + rand() * 30000); return false; }
		return true;
	}, { fps: 30 });

	const schedule = (ms) => { clearTimeout(timer); timer = setTimeout(launch, ms); };
	const launch = () => {
		if (dead) return;
		if (document.hidden || !ctx) return schedule(8000);
		flock = makeFlock();
		flockLoop.wake();
	};

	const size = () => {
		W = root.clientWidth;
		if (!canvas) canvas = makeCanvas(overlay, `left:0;top:0;width:100%;height:${BAND}px`);
		ctx = sizeCanvas(canvas, W, BAND, devicePixelRatio);
	};

	const stopResize = onResize(size);
	// Reduced motion: no animation; a single static flock rests in the margin.
	idle(() => {
		if (dead) return;
		size();
		if (reducedMotion) {
			flock = makeFlock(); flock.x = W * 0.72; flock.t = 0; ctx.lineWidth = 1.1; ctx.lineCap = "round";
			ctx.strokeStyle = dark ? "rgba(205,218,242,0.45)" : "rgba(55,72,100,0.38)";
			for (const b of flock.birds) drawBird(flock.x + b.ox, flock.y0 + b.oy, 0.4, b.s);
			flock = null;
		} else schedule(6000);
	});

	return () => {
		dead = true;
		clearTimeout(timer);
		flockLoop.destroy(); glintLoop.destroy(); ptr.destroy(); stopResize();
		canvas?.remove(); glint.remove();
	};
}

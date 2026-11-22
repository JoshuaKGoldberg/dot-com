import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = document.documentElement.classList.contains("dark");
	const rnd = mulberry(99);
	const R = 96;
	const WIND = 70;
	const rain = dark ? "175,205,245" : "50,85,130";
	let drops = [];
	let splashes = [];

	function respawn(d, k, anywhere) {
		d.x = rnd() * (k.w + 120) - 60;
		d.y = anywhere ? rnd() * k.h : -20 - rnd() * 160;
		d.v = 520 + rnd() * 380;
		d.len = 9 + rnd() * 14;
		d.a = 0.14 + rnd() * 0.3;
		d.slide = 0;
		d.phi = 0;
		d.vx = WIND;
	}

	function build(k) {
		const n = Math.min(320, Math.round((k.w * k.h) / 3600));
		drops = Array.from({ length: n }, () => {
			const d = {};
			respawn(d, k, true);
			return d;
		});
		splashes = [];
	}

	function update(k, dt) {
		const cx = k.x;
		const cy = k.y + 8;
		for (const d of drops) {
			if (d.slide) {
				d.sp += 700 * dt;
				d.phi += (d.slide * d.sp * dt) / R;
				if (Math.abs(d.phi) >= 1.5) {
					d.vx = d.slide * (50 + d.sp * 0.1);
					d.v = 200 + d.sp * 0.3;
					d.x = cx + R * Math.sin(d.phi);
					d.y = cy - R * Math.cos(d.phi);
					d.slide = 0;
				} else {
					d.x = cx + R * Math.sin(d.phi);
					d.y = cy - R * Math.cos(d.phi);
					continue;
				}
			}
			d.x += d.vx * dt;
			d.y += d.v * dt;
			d.v += 0;
			const dx = d.x - cx;
			if (Math.abs(dx) < R) {
				const surf = cy - Math.sqrt(R * R - dx * dx);
				if (d.y >= surf && d.y <= cy + 2 && d.v > 300) {
					d.slide = dx >= 0 ? 1 : -1;
					d.phi = Math.asin(Math.max(-1, Math.min(1, dx / R)));
					d.sp = 60 + d.v * 0.15;
					if (splashes.length < 60) {
						splashes.push({ x: d.x, y: surf, t: 0, s: d.slide });
					}
				} else if (d.y > cy && d.y < cy + 340 && !d.slide && Math.abs(dx) < R * 0.98 && d.v > 300) {
					respawn(d, k, false);
				}
			}
			if (d.y > k.h + 30 || d.x > k.w + 80 || d.x < -80) respawn(d, k, false);
		}
		for (let i = splashes.length - 1; i >= 0; i--) {
			splashes[i].t += dt;
			if (splashes[i].t > 0.28) splashes.splice(i, 1);
		}
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 8,
		rest: [0.72, 0.4],
		onResize: build,
		step(k, dt) {
			if (reducedMotion) return false;
			update(k, dt);
			return true;
		},
		draw(k) {
			const { ctx } = k;
			ctx.clearRect(0, 0, k.w, k.h);
			// sheltered patch, barely lighter / quieter
			const g = ctx.createRadialGradient(k.x, k.y + 30, 10, k.x, k.y + 30, R * 1.25);
			g.addColorStop(0, dark ? "rgba(140,190,240,0.07)" : "rgba(255,255,255,0.4)");
			g.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = g;
			ctx.fillRect(k.x - R * 1.4, k.y - R * 1.4, R * 2.8, R * 2.8);

			ctx.lineCap = "round";
			ctx.lineWidth = 1.1;
			const cy0 = k.y + 8;
			for (const d of drops) {
				if (d.slide) continue;
				if (reducedMotion) {
					const dx = d.x - k.x;
					if (Math.abs(dx) < R && d.y > cy0 - Math.sqrt(R * R - dx * dx) && d.y < cy0 + 330) continue;
				}
				const sp = Math.hypot(d.vx, d.v);
				ctx.strokeStyle = `rgba(${rain},${d.a})`;
				ctx.beginPath();
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(d.x - (d.vx / sp) * d.len, d.y - (d.v / sp) * d.len);
				ctx.stroke();
			}
			ctx.lineWidth = 1.6;
			for (const d of drops) {
				if (!d.slide) continue;
				const tx = Math.cos(d.phi) * d.slide;
				const ty = Math.sin(d.phi) * d.slide;
				ctx.strokeStyle = `rgba(${rain},0.55)`;
				ctx.beginPath();
				ctx.moveTo(d.x, d.y);
				ctx.lineTo(d.x - tx * 9, d.y - ty * 9);
				ctx.stroke();
			}
			ctx.lineWidth = 1;
			for (const s of splashes) {
				const p = s.t / 0.28;
				ctx.strokeStyle = `rgba(${rain},${0.5 * (1 - p)})`;
				ctx.beginPath();
				ctx.arc(s.x, s.y, 2 + p * 5, Math.PI * 1.1, Math.PI * 1.9);
				ctx.stroke();
			}
		},
	});
	return () => kit.destroy();
}

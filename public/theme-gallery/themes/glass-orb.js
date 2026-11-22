import { createKit, mulberry } from "./cursor-kit/kit.js";

export function activate({ root, reducedMotion }) {
	const style = getComputedStyle(root);
	const v = (n) => style.getPropertyValue(n).trim();
	const R = 92;
	let bg = null;
	let bgCtx = null;
	const layerA = root.querySelector(".scenery-a");
	const bgCanvas = document.createElement("canvas");
	bgCanvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
	layerA.append(bgCanvas);
	bg = bgCanvas;
	bgCtx = bgCanvas.getContext("2d");
	let dirty = null;

	function paintBg(k) {
		bg.width = Math.round(k.w * k.dpr);
		bg.height = Math.round(k.h * k.dpr);
		const c = bgCtx;
		c.setTransform(k.dpr, 0, 0, k.dpr, 0, 0);
		c.clearRect(0, 0, k.w, k.h);
		const blobs = [
			[0.15, 0.2, 0.5, v("--orbBlobA")],
			[0.85, 0.35, 0.45, v("--orbBlobB")],
			[0.5, 0.85, 0.5, v("--orbBlobC")],
			[0.8, 0.9, 0.35, v("--orbBlobA")],
		];
		for (const [fx, fy, fr, col] of blobs) {
			const r = fr * Math.max(k.w, k.h);
			const g = c.createRadialGradient(fx * k.w, fy * k.h, 0, fx * k.w, fy * k.h, r);
			g.addColorStop(0, `rgba(${col},0.38)`);
			g.addColorStop(1, `rgba(${col},0)`);
			c.fillStyle = g;
			c.fillRect(0, 0, k.w, k.h);
		}
		// fine lattice: gives the glass something to bend
		const line = v("--orbLine");
		c.strokeStyle = `rgba(${line},0.12)`;
		c.lineWidth = 1;
		c.beginPath();
		const P = 26;
		for (let x = 0.5; x < k.w; x += P) {
			c.moveTo(x, 0);
			c.lineTo(x, k.h);
		}
		for (let y = 0.5; y < k.h; y += P) {
			c.moveTo(0, y);
			c.lineTo(k.w, y);
		}
		c.stroke();
		c.fillStyle = `rgba(${line},0.26)`;
		const rnd = mulberry(7);
		for (let i = 0; i < 70; i++) {
			const x = Math.round(rnd() * (k.w / P)) * P + 0.5;
			const y = Math.round(rnd() * (k.h / P)) * P + 0.5;
			c.beginPath();
			c.arc(x, y, 2 + rnd() * 2.4, 0, 6.2832);
			c.fill();
		}
	}

	const kit = createKit({
		root,
		reducedMotion,
		follow: 6.5,
		rest: [0.74, 0.34],
		onResize: paintBg,
		draw(k) {
			const { ctx } = k;
			if (dirty) ctx.clearRect(dirty[0], dirty[1], dirty[2], dirty[3]);
			const x = k.x;
			const y = k.y;
			const pad = R + 40;
			dirty = [x - pad, y - pad, pad * 2, pad * 2 + 10];
			const d = k.dpr;

			// contact shadow
			let g = ctx.createRadialGradient(x + 6, y + R * 1.05, 4, x + 6, y + R * 1.05, R * 0.95);
			g.addColorStop(0, "rgba(10,20,40,0.26)");
			g.addColorStop(1, "rgba(10,20,40,0)");
			ctx.save();
			ctx.translate(x, y + R * 1.05);
			ctx.scale(1, 0.28);
			ctx.translate(-x, -(y + R * 1.05));
			ctx.fillStyle = g;
			ctx.fillRect(x - R * 1.3, y + R * 1.05 - R, R * 2.6, R * 2);
			ctx.restore();

			// refracted, inverted, magnified background in concentric annuli
			ctx.save();
			const N = 16;
			const lx = (x - k.w / 2) * -0.03;
			const ly = (y - k.h / 2) * -0.03;
			for (let i = 0; i < N; i++) {
				const r0 = (i / N) * R;
				const r1 = ((i + 1) / N) * R + 0.6;
				const mid = (r0 + r1) / (2 * R);
				const s = 2.1 - 1.75 * Math.pow(mid, 1.5);
				ctx.save();
				ctx.beginPath();
				ctx.arc(x, y, r1, 0, 6.2832);
				if (r0 > 0) ctx.arc(x, y, r0, 0, 6.2832, true);
				ctx.clip("evenodd");
				const sw = (2 * R) / s;
				ctx.translate(x, y);
				ctx.scale(-1, -1);
				ctx.drawImage(bg, (x + lx - sw / 2) * d, (y + ly - sw / 2) * d, sw * d, sw * d, -R, -R, 2 * R, 2 * R);
				ctx.restore();
			}
			ctx.restore();

			// glass body: tint, edge darkening, rim light
			g = ctx.createRadialGradient(x, y, R * 0.55, x, y, R);
			g.addColorStop(0, "rgba(255,255,255,0)");
			g.addColorStop(0.8, "rgba(20,50,90,0.14)");
			g.addColorStop(1, "rgba(10,25,60,0.4)");
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, R, 0, 6.2832);
			ctx.fill();

			// caustic: light focused at the lower rim
			ctx.save();
			ctx.globalCompositeOperation = "lighter";
			g = ctx.createRadialGradient(x + R * 0.18, y + R * 0.62, 0, x + R * 0.18, y + R * 0.62, R * 0.7);
			g.addColorStop(0, "rgba(255,238,200,0.38)");
			g.addColorStop(1, "rgba(255,238,200,0)");
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(x, y, R - 1, 0, 6.2832);
			ctx.fill();
			ctx.restore();

			// chromatic rim
			ctx.lineWidth = 1.6;
			ctx.strokeStyle = "rgba(255,120,140,0.35)";
			ctx.beginPath();
			ctx.arc(x - 0.8, y, R - 1, 0, 6.2832);
			ctx.stroke();
			ctx.strokeStyle = "rgba(90,170,255,0.4)";
			ctx.beginPath();
			ctx.arc(x + 0.8, y, R - 1, 0, 6.2832);
			ctx.stroke();
			ctx.lineWidth = 1;
			ctx.strokeStyle = "rgba(255,255,255,0.55)";
			ctx.beginPath();
			ctx.arc(x, y, R - 0.5, 0, 6.2832);
			ctx.stroke();

			// specular highlights
			ctx.save();
			ctx.translate(x - R * 0.34, y - R * 0.46);
			ctx.rotate(-0.6);
			ctx.scale(1, 0.5);
			g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.42);
			g.addColorStop(0, "rgba(255,255,255,0.85)");
			g.addColorStop(1, "rgba(255,255,255,0)");
			ctx.fillStyle = g;
			ctx.beginPath();
			ctx.arc(0, 0, R * 0.42, 0, 6.2832);
			ctx.fill();
			ctx.restore();
			ctx.fillStyle = "rgba(255,255,255,0.5)";
			ctx.beginPath();
			ctx.arc(x + R * 0.42, y + R * 0.38, R * 0.07, 0, 6.2832);
			ctx.fill();
		},
	});
	return () => {
		kit.destroy();
		bgCanvas.remove();
	};
}

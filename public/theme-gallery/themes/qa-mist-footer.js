import { isDark, auroraAt, rgba, trackPointer, createLoop, makeCanvas, sizeCanvas, idle, onResize } from "./_quiet-e/kit.js";

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const footer = root.querySelector(".site-footer");
	const lake = document.createElement("div");
	lake.className = "qa-lake";
	lake.setAttribute("aria-hidden", "true");
	lake.innerHTML = '<i class="qa-mist"></i><i class="qa-mist"></i><i class="qa-mist"></i><div class="qa-lake-line"></div>';
	footer.before(lake);
	const cv = makeCanvas(lake, "left:0;top:39px;width:100%;height:54px");
	let ctx, W = 0, H = 54, lean = 0.5, glow = 0.35, t = 0;
	const SCALE = 0.5; // half-res reflection, upscaled
	const size = () => {
		W = lake.clientWidth;
		ctx = sizeCanvas(cv, W * SCALE, H * SCALE, 1);
		ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
	};

	const ptr = trackPointer();
	const draw = () => {
		if (!ctx) return;
		ctx.clearRect(0, 0, W, H);
		const rect = lake.getBoundingClientRect();
		const target = ptr.p.seen ? Math.min(Math.max((ptr.p.x - rect.left) / rect.width, 0), 1) : 0.5 + (reducedMotion ? 0 : 0.2 * Math.sin(t * 0.07));
		lean += (target - lean) * 0.04;
		const want = 0.32 + ptr.p.energy * 0.6;
		glow += (want - glow) * 0.06;
		const cx = lean * W;
		// Horizontal reflection dashes, brightest under the aurora, fading with depth.
		for (let y = 3; y < H; y += 4) {
			const depth = 1 - y / H;
			const rows = y / 4;
			const n = 26;
			for (let i = 0; i < n; i++) {
				const phase = (i * 0.618 + rows * 0.37) % 1;
				const x = ((phase * W * 1.1) + Math.sin(t * 0.5 + rows + i) * 6) % W;
				const dx = (x - cx) / (W * 0.22);
				const g = Math.exp(-dx * dx);
				const a = g * glow * depth * (0.55 + 0.45 * Math.sin(t * 0.9 + i * 2 + rows));
				if (a < 0.015) continue;
				const len = 10 + 26 * g;
				ctx.fillStyle = rgba(auroraAt(dark, 0.15 + 0.7 * (x / W)), a * (dark ? 0.9 : 0.55));
				ctx.fillRect(x - len / 2, y, len, 1.2);
			}
		}
	};

	let first = true;
	const loop = createLoop((dt) => {
		t += reducedMotion ? 0 : dt;
		ptr.decay(dt);
		draw();
		first = false;
		return !reducedMotion || Math.abs(glow - (0.32 + ptr.p.energy * 0.6)) > 0.01;
	}, { fps: 20, el: lake });
	const stopPtr = () => {};
	const onMove = () => loop.wake();
	addEventListener("pointermove", onMove, { passive: true });

	idle(() => { size(); draw(); loop.wake(); });
	const stopResize = onResize(() => { size(); draw(); });

	return () => {
		loop.destroy(); ptr.destroy(); stopResize();
		removeEventListener("pointermove", onMove);
		lake.remove();
	};
}

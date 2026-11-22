import { isDark, trackPointer, createLoop, pixelCanvas, rampTable, clamp, gauss } from "./_quiet-b/kit.js";

const H = 170; // css height of the leak strip

export function activate({ root, reducedMotion }) {
	const dark = isDark();
	const color = rampTable(dark);
	const layer = root.querySelector(".site-scenery .scenery-a");
	const px = pixelCanvas(layer, { scale: 5, style: "left:0;top:0;width:100%;" });
	px.canvas.style.height = H + "px";
	const gain = dark ? 0.55 : 0.4;
	const ptr = trackPointer(() => loop.wake());

	const draw = (t) => {
		const W = layer.clientWidth || innerWidth;
		px.size(W, H);
		const w = px.w, h = px.h, sc = W / w;
		const top = layer.getBoundingClientRect().top;
		const has = ptr.has;
		const cxp = has ? (ptr.sx - layer.getBoundingClientRect().left) / sc : w / 2;
		const prox = has ? clamp(1 - Math.max(0, ptr.sy - top) / 220) ** 1.5 : 0;
		const strength = prox * (0.55 + 0.9 * ptr.energy);
		px.paint((x, y, out) => {
			const yy = y * (H / h); // css px below the top edge
			// a hairline of light along the whole edge, barely there
			const hair = Math.exp(-yy / 1.6) * 0.16;
			// ambient drift: a few slow soft pools
			const amb = 0.5 + 0.5 * Math.sin(x * 0.045 * 5 / 5 + t * 0.25 + Math.sin(x * 0.02 + t * 0.13) * 1.7);
			const ambient = Math.exp(-yy / 5) * (1 - yy / H) * (0.1 + 0.1 * amb);
			// light leaking in near the pointer: a fan that widens as it falls
			const sig = (20 + yy * 0.45 + ptr.energy * 24) / sc;
			const fan = gauss(x - cxp, sig) * Math.exp(-yy / (18 + 34 * strength)) * (1 - yy / H) ** 2;
			const leak = fan * strength * 1.1;
			color(0.12 + (x / w) * 0.6 + 0.12 * Math.sin(t * 0.15) + (has ? ((x - cxp) / w) * 0.25 : 0), out);
			return (hair + ambient + leak) * gain;
		});
	};

	const loop = createLoop({
		fps: 24,
		watch: [px.canvas],
		frame(dt, t) {
			ptr.step(dt);
			draw(reducedMotion ? 2 : t);
			return !reducedMotion || ptr.busy();
		},
	});
	draw(2);
	loop.wake();
	const onResize = () => draw(loop.t || 2);
	window.addEventListener("resize", onResize);

	return () => {
		window.removeEventListener("resize", onResize);
		loop.destroy();
		ptr.destroy();
		px.remove();
	};
}

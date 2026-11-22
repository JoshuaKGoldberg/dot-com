// _vs2/portrait.js: composes the hero portrait once on a canvas: the photo's background at 70% opacity, Josh at 100%
// (via assets/josh-mask.png), and a soft rim glow that follows his silhouette (a one-off blur of the mask, build time only).
import { isDark } from "../_refined-e/kit.js";

const load = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });

export function vsPortrait(root, { bgAlpha = 0.7, glow = 0.5 } = {}) {
	const pic = root.querySelector(".site-portrait");
	if (!pic) return () => {};
	const dark = isDark();
	const img = pic.querySelector(dark ? ".site-portrait-dark" : ".site-portrait-light");
	if (!img) return () => {};
	let canvas = null, dead = false;
	const base = new URL("../../assets/", import.meta.url).href;
	Promise.all([load(img.currentSrc || img.src), load(base + "josh-mask.png")]).then(([photo, mask]) => {
		if (dead) return;
		const N = 256, S = Math.min(2, Math.max(1, Math.round(devicePixelRatio || 1))) * N;
		const mk = () => { const c = document.createElement("canvas"); c.width = c.height = S; return [c, c.getContext("2d")]; };
		// mask -> alpha channel
		const [mc, mg] = mk();
		mg.drawImage(mask, 0, 0, S, S);
		const d = mg.getImageData(0, 0, S, S);
		for (let i = 0; i < d.data.length; i += 4) { d.data[i + 3] = d.data[i]; d.data[i] = d.data[i + 1] = d.data[i + 2] = 255; }
		mg.putImageData(d, 0, 0);
		// person only
		const [pc, pg] = mk();
		pg.drawImage(photo, 0, 0, S, S);
		pg.globalCompositeOperation = "destination-in"; pg.drawImage(mc, 0, 0);
		// rim glow: blurred silhouette, tinted once
		const [gc, gg] = mk();
		gg.filter = `blur(${S * 0.035}px)`; gg.drawImage(mc, 0, 0); gg.filter = "none";
		gg.globalCompositeOperation = "source-in";
		const gr = gg.createLinearGradient(0, 0, S, S);
		if (dark) { gr.addColorStop(0, "rgb(120,255,205)"); gr.addColorStop(0.55, "rgb(120,190,255)"); gr.addColorStop(1, "rgb(190,150,255)"); }
		else { gr.addColorStop(0, "rgb(255,255,255)"); gr.addColorStop(1, "rgb(235,225,255)"); }
		gg.fillStyle = gr; gg.fillRect(0, 0, S, S);
		// final
		canvas = document.createElement("canvas");
		canvas.className = "vs-portrait"; canvas.width = canvas.height = S;
		canvas.setAttribute("aria-hidden", "true");
		const g = canvas.getContext("2d");
		g.beginPath(); g.arc(S / 2, S / 2, S / 2, 0, 6.2832); g.clip();
		g.globalAlpha = bgAlpha; g.drawImage(photo, 0, 0, S, S);
		g.globalAlpha = glow * (dark ? 0.55 : 0.7); g.drawImage(gc, 0, 0);
		g.globalAlpha = 1; g.drawImage(pc, 0, 0);
		pic.appendChild(canvas); pic.classList.add("vs-fx");
	}).catch(() => {});
	return () => { dead = true; canvas?.remove(); pic.classList.remove("vs-fx"); };
}

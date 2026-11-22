// _vs4/footer.js: the footer is the header aurora again, much larger and mirrored: it rises from the bottom edge (brightness can only
// fall upward), with no lake, ridges, fog or horizon. A star / circuit network (network.js) crosses it. Both fade up with dwell.
import { GL, footerStage, createLoop, isDark, clamp, idle } from "../_refined-e/kit.js";
import { AURORA_FS_FOOT, Drape, HPX } from "./aurora.js";
import { footNetwork } from "./network.js";

const FPS = 20;
const FOOT_H = 360; // footer min-height (was 600; Josh halved the empty space above the credit); the aurora fills it

export function vsFooter(root, { reducedMotion, seed, light, net = "sparse", dwell, swell = 0, amp = 1, flow = 0.8, nearBoost = false }) {
	const dark = isDark();
	const stage = footerStage(root, { height: FOOT_H });
	if (!stage) return null;
	const { host } = stage;
	const wrap = document.createElement("div");
	wrap.className = "vs-foot-aurora";
	wrap.setAttribute("aria-hidden", "true");
	wrap.style.cssText = "position:absolute;left:0;bottom:0;width:100%;pointer-events:none;contain:paint;";
	host.append(wrap);
	const gl = new GL(wrap, AURORA_FS_FOOT, { scale: 0.22 });
	const glow = wrap.firstElementChild;
	if (glow) glow.style.cssText += ";opacity:.1;will-change:opacity";
	const D = new Drape({ reduced: reducedMotion, dark, am: (dark ? 0.4 : 0.7) * amp });
	const network = footNetwork(host, { mode: net, seed, dark, reduced: reducedMotion, nearBoost });
	D.flow = 0; D.fx = 0;
	let W = 1, H = 1, HF = 520, S = 1.7, v = 0, lastT = 0;
	const ptr = { x: 0, y: 0, has: false, cx: 0, cy: 0 };
	const hostRect = () => host.getBoundingClientRect();

	function measureAvoid() {
		const c = stage.footer.querySelector(".vs-credit"), hr = hostRect();
		if (!c) return null;
		const r = c.getBoundingClientRect();
		return { cx: r.left - hr.left + r.width / 2, cy: r.top - hr.top + r.height / 2, rx: r.width / 2 + 70, ry: r.height / 2 + 46 };
	}
	function layoutNet() { if (W > 4) network.build(W, H, measureAvoid()); }

	function draw(t, dt) {
		const hr = hostRect();
		if (dwell) { const P = dwell.P; ptr.has = P.has; ptr.x = P.x - hr.left; ptr.y = P.y - hr.top; }
		// the aurora: header state machine, cursor mapped into the shader's header-scale units; PR is the footer's soft proximity
		// the cursor x only counts once there is a pointer near the footer (ptr.x defaults to 0, which used to drag the light to the left edge and then slide it back)
		const prox = dwell ? dwell.target.foot : 0;
		D.aim(ptr.has && prox > 0.03 ? ptr.x / S : D.s.tcx, prox);
		// flow: the footer's lights keep moving while the cursor hovers the bloomed footer; calm and nearly still otherwise
		const target = reducedMotion ? 0 : flow * Math.min(1, D.s.pr * 1.4) * (0.3 + 0.7 * v);
		D.flow += (target - D.flow) * (1 - Math.exp(-dt * 0.9));
		D.fx += dt * D.flow * 0.03;
		D.step(dt);
		// "swell": the whole drape grows upward from the bottom edge as dwell rises (a slow tide)
		const sc = 1 / (1 - swell + swell * v);
		gl.draw(D.uniforms(HPX * sc, W / S * 1, [0, 0, 0], 1, light));
		network.draw(dt, ptr, v, hr.top, D.flow);
	}
	const loop = createLoop({ host, fps: FPS, reduced: reducedMotion, draw });

	let cancel = () => {};
	stage.onSize = (s) => {
		W = s.w; H = s.h;
		HF = Math.min(H, 540); S = HF / HPX;
		wrap.style.height = HF + "px";
		gl.resize(W, HF);
		D.s.cx = D.s.tcx = W / 2 / S;
		cancel(); cancel = idle(() => { layoutNet(); loop.start(); loop.redraw(); });
	};
	document.fonts?.ready.then(() => { layoutNet(); loop.redraw(); });
	stage.layout();

	return {
		stage, drape: D, gl, network,
		setDwell(val, o) {
			v = val;
			D.lv = val; D.lr = o.rest / o.peak;
			if (glow) glow.style.opacity = o.peak.toFixed(3);
			network.setRest(o.netRest);
			loop.wake();
		},
		destroy() { cancel(); loop.destroy(); gl.destroy(); network.destroy(); wrap.remove(); stage.destroy(); },
	};
}

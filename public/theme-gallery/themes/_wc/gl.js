// _wc/gl.js: swap the fragment shader of an existing _vs4 GL canvas (same canvas, same context, same opacity driver) for the watercolor one.
import { wcShader, wcUniforms } from "./shader.js";

function retarget(g, fs) {
	const gl = g.gl; if (!gl || !g.ok) return false;
	const sh = (type, src) => { const x = gl.createShader(type); gl.shaderSource(x, src); gl.compileShader(x); if (!gl.getShaderParameter(x, gl.COMPILE_STATUS)) { console.warn("[wc]", gl.getShaderInfoLog(x)); return null; } return x; };
	const vsrc = gl.getAttachedShaders(g.pr).map((s) => [gl.getShaderParameter(s, gl.SHADER_TYPE), gl.getShaderSource(s)]).find(([t]) => t === gl.VERTEX_SHADER)[1];
	const vs = sh(gl.VERTEX_SHADER, vsrc), f = sh(gl.FRAGMENT_SHADER, fs); if (!vs || !f) return false;
	const pr = gl.createProgram(); gl.attachShader(pr, vs); gl.attachShader(pr, f); gl.linkProgram(pr);
	if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { console.warn("[wc]", gl.getProgramInfoLog(pr)); return false; }
	gl.deleteProgram(g.pr); g.pr = pr; g.locs = {}; gl.useProgram(pr);
	const loc = gl.getAttribLocation(pr, "p"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
	return true;
}

// the cursor-pulled pigment trail (#528): samples of the drape's cursor x, each fading over a few seconds
function trail() {
	const pts = []; let lastX = null, lastT = 0, hue = 0.1;
	return {
		feed(cx, pr, now) {
			if (pr > 0.08 && (lastX === null || Math.abs(cx - lastX) > 14) && now - lastT > 90) {
				hue = (hue + 0.17) % 1.15; pts.push({ x: cx, t: now, h: hue }); if (pts.length > 8) pts.shift(); lastX = cx; lastT = now;
			}
			if (pr < 0.03) lastX = null;
		},
		array(now) {
			const a = new Float32Array(24);
			pts.forEach((p, i) => { const age = (now - p.t) / 1000, w = Math.min(1, age / 0.9) * Math.exp(-Math.max(0, age - 1) / 4.2) * (age < 12 ? 1 : 0); a[i * 3] = p.x; a[i * 3 + 1] = w; a[i * 3 + 2] = p.h; });
			return a;
		},
	};
}

export function applyWatercolor(mode, scale, boost = false) {
	const hook = window.__vs4; if (!hook) return () => {};
	const undo = [];
	const doOne = (obj, foot) => {
		const g = obj?.gl; if (!g || !g.ok) return;
		if (!retarget(g, wcShader(mode, foot, boost))) return;
		const base = wcUniforms(mode), tr = mode === "pull" ? trail() : null, empty = new Float32Array(24);
		const draw0 = g.draw; // prototype method; shadow it on the instance
		g.draw = (u) => {
			const now = performance.now(); let extra = base;
			if (tr) { tr.feed(u.CX, u.PR, now); extra = { ...base, TR: tr.array(now) }; }
			else extra = { ...base, TR: empty };
			return draw0.call(g, { ...u, ...extra });
		};
		if (scale) { g.scale = scale; const p = g.c.parentElement; if (p) g.resize(p.clientWidth, p.clientHeight); }
		undo.push(() => { delete g.draw; });
	};
	doOne(hook.aur, false); doOne(hook.foot, true);
	try { hook.aur?.draw(0.016); hook.foot?.stage?.layout?.(); } catch {}
	return () => undo.forEach((f) => f());
}

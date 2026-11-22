const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform float uCol;
uniform vec3 uInk;
uniform vec3 uPaper;

float bayer2(vec2 a){ a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
float bayer4(vec2 a){ return bayer2(0.5 * a) * 0.25 + bayer2(a); }
float bayer8(vec2 a){ return bayer4(0.5 * a) * 0.25 + bayer2(a); }

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p){
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
	return v;
}

void main(){
	vec2 uv = gl_FragCoord.xy / uRes;
	vec2 p = vec2(uv.x * uRes.x / uRes.y, uv.y) * 2.2;
	float t = uTime * 0.04;
	vec2 w = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3 - t)));
	float n = fbm(p + 1.8 * w + vec2(0.0, t * 0.5));
	float tide = 0.5 + 0.5 * sin(uv.y * 5.0 + n * 5.0 - uTime * 0.08);
	float v = clamp((n - 0.3) * 1.9, 0.0, 1.0) * (0.45 + 0.55 * tide);

	float dx = abs(gl_FragCoord.x - 0.5 * uRes.x);
	float edge = smoothstep(uCol - 10.0, uCol + 80.0, dx);
	v *= edge * 0.85;

	float ink = step(bayer8(gl_FragCoord.xy) + 0.004, v);
	gl_FragColor = vec4(mix(uPaper, uInk, ink), 1.0);
}`;

function rgb(css) {
	const c = document.createElement("canvas");
	c.width = c.height = 1;
	const g = c.getContext("2d");
	g.fillStyle = css;
	g.fillRect(0, 0, 1, 1);
	const d = g.getImageData(0, 0, 1, 1).data;
	return [d[0] / 255, d[1] / 255, d[2] / 255];
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function ditherPortrait(root, mode, colors) {
	const portrait = root.querySelector(".site-portrait");
	const img = portrait?.querySelector(mode === "dark" ? ".site-portrait-dark" : ".site-portrait-light");
	if (!portrait || !img) {
		return;
	}

	const draw = () => {
		const size = 150;
		const work = document.createElement("canvas");
		work.width = work.height = size;
		const g = work.getContext("2d", { willReadFrequently: true });
		g.drawImage(img, 0, 0, size, size);
		let data;
		try {
			data = g.getImageData(0, 0, size, size);
		} catch {
			return;
		}
		const ink = rgb(colors.ink).map((v) => v * 255);
		const paper = rgb(colors.paper).map((v) => v * 255);
		const dark = mode === "dark";
		for (let y = 0; y < size; y++) {
			for (let x = 0; x < size; x++) {
				const i = (y * size + x) * 4;
				const a = data.data[i + 3];
				let lum = (0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2]) / 255;
				lum = Math.min(1, Math.max(0, (lum - 0.5) * 1.35 + 0.5));
				const threshold = (BAYER4[(y % 4) * 4 + (x % 4)] + 0.5) / 16;
				const isInk = dark ? lum > threshold : lum < threshold;
				const c = isInk ? ink : paper;
				data.data[i] = c[0];
				data.data[i + 1] = c[1];
				data.data[i + 2] = c[2];
				data.data[i + 3] = a;
			}
		}
		g.putImageData(data, 0, 0);
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = size;
		canvas.setAttribute("role", "img");
		canvas.setAttribute("aria-label", img.alt || "Portrait");
		canvas.getContext("2d").drawImage(work, 0, 0);
		portrait.append(canvas);
		portrait.classList.add("is-dithered");
	};

	if (img.complete && img.naturalWidth) {
		draw();
	} else {
		img.addEventListener("load", draw, { once: true });
	}
}

export function activate({ root, mode, reducedMotion }) {
	const style = getComputedStyle(root);
	const inkCss = style.getPropertyValue("--ditherInk").trim() || "#777";
	const paperCss = style.getPropertyValue("--siteBg").trim() || "#fff";

	ditherPortrait(root, mode, { ink: style.getPropertyValue("--portraitInk").trim() || "#111", paper: paperCss });

	const scenery = root.querySelector(".scenery-a");
	if (!scenery) {
		return;
	}

	const canvas = document.createElement("canvas");
	const gl = canvas.getContext("webgl", { alpha: false, antialias: false, powerPreference: "low-power" });
	if (!gl) {
		return;
	}

	const compile = (type, source) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null;
	};
	const vs = compile(gl.VERTEX_SHADER, VERT);
	const fs = compile(gl.FRAGMENT_SHADER, FRAG);
	if (!vs || !fs) {
		return;
	}
	const program = gl.createProgram();
	gl.attachShader(program, vs);
	gl.attachShader(program, fs);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		return;
	}
	gl.useProgram(program);

	const buffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const loc = gl.getAttribLocation(program, "p");
	gl.enableVertexAttribArray(loc);
	gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

	const u = (name) => gl.getUniformLocation(program, name);
	const uRes = u("uRes");
	const uTime = u("uTime");
	const uCol = u("uCol");
	gl.uniform3fv(u("uInk"), rgb(inkCss));
	gl.uniform3fv(u("uPaper"), rgb(paperCss));

	scenery.append(canvas);
	scenery.classList.add("has-gl");

	const start = performance.now();
	let frame = 0;
	let last = 0;

	function resize() {
		// Half resolution; the CSS upscales with nearest-neighbour so each dither cell is 2 CSS px.
		const w = Math.max(2, Math.min(1400, Math.round(scenery.clientWidth / 2)));
		const h = Math.max(2, Math.min(900, Math.round(scenery.clientHeight / 2)));
		canvas.width = w;
		canvas.height = h;
		gl.viewport(0, 0, w, h);
		const page = root.querySelector(".site-page");
		const column = Math.min(scenery.clientWidth, page ? page.clientWidth : 800) / 4;
		gl.uniform2f(uRes, w, h);
		gl.uniform1f(uCol, column);
		render();
	}

	function render(now = performance.now()) {
		const t = reducedMotion ? 40 : (now - start) / 1000 + 40;
		gl.uniform1f(uTime, t);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}

	function loop(now) {
		frame = requestAnimationFrame(loop);
		if (document.hidden || now - last < 60) {
			return;
		}
		last = now;
		render(now);
	}

	const observer = new ResizeObserver(resize);
	observer.observe(scenery);
	resize();

	if (!reducedMotion) {
		frame = requestAnimationFrame(loop);
	}

	return () => {
		cancelAnimationFrame(frame);
		observer.disconnect();
		gl.getExtension("WEBGL_lose_context")?.loseContext();
		canvas.remove();
	};
}

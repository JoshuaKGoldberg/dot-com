import { isEmptyAt, addHint, addUI, isDark, watchDark, rng, clamp, lerp, smooth, TAU } from "./forest-kit/kit.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.min.js";
const R = 8; // island radius
const WATER = 0.5;

const LOOK = {
	light: { amb: 0xcfe0ff, ambI: 0.75, sun: 0xfff1d6, sunI: 2.1, rim: 0xbcd4ff, rimI: 0.5, water: 0x62aac4, bird: 0x22313f, grass: [0x7fae5e, 0x69974f, 0x8bb866], sand: 0xd6c795, rock: 0x93979c, snow: 0xf2f5f8, pine: [0x2f6a4a, 0x3c7d55, 0x285a3f], base: 0x8a6a4e, baseLow: 0x6d513b },
	dark: { amb: 0x7d93d6, ambI: 1.25, sun: 0xc4d4ff, sunI: 1.5, rim: 0x8fa3e6, rimI: 0.9, water: 0x2f5aa0, bird: 0xd6e2fa, grass: [0x4a7886, 0x3f6b7a, 0x57879a], sand: 0x6a7a96, rock: 0x6f7ea6, snow: 0xb6c6ee, pine: [0x1f4a5c, 0x265668, 0x183f50], base: 0x40406a, baseLow: 0x2c2c50 },
};

function fallbackSVG() {
	const ns = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(ns, "svg");
	svg.setAttribute("class", "lpd-fallback");
	svg.setAttribute("viewBox", "0 0 1000 600");
	svg.setAttribute("preserveAspectRatio", "xMidYMax slice");
	const poly = (cls, pts) => { const p = document.createElementNS(ns, "polygon"); p.setAttribute("class", cls); p.setAttribute("points", pts); svg.appendChild(p); };
	poly("d", "120,470 330,250 420,330 520,200 700,420 900,470");
	poly("c", "300,470 330,250 420,330 380,470");
	poly("c", "520,200 700,420 520,470 470,330");
	poly("b", "60,520 250,400 420,470 640,390 860,480 960,520 960,600 60,600");
	poly("a", "40,560 280,470 500,520 760,455 980,560 980,600 40,600");
	poly("w", "380,540 560,500 700,540 540,585");
	return svg;
}

export function activate({ root, reducedMotion }) {
	let dark = isDark();
	const reduced = reducedMotion || matchMedia("(prefers-reduced-motion: reduce)").matches;
	const host = root.querySelector(".scenery-a");
	const fallback = fallbackSVG();
	host.appendChild(fallback);
	const hint = addHint(root, "Drag the empty margins to orbit the island");
	const ui = addUI(root, `<span>Island</span><button type="button" aria-pressed="${!reduced}">Auto-orbit</button>`);
	const btn = ui.querySelector("button");
	let auto = !reduced;
	btn.addEventListener("click", () => { auto = !auto; btn.setAttribute("aria-pressed", String(auto)); if (reduced) render(); });

	let dead = false, T = null, renderer = null, scene, camera, raf = 0, idleId = 0, last = 0;
	let canvas = null, ro = null;
	const cleanups = [];
	const on = (t, ty, fn, o) => { t.addEventListener(ty, fn, o); cleanups.push(() => t.removeEventListener(ty, fn, o)); };
	let az = 0.7, pol = 1.12, vAz = 0, vPol = 0, drag = null, time = 0;
	let W = 1, Hh = 1;
	const mats = {};
	let birds = [], water = null, waterBase = null, lights = {}, treeMeshes = [], terrain = null, skirt = null;
	const geos = [];

	const unwatch = watchDark((d) => { dark = d; if (T) { applyLook(); render(); } });

	function noise2(seed) {
		const r = rng(seed);
		const P = Array.from({ length: 256 }, () => r());
		const at = (i, j) => P[(((i * 31 + j * 17 + ((i * j) % 13)) % 256) + 256) % 256];
		return (x, y) => {
			const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
			const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
			return lerp(lerp(at(i, j), at(i + 1, j), u), lerp(at(i, j + 1), at(i + 1, j + 1), u), v);
		};
	}

	function heightAt(n, x, z) {
		const r = Math.hypot(x, z) / R;
		let h = 1.0 + (n(x * 0.35 + 3, z * 0.35) - 0.5) * 1.4 + (n(x * 0.9, z * 0.9 + 9) - 0.5) * 0.5;
		const peaks = [[-2.6, -2.4, 4.2, 2.6], [1.2, -3.8, 3.1, 2.0], [3.5, -0.6, 2.4, 1.6]];
		for (const [px, pz, ph, pr] of peaks) h += ph * Math.exp(-((x - px) ** 2 + (z - pz) ** 2) / (pr * pr));
		h -= 1.7 * Math.exp(-(((x - 0.3) ** 2) / 12 + ((z - 2.4) ** 2) / 7)); // lake basin
		h = lerp(h, 0.9, smooth(clamp((r - 0.82) / 0.18)));
		return h;
	}

	function buildAll() {
		const rand = rng(7);
		const n = noise2(5);
		// terrain: polar grid, flat-shaded vertex-coloured faces
		const rings = 20, segs = 44;
		const pos = [];
		const grid = [];
		for (let i = 0; i <= rings; i++) {
			const row = [];
			for (let j = 0; j < segs; j++) {
				const rr = (i / rings) * R * (i > 0 && i < rings ? 1 + (rand() - 0.5) * 0.1 : 1);
				const a = ((j + (i % 2) * 0.5) / segs) * TAU;
				const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
				row.push([x, heightAt(n, x, z), z]);
			}
			grid.push(row);
		}
		const tris = [];
		for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
			const j1 = (j + 1) % segs;
			const a = grid[i][j], b = grid[i][j1], c = grid[i + 1][j], d = grid[i + 1][j1];
			if (i > 0) tris.push(a, b, c);
			tris.push(b, d, c);
		}
		const g = new T.BufferGeometry();
		const P = new Float32Array(tris.length * 3);
		tris.forEach((v, k) => P.set(v, k * 3));
		g.setAttribute("position", new T.BufferAttribute(P, 3));
		g.setAttribute("color", new T.BufferAttribute(new Float32Array(tris.length * 3), 3));
		g.computeVertexNormals();
		terrain = new T.Mesh(g, new T.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
		scene.add(terrain);
		geos.push(g);
		terrain.userData.rand = rng(3);
		// skirt (diorama plate)
		const sg = new T.CylinderGeometry(R, R * 0.55, 3.2, 40, 1, true);
		skirt = new T.Mesh(sg, new T.MeshLambertMaterial({ color: 0x8a6a4e, flatShading: true, side: T.DoubleSide }));
		skirt.position.y = 0.9 - 1.6 - 0.02;
		scene.add(skirt);
		geos.push(sg);
		// water
		const wr = 20, ws = 40;
		const wp = [], wi = [];
		wp.push(0, 0, 0);
		for (let i = 1; i <= wr; i++) for (let j = 0; j < ws; j++) { const rr = (i / wr) * R * 0.93; const a = (j / ws) * TAU; wp.push(Math.cos(a) * rr, 0, Math.sin(a) * rr); }
		for (let j = 0; j < ws; j++) wi.push(0, 1 + j, 1 + ((j + 1) % ws));
		for (let i = 1; i < wr; i++) for (let j = 0; j < ws; j++) {
			const a = 1 + (i - 1) * ws + j, b = 1 + (i - 1) * ws + ((j + 1) % ws), c = a + ws, d = b + ws;
			wi.push(a, c, b, b, c, d);
		}
		const wg = new T.BufferGeometry();
		wg.setAttribute("position", new T.BufferAttribute(new Float32Array(wp), 3));
		wg.setIndex(wi);
		waterBase = new Float32Array(wp);
		water = new T.Mesh(wg, new T.MeshStandardMaterial({ color: 0x62aac4, flatShading: true, roughness: 0.28, metalness: 0.1, transparent: true, opacity: 0.9, side: T.DoubleSide }));
		water.position.y = WATER;
		scene.add(water);
		geos.push(wg);
		terrain.userData.n = n;
	}

	function colorTerrain() {
		const L = LOOK[dark ? "dark" : "light"];
		const g = terrain.geometry;
		const P = g.attributes.position.array, C = g.attributes.color.array;
		const col = new T.Color();
		const r = rng(11);
		for (let f = 0; f < P.length / 9; f++) {
			const y = (P[f * 9 + 1] + P[f * 9 + 4] + P[f * 9 + 7]) / 3;
			const x = (P[f * 9] + P[f * 9 + 3] + P[f * 9 + 6]) / 3, z = (P[f * 9 + 2] + P[f * 9 + 5] + P[f * 9 + 8]) / 3;
			let hexv;
			if (y > 4.1) hexv = L.snow;
			else if (y > 3.0) hexv = L.rock;
			else if (y < WATER + 0.3 && Math.hypot(x - 0.3, z - 2.4) < 6) hexv = L.sand;
			else hexv = L.grass[(r() * 3) | 0];
			col.setHex(hexv);
			const jitter = 0.92 + r() * 0.16;
			for (let v = 0; v < 3; v++) { C[f * 9 + v * 3] = col.r * jitter; C[f * 9 + v * 3 + 1] = col.g * jitter; C[f * 9 + v * 3 + 2] = col.b * jitter; }
		}
		g.attributes.color.needsUpdate = true;
	}

	function buildTrees() {
		const n = terrain.userData.n;
		const r = rng(21);
		const spots = [];
		for (let k = 0; k < 900 && spots.length < 110; k++) {
			const a = r() * TAU, rr = Math.sqrt(r()) * R * 0.9;
			const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
			const y = heightAt(n, x, z);
			if (y < WATER + 0.35 || y > 3.3) continue;
			if (n(x * 0.5 + 40, z * 0.5) < 0.38) continue;
			if (spots.some((s) => (s[0] - x) ** 2 + (s[2] - z) ** 2 < 0.5)) continue;
			spots.push([x, y, z, 0.7 + r() * 0.7]);
		}
		const cone = new T.ConeGeometry(0.62, 1.25, 5);
		geos.push(cone);
		const mat = new T.MeshLambertMaterial({ flatShading: true });
		const tiers = [[1, 0.55], [0.74, 1.15], [0.5, 1.7]];
		const dummy = new T.Object3D();
		const L = LOOK.light;
		for (const [sc, yo] of tiers) {
			const im = new T.InstancedMesh(cone, mat, spots.length);
			spots.forEach(([x, y, z, s], i) => {
				dummy.position.set(x, y + yo * s, z);
				dummy.scale.set(s * sc, s, s * sc);
				dummy.rotation.y = (i * 1.7) % 6.28;
				dummy.updateMatrix();
				im.setMatrixAt(i, dummy.matrix);
			});
			im.instanceMatrix.needsUpdate = true;
			scene.add(im);
			treeMeshes.push(im);
		}
		treeMeshes.spots = spots;
	}

	function colorTrees() {
		const L = LOOK[dark ? "dark" : "light"];
		const c = new T.Color();
		const r = rng(2);
		const spots = treeMeshes.spots;
		const base = spots.map(() => (r() * 3) | 0);
		treeMeshes.forEach((im, ti) => {
			spots.forEach((s, i) => {
				c.setHex(L.pine[base[i]]);
				c.offsetHSL(0, 0, ti * 0.025);
				im.setColorAt(i, c);
			});
			im.instanceColor.needsUpdate = true;
		});
	}

	function buildBirds() {
		const wing = (sx) => {
			const g = new T.BufferGeometry();
			g.setAttribute("position", new T.BufferAttribute(new Float32Array([0, 0, -0.22, 0, 0, 0.26, sx * 1.0, 0.04, 0.05]), 3));
			g.computeVertexNormals();
			geos.push(g);
			return g;
		};
		const body = new T.BufferGeometry();
		body.setAttribute("position", new T.BufferAttribute(new Float32Array([0, 0, 0.36, 0.09, 0, -0.26, -0.09, 0, -0.26]), 3));
		geos.push(body);
		mats.bird = new T.MeshBasicMaterial({ color: 0x22313f, side: T.DoubleSide });
		const gl = wing(1), gr = wing(-1);
		const r = rng(31);
		for (let i = 0; i < 16; i++) {
			const grp = new T.Group();
			const wl = new T.Group(), wr = new T.Group();
			wl.add(new T.Mesh(gl, mats.bird));
			wr.add(new T.Mesh(gr, mats.bird));
			grp.add(wl, wr, new T.Mesh(body, mats.bird));
			const s = 0.4 + r() * 0.2;
			grp.scale.setScalar(s);
			const a = r() * TAU;
			const b = { grp, wl, wr, p: new T.Vector3(Math.cos(a) * 6, 6 + r() * 3, Math.sin(a) * 6), v: new T.Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(2.6), ph: r() * 6, fs: 5 + r() * 3 };
			birds.push(b);
			scene.add(grp);
		}
	}

	const tmpA = null;
	function stepBirds(dt) {
		const c = new T.Vector3(), sep = new T.Vector3(), ali = new T.Vector3(), coh = new T.Vector3(), d = new T.Vector3();
		for (const b of birds) {
			sep.set(0, 0, 0); ali.set(0, 0, 0); coh.set(0, 0, 0);
			let cnt = 0;
			for (const q of birds) {
				if (q === b) continue;
				d.subVectors(b.p, q.p);
				const dist = d.length();
				if (dist < 5) {
					cnt++;
					ali.add(q.v); coh.add(q.p);
					if (dist < 1.4) sep.add(d.multiplyScalar((1.4 - dist) / (dist + 0.01)));
				}
			}
			const acc = new T.Vector3();
			if (cnt) { ali.divideScalar(cnt).sub(b.v).multiplyScalar(0.8); coh.divideScalar(cnt).sub(b.p).multiplyScalar(0.35); acc.add(ali).add(coh); }
			acc.add(sep.multiplyScalar(3));
			// loiter around the island: gentle swirl + pull to a ring and altitude band
			const rad = Math.hypot(b.p.x, b.p.z);
			acc.x += -b.p.x * (rad - 7.5) * 0.12 / (rad + 0.01) * 4 + (-b.p.z / (rad + 0.01)) * 1.2;
			acc.z += -b.p.z * (rad - 7.5) * 0.12 / (rad + 0.01) * 4 + (b.p.x / (rad + 0.01)) * 1.2;
			acc.y += (7.2 + Math.sin(time * 0.3 + b.ph) * 1.6 - b.p.y) * 0.9;
			b.v.addScaledVector(acc, dt);
			const sp = b.v.length();
			if (sp > 3.4) b.v.multiplyScalar(3.4 / sp); else if (sp < 2.0) b.v.multiplyScalar(2.0 / (sp + 0.001));
			b.p.addScaledVector(b.v, dt);
			b.grp.position.copy(b.p);
			c.copy(b.p).add(b.v);
			b.grp.lookAt(c);
			b.ph += dt * b.fs;
			const a = Math.sin(b.ph) * 0.75 + (b.v.y > 0.3 ? 0.15 : 0);
			b.wl.rotation.z = a;
			b.wr.rotation.z = -a;
		}
	}

	function applyLook() {
		const L = LOOK[dark ? "dark" : "light"];
		lights.amb.color.setHex(L.amb); lights.amb.intensity = L.ambI;
		lights.sun.color.setHex(L.sun); lights.sun.intensity = L.sunI;
		lights.rim.color.setHex(L.rim); lights.rim.intensity = L.rimI;
		water.material.color.setHex(L.water);
		skirt.material.color.setHex(L.base);
		mats.bird.color.setHex(L.bird);
		colorTerrain();
		colorTrees();
	}

	function updateCamera() {
		const dist = 31;
		const sp = Math.sin(pol), cp = Math.cos(pol);
		camera.position.set(Math.cos(az) * sp * dist, 1.6 + cp * dist, Math.sin(az) * sp * dist);
		camera.lookAt(0, 1.6, 0);
		lights.sun.position.set(Math.cos(az + 0.9) * 12, 14, Math.sin(az + 0.9) * 12);
	}

	function resize() {
		W = host.clientWidth; Hh = host.clientHeight;
		if (!W || !Hh || !renderer) return;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		renderer.setSize(W, Hh, false);
		camera.aspect = W / Hh;
		// shift the island toward the lower right margin so it is not hidden by the text column
		camera.setViewOffset(W, Hh, W > 900 ? -W * 0.17 : 0, -Hh * 0.08, W, Hh);
		camera.updateProjectionMatrix();
		render();
	}

	function render() {
		if (!renderer || dead) return;
		updateCamera();
		renderer.render(scene, camera);
	}

	function wave(dt) {
		const p = water.geometry.attributes.position.array;
		for (let i = 0; i < p.length; i += 3) {
			const x = waterBase[i], z = waterBase[i + 2];
			p[i + 1] = Math.sin(x * 0.9 + time * 1.3) * 0.06 + Math.sin(z * 1.1 - time * 1.1 + x * 0.3) * 0.05;
		}
		water.geometry.attributes.position.needsUpdate = true;
	}

	function frame(now) {
		raf = 0;
		if (dead || document.hidden) return;
		const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
		last = now;
		time += dt;
		if (!drag) {
			az += vAz * dt; pol = clamp(pol + vPol * dt, 0.75, 1.42);
			vAz *= Math.exp(-dt * 2.5); vPol *= Math.exp(-dt * 2.5);
			if (auto) az += 0.045 * dt;
		}
		wave(dt);
		stepBirds(dt);
		render();
		raf = requestAnimationFrame(frame);
	}

	function startLoop() {
		if (reduced || raf || dead) return;
		last = performance.now();
		raf = requestAnimationFrame(frame);
	}

	async function boot() {
		idleId = 0;
		try {
			T = await import(THREE_URL);
		} catch {
			return; // keep the static fallback if the CDN is unreachable
		}
		if (dead) return;
		const steps = [
			() => {
				renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
				canvas = renderer.domElement;
				canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;transition:opacity .9s ease";
				host.appendChild(canvas);
				scene = new T.Scene();
				camera = new T.PerspectiveCamera(32, 1, 1, 120);
				lights.amb = new T.AmbientLight(0xffffff, 1);
				lights.sun = new T.DirectionalLight(0xffffff, 1);
				lights.rim = new T.DirectionalLight(0xffffff, 0.5);
				lights.rim.position.set(-8, 4, -10);
				scene.add(lights.amb, lights.sun, lights.rim);
			},
			buildAll,
			buildTrees,
			buildBirds,
			() => {
				applyLook();
				for (let i = 0; i < 40; i++) stepBirds(0.05), time += 0.05;
				if (reduced) { for (const b of birds) b.wl.rotation.z = 0.5, b.wr.rotation.z = -0.5; }
				ro = new ResizeObserver(resize);
				ro.observe(host);
				resize();
				canvas.style.opacity = "1";
				fallback.classList.add("is-gone");
				startLoop();
			},
		];
		for (const s of steps) {
			if (dead) return;
			s();
			await new Promise((r) => requestAnimationFrame(() => r()));
		}
	}
	if ("requestIdleCallback" in window) idleId = requestIdleCallback(boot, { timeout: 600 });
	else idleId = setTimeout(boot, 200);

	// drag to orbit; only from empty scenery
	on(window, "pointerdown", (e) => {
		if (!renderer || e.button !== 0 || !isEmptyAt(root, e.clientX, e.clientY)) return;
		e.preventDefault();
		drag = { x: e.clientX, y: e.clientY, t: performance.now() };
		root.style.cursor = "grabbing";
		hint.hide();
	});
	on(window, "pointermove", (e) => {
		if (drag) {
			const now = performance.now();
			const dt = Math.max(8, now - drag.t) / 1000;
			const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
			drag.x = e.clientX; drag.y = e.clientY; drag.t = now;
			az -= dx * 0.006;
			pol = clamp(pol - dy * 0.004, 0.75, 1.42);
			vAz = lerp(vAz, (-dx * 0.006) / dt, 0.5);
			vPol = lerp(vPol, (-dy * 0.004) / dt, 0.5);
			if (reduced) { requestAnimationFrame(render); }
		} else if (renderer) {
			root.style.cursor = isEmptyAt(root, e.clientX, e.clientY) ? "grab" : "";
		}
	}, { passive: true });
	const up = () => { if (drag) { drag = null; root.style.cursor = "grab"; if (reduced) { vAz = vPol = 0; } } };
	on(window, "pointerup", up);
	on(window, "pointercancel", up);
	on(document, "visibilitychange", () => {
		if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else startLoop();
	});

	return () => {
		dead = true;
		cancelAnimationFrame(raf);
		if (idleId) { window.cancelIdleCallback ? cancelIdleCallback(idleId) : clearTimeout(idleId); }
		cleanups.forEach((f) => f());
		unwatch();
		ro?.disconnect();
		root.style.cursor = "";
		if (scene) {
			scene.traverse((o) => { if (o.material) o.material.dispose?.(); });
			for (const g of geos) g.dispose();
			for (const im of treeMeshes) im.dispose?.();
		}
		if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); canvas?.remove(); }
		fallback.remove();
	};
}

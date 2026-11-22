// A small voxel diorama of a desk: laptop, books, plant, mug, lamp, notebook. three.js is loaded only on activation.
const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";

const hash = (a, b = 0, c = 0) => {
	const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
	return s - Math.floor(s);
};

function buildVoxels() {
	const solid = new Map();
	const glow = new Map();
	const key = (x, y, z) => `${x},${y},${z}`;
	const put = (map, x, y, z, hex, jit = 0.06) => {
		const r = (hex >> 16) & 255;
		const g = (hex >> 8) & 255;
		const b = hex & 255;
		const j = 1 + (hash(x, y, z) - 0.5) * jit * 2;
		map.set(key(x, y, z), [x, y, z, Math.min(255, r * j), Math.min(255, g * j), Math.min(255, b * j)]);
	};
	const box = (x0, y0, z0, w, h, d, hex, jit, map = solid) => {
		for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) put(map, x, y, z, hex, jit);
	};

	// desk: top slab + legs + a drawer front
	box(0, -2, 0, 24, 2, 15, 0xc08a5c, 0.07);
	box(0, -2, 14, 24, 2, 1, 0xa87248, 0.05);
	box(1, -3, 13, 22, 1, 1, 0x8a5a3a, 0.05);
	for (const [x, z] of [[1, 1], [21, 1], [1, 12], [21, 12]]) box(x, -12, z, 2, 10, 2, 0x8f5d3b, 0.06);
	box(3, -5, 1, 18, 1, 1, 0x7d5033, 0.05);
	box(6, -9, 13, 12, 5, 1, 0x9a6642, 0.05);   // drawer front
	box(10, -7, 14, 4, 1, 1, 0xd8c7a3, 0.02);    // drawer handle
	// desk mat
	box(5, 0, 2, 14, 1, 11, 0x3f4a63, 0.03);

	// laptop (aluminium) on the mat
	box(7, 1, 5, 10, 1, 7, 0xb9c1cd, 0.03);
	for (let x = 8; x < 16; x++) for (let z = 6; z < 10; z++) if ((x + z) % 2 === 0) put(solid, x, 2, z, 0x2f3544, 0.04);
	box(11, 2, 10, 2, 1, 1, 0x8c95a3, 0.02);     // trackpad
	box(7, 2, 4, 10, 7, 1, 0xb9c1cd, 0.03);      // lid back
	box(7, 8, 4, 10, 1, 1, 0xb9c1cd, 0.03);
	// screen face (emissive): dark navy with lines of "code"
	const lineCols = [0x7dd3fc, 0xf9a8d4, 0xfde68a, 0x86efac, 0xc4b5fd];
	for (let x = 8; x < 16; x++) for (let y = 3; y < 8; y++) put(glow, x, y, 5, 0x172036, 0.03);
	const lines = [[9, 7, 4, 0], [9, 6, 6, 1], [11, 5, 3, 2], [9, 4, 5, 3], [10, 3, 3, 4], [14, 4, 1, 0], [12, 7, 2, 2], [9, 5, 1, 1]];
	for (const [x, y, w, c] of lines) for (let i = 0; i < w; i++) put(glow, x + i, y, 5, lineCols[c], 0.02);

	// books (front right)
	const book = (x0, y0, z0, w, h, d, cover) => {
		for (let x = x0; x < x0 + w; x++) for (let y = y0; y < y0 + h; y++) for (let z = z0; z < z0 + d; z++) {
			const cap = y === y0 || y === y0 + h - 1;
			const spine = x === x0;
			const pages = z === z0 + d - 1 || x === x0 + w - 1;
			put(solid, x, y, z, !cap && !spine && pages ? 0xf1e9d6 : cover, 0.04);
		}
	};
	book(18, 1, 7, 6, 2, 6, 0x2f8f8f);
	book(18, 3, 7, 5, 2, 5, 0xe0a63a);
	book(19, 5, 8, 4, 1, 4, 0xc4503b);
	// tiny sprout bookmark ribbon
	put(solid, 20, 6, 11, 0xf3e9cf, 0.02);

	// notebook + pencil (front left)
	box(1, 1, 8, 6, 1, 5, 0xf4cfd2, 0.03);
	box(1, 1, 8, 1, 1, 5, 0xc96f7b, 0.03);
	for (let z = 8; z < 13; z += 2) put(solid, 1, 2, z, 0x555a66, 0.02);
	box(2, 2, 9, 5, 1, 3, 0xfaf3e4, 0.02);
	box(2, 3, 11, 5, 1, 1, 0xf2c14e, 0.03);
	put(solid, 7, 3, 11, 0xe57b8a, 0.02);
	put(solid, 1, 3, 11, 0x3a3d45, 0.02);

	// mug (front, centre) with coffee
	const mug = (cx, cz) => {
		for (let y = 1; y < 5; y++) for (let x = 0; x < 4; x++) for (let z = 0; z < 4; z++) {
			if ((x === 0 || x === 3) && (z === 0 || z === 3)) continue;
			const inner = x > 0 && x < 3 && z > 0 && z < 3;
			if (y === 4 && inner) put(solid, cx + x, y, cz + z, 0x4a2b1b, 0.05);
			else put(solid, cx + x, y, cz + z, y === 2 ? 0x4f7fd0 : 0xf5f1ea, 0.03);
		}
		put(solid, cx + 4, 2, cz + 1, 0xf5f1ea, 0.03);
		put(solid, cx + 4, 3, cz + 1, 0xf5f1ea, 0.03);
		put(solid, cx + 4, 4, cz + 1, 0xf5f1ea, 0.03);
	};
	mug(10, 11);

	// plant (back left)
	const px = 3;
	const pz = 3;
	box(px - 1, 1, pz - 1, 3, 1, 3, 0xb4623e, 0.05);
	box(px - 2, 2, pz - 2, 5, 2, 5, 0xc4724a, 0.05);
	box(px - 2, 4, pz - 2, 5, 1, 5, 0xa8552f, 0.04);
	box(px - 1, 5, pz - 1, 3, 1, 3, 0x4b3322, 0.06);
	box(px, 6, pz, 1, 4, 1, 0x2f7d3e, 0.05);
	const greens = [0x3f9b4f, 0x58b85f, 0x2e7d3f, 0x6fcf6b, 0x4aa85a];
	const leaves = [[0, 11, 0, 2.4], [-2.2, 9, 0.5, 1.9], [2.3, 10, -0.8, 2.0], [0.4, 8, 2.3, 1.8], [-0.8, 9.5, -2.2, 1.9], [1.8, 8, 1.6, 1.6], [-1.6, 11, 1.5, 1.6]];
	for (const [lx, ly, lz, r] of leaves) {
		for (let x = -3; x <= 3; x++) for (let y = -2; y <= 2; y++) for (let z = -3; z <= 3; z++) {
			const d = Math.hypot(x / r, (y * 1.5) / r, z / r);
			if (d <= 1) put(solid, Math.round(px + lx + x), Math.round(ly + y), Math.round(pz + lz + z), greens[Math.floor(hash(x + lx, y + ly, z + lz) * greens.length)], 0.07);
		}
	}
	put(solid, px, 13, pz, 0xf17aa8, 0.02);
	put(solid, px + 1, 12, pz, 0xf9a8c9, 0.02);

	// lamp (back right) + warm glowing shade
	box(20, 1, 1, 3, 1, 3, 0x2b2d36, 0.03);
	box(21, 2, 2, 1, 13, 1, 0x3b3e4a, 0.03);
	box(18, 14, 2, 4, 1, 1, 0x3b3e4a, 0.03);
	box(16, 12, 1, 4, 2, 3, 0xe85d4a, 0.04);
	box(17, 11, 2, 2, 1, 1, 0xffd88a, 0.02, glow);
	box(16, 11, 1, 4, 1, 3, 0xffe3a6, 0.02, glow);

	return { solid: [...solid.values()], glow: [...glow.values()] };
}

export function activate({ root, mode, reducedMotion }) {
	const hero = root.querySelector(".site-hero");
	if (!hero) return;
	const dark = mode === "dark";
	const wrap = document.createElement("div");
	wrap.className = "diorama";
	wrap.setAttribute("role", "img");
	wrap.setAttribute("aria-label", "A voxel diorama of a desk with a laptop, books, a plant, a mug and a lamp. Drag to orbit.");
	const hint = document.createElement("div");
	hint.className = "diorama-hint";
	hint.textContent = "drag to orbit";
	hero.append(wrap);
	wrap.append(hint);

	let alive = true;
	let teardown = () => {};

	(async () => {
		const THREE = await import(THREE_URL);
		if (!alive) return;
		const { solid, glow } = buildVoxels();

		const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "default" });
		const dprCap = Math.min(window.devicePixelRatio || 1, 1.5);
		renderer.setPixelRatio(dprCap);
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.shadowMap.autoUpdate = false;
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = dark ? 1.0 : 1.0;
		wrap.prepend(renderer.domElement);
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(26, 1, 1, 400);

		const geo = new THREE.BoxGeometry(1, 1, 1);
		const mat = new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0.0 });
		const mesh = new THREE.InstancedMesh(geo, mat, solid.length);
		const m4 = new THREE.Matrix4();
		const col = new THREE.Color();
		solid.forEach((v, i) => {
			m4.makeTranslation(v[0] + 0.5, v[1] + 0.5, v[2] + 0.5);
			mesh.setMatrixAt(i, m4);
			col.setRGB(v[3] / 255, v[4] / 255, v[5] / 255, THREE.SRGBColorSpace);
			mesh.setColorAt(i, col);
		});
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		scene.add(mesh);

		const gmat = new THREE.MeshBasicMaterial({ toneMapped: false });
		const gmesh = new THREE.InstancedMesh(geo, gmat, glow.length);
		glow.forEach((v, i) => {
			m4.makeTranslation(v[0] + 0.5, v[1] + 0.5, v[2] + 0.5);
			gmesh.setMatrixAt(i, m4);
			col.setRGB(v[3] / 255, v[4] / 255, v[5] / 255, THREE.SRGBColorSpace);
			if (dark) col.multiplyScalar(1.15);
			else col.multiplyScalar(0.92);
			gmesh.setColorAt(i, col);
		});
		scene.add(gmesh);

		// lights
		scene.add(new THREE.HemisphereLight(dark ? 0x5a6cb0 : 0xfff3e0, dark ? 0x1a1630 : 0xc9b79c, dark ? 1.0 : 1.15));
		const sun = new THREE.DirectionalLight(dark ? 0x7f95ff : 0xfff0d6, dark ? 0.9 : 2.6);
		sun.position.set(-18, 36, 26);
		sun.target.position.set(12, 0, 7);
		sun.castShadow = true;
		sun.shadow.mapSize.set(1024, 1024);
		const sc = sun.shadow.camera;
		sc.left = -26;
		sc.right = 26;
		sc.top = 26;
		sc.bottom = -26;
		sc.near = 1;
		sc.far = 120;
		sun.shadow.bias = -0.0006;
		sun.shadow.normalBias = 0.03;
		scene.add(sun, sun.target);
		const lampLight = new THREE.PointLight(0xffc873, dark ? 420 : 160, 70, 2);
		lampLight.position.set(18.5, 10.5, 3);
		scene.add(lampLight);
		if (dark) {
			const screenLight = new THREE.PointLight(0x7aa7ff, 140, 30, 2);
			screenLight.position.set(12, 6, 8);
			scene.add(screenLight);
		}

		// soft ground shadow
		const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 40), new THREE.ShadowMaterial({ opacity: dark ? 0.35 : 0.2 }));
		ground.rotation.x = -Math.PI / 2;
		ground.position.set(12, -12.01, 7);
		ground.receiveShadow = true;
		scene.add(ground);

		// steam
		const steam = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }), 5);
		scene.add(steam);
		const dummy = new THREE.Object3D();
		const steamAt = (t) => {
			for (let i = 0; i < 5; i++) {
				const p = (t * 0.22 + i / 5) % 1;
				dummy.position.set(12 + 0.2 + Math.sin(p * 6 + i * 2) * 0.55, 5.6 + p * 6, 13 + Math.cos(p * 5 + i) * 0.5);
				const s = 0.55 * Math.sin(p * Math.PI) + 0.05;
				dummy.scale.setScalar(s);
				dummy.updateMatrix();
				steam.setMatrixAt(i, dummy.matrix);
			}
			steam.instanceMatrix.needsUpdate = true;
		};
		steamAt(0.3);

		// orbit
		const target = new THREE.Vector3(12, 1, 7.5);
		const st = { az: 0.62, el: 0.5, dist: 80, vaz: 0, vel: 0, drag: false, lastInput: -1e9 };
		const place = (sway) => {
			const az = st.az + sway;
			camera.position.set(target.x + st.dist * Math.cos(st.el) * Math.sin(az), target.y + st.dist * Math.sin(st.el), target.z + st.dist * Math.cos(st.el) * Math.cos(az));
			camera.lookAt(target);
		};
		const resize = () => {
			const w = Math.max(60, wrap.clientWidth);
			renderer.setSize(w, w, false);
			camera.aspect = 1;
			camera.updateProjectionMatrix();
		};
		resize();
		renderer.shadowMap.needsUpdate = true;

		let visible = true;
		let raf = 0;
		let last = 0;
		let clock = 0;
		let needs = 2;
		const frame = (now) => {
			raf = 0;
			if (!alive || document.hidden) return;
			const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
			last = now;
			clock += dt;
			if (!st.drag) {
				st.az += st.vaz * dt;
				st.el = Math.min(1.1, Math.max(0.12, st.el + st.vel * dt));
				const damp = Math.exp(-dt * 3.2);
				st.vaz *= damp;
				st.vel *= damp;
			}
			const idle = performance.now() - st.lastInput > 2500;
			const sway = reducedMotion ? 0 : idle ? Math.sin(clock * 0.35) * 0.16 : 0;
			place(sway);
			if (!reducedMotion) steamAt(clock);
			renderer.render(scene, camera);
			needs = Math.max(0, needs - 1);
			const moving = Math.abs(st.vaz) > 0.004 || Math.abs(st.vel) > 0.004 || st.drag;
			if (visible && !document.hidden && (!reducedMotion || moving || needs > 0)) raf = requestAnimationFrame(frame);
		};
		const kick = () => {
			needs = Math.max(needs, 2);
			if (!raf && visible && alive) {
				last = 0;
				raf = requestAnimationFrame(frame);
			}
		};
		kick();

		const io = new IntersectionObserver((entries) => {
			visible = entries[0].isIntersecting;
			if (visible) kick();
		});
		io.observe(wrap);
		const onVis = () => {
			if (!document.hidden) kick();
		};
		document.addEventListener("visibilitychange", onVis);
		const ro = new ResizeObserver(() => {
			resize();
			kick();
		});
		ro.observe(wrap);

		// drag to orbit (canvas-local pointer events; the diorama has no text under it)
		let px = 0;
		let py = 0;
		const down = (e) => {
			st.drag = true;
			px = e.clientX;
			py = e.clientY;
			st.lastInput = performance.now();
			hint.style.opacity = "0";
			wrap.setPointerCapture?.(e.pointerId);
			kick();
		};
		const move = (e) => {
			if (!st.drag) return;
			const dx = e.clientX - px;
			const dy = e.clientY - py;
			px = e.clientX;
			py = e.clientY;
			st.az -= dx * 0.009;
			if (e.pointerType !== "touch") st.el = Math.min(1.1, Math.max(0.12, st.el + dy * 0.006));
			st.vaz = (-dx * 0.009) / 0.016;
			st.vel = e.pointerType !== "touch" ? (dy * 0.006) / 0.016 : 0;
			st.lastInput = performance.now();
			kick();
		};
		const up = (e) => {
			st.drag = false;
			st.vaz = Math.max(-3, Math.min(3, st.vaz));
			st.vel = Math.max(-2, Math.min(2, st.vel));
			wrap.releasePointerCapture?.(e.pointerId);
			kick();
		};
		wrap.addEventListener("pointerdown", down);
		wrap.addEventListener("pointermove", move);
		wrap.addEventListener("pointerup", up);
		wrap.addEventListener("pointercancel", up);

		teardown = () => {
			cancelAnimationFrame(raf);
			io.disconnect();
			ro.disconnect();
			document.removeEventListener("visibilitychange", onVis);
			wrap.removeEventListener("pointerdown", down);
			wrap.removeEventListener("pointermove", move);
			wrap.removeEventListener("pointerup", up);
			wrap.removeEventListener("pointercancel", up);
			geo.dispose();
			mat.dispose();
			gmat.dispose();
			steam.material.dispose();
			ground.geometry.dispose();
			ground.material.dispose();
			mesh.dispose();
			gmesh.dispose();
			steam.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			renderer.domElement.remove();
		};
	})().catch((err) => {
		hint.textContent = "3D preview unavailable offline";
		console.warn(err);
	});

	return () => {
		alive = false;
		teardown();
		wrap.remove();
	};
}

// Lit 3D type: the hero title and section headings are rebuilt as extruded, bevelled three.js text
// that sits exactly where the DOM text is (the DOM text stays for selection / screen readers, just
// invisible). A spotlight follows the cursor, casting soft shadows onto a backdrop plane.
import { trackPointer, createLoop, makeButton, observeSize, onScrollFrame, siteColors } from "./_wild/kit.js";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/+esm";
const TEXT_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/geometries/TextGeometry.js/+esm";
const LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/FontLoader.js/+esm";
const FONT_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/droid/droid_sans_bold.typeface.json";

const LIGHTS = [
	{ name: "amber", hex: 0xffd9a0 },
	{ name: "ice", hex: 0xa8d8ff },
	{ name: "rose", hex: 0xffa8d8 },
];

export function activate({ root, mode, reducedMotion }) {
	const layer = root.querySelector(".scenery-a");
	if (!layer) return;
	const dark = mode === "dark";
	let disposed = false;
	let cleanup = () => {};

	(async () => {
		let THREE, TextGeometry, FontLoader, fontJson;
		try {
			const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(r, { timeout: 600 }) : setTimeout(r, 50)));
			await idle();
			[THREE, { TextGeometry }, { FontLoader }, fontJson] = await Promise.all([
				import(THREE_URL),
				import(TEXT_URL),
				import(LOADER_URL),
				fetch(FONT_URL).then((r) => r.json()),
			]);
		} catch (error) {
			console.warn("lit-type: could not load three.js", error);
			return;
		}
		if (disposed) return;
		cleanup = start(THREE, TextGeometry, new FontLoader().parse(fontJson));
	})();

	function start(THREE, TextGeometry, font) {
		const colors = siteColors(root);
		const canvas = document.createElement("canvas");
		canvas.setAttribute("aria-hidden", "true");
		Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", display: "block", pointerEvents: "none" });
		layer.append(canvas);

		const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: "default" });
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		renderer.setClearColor(0x000000, 0);

		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(28, 1, 10, 4000);
		let W = 2;
		let H = 2;

		// lights
		const hemi = new THREE.HemisphereLight(dark ? 0x8fa8ff : 0xffffff, dark ? 0x101428 : 0xb9c3d6, dark ? 1.9 : 1.35);
		scene.add(hemi);
		const spot = new THREE.SpotLight(LIGHTS[0].hex, dark ? 6.5 : 4.2, 0, 1.15, 0.85, 0);
		spot.castShadow = true;
		spot.shadow.mapSize.set(1024, 1024);
		spot.shadow.radius = 5;
		spot.shadow.bias = -0.0004;
		spot.shadow.camera.near = 40;
		spot.shadow.camera.far = 1600;
		scene.add(spot, spot.target);
		const rim = new THREE.DirectionalLight(dark ? 0x6f8cff : 0xffffff, dark ? 0.8 : 0.5);
		rim.position.set(-400, 300, 200);
		scene.add(rim);

		// backdrop: receives shadows; in dark mode also shows the pool of light
		const FLOOR_Z = -70;
		const floorMat = dark
			? new THREE.MeshStandardMaterial({ color: 0x1a2748, roughness: 1, metalness: 0, transparent: true, opacity: 0.4 })
			: new THREE.ShadowMaterial({ opacity: 0.17, color: 0x1a2540 });
		const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat);
		floor.receiveShadow = true;
		floor.position.z = FLOOR_Z;
		scene.add(floor);

		// text meshes
		const letterMat = new THREE.MeshStandardMaterial({
			color: new THREE.Color(...(dark ? [0.82, 0.9, 1.0] : colors.accent)),
			roughness: 0.34,
			metalness: dark ? 0.25 : 0.1,
		});
		const headMat = new THREE.MeshStandardMaterial({
			color: new THREE.Color(...(dark ? [0.86, 0.92, 1.0] : colors.strong)).multiplyScalar(dark ? 1 : 1.6),
			roughness: 0.4,
			metalness: 0.1,
		});

		const targets = [];
		const els = [root.querySelector(".site-title"), ...root.querySelectorAll(".site-section-title")].filter(Boolean);
		for (const el of els) {
			const text = el.textContent.trim();
			const rectOf = () => {
				const range = document.createRange();
				range.selectNodeContents(el);
				return range.getClientRects().length === 1 ? range.getBoundingClientRect() : null;
			};
			if (!rectOf()) continue;
			const hero = el.classList.contains("site-title");
			const geo = new TextGeometry(text, {
				font,
				size: 100,
				depth: hero ? 34 : 24,
				height: hero ? 34 : 24,
				curveSegments: 5,
				bevelEnabled: true,
				bevelThickness: hero ? 5 : 3.5,
				bevelSize: hero ? 3.4 : 2.4,
				bevelSegments: 3,
			});
			geo.computeBoundingBox();
			const bb = geo.boundingBox;
			geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.max.z - bb.min.z) / 2);
			const mesh = new THREE.Mesh(geo, hero ? letterMat : headMat);
			mesh.castShadow = true;
			mesh.receiveShadow = true;
			const group = new THREE.Group();
			group.add(mesh);
			scene.add(group);
			targets.push({ el, rectOf, group, bw: bb.max.x - bb.min.x, bh: bb.max.y - bb.min.y, hero });
		}
		if (!targets.length) {
			canvas.remove();
			renderer.dispose();
			return () => {};
		}
		root.classList.add("lit-3d");

		function layoutTargets() {
			const lr = layer.getBoundingClientRect();
			for (const t of targets) {
				const r = t.rectOf();
				if (!r) {
					t.group.visible = false;
					continue;
				}
				const top = r.top - lr.top;
				t.group.visible = top < H + 80 && top + r.height > -80;
				// fit the glyph box to the DOM text box (width wins), centred on it
				const s = (r.width / t.bw) * (t.hero ? 0.93 : 0.97);
				t.group.scale.setScalar(s);
				t.cx = r.left - lr.left + r.width / 2;
				t.cy = top + r.height * (t.hero ? 0.44 : 0.5);
				t.group.position.set(t.cx, -t.cy, 0);
			}
		}

		function resize() {
			W = Math.max(2, layer.clientWidth);
			H = Math.max(2, layer.clientHeight);
			renderer.setSize(W, H, false);
			camera.aspect = W / H;
			const dz = H / 2 / Math.tan((camera.fov * Math.PI) / 360);
			camera.position.set(W / 2, -H / 2, dz);
			camera.lookAt(W / 2, -H / 2, 0);
			camera.updateProjectionMatrix();
			floor.scale.set(W * 3, H * 3, 1);
			floor.position.x = W / 2;
			floor.position.y = -H / 2;
			layoutTargets();
		}

		// ---- light + render -----------------------------------------------------------------
		const lightPos = { x: 0, y: 0, z: 320 };
		let held = false;
		let colorIdx = 0;
		const ptr = trackPointer(layer, {
			onMove: () => {
				activeUntil = performance.now() + 2500;
				if (reducedMotion) requestAnimationFrame(renderOnce);
			},
			onDown: (p, e) => {
				if (e.target.closest?.("button, input")) return;
				held = true;
				activeUntil = performance.now() + 2500;
				if (reducedMotion) requestAnimationFrame(renderOnce);
			},
			onUp: () => {
				held = false;
				if (reducedMotion) requestAnimationFrame(renderOnce);
			},
		});
		let activeUntil = 0;

		function updateLight(t, snap) {
			const active = ptr.seen && ptr.inside && (performance.now() < activeUntil || reducedMotion);
			let tx, ty;
			if (active) {
				tx = ptr.x;
				ty = ptr.y;
			} else {
				// idle: slow figure-of-eight around the hero
				const hero = targets[0];
				const cx = hero ? hero.cx : W / 2;
				const cy = hero ? hero.cy : H * 0.3;
				tx = cx + Math.sin(t * 0.33) * W * 0.28;
				ty = cy - 90 + Math.sin(t * 0.66) * 90;
			}
			if (reducedMotion && !active) {
				tx = W * 0.32;
				ty = H * 0.16;
			}
			const tz = held ? 120 : 330;
			const k = snap ? 1 : 0.14;
			lightPos.x += (tx - lightPos.x) * k;
			lightPos.y += (ty - lightPos.y) * k;
			lightPos.z += (tz - lightPos.z) * (snap ? 1 : 0.1);
			spot.position.set(lightPos.x, -lightPos.y, lightPos.z);
			spot.target.position.set(lightPos.x, -lightPos.y, 0);
			spot.intensity = (dark ? 6.5 : 4.2) * (held ? 1.35 : 1);
			// letters turn gently toward the light
			for (const t2 of targets) {
				if (!t2.group.visible) continue;
				const dx = (lightPos.x - t2.cx) / W;
				const dy = (lightPos.y - t2.cy) / H;
				t2.group.rotation.y += (dx * 0.5 - t2.group.rotation.y) * 0.1;
				t2.group.rotation.x += (dy * 0.35 - t2.group.rotation.x) * 0.1;
			}
		}

		function renderOnce() {
			updateLight(3, true);
			renderer.render(scene, camera);
		}

		const button = makeButton(root, reducedMotion ? "light colour" : "move to aim the light · hold for raking light", {
			title: "Click to cycle the light colour",
		});
		button.addEventListener("click", () => {
			colorIdx = (colorIdx + 1) % LIGHTS.length;
			spot.color.setHex(LIGHTS[colorIdx].hex);
			if (reducedMotion) renderOnce();
		});

		resize();
		let loop = null;
		let frameNo = 0;
		if (reducedMotion) {
			renderOnce();
		} else {
			loop = createLoop((dt, t) => {
				frameNo++;
				const lively = performance.now() < activeUntil || held;
				if (!lively && frameNo % 2) return; // idle drift at 30fps
				updateLight(t, false);
				renderer.render(scene, camera);
			});
		}
		const stopScroll = onScrollFrame(root, () => {
			layoutTargets();
			if (reducedMotion) renderOnce();
		});
		const stopSize = observeSize(layer, () => {
			resize();
			if (reducedMotion) renderOnce();
		});

		return () => {
			loop?.stop();
			stopScroll();
			stopSize();
			ptr.destroy();
			button.remove();
			root.classList.remove("lit-3d");
			scene.traverse((o) => {
				o.geometry?.dispose?.();
			});
			letterMat.dispose();
			headMat.dispose();
			floorMat.dispose();
			spot.shadow.map?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
			canvas.remove();
		};
	}

	return () => {
		disposed = true;
		cleanup();
	};
}

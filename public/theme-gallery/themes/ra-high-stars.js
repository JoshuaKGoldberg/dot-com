import { raisedAurora, sideSky, footerHost, whenVisible, isDark, clamp, lerp, rng, STAR, TAU } from "./_refined-c/kit.js";

function star(ctx, x, y, r, rgb, a, flare) {
	ctx.fillStyle = `rgba(${rgb},${a})`;
	if (r <= 1.1) ctx.fillRect(x - 0.5, y - 0.5, 1.1, 1.1);
	else { ctx.beginPath(); ctx.arc(x, y, r * 0.75, 0, TAU); ctx.fill(); }
	if (false && flare) { // 4-point glints removed: Josh wants plain dark-sky dots
		ctx.strokeStyle = `rgba(${rgb},${a * 0.45})`; ctx.lineWidth = 0.6;
		ctx.beginPath(); ctx.moveTo(x - r * 3.4, y); ctx.lineTo(x + r * 3.4, y); ctx.moveTo(x, y - r * 3.4); ctx.lineTo(x, y + r * 3.4); ctx.stroke();
		const g = ctx.createRadialGradient(x, y, 0, x, y, r * 5);
		g.addColorStop(0, `rgba(${rgb},${a * 0.28})`); g.addColorStop(1, `rgba(${rgb},0)`);
		ctx.fillStyle = g; ctx.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
	}
}

// Highest band: stars fade out downward. Three layers: still, and two that twinkle out of phase via CSS opacity.
function highBand(root, host, reducedMotion) {
	const dark = isDark(), rgb = STAR[dark ? "dark" : "light"].join(",");
	const wrap = document.createElement("div");
	wrap.className = "rac-high";
	host.appendChild(wrap);
	let ro = null;
	const build = () => {
		wrap.textContent = "";
		const W = Math.round(root.clientWidth), H = Math.round(root.clientHeight * 0.3);
		wrap.style.height = H + "px";
		const dpr = Math.min(devicePixelRatio || 1, 1.5);
		const layers = ["", "a", "b"].map((cls) => {
			const c = document.createElement("canvas");
			c.className = "rac-tw " + cls;
			c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
			const x = c.getContext("2d"); x.scale(dpr, dpr);
			wrap.appendChild(c);
			return x;
		});
		const r = rng(319), n = Math.round(W * H / 2400);
		for (let i = 0; i < n; i++) {
			const y = H * Math.pow(r(), 1.7), x = r() * W; // denser near the top
			const f = Math.pow(1 - y / H, 1.3);
			const big = r() < 0.07;
			const rad = big ? 1.5 + r() * 0.8 : 0.7 + r() * r() * 1.1;
			const a = clamp((dark ? 0.85 : 0.6) * (0.35 + r() * 0.65) * f * 1.15, 0, 1);
			star(layers[(r() * 3) | 0], x, y, rad, rgb, a, big && f > 0.35);
		}
	};
	build();
	ro = new ResizeObserver(build); ro.observe(root);
	return { wrap, destroy: () => { ro.disconnect(); wrap.remove(); } };
}

// Starlit ridge footer, painted once. Glints twinkle by CSS opacity only while visible.
function ridgeFooter(root, reducedMotion) {
	const fh = footerHost(root, 170);
	fh.box.classList.add("rac-ridge");
	const dark = isDark(), rgb = STAR[dark ? "dark" : "light"].join(",");
	const build = () => {
		fh.box.textContent = "";
		const W = Math.round(root.clientWidth), H = 170, dpr = Math.min(devicePixelRatio || 1, 1.5);
		const mk = (cls) => { const c = document.createElement("canvas"); c.className = cls; c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); const x = c.getContext("2d"); x.scale(dpr, dpr); fh.box.appendChild(c); return x; };
		const base = mk(""), g1 = mk("rac-glint"), g2 = mk("rac-glint b");
		const r = rng(3190);
		const ridge = (seed, y0, amp, sc) => { const q = rng(seed), ph = [q() * 6, q() * 6, q() * 6]; return (x) => y0 + amp * (Math.sin(x / sc + ph[0]) * 0.5 + Math.sin(x / (sc * 0.43) + ph[1]) * 0.3 + Math.sin(x / (sc * 0.17) + ph[2]) * 0.14); };
		const far = ridge(5, H * 0.7, 14, 130), near = ridge(9, H * 0.86, 10, 90);
		// sky glow behind, fading in from the top
		const sky = base.createLinearGradient(0, 0, 0, H);
		const glow = dark ? "70,90,170" : "190,180,230";
		sky.addColorStop(0, `rgba(${glow},0)`); sky.addColorStop(0.75, `rgba(${glow},${dark ? 0.16 : 0.2})`); sky.addColorStop(1, `rgba(${glow},${dark ? 0.1 : 0.12})`);
		base.fillStyle = sky; base.fillRect(0, 0, W, H);
		// stars in the sky
		for (let i = 0; i < W * 0.07; i++) {
			const y = r() * H * 0.72, x = r() * W, a = (0.25 + r() * 0.6) * (dark ? 0.8 : 0.55) * clamp(y / (H * 0.2), 0.15, 1);
			star(r() < 0.4 ? g1 : r() < 0.5 ? g2 : base, x, y, 0.7 + r() * r() * 1.3, rgb, a);
		}
		const fill = (fn, col, rim) => {
			base.fillStyle = col; base.beginPath(); base.moveTo(0, H);
			for (let x = 0; x <= W; x += 6) base.lineTo(x, fn(x));
			base.lineTo(W, H); base.closePath(); base.fill();
			// starlit rim along the crest
			base.strokeStyle = rim; base.lineWidth = 1; base.beginPath();
			for (let x = 0; x <= W; x += 6) (x ? base.lineTo(x, fn(x)) : base.moveTo(x, fn(x)));
			base.stroke();
		};
		fill(far, dark ? "#101d38" : "#d3d9ee", dark ? "rgba(150,175,235,0.22)" : "rgba(255,255,255,0.8)");
		fill(near, dark ? "#0a1426" : "#c3cbe6", dark ? "rgba(170,195,250,0.3)" : "rgba(255,255,255,0.9)");
		// glints of starlight on the crests
		for (let i = 0; i < W / 16; i++) {
			const x = r() * W, fn = r() < 0.5 ? far : near;
			star(r() < 0.5 ? g1 : g2, x, fn(x) - 0.5, 0.9 + r() * 0.8, rgb, (dark ? 0.75 : 0.5) * (0.5 + r() * 0.5));
		}
	};
	build();
	const ro = new ResizeObserver(build); ro.observe(root);
	const stop = whenVisible(fh.box, root, () => { fh.box.classList.add("on"); return () => fh.box.classList.remove("on"); });
	return () => { stop(); ro.disconnect(); fh.destroy(); };
}

export function activate({ root, reducedMotion }) {
	const aur = raisedAurora({ root, reducedMotion, level: 2 });
	const host = root.querySelector(".scenery-b");
	const high = highBand(root, host, reducedMotion);
	// sparse, static margin stars
	const sky = sideSky({
		root, host: root.querySelector(".scenery-c"), seed: 319, galaxy: true, galaxyDust: 90, galaxyAlpha: 0.55,
		onLayout(sides) {
			const rgb = STAR[isDark() ? "dark" : "light"].join(","), dark = isDark();
			sides.forEach((s) => {
				const r = rng(31 + s.i), n = Math.round(clamp(s.w * s.h / 16000, 8, 30));
				for (let i = 0; i < n; i++) star(s.ctx, r() * s.w, r() * s.h, 0.7 + r() * r() * 1.3, rgb, (0.35 + r() * 0.5) * (dark ? 0.8 : 0.55));
			});
		},
	});
	// scroll the band away with the page, and drift it a few px against the pointer (transform only)
	let raf = 0, mx = 0;
	const apply = () => { raf = 0; high.wrap.style.transform = `translate3d(${(-mx * 7).toFixed(2)}px,${-root.scrollTop}px,0)`; };
	const q = () => { if (!raf) raf = requestAnimationFrame(apply); };
	const onMove = (e) => { if (reducedMotion) return; mx = e.clientX / innerWidth - 0.5; q(); };
	root.addEventListener("scroll", q, { passive: true });
	addEventListener("pointermove", onMove, { passive: true });
	apply();
	const footerOff = ridgeFooter(root, reducedMotion);
	return () => { aur.destroy(); cancelAnimationFrame(raf); root.removeEventListener("scroll", q); removeEventListener("pointermove", onMove); high.destroy(); sky.destroy(); footerOff(); };
}

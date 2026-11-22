/* Squiggle delights for #345 (pigment bleed), #346 (warm pigment hue shift), #356 (aurora ribbon). */
import { clamp, squiggleEngine } from "./util.js";

const BLEED = {
	dark: [[84, 255, 182], [84, 196, 255], [190, 130, 255], [255, 124, 170], [255, 190, 110]],
	light: [[30, 176, 138], [58, 140, 226], [150, 98, 214], [226, 98, 142], [232, 150, 60]],
};

/** #345: pigment drops land on the squiggle where the pointer enters and bleed outward, then dry back to blue. */
export function pigmentBleed(root, d, { dark, reducedMotion }) {
	const pal = BLEED[dark ? "dark" : "light"];
	let ci = 0;
	const theme = {
		step(st, dt, f) {
			const drops = (st.drops ||= []);
			if (!f.inside && !drops.length) return false;
			const lastX = st.lastX ?? -999;
			if (f.inside) {
				if (!drops.length || Math.abs(f.px - lastX) > Math.max(34, f.w * 0.22)) {
					if (drops.length < 4) drops.push({ x: f.px, r: 2, age: 0, c: pal[ci++ % pal.length], c2: pal[ci % pal.length], a: 1 });
					st.lastX = f.px;
				}
			} else st.lastX = -999;
			for (const q of drops) {
				q.age += dt;
				const target = Math.min(f.w * 0.55, 70) + 14;
				q.r += (target - q.r) * (1 - Math.exp(-dt / 0.9)); // pigment creeps outward, slowing
				if (!f.inside) q.a -= (dt / 1.5) * (1 + drops.length * 0.2);
			}
			while (drops.length && drops[0].a <= 0) drops.shift();
			if (!drops.length) { theme.clear(st); return false; }
			let bg = "";
			for (let i = drops.length - 1; i >= 0; i--) {
				const q = drops[i], a = clamp(q.a), rr = q.r.toFixed(1);
				const [r, g, b] = q.c, [r2, g2, b2] = q.c2;
				bg += `radial-gradient(circle ${rr}px at ${q.x.toFixed(1)}px 50%, rgba(${r},${g},${b},${a.toFixed(3)}) 0, rgba(${r},${g},${b},${(a * 0.92).toFixed(3)}) 55%, rgba(${r2},${g2},${b2},${(a * 0.7).toFixed(3)}) 82%, rgba(${r2},${g2},${b2},0) 100%),`;
			}
			st.a.style.setProperty("--dl-bg", `${bg}linear-gradient(var(--siteSquiggle),var(--siteSquiggle))`);
			st.a.classList.add("dl-bleeding");
			return true;
		},
		clear(st) {
			st.drops = [];
			st.a.style.removeProperty("--dl-bg");
			st.a.classList.remove("dl-bleeding");
		},
	};
	return squiggleEngine(root, d, theme, { reducedMotion });
}

/** #346: the underline warms through rose, coral and amber; the hue window slides with the pointer along the link. */
export function warmShift(root, d, { reducedMotion }) {
	const theme = {
		step(st, dt, f) {
			st.w = st.w ?? 0; st.x = st.x ?? 0.5;
			if (!f.near && !st.w) return false;
			const target = f.inside ? 1 : f.near * 0.55;
			const k = target > st.w ? 0.22 : 0.9; // warms quickly, cools slowly
			st.w += (target - st.w) * (1 - Math.exp(-dt / k));
			if (f.near) st.x += (f.fx - st.x) * (1 - Math.exp(-dt / 0.35));
			st.a.style.setProperty("--dl-w", st.w.toFixed(3));
			st.a.style.setProperty("--dl-x", `${(st.x * 100).toFixed(1)}%`);
			if (st.w < 0.004 && !f.near) { theme.clear(st); return false; }
			return true;
		},
		clear(st) { st.w = 0; st.a.style.removeProperty("--dl-w"); st.a.style.removeProperty("--dl-x"); },
	};
	return squiggleEngine(root, d, theme, { radius: 150, reducedMotion });
}

/** #356: each squiggle becomes two interwoven aurora strands that brighten and cycle hue as the pointer approaches. */
export function ribbons(root, d, { reducedMotion }) {
	const theme = {
		init(states) {
			for (const st of states) {
				const i = document.createElement("i");
				i.className = "dl-rb";
				i.setAttribute("aria-hidden", "true");
				st.a.append(i);
				st.rb = i;
			}
			d.add(() => states.forEach((st) => st.rb?.remove()));
		},
		step(st, dt, f) {
			st.p = st.p ?? 0; st.ph = st.ph ?? Math.random() * 100;
			if (!f.near && !st.p) return false;
			const target = clamp(f.near ** 1.4 * 1.1 + (f.inside ? 0.25 : 0));
			st.p += (target - st.p) * (1 - Math.exp(-dt / (target > st.p ? 0.25 : 0.7)));
			st.ph += dt * (4 + 26 * st.p); // hue flows faster the closer you are
			const lean = f.near ? (f.fx - 0.5) * 60 : 0;
			st.lean = (st.lean ?? 0) + (lean - (st.lean ?? 0)) * (1 - Math.exp(-dt / 0.4));
			const s = st.a.style;
			s.setProperty("--dl-p", st.p.toFixed(3));
			s.setProperty("--dl-h", `${(st.ph + st.lean).toFixed(1)}%`);
			s.setProperty("--dl-h2", `${(st.ph + st.lean + 38).toFixed(1)}%`);
			st.rb.classList.toggle("is-lit", st.p > 0.03);
			if (st.p < 0.01 && !f.near) { theme.clear(st); return false; }
			return true;
		},
		clear(st) {
			st.p = 0;
			for (const k of ["--dl-p", "--dl-h", "--dl-h2"]) st.a.style.removeProperty(k);
			st.rb?.classList.remove("is-lit");
		},
	};
	return squiggleEngine(root, d, theme, { radius: 190, reducedMotion });
}

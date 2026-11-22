/*
 * #274 Season Mark: a tiny seasonal glyph by the logo, chosen by the real
 * date. Its soft aurora halo leans toward the cursor and brightens with
 * movement. Now and then a leaf/flake/petal falls down the margin.
 */
import { clamp, disposer, loop, param, pointer } from "./_quiet-d/kit.js";

const NS = "http://www.w3.org/2000/svg";
const SVG = {
	winter: `<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.6 4.8L12 6.6l2.4-1.8M9.6 19.2L12 17.4l2.4 1.8M5.4 10.4l2.5-.2-.6-2.9M18.6 13.6l-2.5.2.6 2.9M18.6 10.4l-2.5-.2.6-2.9M5.4 13.6l2.5.2-.6 2.9"/></g>`,
	spring: `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21v-8"/><path d="M12 13c-4 0-6.5-2.5-6.5-6.5C9.5 6.5 12 9 12 13z"/><path d="M12 13c4 0 6.5-2.5 6.5-6.5C14.5 6.5 12 9 12 13z"/><path d="M12 11.5C10.3 9.5 10.3 6.5 12 3.5c1.7 3 1.7 6 0 8z"/></g>`,
	summer: `<g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><ellipse cx="12" cy="14" rx="2.2" ry="3.6"/><path d="M12 10.4V8.6M10.4 10.6C7.6 9 6.2 11 6 12.8c2 .4 3.4-.2 4.2-1.4M13.6 10.6c2.8-1.6 4.2.4 4.4 2.2-2 .4-3.4-.2-4.2-1.4"/></g><circle class="qsm-glow" cx="12" cy="16.2" r="2.4" fill="currentColor" stroke="none"/>`,
	autumn: `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 19C4 11 9 4.5 19.5 4.5 19.5 14 14 19.5 5 19z"/><path d="M5 19L14 10"/></g>`,
};
const FALL = { winter: "flake", spring: "petal", summer: "firefly", autumn: "leaf" };

function seasonNow() {
	const forced = param("season");
	if (forced && SVG[forced]) return forced;
	const m = new Date().getMonth();
	return m === 11 || m < 2 ? "winter" : m < 5 ? "spring" : m < 8 ? "summer" : "autumn";
}

function icon(season, size) {
	const s = document.createElementNS(NS, "svg");
	s.setAttribute("viewBox", "0 0 24 24");
	s.setAttribute("width", size);
	s.setAttribute("height", size);
	s.setAttribute("aria-hidden", "true");
	s.innerHTML = SVG[season];
	return s;
}

export function activate({ root, mode, reducedMotion }) {
	const d = disposer();
	const season = seasonNow();
	const logo = root.querySelector(".site-logo");
	const overlay = root.querySelector(".overlay-a") || root;
	if (!logo) return;

	const mark = document.createElement("span");
	mark.className = `qsm-mark qsm-${season}`;
	mark.dataset.season = season;
	mark.setAttribute("role", "img");
	mark.setAttribute("aria-label", `Season: ${season}`);
	mark.title = `It's ${season}. Click for a little drift.`;
	const halo = document.createElement("span");
	halo.className = "qsm-halo";
	mark.append(halo, icon(season, 20));
	logo.after(mark);

	// Aurora halo: leans toward the cursor, brightens with movement.
	const pt = pointer(d, () => lp.wake());
	let lx = 0;
	let ly = 0;
	let le = 0;
	const lp = loop(
		(dt) => {
			const r = mark.getBoundingClientRect();
			const tx = pt.has ? clamp((pt.x - (r.left + r.width / 2)) / 500, -1, 1) : 0;
			const ty = pt.has ? clamp((pt.y - (r.top + r.height / 2)) / 500, -1, 1) : 0;
			lx += (tx - lx) * 0.12;
			ly += (ty - ly) * 0.12;
			le += (pt.energy - le) * 0.15;
			mark.style.setProperty("--lx", (lx * 4).toFixed(2) + "px");
			mark.style.setProperty("--ly", (ly * 4).toFixed(2) + "px");
			mark.style.setProperty("--le", le.toFixed(3));
			const moving = pt.decay(dt);
			return moving || Math.abs(le - pt.energy) > 0.004 || Math.abs(lx - tx) > 0.01 || Math.abs(ly - ty) > 0.01;
		},
		{ fps: 30, el: mark, d },
	);
	if (!reducedMotion) lp.wake();

	// A rare drifter in the margins.
	const live = new Set();
	const drop = () => {
		if (reducedMotion || document.hidden) return;
		const vw = overlay.clientWidth || window.innerWidth;
		const vh = overlay.clientHeight || window.innerHeight;
		const colW = Math.min(root.querySelector(".site-page")?.clientWidth || 832, vw);
		const gutter = (vw - colW) / 2;
		if (gutter < 64 || live.size > 2) return;
		const left = Math.random() < 0.5;
		const x = 14 + Math.random() * (gutter - 54);
		const el = document.createElement("span");
		el.className = `qsm-fall qsm-fall-${FALL[season]}`;
		el.append(icon(season, 14));
		el.style.left = (left ? x : vw - x - 14) + "px";
		overlay.append(el);
		live.add(el);
		const dur = 16000 + Math.random() * 8000;
		const sway = 14 + Math.random() * 14;
		const up = season === "summer";
		const y0 = up ? vh + 20 : -24;
		const y1 = up ? -24 : vh + 24;
		const a = el.animate(
			[
				{ transform: `translate(0, ${y0}px) rotate(0deg)`, opacity: 0 },
				{ transform: `translate(${sway}px, ${y0 + (y1 - y0) * 0.15}px) rotate(40deg)`, opacity: 0.55, offset: 0.1 },
				{ transform: `translate(${-sway}px, ${y0 + (y1 - y0) * 0.5}px) rotate(120deg)`, opacity: 0.5, offset: 0.5 },
				{ transform: `translate(${sway * 0.6}px, ${y0 + (y1 - y0) * 0.85}px) rotate(200deg)`, opacity: 0.45, offset: 0.85 },
				{ transform: `translate(0, ${y1}px) rotate(260deg)`, opacity: 0 },
			],
			{ duration: dur, easing: "ease-in-out" },
		);
		a.onfinish = () => {
			live.delete(el);
			el.remove();
		};
	};
	let timer = 0;
	const schedule = (first) => {
		timer = setTimeout(
			() => {
				drop();
				schedule(false);
			},
			first ? 6000 : 28000 + Math.random() * 30000,
		);
	};
	if (!reducedMotion) schedule(true);
	d.on(mark, "click", () => drop());
	d.add(() => {
		clearTimeout(timer);
		for (const el of live) el.remove();
		mark.remove();
	});
	return () => d.run();
}

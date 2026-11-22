const NS = "http://www.w3.org/2000/svg";
const PLANE = `<svg viewBox="0 0 120 60" width="120" height="60">
<g class="pp-wing" style="transform-origin:54px 30px;transform:scaleY(var(--w,1))">
<path d="M8 12 L116 27 L54 30Z" fill="#fff" stroke="#9aa8c6" stroke-width="1" stroke-linejoin="round"/>
<path d="M30 47 L116 27 L54 30Z" fill="#e3e9f5" stroke="#9aa8c6" stroke-width="1" stroke-linejoin="round"/>
<path d="M8 12 L54 30 L30 47Z" fill="#cdd6e8" stroke="#8795b8" stroke-width="1" stroke-linejoin="round"/>
</g><path d="M54 30 L116 27" stroke="#8795b8" stroke-width="1"/></svg>`;

const G = 560; // px/s^2
const GLIDE = 330; // trim speed
const CL = G / GLIDE ** 2;
const CD = CL / 8; // lift/drag ratio of 8
const STEP = 1 / 120;

export function create(root, reduced) {
	const page = root.querySelector(".site-page");
	const layer = document.createElement("div");
	layer.className = "pp-layer";
	page.append(layer);
	const planes = new Set();
	let raf = 0;
	let last = 0;
	let acc = 0;
	let ledges = [];

	const origin = () => {
		const r = page.getBoundingClientRect();
		return { x: r.left, y: r.top, w: r.width, h: r.height };
	};

	function measureLedges() {
		const o = origin();
		ledges = [...root.querySelectorAll(".site-item, .site-section-title, .site-about p, .site-title, .site-tagline, .site-socials, .site-footer, .site-header, .site-portrait")]
			.map((el) => {
				const r = el.getBoundingClientRect();
				return { top: r.top - o.y, l: r.left - o.x, r: r.right - o.x };
			});
		ledges.push({ top: o.h - 6, l: -2000, r: 4000 });
	}

	function makePlane(el, box) {
		const plane = document.createElement("div");
		plane.className = "pp-plane";
		plane.innerHTML = PLANE;
		plane.title = "Click to unfold";
		plane.addEventListener("click", () => unfold(p));
		const trail = document.createElementNS(NS, "svg");
		trail.setAttribute("class", "pp-trail");
		const path = document.createElementNS(NS, "path");
		trail.append(path);
		const sheet = document.createElement("div");
		sheet.className = "pp-sheet";
		Object.assign(sheet.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.w}px`, height: `${box.h}px` });
		const clone = el.cloneNode(true);
		clone.classList.remove("pp-gone");
		sheet.append(clone);
		layer.append(trail, sheet, plane);
		const p = { el, box, plane, sheet, trail, path, pts: [], x: box.x + box.w / 2, y: box.y + box.h / 2, g: 0, v: 0, dir: 1, state: "fold", skid: 0 };
		planes.add(p);
		return p;
	}

	const place = (p, roll = 0) => {
		p.plane.style.transform = `translate(${p.x}px,${p.y}px) scale(${p.dir},1) rotate(${p.g}rad)`;
		p.plane.style.setProperty("--w", String(1 - Math.min(0.35, Math.abs(roll) * 0.12)));
	};

	async function fold(el) {
		if (el.classList.contains("pp-gone")) return;
		const o = origin();
		const r = el.getBoundingClientRect();
		const box = { x: r.left - o.x, y: r.top - o.y, w: r.width, h: r.height };
		measureLedges();
		const p = makePlane(el, box);
		el.classList.add("pp-gone");
		p.plane.style.opacity = "0";
		place(p);

		if (reduced) {
			p.sheet.style.display = "none";
			p.plane.style.opacity = "1";
			p.x = box.x + 60;
			p.y = box.y + box.h - 8;
			land(p);
			return;
		}

		const k = [Math.min(1, 150 / box.w), Math.min(1, 96 / box.h)];
		const ease = "cubic-bezier(0.5, 0, 0.2, 1)";
		await p.sheet.animate(
			[
				{ transform: "none", boxShadow: "0 1px 2px rgb(20 30 60 / 0.1)" },
				{ transform: "scale(1.01) rotate(-1deg)", offset: 0.25 },
				{ transform: `scale(${k[0]},${k[1]}) rotate(-6deg)`, opacity: 1, offset: 0.8 },
				{ transform: `scale(${k[0] * 0.8},${k[1] * 0.6}) rotate(-12deg)`, opacity: 0 },
			],
			{ duration: 620, easing: ease, fill: "forwards" },
		).finished;
		if (!planes.has(p)) return;
		p.plane.style.setProperty("--w", "0.02");
		p.plane.style.opacity = "1";
		p.sheet.style.display = "none";
		// Fold the wings up, then throw.
		requestAnimationFrame(() => requestAnimationFrame(() => place(p)));
		await new Promise((res) => setTimeout(res, 240));
		if (!planes.has(p)) return;
		const mid = innerWidth / 2;
		p.dir = box.x + origin().x + box.w / 2 < mid ? 1 : -1;
		p.g = -0.55;
		p.v = 720;
		p.state = "fly";
		p.pts = [[p.x, p.y]];
		start();
	}

	function stepPlane(p) {
		const px = p.x;
		const py = p.y;
		if (p.state === "fly") {
			const v = Math.max(p.v, 40);
			const dv = G * Math.sin(p.g) - CD * v * v;
			const dg = (G * Math.cos(p.g) - CL * v * v) / v;
			p.v = Math.max(40, p.v + dv * STEP);
			p.g += Math.max(-4, Math.min(4, dg)) * STEP;
			p.roll = dg;
			p.x += p.dir * p.v * Math.cos(p.g) * STEP;
			p.y += p.v * Math.sin(p.g) * STEP;
			const o = origin();
			const viewX = p.x + o.x;
			if ((viewX < 30 && p.dir < 0) || (viewX > innerWidth - 30 && p.dir > 0)) p.dir = -p.dir;
			if (p.y < 20) { p.y = 20; p.g = Math.max(p.g, 0.2); }
			if (p.v * Math.sin(p.g) > 0) {
				const belly = p.y + 12;
				const pb = py + 12;
				for (const l of ledges) {
					if (pb <= l.top + 1 && belly >= l.top && p.x > l.l - 8 && p.x < l.r + 8) {
						p.y = l.top - 12;
						p.state = "skid";
						p.skid = p.v * Math.cos(p.g) * 0.55;
						p.ledge = l;
						break;
					}
				}
			}
			if (p.state === "fly") {
				const d = Math.hypot(p.x - p.pts.at(-1)[0], p.y - p.pts.at(-1)[1]);
				if (d > 14) p.pts.push([p.x, p.y]);
			}
		} else if (p.state === "skid") {
			p.x += p.dir * p.skid * STEP;
			p.skid *= Math.exp(-5 * STEP);
			p.g += (0.04 - p.g) * Math.min(1, 14 * STEP);
			p.roll = 0;
			if (p.x < p.ledge.l || p.x > p.ledge.r) {
				p.x = Math.max(p.ledge.l, Math.min(p.ledge.r, p.x));
				p.skid = 0;
			}
			if (p.skid < 4) land(p);
		}
		void px;
	}

	function land(p) {
		p.state = "landed";
		p.g = reduced ? 0 : 0.04;
		p.plane.classList.add("is-landed");
		p.plane.style.setProperty("--w", "1");
		place(p);
		p.trail.classList.add("is-fading");
	}

	function draw(p) {
		place(p, p.roll ?? 0);
		if (p.pts.length > 1) {
			p.path.setAttribute("d", `M${p.pts.map((q) => `${q[0].toFixed(0)} ${q[1].toFixed(0)}`).join("L")}`);
		}
	}

	function frame(now) {
		raf = 0;
		if (document.hidden) { last = 0; start(); return; }
		acc += Math.min(0.05, last ? (now - last) / 1000 : 0.016);
		last = now;
		let flying = false;
		while (acc >= STEP) {
			acc -= STEP;
			for (const p of planes) if (p.state === "fly" || p.state === "skid") stepPlane(p);
		}
		for (const p of planes) {
			if (p.state === "fly" || p.state === "skid") { flying = true; draw(p); }
		}
		if (flying) start(); else last = 0;
	}
	function start() { if (!raf) raf = requestAnimationFrame(frame); }

	async function unfold(p) {
		if (!planes.has(p) || p.state === "unfolding") return;
		p.state = "unfolding";
		planes.delete(p);
		const dx = p.x - (p.box.x + p.box.w / 2);
		const dy = p.y - (p.box.y + p.box.h / 2);
		p.plane.style.pointerEvents = "none";
		p.plane.style.opacity = "0";
		p.plane.style.transition = "opacity .2s";
		p.sheet.style.display = "";
		const s = reduced ? [] : [
			{ transform: `translate(${dx}px,${dy}px) scale(0.2,0.12) rotate(-10deg)`, opacity: 0 },
			{ transform: "scale(1.02) rotate(0.5deg)", opacity: 1, offset: 0.75 },
			{ transform: "none", opacity: 1 },
		];
		if (s.length) await p.sheet.animate(s, { duration: 520, easing: "cubic-bezier(0.2, 0.9, 0.3, 1)", fill: "forwards" }).finished;
		p.el.classList.remove("pp-gone");
		p.sheet.remove();
		p.plane.remove();
		p.trail.remove();
	}

	const onKey = (e) => {
		if (e.key === "Escape" && planes.size) [...planes].forEach(unfold);
	};
	document.addEventListener("keydown", onKey);

	return {
		fold,
		destroy() {
			cancelAnimationFrame(raf);
			document.removeEventListener("keydown", onKey);
			layer.remove();
			planes.clear();
		},
	};
}

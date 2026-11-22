// 104. Birdwatch: click a bird to log it in a tiny field guide that fills up across visits.
import { buildScene } from "./ridge-runner/scenery.js";
import { createFlock, SPECIES, birdSVG } from "./ridge-runner/birds.js";

const KEY = "dotcom-birdwatch-guide-v1";
const ORDER = ["chickadee", "nuthatch", "jay", "cardinal", "goldfinch", "swallow", "woodpecker", "loon", "eagle", "owl", "sawwhet"];
const HINT = {
	loon: "Look on the lake.",
	eagle: "Watch the sky. It's rare.",
	owl: "Switch to dark mode (D).",
	sawwhet: "Dark mode, and patience.",
	woodpecker: "Try the birch trunks.",
	nuthatch: "Try the birch trunks.",
};

const load = () => {
	try {
		return JSON.parse(localStorage.getItem(KEY)) || {};
	} catch {
		return {};
	}
};
const save = (d) => {
	try {
		localStorage.setItem(KEY, JSON.stringify(d));
	} catch {
		/* private mode */
	}
};

export function activate({ root, mode, reducedMotion }) {
	const scene = buildScene(root, { seed: 104, lakeTop: 0.72 });
	const dark = mode === "dark";
	const overlay = root.querySelector(".overlay-b");
	// Birds live in the overlay (above the text) so they can be clicked anywhere; only the birds take pointer events.
	const layer = document.createElement("div");
	layer.className = "sc-birds";
	root.querySelector(".overlay-a").appendChild(layer);
	scene.birdLayer = layer;
	const data = load();
	const total = ORDER.length;
	const roster = dark ? ["owl", "sawwhet", "chickadee", "loon", "swallow"] : ["chickadee", "jay", "cardinal", "goldfinch", "nuthatch", "woodpecker", "swallow", "loon", "eagle"];

	// Perches: spruce tops, two birch trunks (clingers), and open water.
	const perches = [];
	const refresh = () => {
		const tops = scene.treePerches();
		const trunks = [];
		for (const side of ["l", "r"]) {
			const inward = side === "l" ? 9 : 9;
			void inward;
			for (const [vx, vy, kind] of [[214, 640, "a"], [214, 500, "b"], [296, 700, "c"]]) {
				const p = scene.vbPoint(side, vx + 10, vy);
				trunks.push({ ...p, face: side === "l" ? -1 : -1, trunk: true, side: `t${side}${kind}` });
			}
		}
		const water = [[0.34, 0.12], [0.64, 0.1], [0.5, 0.2]].map(([x, y]) => ({ x, y: 0.72 + 0.28 * y, face: 1, water: true }));
		const all = [...tops, ...trunks, ...water];
		all.forEach((p, i) => {
			if (perches[i]) Object.assign(perches[i], p);
			else perches.push(p);
		});
	};
	refresh();

	const size = 1.45;
	const flock = createFlock(layer, {
		species: roster,
		perches,
		reduced: reducedMotion,
		seed: 1041,
		size,
		interval: [1800, 4200],
		onPick: (b) => pick(b),
	});

	// Eagle: a rare slow flyby rather than a perch-hopper.
	const eagle = flock.birds.find((b) => b.key === "eagle");
	let eagleTimer = 0;
	if (eagle) {
		eagle.held = true;
		eagle.el.style.visibility = "hidden";
		eagle.away = true;
		if (!reducedMotion) {
			const go = () => {
				const { w, h } = flock.dims();
				const dir = Math.random() < 0.5 ? 1 : -1;
				const y0 = h * (0.12 + Math.random() * 0.12);
				eagle.el.style.visibility = "";
				eagle.el.classList.add("flying");
				const a = { x: dir > 0 ? -120 : w + 120, y: y0 }, c = { x: dir > 0 ? w + 120 : -120, y: y0 + h * 0.08 };
				const anim = eagle.el.animate(
					[
						{ transform: `translate(${a.x}px, ${a.y}px) scaleX(${dir}) rotate(-3deg)` },
						{ transform: `translate(${(a.x + c.x) / 2}px, ${y0 - 14}px) scaleX(${dir}) rotate(3deg)`, offset: 0.5 },
						{ transform: `translate(${c.x}px, ${c.y}px) scaleX(${dir}) rotate(-3deg)` },
					],
					{ duration: 26000, easing: "linear", fill: "forwards" },
				);
				eagle.anim = anim;
				anim.onfinish = () => {
					eagle.el.style.visibility = "hidden";
					eagle.anim = null;
					eagleTimer = setTimeout(go, 35000 + Math.random() * 40000);
				};
			};
			eagleTimer = setTimeout(go, 9000);
		}
	}

	// ---- field guide UI
	const btn = document.createElement("button");
	btn.type = "button";
	btn.className = "bw-btn";
	const panel = document.createElement("div");
	panel.className = "bw-panel";
	panel.hidden = true;
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Field guide");
	const toast = document.createElement("div");
	toast.className = "bw-toast";
	toast.setAttribute("role", "status");
	overlay.append(btn, panel, toast);

	const count = () => ORDER.filter((k) => data[k]).length;
	const renderBtn = () => {
		btn.innerHTML = `Field guide ${count()}/${total}<kbd>G</kbd>`;
		btn.setAttribute("aria-label", `Field guide, ${count()} of ${total} species logged. Press G to toggle.`);
	};
	const renderPanel = () => {
		panel.innerHTML = `<h2>Field guide</h2><p>${count()} of ${total} logged. Click birds in the scene to find them. Saved on this device.</p><div class="bw-grid"></div>`;
		const grid = panel.querySelector(".bw-grid");
		for (const k of ORDER) {
			const sp = SPECIES[k];
			const seen = data[k];
			const card = document.createElement("div");
			card.className = `bw-card${seen ? "" : " locked"}`;
			card.innerHTML = `<div class="bw-pic">${birdSVG(k, 0.9)}</div><b>${seen ? sp.name : "???"}</b><i>${seen ? sp.latin : "Not yet seen"}</i><small>${seen ? `${sp.note} Seen ×${seen}.` : HINT[k] || "Perched in the spruce tops."}</small>`;
			grid.appendChild(card);
		}
	};
	renderBtn();
	const setPanel = (open) => {
		panel.hidden = !open;
		btn.setAttribute("aria-expanded", String(open));
		if (open) renderPanel();
	};
	btn.addEventListener("click", () => setPanel(panel.hidden));

	let toastT = 0;
	const say = (text) => {
		toast.textContent = text;
		toast.classList.add("show");
		clearTimeout(toastT);
		toastT = setTimeout(() => toast.classList.remove("show"), 2400);
	};

	function pick(b) {
		const k = b.key;
		const fresh = !data[k];
		data[k] = (data[k] || 0) + 1;
		save(data);
		renderBtn();
		if (!panel.hidden) renderPanel();
		say(fresh ? `New species: ${SPECIES[k].name} (${count()}/${total})` : `${SPECIES[k].name}, seen ×${data[k]}`);
		const ring = document.createElement("div");
		ring.className = "bw-ring";
		ring.style.transform = `translate(${b.pos.x}px, ${b.pos.y}px)`;
		const inner = document.createElement("div");
		inner.className = "bw-ring go";
		inner.style.cssText = "left:0;top:0;position:absolute";
		ring.style.cssText = `position:absolute;left:0;top:0;width:0;height:0;transform:translate(${b.pos.x}px,${b.pos.y}px);pointer-events:none`;
		ring.className = "";
		ring.appendChild(inner);
		scene.birdLayer.appendChild(ring);
		setTimeout(() => ring.remove(), 1000);
		if (reducedMotion) {
			if (!b.sp.soar) {
				b.el.style.visibility = "hidden";
				setTimeout(() => {
					const to = flock.freePerch(b);
					if (to) {
						b.perch = to;
						flock.place(b, to, b.face);
					}
					b.el.style.visibility = "";
				}, 2500);
			}
		} else if (!b.busy && !b.sp.swim && !b.sp.soar) {
			setTimeout(() => flock.fly(b, "away", { speed: 380 }), 500);
		}
	}

	const onKey = (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const t = e.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (e.code === "KeyG") {
			e.preventDefault();
			setPanel(panel.hidden);
		} else if (e.code === "Escape" && !panel.hidden) {
			setPanel(false);
		}
	};
	window.addEventListener("keydown", onKey, true);
	let rt = 0;
	const onResize = () => {
		clearTimeout(rt);
		rt = setTimeout(() => {
			refresh();
			for (const b of flock.birds) if (!b.busy && b.perch && !b.away) flock.place(b, b.perch, b.face);
		}, 150);
	};
	addEventListener("resize", onResize);
	flock.start();

	return () => {
		clearTimeout(eagleTimer);
		clearTimeout(toastT);
		clearTimeout(rt);
		removeEventListener("resize", onResize);
		window.removeEventListener("keydown", onKey, true);
		flock.stop();
		btn.remove();
		panel.remove();
		toast.remove();
	};
}

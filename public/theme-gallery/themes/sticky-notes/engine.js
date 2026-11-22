const FONT = "https://fonts.googleapis.com/css2?family=Caveat:wght@500&display=swap";
const MAX = 40;
const W = 176;

const POLY_FLAT = "polygon(0 0,25% 0,50% 0,75% 0,100% 0,100% 33%,100% 66%,100% 100%,66% 100%,33% 100%,0 100%,0 50%)";
const POLY_BALL = "polygon(10% 15%,30% 0%,55% 12%,85% 5%,100% 30%,90% 55%,100% 80%,75% 100%,50% 88%,25% 100%,0 78%,8% 45%)";

export function create(root, reduced, KEY, chip) {
	const page = root.querySelector(".site-page");
	const layer = document.createElement("div");
	layer.className = "sn-layer";
	page.append(layer);
	const font = document.createElement("link");
	font.rel = "stylesheet";
	font.href = FONT;
	document.head.append(font);

	let notes = [];
	let z = 10;
	let timer = 0;
	let toast;
	let toastTimer = 0;
	const badge = document.createElement("b");

	const pageBox = () => page.getBoundingClientRect();

	function persist() {
		clearTimeout(timer);
		timer = setTimeout(flush, 250);
		updateBadge();
	}
	function flush() {
		clearTimeout(timer);
		try {
			localStorage.setItem(KEY, JSON.stringify(notes.map(({ data }) => data)));
		} catch {}
	}
	function updateBadge() {
		badge.textContent = String(notes.length);
		if (notes.length && !badge.isConnected) chip.append(badge);
		if (!notes.length) badge.remove();
	}
	addEventListener("pagehide", flush);

	function place(n) {
		const w = pageBox().width;
		n.el.style.left = `${w / 2 + n.data.x - W / 2}px`;
		n.el.style.top = `${n.data.y}px`;
	}

	function mount(data, fresh) {
		const el = document.createElement("div");
		el.className = "sn-note";
		el.dataset.c = data.c;
		el.style.setProperty("--r", `${data.r}deg`);
		el.innerHTML = '<div class="sn-bar" title="Drag to move"><span class="sn-grip"></span><button class="sn-x" type="button" aria-label="Crumple this note">✕</button></div><div class="sn-text" contenteditable="plaintext-only" spellcheck="false" role="textbox" aria-label="Sticky note" data-ph="Write something…"></div>';
		const text = el.querySelector(".sn-text");
		text.textContent = data.t;
		const n = { data, el };
		notes.push(n);
		layer.append(el);
		place(n);

		text.addEventListener("input", () => { data.t = text.textContent; persist(); });
		text.addEventListener("keydown", (e) => { if (e.key === "Escape") text.blur(); });
		el.addEventListener("pointerdown", () => { el.style.zIndex = String(++z); });
		el.querySelector(".sn-x").addEventListener("click", () => crumple(n));
		drag(n);

		if (fresh && !reduced) {
			el.animate(
				[
					{ transform: `rotate(${data.r - 8}deg) scale(1.5)`, opacity: 0, boxShadow: "0 30px 30px -10px rgb(60 40 0 / 0.3)" },
					{ transform: `rotate(${data.r + 1}deg) scale(0.97)`, opacity: 1, offset: 0.65 },
					{ transform: `rotate(${data.r}deg) scale(1)`, opacity: 1 },
				],
				{ duration: 380, easing: "cubic-bezier(0.3, 0.9, 0.4, 1)" },
			);
		}
		return n;
	}

	function drag(n) {
		const bar = n.el.querySelector(".sn-bar");
		bar.addEventListener("pointerdown", (e) => {
			if (e.target.closest(".sn-x")) return;
			e.preventDefault();
			bar.setPointerCapture(e.pointerId);
			const sx = e.clientX;
			const sy = e.clientY;
			const ox = n.data.x;
			const oy = n.data.y;
			n.el.classList.add("is-drag");
			const move = (m) => {
				const w = pageBox().width;
				n.data.x = Math.round(ox + (m.clientX - sx));
				n.data.y = Math.max(0, Math.round(oy + (m.clientY - sy)));
				n.el.style.left = `${w / 2 + n.data.x - W / 2}px`;
				n.el.style.top = `${n.data.y}px`;
			};
			const up = () => {
				bar.removeEventListener("pointermove", move);
				bar.removeEventListener("pointerup", up);
				bar.removeEventListener("pointercancel", up);
				n.el.classList.remove("is-drag");
				persist();
			};
			bar.addEventListener("pointermove", move);
			bar.addEventListener("pointerup", up);
			bar.addEventListener("pointercancel", up);
		});
	}

	async function crumple(n) {
		const i = notes.indexOf(n);
		if (i < 0) return;
		notes.splice(i, 1);
		persist();
		showUndo(n, i);
		const el = n.el;
		el.style.pointerEvents = "none";
		if (!reduced) {
			const r = n.data.r;
			await el.animate(
				[
					{ transform: `rotate(${r}deg)`, clipPath: POLY_FLAT, opacity: 1 },
					{ transform: `rotate(${r - 6}deg) scale(0.92, 0.78)`, clipPath: POLY_FLAT, offset: 0.2 },
					{ transform: `rotate(${r + 40}deg) scale(0.4)`, clipPath: POLY_BALL, offset: 0.55 },
					{ transform: `translateY(30px) rotate(${r + 120}deg) scale(0.2)`, clipPath: POLY_BALL, opacity: 1, offset: 0.78 },
					{ transform: `translateY(58px) rotate(${r + 200}deg) scale(0.17)`, clipPath: POLY_BALL, opacity: 0 },
				],
				{ duration: 700, easing: "cubic-bezier(0.5, 0, 0.5, 1)", fill: "forwards" },
			).finished.catch(() => {});
		}
		el.remove();
	}

	function showUndo(n, index) {
		toast?.remove();
		clearTimeout(toastTimer);
		if (!n.data.t.trim()) return;
		toast = document.createElement("div");
		toast.className = "sn-toast";
		toast.innerHTML = '<span>Note crumpled</span><button type="button">Undo</button>';
		toast.querySelector("button").addEventListener("click", () => {
			toast.remove();
			const back = mount(n.data, true);
			notes.splice(notes.indexOf(back), 1);
			notes.splice(Math.min(index, notes.length), 0, back);
			persist();
		});
		root.append(toast);
		toastTimer = setTimeout(() => toast?.remove(), 6000);
	}

	function add(cx, cy) {
		if (notes.length >= MAX) return;
		const box = pageBox();
		const left = Math.max(8, Math.min(innerWidth - W - 8, cx - W / 2));
		const data = {
			c: Math.floor(Math.random() * 5),
			r: Math.round((Math.random() * 7 - 3.5) * 10) / 10,
			t: "",
			x: Math.round(left + W / 2 - (box.left + box.width / 2)),
			y: Math.max(0, Math.round(cy - box.top - 14)),
		};
		const n = mount(data, true);
		persist();
		requestAnimationFrame(() => n.el.querySelector(".sn-text").focus());
	}

	let saved = [];
	try { saved = JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch {}
	for (const d of saved.slice(0, MAX)) mount({ c: 0, r: 0, t: "", x: 0, y: 0, ...d }, false);
	updateBadge();

	const onResize = () => notes.forEach(place);
	addEventListener("resize", onResize);

	return {
		add,
		destroy() {
			flush();
			clearTimeout(toastTimer);
			removeEventListener("resize", onResize);
			removeEventListener("pagehide", flush);
			font.remove();
			toast?.remove();
			layer.remove();
		},
	};
}

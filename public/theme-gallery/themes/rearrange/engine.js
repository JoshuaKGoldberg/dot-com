const K = 330; // spring stiffness
const C = 25; // damping (slightly underdamped: a little settle)
const STEP = 1 / 120;

export function create({ root, main, keys, store, reducedMotion, onChange }) {
	const items = () => keys.map((k) => main.querySelector("." + k)).filter(Boolean);
	const ordered = () => [...main.children].filter((c) => keys.some((k) => c.classList.contains(k)));
	const nameOf = (el) => ({ "site-hero": "Intro", "site-about": "About", "site-posts": "Writing", "site-projects": "Projects", "site-talks": "Speaking" })[keys.find((k) => el.classList.contains(k))];

	const state = new Map(); // el -> {y, v, s, sv}
	let raf = 0, last = 0, acc = 0, dragging = null, editing = false;
	const live = document.createElement("p");
	live.className = "dl-sr";
	live.setAttribute("aria-live", "polite");
	const reset = document.createElement("button");
	reset.className = "rg-reset";
	reset.type = "button";
	reset.textContent = "Reset order";
	reset.hidden = true;
	root.append(live, reset);

	const st = (el) => {
		let s = state.get(el);
		if (!s) state.set(el, (s = { y: 0, v: 0, s: 1, sv: 0 }));
		return s;
	};
	const apply = (el, s) => {
		el.style.transform = s.y === 0 && s.s === 1 ? "" : `translate3d(0,${s.y.toFixed(2)}px,0) scale(${s.s.toFixed(4)})`;
	};

	function tick(now) {
		raf = 0;
		acc += Math.min(0.05, (now - last) / 1000);
		last = now;
		while (acc >= STEP) {
			acc -= STEP;
			for (const [el, s] of state) {
				if (el === dragging?.el) {
					// the dragged card chases a gentle lift, y is driven by the pointer
					const ts = 1.025;
					s.sv += (-K * (s.s - ts) - C * s.sv) * STEP;
					s.s += s.sv * STEP;
					continue;
				}
				s.v += (-K * s.y - C * s.v) * STEP;
				s.y += s.v * STEP;
				s.sv += (-K * (s.s - 1) - C * s.sv) * STEP;
				s.s += s.sv * STEP;
			}
		}
		let busy = !!dragging;
		for (const [el, s] of state) {
			if (el !== dragging?.el && Math.abs(s.y) < 0.2 && Math.abs(s.v) < 4 && Math.abs(s.s - 1) < 0.0006 && Math.abs(s.sv) < 0.05) {
				state.delete(el);
				el.style.transform = "";
				el.classList.remove("rg-lifted");
				continue;
			}
			apply(el, s);
			busy = true;
		}
		if (dragging) autoscroll();
		if (busy) schedule();
	}
	const schedule = () => {
		if (!raf) {
			last = performance.now();
			raf = requestAnimationFrame(tick);
		}
	};

	function contentY(clientY) {
		return clientY - root.getBoundingClientRect().top + root.scrollTop;
	}

	// move el to index, springing everyone else from where they were
	function moveTo(el, index) {
		const list = ordered();
		const before = new Map(list.map((n) => [n, n.offsetTop + (state.get(n)?.y ?? 0)]));
		const others = list.filter((n) => n !== el);
		if (others[index] === undefined) main.append(el);
		else main.insertBefore(el, others[index]);
		if (reducedMotion) return;
		for (const n of ordered()) {
			if (n === el) continue;
			const s = st(n);
			s.y = before.get(n) - n.offsetTop;
		}
	}

	function updateDrag() {
		const d = dragging;
		const s = st(d.el);
		const desiredTop = contentY(d.clientY) - d.grab;
		const centre = desiredTop + d.el.offsetHeight / 2;
		const others = ordered().filter((n) => n !== d.el);
		let index = 0;
		for (const n of others) if (n.offsetTop + n.offsetHeight / 2 < centre) index++;
		if (ordered().indexOf(d.el) !== index) moveTo(d.el, index);
		s.y = desiredTop - d.el.offsetTop;
		s.v = 0;
		apply(d.el, s);
	}

	function autoscroll() {
		const r = root.getBoundingClientRect();
		const edge = 70;
		const y = dragging.clientY;
		let dy = 0;
		if (y < r.top + edge) dy = -((r.top + edge - y) / edge) * 14;
		else if (y > r.bottom - edge) dy = ((y - (r.bottom - edge)) / edge) * 14;
		if (dy) {
			root.scrollTop += dy;
			updateDrag();
		}
	}

	function save() {
		const order = ordered().map((n) => keys.find((k) => n.classList.contains(k)));
		const isDefault = order.every((k, i) => k === keys[i]);
		if (isDefault) localStorage.removeItem(store);
		else localStorage.setItem(store, JSON.stringify(order));
		reset.hidden = !editing || isDefault;
	}

	function onDown(e) {
		const grip = e.target.closest(".rg-grip");
		if (!grip || e.button > 0) return;
		e.preventDefault();
		const el = grip.parentElement;
		grip.setPointerCapture(e.pointerId);
		dragging = { el, clientY: e.clientY, grab: contentY(e.clientY) - el.offsetTop, grip };
		el.classList.add("rg-lifted");
		document.documentElement.classList.add("rg-dragging");
		st(el);
		updateDrag();
		schedule();
	}
	function onMove(e) {
		if (!dragging) return;
		dragging.clientY = e.clientY;
		updateDrag();
	}
	function onUp() {
		if (!dragging) return;
		const { el } = dragging;
		dragging = null;
		document.documentElement.classList.remove("rg-dragging");
		const s = st(el);
		if (reducedMotion) {
			s.y = 0;
			s.s = 1;
			el.style.transform = "";
			el.classList.remove("rg-lifted");
			state.delete(el);
		} else schedule();
		save();
	}
	function onKey(e) {
		const grip = e.target.closest?.(".rg-grip");
		if (!grip || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
		e.preventDefault();
		const el = grip.parentElement;
		const i = ordered().indexOf(el);
		const j = Math.max(0, Math.min(ordered().length - 1, i + (e.key === "ArrowUp" ? -1 : 1)));
		if (i === j) return;
		moveTo(el, j);
		el.classList.add("rg-lifted");
		const s = st(el);
		s.y = 0;
		s.s = 1.025;
		if (!reducedMotion) schedule();
		else {
			state.delete(el);
			el.classList.remove("rg-lifted");
		}
		el.scrollIntoView({ block: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
		grip.focus({ preventScroll: true });
		live.textContent = `${nameOf(el)} moved to position ${j + 1} of ${ordered().length}`;
		save();
	}
	reset.addEventListener("click", () => {
		const list = items();
		const before = new Map(list.map((n) => [n, n.offsetTop]));
		for (const el of list) main.append(el);
		for (const n of list) {
			if (!reducedMotion) st(n).y = before.get(n) - n.offsetTop;
		}
		schedule();
		save();
	});

	function setEditing(on) {
		editing = on;
		root.classList.toggle("rg-editing", on);
		for (const el of items()) {
			el.querySelector(":scope > .rg-grip")?.remove();
			if (!on) continue;
			const g = document.createElement("button");
			g.type = "button";
			g.className = "rg-grip";
			g.setAttribute("aria-label", `Reorder ${nameOf(el)} section. Drag, or use the up and down arrow keys.`);
			g.innerHTML = "<span aria-hidden='true'>⠿</span>";
			el.prepend(g);
		}
		reset.hidden = !on || ordered().every((n, i) => n.classList.contains(keys[i]));
		onChange(on);
	}

	main.addEventListener("pointerdown", onDown);
	main.addEventListener("keydown", onKey);
	window.addEventListener("pointermove", onMove);
	window.addEventListener("pointerup", onUp);
	window.addEventListener("pointercancel", onUp);

	return {
		toggle: () => setEditing(!editing),
		destroy() {
			cancelAnimationFrame(raf);
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			window.removeEventListener("pointercancel", onUp);
			main.removeEventListener("pointerdown", onDown);
			main.removeEventListener("keydown", onKey);
			document.documentElement.classList.remove("rg-dragging");
		},
	};
}

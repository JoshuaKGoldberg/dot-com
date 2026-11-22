const MIN = 1.5;
const MAX = 5;

export function create(root, reduced) {
	const page = root.querySelector(".site-page");
	const lens = document.createElement("div");
	lens.className = "lp-lens";
	lens.setAttribute("aria-hidden", "true");
	lens.innerHTML = '<div class="lp-handle"></div><div class="lp-pop"><div class="lp-clip"><div class="lp-view"></div><div class="lp-glass"></div></div><div class="lp-rim"></div></div><div class="lp-zoom"></div>';
	root.append(lens);
	const view = lens.querySelector(".lp-view");
	const zoomLabel = lens.querySelector(".lp-zoom");
	let zoom = 2.2;
	let px = 0;
	let py = 0;
	let raf = 0;
	let on = false;
	let zoomTimer = 0;
	const R = 95;

	function build() {
		const clone = page.cloneNode(true);
		for (const el of clone.querySelectorAll("[id]")) el.removeAttribute("id");
		for (const a of clone.querySelectorAll("a, button")) a.tabIndex = -1;
		view.replaceChildren(clone);
		view.style.width = `${page.getBoundingClientRect().width}px`;
	}

	function paint() {
		raf = 0;
		const pr = page.getBoundingClientRect();
		lens.style.transform = `translate3d(${px - R}px, ${py - R}px, 0)`;
		view.style.transform = `translate(${R - (px - pr.left) * zoom}px, ${R - (py - pr.top) * zoom}px) scale(${zoom})`;
	}
	const queue = () => { raf ||= requestAnimationFrame(paint); };

	const onWheel = (e) => {
		if (!on) return;
		e.preventDefault();
		zoom = Math.max(MIN, Math.min(MAX, zoom * Math.exp(-e.deltaY * 0.0015)));
		zoomLabel.textContent = `${zoom.toFixed(1)}×`;
		zoomLabel.classList.add("is-shown");
		clearTimeout(zoomTimer);
		zoomTimer = setTimeout(() => zoomLabel.classList.remove("is-shown"), 700);
		queue();
	};
	const onScroll = () => on && queue();

	return {
		show(x, y) {
			if (on) return;
			on = true;
			px = x;
			py = y;
			build();
			paint();
			// Let the first paint land at the pointer, then pop in.
			lens.classList.add("is-on");
			root.addEventListener("wheel", onWheel, { passive: false });
			root.addEventListener("scroll", onScroll, { passive: true });
		},
		hide() {
			on = false;
			lens.classList.remove("is-on");
			root.removeEventListener("wheel", onWheel);
			root.removeEventListener("scroll", onScroll);
			setTimeout(() => !on && view.replaceChildren(), 250);
		},
		move(x, y) {
			px = x;
			py = y;
			if (on) queue();
		},
		destroy() {
			cancelAnimationFrame(raf);
			clearTimeout(zoomTimer);
			lens.remove();
		},
	};
}

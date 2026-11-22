// Fallback for browsers without CSS scroll-driven animations (and the only
// driver for the section titles' "view" progress there).
export function activate({ root, reducedMotion }) {
	const native = CSS.supports("animation-timeline: scroll()");
	if (native || reducedMotion) {
		return;
	}
	root.classList.add("vf-js");
	const lerp = (a, b, t) => a + (b - a) * Math.min(1, Math.max(0, t));
	const titles = [...root.querySelectorAll(".site-section-title")];
	let frame = 0;
	const update = () => {
		frame = 0;
		const p = root.scrollTop / 420;
		root.style.setProperty("--vf-wght", lerp(160, 1000, p));
		root.style.setProperty("--vf-wdth", lerp(50, 130, p));
		root.style.setProperty("--vf-amp", lerp(0.35, 1.5, root.scrollTop / 1500));
		const h = root.clientHeight;
		for (const title of titles) {
			const top = title.getBoundingClientRect().top;
			const t = (h - top) / (h * 0.6);
			title.style.setProperty("--vf-sw-wght", lerp(120, 950, t));
			title.style.setProperty("--vf-sw-wdth", lerp(40, 125, t));
		}
	};
	const onScroll = () => { frame ||= requestAnimationFrame(update); };
	root.addEventListener("scroll", onScroll, { passive: true });
	update();
	return () => {
		root.classList.remove("vf-js");
		for (const p of ["--vf-wght", "--vf-wdth", "--vf-amp"]) root.style.removeProperty(p);
		cancelAnimationFrame(frame);
	};
}

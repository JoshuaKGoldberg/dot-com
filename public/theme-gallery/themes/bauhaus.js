// 18 — Bauhaus: gentle scroll parallax on the margin shapes.
export function activate({ root, reducedMotion }) {
	if (reducedMotion) return;
	const scenery = root.querySelector(".site-scenery");
	if (!scenery) return;
	let frame = 0;
	const update = () => {
		frame = 0;
		scenery.style.setProperty("--scroll", String(root.scrollTop));
	};
	const onScroll = () => {
		if (!frame) frame = requestAnimationFrame(update);
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	update();
	return () => {
		root.removeEventListener("scroll", onScroll);
		cancelAnimationFrame(frame);
	};
}

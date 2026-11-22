export function activate({ root }) {
	let frame = 0;
	const onMove = (event) => {
		const card = event.target.closest?.(".site-item");
		if (!card) return;
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			const r = card.getBoundingClientRect();
			card.style.setProperty("--mx", `${event.clientX - r.left}px`);
			card.style.setProperty("--my", `${event.clientY - r.top}px`);
		});
	};
	root.addEventListener("pointermove", onMove);
	return () => { cancelAnimationFrame(frame); root.removeEventListener("pointermove", onMove); };
}

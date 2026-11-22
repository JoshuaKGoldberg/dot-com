// 124 — Finale: reach the bottom and a quiet fireworks show bursts over the footer.
// Pre-activation cost: one passive scroll listener. The show module is fetched as you near the end.
export function activate({ root, reducedMotion }) {
	let show = null;
	let mod = null;
	let armed = true;
	let lastRun = 0;
	let loading = null;

	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Scroll to the end of the page for a little finale";
	chip.innerHTML = '<span aria-hidden="true">🎆</span><span>Finale: scroll to the end</span>';
	root.append(chip);

	const load = () => (loading ??= import("./finale/show.js").then((m) => (mod = m)));
	const play = async () => {
		lastRun = performance.now();
		armed = false;
		await load();
		show?.stop();
		chip.setAttribute("aria-pressed", "true");
		show = mod.start({ root, reducedMotion, onEnd: () => chip.setAttribute("aria-pressed", "false") });
	};
	const onScroll = () => {
		const left = root.scrollHeight - root.clientHeight - root.scrollTop;
		if (left < root.clientHeight * 1.2) load();
		if (left < 28 && armed) play();
		else if (left > 240 && performance.now() - lastRun > 1500) armed = true;
	};
	root.addEventListener("scroll", onScroll, { passive: true });
	chip.addEventListener("click", () => {
		const left = root.scrollHeight - root.clientHeight - root.scrollTop;
		if (left < 28) play();
		else root.scrollTo({ top: root.scrollHeight, behavior: reducedMotion ? "auto" : "smooth" });
	});
	return () => {
		root.removeEventListener("scroll", onScroll);
		show?.stop();
	};
}

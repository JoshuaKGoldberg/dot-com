const TARGETS = { blog: ".site-posts", projects: ".site-projects", speaking: ".site-talks" };

export function activate({ root }) {
	const links = [...root.querySelectorAll(".site-nav-link")];
	let timer;
	const key = (link) => link.textContent.trim().toLowerCase();
	const reduced = () =>
		document.documentElement.classList.contains("reduce-motion") ||
		matchMedia("(prefers-reduced-motion: reduce)").matches;

	function apply(name) {
		if (name === "book") delete root.dataset.personality;
		else root.dataset.personality = name;
		for (const link of links) {
			const on = key(link) === name;
			link.classList.toggle("is-active", on);
			on ? link.setAttribute("aria-current", "true") : link.removeAttribute("aria-current");
		}
		for (const [k, sel] of Object.entries(TARGETS)) {
			root.querySelector(sel)?.classList.toggle("is-emphasized", k === name);
		}
	}

	function select(name) {
		const target = TARGETS[name] ? root.querySelector(TARGETS[name]) : null;
		const still = reduced();
		if (!still) {
			if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
			else root.scrollTo({ top: 0, behavior: "smooth" });
		} else {
			if (target) target.scrollIntoView({ block: "start" });
			else root.scrollTo({ top: 0 });
		}
		if (!still && document.startViewTransition) {
			root.dataset.vt = "";
			const t = document.startViewTransition(() => apply(name));
			t.finished.finally(() => delete root.dataset.vt);
		} else {
			apply(name);
		}
		clearTimeout(timer);
	}

	const handlers = links.map((link) => {
		const fn = (event) => { event.preventDefault(); select(key(link)); };
		link.addEventListener("click", fn);
		return [link, fn];
	});
	apply("book");

	return () => {
		clearTimeout(timer);
		for (const [l, f] of handlers) l.removeEventListener("click", f);
	};
}

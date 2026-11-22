// 123 — Achievements: quiet listeners unlock toasts; a trophy drawer (key A) lists them. UI loads on first unlock/open.
const STORE = "achievements-unlocked";
const LINKS = ".site-link, .site-nav-link, .site-logo";
const DEFS = [
	{ id: "bottom", icon: "🏁", title: "Read to the bottom", desc: "Scroll all the way to the footer." },
	{ id: "links", icon: "🔗", title: "Hovered every link", desc: "Point at every link on the page." },
	{ id: "hi", icon: "👋", title: "Said hi", desc: "Hover over Josh’s portrait." },
	{ id: "dark", icon: "🌙", title: "Switched sides", desc: "Flip between light and dark mode." },
	{ id: "sections", icon: "🧭", title: "Section hopper", desc: "Visit writing, projects and speaking." },
	{ id: "highlight", icon: "🖍️", title: "Highlighter", desc: "Select a sentence of text." },
	{ id: "tab", icon: "⌨️", title: "Keyboard navigator", desc: "Tab through five focusable things." },
	{ id: "click", icon: "👆", title: "Curious clicker", desc: "Click any link." },
	{ id: "linger", icon: "☕", title: "Lingerer", desc: "Spend 30 seconds on the page." },
];

export function activate({ root, reducedMotion }) {
	let unlocked = new Set();
	try {
		unlocked = new Set(JSON.parse(localStorage.getItem(STORE) || "[]"));
	} catch {}
	const seen = new Set();
	let tabs = 0;
	let ui = null;
	let uiLoading = null;
	const cleanups = [];
	const on = (target, type, fn, opts) => {
		target.addEventListener(type, fn, opts);
		cleanups.push(() => target.removeEventListener(type, fn, opts));
	};

	const chip = document.createElement("button");
	chip.className = "dl-chip";
	chip.type = "button";
	chip.setAttribute("aria-pressed", "false");
	chip.title = "Open the trophy drawer";
	chip.innerHTML = '<span aria-hidden="true">🏆</span><span class="ac-count"></span><kbd>A</kbd>';
	root.append(chip);
	const count = chip.querySelector(".ac-count");
	const refresh = () => (count.textContent = `${unlocked.size}/${DEFS.length}`);
	refresh();

	const loadUi = () =>
		(uiLoading ??= import("./achievements/ui.js").then((m) => {
			ui = m.create({
				root,
				defs: DEFS,
				reducedMotion,
				getUnlocked: () => unlocked,
				getProgress: () => ({ links: [seen.size, linkTotal()] }),
				onReset: () => {
					unlocked.clear();
					seen.clear();
					tabs = 0;
					localStorage.removeItem(STORE);
					refresh();
				},
				onToggle: (open) => chip.setAttribute("aria-pressed", String(open)),
			});
			return ui;
		}));

	const unlock = async (id) => {
		if (unlocked.has(id)) return;
		unlocked.add(id);
		localStorage.setItem(STORE, JSON.stringify([...unlocked]));
		refresh();
		const u = await loadUi();
		u.toast(DEFS.find((d) => d.id === id));
		u.refresh();
	};
	const linkTotal = () => root.querySelectorAll(LINKS).length;

	on(root, "pointerover", (e) => {
		const link = e.target.closest?.(LINKS);
		if (link && !unlocked.has("links")) {
			seen.add(link);
			ui?.refresh();
			if (seen.size >= linkTotal()) unlock("links");
		}
		if (e.target.closest?.(".site-portrait")) unlock("hi");
	});
	on(root, "click", (e) => {
		if (e.target.closest?.(LINKS)) unlock("click");
	});
	on(root, "scroll", () => {
		if (root.scrollTop + root.clientHeight >= root.scrollHeight - 8) unlock("bottom");
	}, { passive: true });
	on(document, "keydown", (e) => {
		const t = e.target;
		if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
		if (e.key === "Tab" && ++tabs >= 5) unlock("tab");
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key === "a" || e.key === "A") {
			e.preventDefault();
			loadUi().then((u) => u.toggle());
		}
	});
	let selTimer = 0;
	on(document, "selectionchange", () => {
		clearTimeout(selTimer);
		selTimer = setTimeout(() => {
			if ((getSelection()?.toString().trim().length ?? 0) >= 24) unlock("highlight");
		}, 400);
	});
	const mo = new MutationObserver(() => unlock("dark"));
	mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
	cleanups.push(() => mo.disconnect());

	const sectionsSeen = new Set();
	const io = new IntersectionObserver(
		(entries) => {
			for (const en of entries) {
				if (!en.isIntersecting) continue;
				sectionsSeen.add(en.target);
				io.unobserve(en.target);
			}
			if (sectionsSeen.size >= 3) unlock("sections");
		},
		{ root, threshold: 0.5 },
	);
	for (const s of root.querySelectorAll(".site-posts, .site-projects, .site-talks")) io.observe(s);
	cleanups.push(() => io.disconnect());
	const linger = setTimeout(() => unlock("linger"), 30000);
	cleanups.push(() => clearTimeout(linger), () => clearTimeout(selTimer));

	chip.addEventListener("click", () => loadUi().then((u) => u.toggle()));
	return () => {
		for (const c of cleanups) c();
		ui?.destroy();
	};
}

import { el, formatMs, state, subscribe } from "./_perf/kit.js";

// Re-lays out the whole page between three densities using cross-element View Transitions.
// Every meaningful element gets its own view-transition-name, so the browser morphs each box from its
// old rect to its new one. While a transition runs we sample real rAF frame deltas, the number of long
// tasks (PerformanceObserver) and the layout-shift score, and report them honestly in the readout.

const LAYOUTS = [
	{ id: "compact", label: "Compact", key: "1" },
	{ id: "cozy", label: "Cozy", key: "2" },
	{ id: "spread", label: "Spread", key: "3" },
];

export function activate({ root, reducedMotion }) {
	const targets = root.querySelectorAll(
		".site-logo, .site-theme-toggle, .site-nav, .site-portrait, .site-title, .site-tagline, .site-socials, .site-about p, .site-section-title, .site-item, .site-footer",
	);
	targets.forEach((node, i) => {
		node.style.viewTransitionName = `ms-${i}`;
	});

	root.dataset.layout = "cozy";

	const buttons = LAYOUTS.map((layout) =>
		el("button", { class: "ms-option", type: "button", "data-layout": layout.id, "aria-pressed": String(layout.id === "cozy") }, layout.label, el("kbd", { text: layout.key })),
	);
	const readout = el("span", { class: "ms-readout", text: "Pick a layout. The morph is measured live." });
	const bar = el("div", { class: "ms-bar", role: "group", "aria-label": "Page layout" }, ...buttons, readout);
	root.append(bar);

	let busy = false;

	function apply(id) {
		root.dataset.layout = id;
		for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.layout === id));
	}

	function setLayout(id) {
		if (id === root.dataset.layout || busy) return;
		if (reducedMotion || !document.startViewTransition) {
			apply(id);
			readout.textContent = reducedMotion ? "Reduced motion: layout switched instantly, no transition." : "View Transitions unsupported here: switched instantly.";
			return;
		}
		busy = true;
		const longBefore = state.longTasks.length;
		const clsBefore = state.cls;
		const deltas = [];
		let last = 0;
		let sampling = true;
		const sample = (now) => {
			if (last) deltas.push(now - last);
			last = now;
			if (sampling) requestAnimationFrame(sample);
		};
		const start = performance.now();
		const transition = document.startViewTransition(() => apply(id));
		requestAnimationFrame(sample);
		let readyAt = 0;
		transition.ready.then(() => {
			readyAt = performance.now() - start;
		}, () => {});
		transition.finished.finally(() => {
			sampling = false;
			busy = false;
			const worst = deltas.length ? Math.max(...deltas) : 0;
			const total = performance.now() - start;
			// Long tasks surface asynchronously; give the observer a beat.
			setTimeout(() => {
				readout.textContent = `${id}: DOM update + first frame ${formatMs(readyAt)} · whole morph ${formatMs(total)} · worst frame ${formatMs(worst)} · long tasks ${state.longTasks.length - longBefore} · CLS +${(state.cls - clsBefore).toFixed(3)}`;
			}, 120);
		});
	}

	const onClick = (event) => {
		const button = event.target.closest?.(".ms-option");
		if (button && bar.contains(button)) setLayout(button.dataset.layout);
	};
	const onKey = (event) => {
		if (event.metaKey || event.ctrlKey || event.altKey) return;
		const tag = event.target?.tagName;
		if (tag === "INPUT" || tag === "TEXTAREA" || event.target?.isContentEditable) return;
		const layout = LAYOUTS.find((item) => item.key === event.key);
		if (layout) {
			event.preventDefault();
			setLayout(layout.id);
		}
	};
	bar.addEventListener("click", onClick);
	document.addEventListener("keydown", onKey);
	const unsubscribe = subscribe(() => {});

	return () => {
		unsubscribe();
		document.removeEventListener("keydown", onKey);
		bar.removeEventListener("click", onClick);
	};
}

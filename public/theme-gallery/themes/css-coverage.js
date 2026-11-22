import { el } from "./_perf/kit.js";

// CSS coverage, rule by rule, measured from the live CSSOM:
//  - walks document.styleSheets (including @media / @supports / @layer / @container groups and @import'ed sheets),
//  - tests each style rule's selector against the live DOM (pseudo-elements and :hover/:focus/:active are
//    stripped so `a:hover` counts as "used" if an `a` exists),
//  - an element's "heat" is how many rules match it.
// It is OPT-IN: nothing is computed until you press the button, and work is time-sliced (<= ~8 ms per slice).
// Cross-origin sheets (Google Fonts CSS) cannot be read and are reported as opaque, not guessed.

const STRIP = /::?(?:hover|focus|focus-visible|focus-within|active|visited|target|before|after|placeholder|selection|first-line|first-letter|marker|backdrop|-webkit-[\w-]+|-moz-[\w-]+|view-transition[\w-]*(?:\([^)]*\))?|scrollbar[\w-]*)(?:\([^)]*\))?/g;

function sheetName(sheet) {
	if (!sheet.href) return "inline <style>";
	try {
		const url = new URL(sheet.href);
		return url.origin === location.origin ? url.pathname.replace(/^\//, "").replace(/\?.*/, "") : url.host + url.pathname.slice(0, 18);
	} catch {
		return sheet.href;
	}
}

export function activate({ root }) {
	const page = root.querySelector(".site-page");
	const toggle = el("button", { class: "cg-toggle", type: "button", "aria-pressed": "false" }, "Show CSS coverage");
	const status = el("div", { class: "cg-status", text: "Off. Nothing has been computed." });
	const sheets = el("div", { class: "cg-sheets" });
	const detail = el("div", { class: "cg-detail", text: "" });
	const card = el("div", { class: "cg-card" }, el("div", { class: "cg-title", text: "CSS coverage glow" }), toggle, status, sheets, detail);
	root.append(card);

	let on = false;
	let job = 0;
	let hovered;
	const marked = [];
	const matches = new WeakMap(); // element -> selector[]
	let pointerHandler;

	function collect() {
		const result = []; // { sheet name, rule, active }
		const opaque = [];
		function walk(rules, name, active) {
			for (const rule of rules) {
				if (rule.type === CSSRule.STYLE_RULE) {
					result.push({ name, rule, active });
				} else if (rule.type === CSSRule.IMPORT_RULE) {
					try {
						walk(rule.styleSheet.cssRules, sheetName(rule.styleSheet), active);
					} catch {
						opaque.push(rule.href);
					}
				} else if (rule.cssRules && rule.type !== CSSRule.KEYFRAMES_RULE) {
					let inner = active;
					if (rule.type === CSSRule.MEDIA_RULE) inner = active && matchMedia(rule.media.mediaText).matches;
					else if (rule.constructor.name === "CSSSupportsRule") inner = active && CSS.supports(rule.conditionText);
					walk(rule.cssRules, name, inner);
				}
			}
		}
		for (const sheet of document.styleSheets) {
			try {
				walk(sheet.cssRules, sheetName(sheet), true);
			} catch {
				opaque.push(sheet.href ?? "inline");
			}
		}
		return { result, opaque };
	}

	function test(selector) {
		const cleaned = selector.replace(STRIP, "").replace(/(^|[\s>+~,(])\s*(?=[\s>+~,)]|$)/g, "$1*").trim();
		try {
			return [...document.querySelectorAll(cleaned || "*")];
		} catch {
			return undefined; // selector the engine will not run through querySelectorAll: unknown, not counted
		}
	}

	function run() {
		const myJob = ++job;
		status.textContent = "Walking the CSSOM...";
		const { result, opaque } = collect();
		const stats = new Map();
		const counts = new Map();
		let index = 0;
		let unknown = 0;

		function slice() {
			if (myJob !== job) return;
			const end = performance.now() + 8;
			while (index < result.length && performance.now() < end) {
				const { name, rule, active } = result[index++];
				const stat = stats.get(name) ?? stats.set(name, { name, total: 0, used: 0, inactive: 0 }).get(name);
				if (!active) {
					stat.inactive++;
					continue;
				}
				const found = test(rule.selectorText);
				if (!found) {
					unknown++;
					continue;
				}
				stat.total++;
				if (found.length) {
					stat.used++;
					for (const node of found) {
						if (!page.contains(node)) continue;
						counts.set(node, (counts.get(node) ?? 0) + 1);
						(matches.get(node) ?? matches.set(node, []).get(node)).push(rule.selectorText.length > 48 ? `${rule.selectorText.slice(0, 45)}...` : rule.selectorText);
					}
				}
			}
			status.textContent = `Testing rules ${Math.min(index, result.length)} / ${result.length}`;
			if (index < result.length) {
				setTimeout(slice, 0);
			} else {
				finish(stats, counts, opaque, unknown);
			}
		}
		slice();
	}

	function finish(stats, counts, opaque, unknown) {
		// Heat is the element's rank among styled elements (percentile), so the colour range is actually used.
		const vw = innerWidth * innerHeight;
		const ranked = [...counts].filter(([node]) => {
			const box = node.getBoundingClientRect();
			return box.width * box.height < vw * 0.35; // skip page-sized wrappers: their glow would just be a frame
		}).sort((a, b) => a[1] - b[1]);
		ranked.forEach(([node, count], i) => {
			node.style.setProperty("--heat", (ranked.length > 1 ? i / (ranked.length - 1) : 1).toFixed(3));
			node.dataset.heat = String(count);
			marked.push(node);
		});
		root.dataset.coverage = "on";
		const all = [...stats.values()];
		const total = all.reduce((a, b) => a + b.total, 0);
		const used = all.reduce((a, b) => a + b.used, 0);
		status.textContent = `${used} of ${total} rules match something on this page (${Math.round((used / Math.max(1, total)) * 100)}%). ${total - used} match nothing right now.`;
		sheets.replaceChildren(
			...all
				.filter((stat) => stat.total)
				.map((stat) => {
					const bar = el("i", { style: `--used:${(stat.used / stat.total) * 100}%` });
					return el("div", { class: "cg-sheet" }, el("span", { text: stat.name }), bar, el("b", { text: `${stat.used}/${stat.total}` }));
				}),
			...(opaque.length ? [el("div", { class: "cg-opaque", text: `${opaque.length} cross-origin sheet${opaque.length === 1 ? "" : "s"} unreadable (opaque)` })] : []),
		);
		detail.textContent = "Hover the page: hotter glow = more rules style that element.";
		pointerHandler = (event) => {
			const node = event.target?.closest?.("[data-heat]");
			if (node === hovered) return;
			hovered = node;
			detail.textContent = node
				? `${node.dataset.heat} rules match <${node.localName}.${[...node.classList].slice(0, 2).join(".")}>: ${[...new Set(matches.get(node) ?? [])].slice(0, 6).join("  ")}`
				: "Hover the page: hotter glow = more rules style that element.";
		};
		window.addEventListener("pointermove", pointerHandler, { passive: true });
	}

	function clear() {
		job++;
		delete root.dataset.coverage;
		for (const node of marked) {
			node.style.removeProperty("--heat");
			delete node.dataset.heat;
		}
		marked.length = 0;
		if (pointerHandler) window.removeEventListener("pointermove", pointerHandler);
		pointerHandler = undefined;
		hovered = undefined;
		sheets.replaceChildren();
		detail.textContent = "";
		status.textContent = "Off. Nothing has been computed.";
	}

	toggle.addEventListener("click", () => {
		on = !on;
		toggle.setAttribute("aria-pressed", String(on));
		toggle.textContent = on ? "Hide CSS coverage" : "Show CSS coverage";
		if (on) run();
		else clear();
	});

	return () => {
		job++;
		if (pointerHandler) window.removeEventListener("pointermove", pointerHandler);
	};
}

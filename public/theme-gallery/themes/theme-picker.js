const STORAGE_KEY = "dotcom-theme-picker";

// Each palette has light + dark token sets. Contrast (checked with a script while
// authoring): fg/bg >= 7:1, muted/bg and accent/bg >= 4.5:1.
export const palettes = [
	{
		id: "strict", name: "Strict Mode", note: "No implicit anys. No surprises.",
		light: { bg: "#fdffff", fg: "#283556", strong: "#142842", muted: "#4f5f80", accent: "#0b5fb8", squiggle: "#00a3ff", subtle: "#d7e9ef" },
		dark: { bg: "#0b1220", fg: "#dae7f3", strong: "#f1f6fb", muted: "#93a5bf", accent: "#77bbff", squiggle: "#00a3ff", subtle: "#102a40" },
	},
	{
		id: "any", name: "Any (chaotic)", note: "Everything is permitted. Nothing is checked.",
		light: { bg: "#fff6dc", fg: "#2a1747", strong: "#1a0b33", muted: "#62408a", accent: "#c4006c", squiggle: "#00b3a4", subtle: "#ffe08a" },
		dark: { bg: "#1b0f31", fg: "#f6e9ff", strong: "#ffffff", muted: "#c9a9ee", accent: "#ff6ad5", squiggle: "#5cf2d6", subtle: "#3b2166" },
	},
	{
		id: "nightly", name: "Nightly", note: "Built from main. May contain moonlight.",
		light: { bg: "#f2f3fb", fg: "#22274a", strong: "#12163a", muted: "#555b85", accent: "#4046c8", squiggle: "#7b82ff", subtle: "#dcdff5" },
		dark: { bg: "#070914", fg: "#d2d6f6", strong: "#f2f3ff", muted: "#9aa0d0", accent: "#9ba2ff", squiggle: "#6f78ff", subtle: "#171b3a" },
	},
	{
		id: "declaration", name: "Declaration File", note: "All types, no runtime. Pure ink.",
		light: { bg: "#f5f5f2", fg: "#262626", strong: "#0d0d0d", muted: "#5a5a55", accent: "#0b6b58", squiggle: "#2fa68a", subtle: "#deded8" },
		dark: { bg: "#131313", fg: "#d8d8d2", strong: "#f5f5ef", muted: "#a2a29a", accent: "#7ad3ba", squiggle: "#4cb89c", subtle: "#262624" },
	},
	{
		id: "legacy", name: "Legacy JS", note: "var everywhere. It still works, somehow.",
		light: { bg: "#fff9d4", fg: "#2d2700", strong: "#1a1600", muted: "#67590a", accent: "#8c5a00", squiggle: "#e6b800", subtle: "#f4e684" },
		dark: { bg: "#17140a", fg: "#f6ecb0", strong: "#fff8cc", muted: "#cdbf72", accent: "#f7df1e", squiggle: "#f7df1e", subtle: "#383010" },
	},
	{
		id: "never", name: "Never", note: "This theme should be unreachable.",
		light: { bg: "#ffffff", fg: "#1a1a1a", strong: "#000000", muted: "#555555", accent: "#000000", squiggle: "#000000", subtle: "#e6e6e6" },
		dark: { bg: "#000000", fg: "#e6e6e6", strong: "#ffffff", muted: "#a6a6a6", accent: "#ffffff", squiggle: "#ffffff", subtle: "#222222" },
	},
	{
		id: "unknown", name: "Unknown (narrow me)", note: "Prove what you are with a typeof check.",
		light: { bg: "#eef6f1", fg: "#16332a", strong: "#0a2018", muted: "#466559", accent: "#086a52", squiggle: "#34b58e", subtle: "#cfe5da" },
		dark: { bg: "#0a1512", fg: "#d3ebe0", strong: "#effaf5", muted: "#93b8a8", accent: "#63dcb3", squiggle: "#34b58e", subtle: "#16302a" },
	},
];

const TOKEN_MAP = {
	bg: "--siteBg", fg: "--siteFg", strong: "--siteFgStrong", muted: "--siteMuted",
	accent: "--siteAccent", squiggle: "--siteSquiggle", subtle: "--siteSubtle",
};

export function activate({ root, mode }) {
	const tokens = (p) => p[mode];
	const apply = (p) => {
		for (const [key, prop] of Object.entries(TOKEN_MAP)) root.style.setProperty(prop, tokens(p)[key]);
	};
	const byId = (id) => palettes.find((p) => p.id === id);
	let committed = byId(localStorage.getItem(STORAGE_KEY)) ?? palettes[0];
	apply(committed);

	const header = root.querySelector(".site-header");
	const button = document.createElement("button");
	button.className = "tp-button";
	button.type = "button";
	button.setAttribute("aria-haspopup", "dialog");
	button.innerHTML = `<span aria-hidden="true">\u{1F3A8}</span> Theme <kbd>P</kbd>`;
	header.append(button);

	const modal = document.createElement("div");
	modal.className = "tp-modal";
	modal.hidden = true;
	modal.innerHTML = `<div class="tp-backdrop"></div>
		<div class="tp-panel" role="dialog" aria-modal="true" aria-label="Select color theme">
			<div class="tp-head">
				<span class="tp-prompt">&gt;</span>
				<input class="tp-input" type="text" placeholder="Select Color Theme" aria-label="Filter palettes" autocomplete="off" spellcheck="false" />
				<span class="tp-mode"></span>
			</div>
			<ul class="tp-list" role="listbox"></ul>
			<div class="tp-foot"><span><kbd>↑</kbd><kbd>↓</kbd> preview</span><span><kbd>↵</kbd> apply</span><span><kbd>esc</kbd> revert</span></div>
		</div>`;
	root.append(modal);
	const input = modal.querySelector(".tp-input");
	const list = modal.querySelector(".tp-list");
	modal.querySelector(".tp-mode").textContent = mode === "dark" ? "dark" : "light";

	let open = false;
	let matches = palettes;
	let index = 0;

	const render = () => {
		list.innerHTML = "";
		matches.forEach((p, i) => {
			const t = tokens(p);
			const li = document.createElement("li");
			li.setAttribute("role", "option");
			li.className = "tp-item" + (i === index ? " is-selected" : "");
			li.setAttribute("aria-selected", String(i === index));
			li.innerHTML = `<span class="tp-swatch" style="background:${t.bg}">
					<i style="background:${t.fg}"></i><i style="background:${t.accent}"></i><i style="background:${t.squiggle}"></i><i style="background:${t.subtle}"></i></span>
				<span class="tp-text"><b>${p.name}</b><small>${p.note}</small></span>
				<span class="tp-check">${p === committed ? "✓ applied" : ""}</span>`;
			li.addEventListener("mousemove", () => { if (index !== i) { index = i; select(); } });
			li.addEventListener("click", () => { index = i; commit(); });
			list.append(li);
		});
	};
	const select = () => {
		[...list.children].forEach((li, i) => {
			li.classList.toggle("is-selected", i === index);
			li.setAttribute("aria-selected", String(i === index));
		});
		list.children[index]?.scrollIntoView({ block: "nearest" });
		if (matches[index]) apply(matches[index]);
	};
	const filter = () => {
		const q = input.value.trim().toLowerCase();
		matches = palettes.filter((p) => p.name.toLowerCase().includes(q) || p.note.toLowerCase().includes(q));
		index = Math.min(index, Math.max(0, matches.length - 1));
		render();
		apply(matches[index] ?? committed);
	};
	const show = () => {
		open = true;
		modal.hidden = false;
		input.value = "";
		matches = palettes;
		index = Math.max(0, palettes.indexOf(committed));
		render();
		input.focus();
	};
	const hide = () => {
		open = false;
		modal.hidden = true;
		button.focus({ preventScroll: true });
	};
	const commit = () => {
		if (matches[index]) {
			committed = matches[index];
			localStorage.setItem(STORAGE_KEY, committed.id);
		}
		apply(committed);
		hide();
	};
	const revert = () => { apply(committed); hide(); };

	button.addEventListener("click", () => (open ? revert() : show()));
	modal.querySelector(".tp-backdrop").addEventListener("click", revert);
	input.addEventListener("input", filter);

	// Capture phase on document so we run before the gallery's window listener.
	const onKey = (e) => {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (!open) {
			const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
			if ((e.key === "p" || e.key === "P") && !typing) {
				e.preventDefault();
				show();
			}
			return;
		}
		switch (e.key) {
			case "ArrowDown": e.preventDefault(); if (matches.length) { index = (index + 1) % matches.length; select(); } break;
			case "ArrowUp": e.preventDefault(); if (matches.length) { index = (index - 1 + matches.length) % matches.length; select(); } break;
			case "Enter": e.preventDefault(); commit(); break;
			case "Escape": e.preventDefault(); revert(); break;
			case "Tab": e.preventDefault(); break;
			default:
				// typing goes to the filter input; block the gallery's shortcuts elsewhere
				if (e.target !== input) e.preventDefault();
		}
	};
	document.addEventListener("keydown", onKey, true);

	return () => {
		for (const prop of Object.values(TOKEN_MAP)) root.style.removeProperty(prop);
		document.removeEventListener("keydown", onKey, true);
	};
}
